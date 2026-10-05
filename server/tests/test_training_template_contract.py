from __future__ import annotations

import copy
import json
import unittest
from collections import defaultdict
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker

from app.models.base import Base
from app.models.analysis_report import AnalysisReport
from app.models.training_session import TrainingSession
from app.models.enums import AnalysisType, UserRole
from app.models.template_example_video import TemplateExampleVideo
from app.models.training_template import TrainingTemplate
from app.models.training_template_version import TrainingTemplateVersion
from app.schemas.report import SaveReportRequest
from app.schemas.admin import AdminUpdateTrainingTemplateVersionRequest
from app.schemas.training import UploadInitRequest
from app.services.admin_service import AdminService
from app.services.report_service import ReportService
from app.services.training_service import TrainingService
from app.services.template_service import TemplateService
from app.api.v1 import admin as admin_api


@compiles(JSONB, "sqlite")
def _compile_jsonb_for_sqlite(_type, _compiler, **_kwargs) -> str:
    return "JSON"


_id_counters: defaultdict[str, int] = defaultdict(int)


def _assign_sqlite_bigint_id(_mapper, _connection, target) -> None:
    if _connection.dialect.name != "sqlite":
        return
    if getattr(target, "id", None) is not None:
        return
    table_name = target.__tablename__
    _id_counters[table_name] += 1
    target.id = 5000 + _id_counters[table_name]


for _model in (TrainingTemplate, TrainingTemplateVersion):
    event.listen(_model, "before_insert", _assign_sqlite_bigint_id)


class _SingleScalarDb:
    def __init__(self, value: object) -> None:
        self.value = value

    def scalar(self, _statement):
        return self.value


class _UploadDb:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.scalar_calls = 0

    def add(self, value: object) -> None:
        self.added.append(value)

    def flush(self) -> None:
        value = self.added[-1]
        if getattr(value, "id", None) is None:
            value.id = len(self.added)  # type: ignore[attr-defined]
        if getattr(value, "public_id", None) is None:
            value.public_id = uuid4()  # type: ignore[attr-defined]

    def commit(self) -> None:
        self.flush()

    def refresh(self, _value: object) -> None:
        return None

    def scalar(self, _statement):
        self.scalar_calls += 1
        raise AssertionError("Free shooting upload should not query the Training template catalog.")


class TrainingTemplateContractTests(unittest.TestCase):
    def test_local_training_templates_follow_versioned_contract(self) -> None:
        service = AdminService(SimpleNamespace())  # type: ignore[arg-type]

        payloads = service._load_local_template_payloads()  # noqa: SLF001
        training_payloads = [
            payload
            for payload in payloads
            if payload["analysis_type"] == AnalysisType.training
        ]

        self.assertEqual(len(training_payloads), 10)
        self.assertEqual(sum(payload["version"] == "v1" for payload in training_payloads), 5)
        self.assertEqual(sum(payload["version"] == "v2" for payload in training_payloads), 5)
        self.assertTrue(all(payload["content_hash"] for payload in training_payloads))

    def test_local_training_template_rejects_forbidden_metric(self) -> None:
        repository_root = Path(__file__).resolve().parents[2]
        template_path = (
            repository_root
            / "web"
            / "src"
            / "config"
            / "templates"
            / "training"
            / "jumping_jack_reps_front.json"
        )
        raw_template = json.loads(template_path.read_text(encoding="utf-8"))
        invalid_template = copy.deepcopy(raw_template)
        invalid_template["metrics"][0]["computeKey"] = "repCount"
        service = AdminService(SimpleNamespace())  # type: ignore[arg-type]

        with self.assertRaises(HTTPException) as context:
            service._validate_local_training_template(  # noqa: SLF001
                invalid_template,
                template_path,
            )

        self.assertEqual(context.exception.status_code, 500)
        self.assertIn("forbidden computeKey", str(context.exception.detail))

    def test_upload_resolves_active_template_version_and_hash(self) -> None:
        version = SimpleNamespace(
            public_id=uuid4(),
            version="v1",
            status="active",
            is_default=True,
            summary_template={"content_hash": "abc123"},
        )
        template = SimpleNamespace(
            public_id=uuid4(),
            template_code="jumping_jack_reps_front",
            analysis_type=AnalysisType.training,
            status="active",
            current_version="v1",
            versions=[version],
        )
        payload = UploadInitRequest(
            analysis_type=AnalysisType.training,
            file_name="jumping-jack.mp4",
            content_type="video/mp4",
            file_size=1024,
            template_code="jumping_jack_reps_front",
            template_version="v1",
        )
        service = TrainingService(_SingleScalarDb(template))  # type: ignore[arg-type]

        resolved_template, resolved_version, content_hash = service._resolve_template_context(  # noqa: SLF001
            payload,
            None,
        )

        self.assertIs(resolved_template, template)
        self.assertIs(resolved_version, version)
        self.assertEqual(content_hash, "abc123")

    def test_upload_rejects_template_change_for_assigned_task(self) -> None:
        payload = UploadInitRequest(
            analysis_type=AnalysisType.training,
            file_name="exercise.mp4",
            content_type="video/mp4",
            file_size=1024,
            template_code="pushup_reps_side",
            template_version="v1",
        )
        assignment = SimpleNamespace(
            task=SimpleNamespace(
                analysis_type=AnalysisType.training,
                template_code="lunge_same_side_reps_side",
            )
        )
        service = TrainingService(_SingleScalarDb(None))  # type: ignore[arg-type]

        with self.assertRaises(HTTPException) as context:
            service._resolve_template_context(payload, assignment)  # noqa: SLF001

        self.assertEqual(context.exception.status_code, 409)
        self.assertIn("assigned training task", str(context.exception.detail))

    def test_free_shooting_upload_keeps_legacy_template_flow(self) -> None:
        payload = UploadInitRequest(
            analysis_type=AnalysisType.shooting,
            file_name="shot.mp4",
            content_type="video/mp4",
            file_size=1024,
            template_code="shoot_front_form_close",
            template_version="v1",
        )
        current_user = SimpleNamespace(
            id=1,
            public_id=uuid4(),
            role=UserRole.student,
        )
        db = _UploadDb()
        service = TrainingService(db)  # type: ignore[arg-type]

        response = service.init_upload(current_user, payload)  # type: ignore[arg-type]

        self.assertEqual(db.scalar_calls, 0)
        self.assertEqual(response.template_code, payload.template_code)
        self.assertEqual(response.template_version, payload.template_version)

    def test_report_rejects_template_different_from_upload_session(self) -> None:
        session = SimpleNamespace(
            analysis_type=AnalysisType.training,
            template_code="jumping_jack_reps_front",
            template_version="v1",
            video=object(),
        )
        payload = SaveReportRequest(
            session_public_id=uuid4(),
            template_code="pushup_reps_side",
            template_version="v1",
            score_data={},
        )
        current_user = SimpleNamespace(id=1, role=UserRole.student)
        service = ReportService(_SingleScalarDb(session))  # type: ignore[arg-type]

        with self.assertRaises(HTTPException) as context:
            service.save_report(current_user, payload)  # type: ignore[arg-type]

        self.assertEqual(context.exception.status_code, 409)
        self.assertIn("uploaded training session", str(context.exception.detail))


class TrainingTemplateSyncTests(unittest.TestCase):
    def setUp(self) -> None:
        engine = create_engine("sqlite:///:memory:", future=True)
        Base.metadata.create_all(
            engine,
            tables=[
                TrainingTemplate.__table__,
                TrainingTemplateVersion.__table__,
                TemplateExampleVideo.__table__,
                TrainingSession.__table__,
                AnalysisReport.__table__,
            ],
        )
        self.session_factory = sessionmaker(bind=engine, class_=Session, future=True)
        self.db = self.session_factory()
        self.admin = SimpleNamespace(id=1, role=UserRole.admin)

    def tearDown(self) -> None:
        self.db.close()

    def test_local_sync_is_idempotent_and_public_catalog_only_returns_active_training(self) -> None:
        service = AdminService(self.db)

        first_dry_run = service.sync_local_training_templates(
            self.admin,  # type: ignore[arg-type]
            dry_run=True,
        )
        applied = service.sync_local_training_templates(
            self.admin,  # type: ignore[arg-type]
            dry_run=False,
        )
        second_dry_run = service.sync_local_training_templates(
            self.admin,  # type: ignore[arg-type]
            dry_run=True,
        )

        self.assertEqual(first_dry_run.created, len(first_dry_run.items))
        self.assertEqual(len(first_dry_run.items), 10)
        self.assertEqual(first_dry_run.analysis_type, AnalysisType.training)
        self.assertEqual(applied.created, len(applied.items))
        self.assertEqual(second_dry_run.skipped, len(second_dry_run.items))

        catalog = TemplateService(self.db).list_templates(
            analysis_type=AnalysisType.training,
        )
        self.assertEqual(len(catalog), 10)
        self.assertTrue(all(item.analysis_type == AnalysisType.training for item in catalog))
        self.assertTrue(all(item.status == "active" for item in catalog))
        self.assertTrue(
            all(
                version.status == "active"
                for item in catalog
                for version in item.versions
            )
        )

    def test_sync_filters_codes_and_does_not_touch_other_modes(self) -> None:
        service = AdminService(self.db)
        result = service.sync_local_training_templates(
            self.admin, dry_run=False, template_codes=["pushup_reps_side"],
        )
        self.assertEqual([item.template_code for item in result.items], ["pushup_reps_side"])
        shooting = service.sync_local_training_templates(
            self.admin, dry_run=True, analysis_type=AnalysisType.shooting,
        )
        self.assertEqual(len(shooting.items), 2)
        self.assertEqual(self.db.scalar(select(func.count()).select_from(TrainingTemplate)), 1)
        with self.assertRaises(HTTPException) as context:
            service.sync_local_training_templates(self.admin, template_codes=["shoot_front_form_close"])
        self.assertEqual(context.exception.status_code, 400)

    def test_apply_rejects_stale_preview_before_writes(self) -> None:
        service = AdminService(self.db)
        preview = service.sync_local_training_templates(self.admin, template_codes=["pushup_reps_side"])
        self.assertTrue(preview.preview_token)
        with self.assertRaises(HTTPException) as context:
            service.sync_local_training_templates(
                self.admin, dry_run=False, preview_token=preview.preview_token,
            )
        self.assertEqual(context.exception.status_code, 409)
        self.assertEqual(self.db.scalar(select(func.count()).select_from(TrainingTemplate)), 0)
        service.sync_local_training_templates(
            self.admin, dry_run=False, template_codes=["pushup_reps_side"], preview_token=preview.preview_token,
        )
        self.assertEqual(self.db.scalar(select(func.count()).select_from(TrainingTemplate)), 1)

    def test_api_requires_preview_before_apply(self) -> None:
        with self.assertRaises(HTTPException) as context:
            admin_api.sync_local_training_templates(
                dry_run=False, analysis_type=AnalysisType.training, template_codes=None,
                preview_token=None, current_user=self.admin, db=self.db,
            )
        self.assertEqual(context.exception.status_code, 400)
        preview = admin_api.sync_local_training_templates(
            dry_run=True, analysis_type=AnalysisType.training, template_codes=["pushup_reps_side"],
            preview_token=None, current_user=self.admin, db=self.db,
        )
        applied = admin_api.sync_local_training_templates(
            dry_run=False, analysis_type=AnalysisType.training, template_codes=["pushup_reps_side"],
            preview_token=preview.preview_token, current_user=self.admin, db=self.db,
        )
        self.assertEqual(applied.created, 1)

    def test_conflicting_published_rules_block_entire_batch_even_if_hash_is_unchanged(self) -> None:
        service = AdminService(self.db)
        service.sync_local_training_templates(self.admin, dry_run=False, template_codes=["pushup_reps_side"])
        version = self.db.scalar(select(TrainingTemplateVersion))
        original_rules = copy.deepcopy(version.scoring_rules)
        payloads = service._load_local_template_payloads()
        changed = next(item for item in payloads if item["template_code"] == "pushup_reps_side")
        changed["scoring_rules"]["template"]["metrics"][0]["params"]["U"] = 0.99
        with patch.object(service, "_load_local_template_payloads", return_value=payloads):
            preview = service.sync_local_training_templates(self.admin)
            self.assertEqual(preview.blocked, 1)
            self.assertEqual(preview.created, 9)
            with self.assertRaises(HTTPException) as context:
                service.sync_local_training_templates(self.admin, dry_run=False)
        self.assertEqual(context.exception.status_code, 409)
        self.assertEqual(self.db.scalar(select(func.count()).select_from(TrainingTemplate)), 1)
        self.db.refresh(version)
        self.assertEqual(version.scoring_rules, original_rules)

    def test_new_version_preserves_old_published_rules(self) -> None:
        service = AdminService(self.db)
        code = "deep_squat_reps_side"
        service.sync_local_training_templates(self.admin, dry_run=False, template_codes=[code])
        template = self.db.scalar(select(TrainingTemplate))
        old = self.db.scalar(select(TrainingTemplateVersion))
        old.version = "v1"
        rules = copy.deepcopy(old.scoring_rules)
        rules["template"]["version"] = "v1"
        rules["template"]["metrics"][0]["params"]["U"] = 99
        old.scoring_rules = rules
        template.current_version = "v1"
        self.db.commit()
        original_rules = copy.deepcopy(old.scoring_rules)
        preview = service.sync_local_training_templates(self.admin, template_codes=[code])
        self.assertEqual(preview.new_versions, 1)
        applied = service.sync_local_training_templates(self.admin, dry_run=False, template_codes=[code])
        self.assertEqual(applied.new_versions, 1)
        self.db.refresh(old)
        self.db.refresh(template)
        self.assertEqual(old.scoring_rules, original_rules)
        self.assertFalse(old.is_default)
        self.assertEqual(template.current_version, "v2")
        self.assertEqual(self.db.scalar(select(func.count()).select_from(TrainingTemplateVersion)), 2)

    def test_manual_edit_cannot_bypass_published_version_lock(self) -> None:
        service = AdminService(self.db)
        service.sync_local_training_templates(self.admin, dry_run=False, template_codes=["pushup_reps_side"])
        template = self.db.scalar(select(TrainingTemplate))
        version = self.db.scalar(select(TrainingTemplateVersion))
        version.status = "archived"
        self.db.commit()
        with self.assertRaises(HTTPException) as context:
            service.update_training_template_version(
                self.admin, template.public_id, version.public_id,
                AdminUpdateTrainingTemplateVersionRequest(scoring_rules={"template": {}}),
            )
        self.assertEqual(context.exception.status_code, 409)

    def test_unpublished_draft_referenced_by_session_is_locked(self) -> None:
        service = AdminService(self.db)
        service.sync_local_training_templates(self.admin, dry_run=False, template_codes=["pushup_reps_side"])
        template = self.db.scalar(select(TrainingTemplate))
        version = self.db.scalar(select(TrainingTemplateVersion))
        version.status = "draft"
        version.published_at = None
        self.db.add(TrainingSession(
            id=88, student_id=1, analysis_type=AnalysisType.training,
            template_code=template.template_code, template_version=version.version,
        ))
        self.db.commit()
        with self.assertRaises(HTTPException) as context:
            service.update_training_template_version(
                self.admin, template.public_id, version.public_id,
                AdminUpdateTrainingTemplateVersionRequest(version="v9"),
            )
        self.assertEqual(context.exception.status_code, 409)

    def test_unreferenced_draft_can_be_updated_then_published(self) -> None:
        service = AdminService(self.db)
        service.sync_local_training_templates(self.admin, dry_run=False, template_codes=["pushup_reps_side"])
        version = self.db.scalar(select(TrainingTemplateVersion))
        version.status = "draft"
        version.published_at = None
        version.scoring_rules = {"unpublished": True}
        self.db.commit()
        preview = service.sync_local_training_templates(self.admin, template_codes=["pushup_reps_side"])
        self.assertEqual(preview.items[0].action, "draft_update")
        service.sync_local_training_templates(self.admin, dry_run=False, template_codes=["pushup_reps_side"])
        self.db.refresh(version)
        self.assertEqual(version.status, "active")
        self.assertIn("template", version.scoring_rules)

    def test_metadata_reactivation_does_not_rewrite_published_rules(self) -> None:
        service = AdminService(self.db)
        service.sync_local_training_templates(self.admin, dry_run=False, template_codes=["pushup_reps_side"])
        template = self.db.scalar(select(TrainingTemplate))
        version = self.db.scalar(select(TrainingTemplateVersion))
        rules = copy.deepcopy(version.scoring_rules)
        template.status = "inactive"
        self.db.commit()
        preview = service.sync_local_training_templates(self.admin, template_codes=["pushup_reps_side"])
        self.assertEqual(preview.items[0].action, "metadata_update")
        service.sync_local_training_templates(self.admin, dry_run=False, template_codes=["pushup_reps_side"])
        self.db.refresh(template)
        self.db.refresh(version)
        self.assertEqual(template.status, "active")
        self.assertEqual(version.scoring_rules, rules)


if __name__ == "__main__":
    unittest.main()
