from __future__ import annotations

import copy
import json
import unittest
from collections import defaultdict
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker

from app.models.base import Base
from app.models.enums import AnalysisType, UserRole
from app.models.template_example_video import TemplateExampleVideo
from app.models.training_template import TrainingTemplate
from app.models.training_template_version import TrainingTemplateVersion
from app.schemas.report import SaveReportRequest
from app.schemas.training import UploadInitRequest
from app.services.admin_service import AdminService
from app.services.report_service import ReportService
from app.services.training_service import TrainingService
from app.services.template_service import TemplateService


@compiles(JSONB, "sqlite")
def _compile_jsonb_for_sqlite(_type, _compiler, **_kwargs) -> str:
    return "JSON"


_id_counters: defaultdict[str, int] = defaultdict(int)


def _assign_sqlite_bigint_id(_mapper, _connection, target) -> None:
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
    def test_local_training_templates_follow_v1_contract(self) -> None:
        service = AdminService(SimpleNamespace())  # type: ignore[arg-type]

        payloads = service._load_local_template_payloads()  # noqa: SLF001
        training_payloads = [
            payload
            for payload in payloads
            if payload["analysis_type"] == AnalysisType.training
        ]

        self.assertEqual(len(training_payloads), 10)
        self.assertEqual({payload["version"] for payload in training_payloads}, {"v1"})
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


if __name__ == "__main__":
    unittest.main()
