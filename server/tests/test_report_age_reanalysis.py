"""Isolated persistence tests; never connect to the configured application database."""
from copy import deepcopy
import unittest
from uuid import uuid4
from datetime import datetime, timezone
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import BigInteger, create_engine, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

from app.models import AnalysisReport, ReportSnapshot, TrainingSession, User, Video
from app.models.training_template import TrainingTemplate
from app.models.training_template_version import TrainingTemplateVersion
from app.models.base import Base
from app.models.enums import AnalysisType, ReportStatus, UserRole
from app.schemas.report import ReanalyzeReportAgeRequest, SaveReportRequest
from app.services.report_service import ReportService, _original_reports_only


def score_result(score=80):
    return {
        "overall": score, "grade": "B", "analysisStatus": "ready",
        "weights": {"posture": .4, "execution": .4, "consistency": .2},
        "availability": {"posture": True, "execution": False, "consistency": False},
        "breakdown": {"posture": score, "execution": 0, "consistency": 0},
        "findings": [{"id": "P_test", "title": "Measured angle", "score": score,
                      "isPositive": True, "state": "good", "actualValue": "10 degrees",
                      "targetText": "Historical target", "hint": "Keep the position", "category": "posture"}],
    }


@compiles(JSONB, "sqlite")
def _sqlite_json(_type, _compiler, **_kwargs):
    return "JSON"


@compiles(BigInteger, "sqlite")
def _sqlite_integer(_type, _compiler, **_kwargs):
    return "INTEGER"


class ReportAgeReanalysisTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.user = User(username="age-fixture", password_hash="unused", phone_number="fixture", role=UserRole.student)
        self.db.add(self.user)
        self.db.flush()
        self.video = Video(user_id=self.user.id, bucket_name="fixture", object_key="clip", file_name="clip.mp4", content_type="video/mp4", file_size=100)
        self.db.add(self.video)
        self.db.flush()
        self.session = TrainingSession(student_id=self.user.id, video_id=self.video.id, analysis_type=AnalysisType.training,
                                       template_code="historical", template_version="v1", status="completed")
        self.db.add(self.session)
        self.db.flush()
        self.original = AnalysisReport(user_id=self.user.id, session_id=self.session.id, video_id=self.video.id,
            analysis_type=AnalysisType.training, template_id="historical", template_version="v1", status=ReportStatus.completed,
            overall_score=70, grade="C", score_data={
                "overall": 70, "grade": "C", "saved_metrics": [{"name": "measured", "value": 10}],
                "score_context": {"age_group": "16-18", "handedness": "left", "camera_match": False},
                "template_snapshot": {"templateId": "historical", "version": "v1", "mode": "training", "metrics": [{"metricId": "P_test"}]},
            }, timeline_data=[{"time": 1, "angles": [{"name": "measured", "value": 10}]}],
            summary_data={"age_group": "16-18", "capture_source": "auto_full_video"})
        self.db.add(self.original)
        self.db.commit()
        self.service = ReportService(self.db)
        self.payload = ReanalyzeReportAgeRequest(request_id=uuid4(), age_group="4-7", overall_score=80, grade="B", score_data={
            **score_result(), "template_snapshot": {"templateId": "forged"},
            "saved_metrics": [{"name": "forged", "value": 999}], "score_context": {"handedness": "forged"},
        })

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_creates_independent_report_preserving_source_and_training_session(self):
        original_data = deepcopy(self.original.score_data)
        original_timeline = deepcopy(self.original.timeline_data)
        original_summary = deepcopy(self.original.summary_data)
        saved = self.service.reanalyze_report_age(self.user, self.original.public_id, self.payload)
        self.db.expire_all()
        self.assertNotEqual(saved.public_id, self.original.public_id)
        self.assertEqual(self.original.score_data, original_data)
        self.assertEqual(self.original.timeline_data, original_timeline)
        self.assertEqual(self.original.summary_data, original_summary)
        self.assertEqual(float(self.original.overall_score), 70)
        self.assertEqual(saved.session_public_id, self.session.public_id)
        self.assertEqual(saved.video_public_id, self.video.public_id)
        self.assertEqual(saved.score_data["saved_metrics"], original_data["saved_metrics"])
        self.assertEqual(saved.template_snapshot, original_data["template_snapshot"])
        self.assertEqual(saved.timeline_data, original_timeline)
        self.assertEqual(saved.score_data["score_context"]["handedness"], "left")
        self.assertEqual(saved.score_data["score_context"]["age_group"], "4-7")
        self.assertEqual(saved.summary_data["age_group"], "4-7")
        self.assertEqual(self.db.scalar(select(func.count(TrainingSession.id))), 1)
        self.assertEqual(self.db.scalar(select(func.count(ReportSnapshot.id))), 1)
        self.assertTrue(saved.can_reanalyze_age)
        self.assertTrue(saved.is_age_comparison)
        self.assertFalse(self.service.get_report_detail(self.user, self.original.public_id).is_age_comparison)
        self.assertEqual(self.db.scalars(select(AnalysisReport).where(_original_reports_only())).all(), [self.original])

    def test_retry_is_idempotent_and_refresh_and_shared_view_preserve_age(self):
        first = self.service.reanalyze_report_age(self.user, self.original.public_id, self.payload)
        second = self.service.reanalyze_report_age(self.user, self.original.public_id, self.payload)
        self.assertEqual(first.public_id, second.public_id)
        self.assertEqual(first.model_dump(), second.model_dump())
        self.assertEqual(self.db.scalar(select(func.count(AnalysisReport.id))), 2)
        self.assertEqual(self.db.scalar(select(func.count(ReportSnapshot.id))), 1)
        self.assertEqual(self.service.get_report_detail(self.user, first.public_id).score_data["score_context"]["age_group"], "4-7")
        shared = self.service.get_shared_report_detail(first.public_id)
        self.assertFalse(shared.can_reanalyze_age)
        self.assertEqual(shared.score_data["score_context"]["age_group"], "4-7")

    def test_request_id_cannot_be_reused_for_another_age(self):
        self.service.reanalyze_report_age(self.user, self.original.public_id, self.payload)
        changed = self.payload.model_copy(update={"age_group": "7-10"})
        with self.assertRaises(HTTPException) as caught:
            self.service.reanalyze_report_age(self.user, self.original.public_id, changed)
        self.assertEqual(caught.exception.status_code, 409)

    def test_another_student_and_admin_cannot_modify_owner_report(self):
        for role in (UserRole.student, UserRole.admin):
            other = User(id=self.user.id + 1, role=role)
            with self.assertRaises(HTTPException) as caught:
                self.service.reanalyze_report_age(other, self.original.public_id, self.payload)
            self.assertEqual(caught.exception.status_code, 404)

    def test_missing_snapshot_or_metrics_blocks_save(self):
        for key in ("template_snapshot", "saved_metrics"):
            before = deepcopy(self.original.score_data)
            self.original.score_data = {k: v for k, v in before.items() if k != key}
            self.db.commit()
            with self.assertRaises(HTTPException) as caught:
                self.service.reanalyze_report_age(self.user, self.original.public_id, self.payload)
            self.assertEqual(caught.exception.status_code, 409)
            self.original.score_data = before
            self.db.commit()

    def test_mismatched_score_contract_is_rejected(self):
        for override in ({"overall": 99}, {"findings": [{"id": "wrong"}]}, {"analysisStatus": "insufficient_data"}):
            changed = self.payload.model_copy(update={"score_data": {**self.payload.score_data, **override}})
            with self.assertRaises(HTTPException) as caught:
                self.service.reanalyze_report_age(self.user, self.original.public_id, changed)
            self.assertEqual(caught.exception.status_code, 422)

    def test_non_training_report_is_rejected(self):
        self.original.analysis_type = AnalysisType.shooting
        self.db.commit()
        with self.assertRaises(HTTPException) as caught:
            self.service.reanalyze_report_age(self.user, self.original.public_id, self.payload)
        self.assertEqual(caught.exception.status_code, 403)

    def test_invalid_age_is_rejected_by_api_schema(self):
        with self.assertRaises(ValidationError):
            ReanalyzeReportAgeRequest(**{**self.payload.model_dump(), "age_group": "99-100"})

    def test_processing_failed_and_deleted_source_cannot_be_saved(self):
        for state in (ReportStatus.processing, ReportStatus.failed):
            self.original.status = state
            self.db.commit()
            self.assertFalse(self.service.get_report_detail(self.user, self.original.public_id).can_reanalyze_age)
            with self.assertRaises(HTTPException) as caught:
                self.service.reanalyze_report_age(self.user, self.original.public_id, self.payload)
            self.assertEqual(caught.exception.status_code, 409)
        self.original.status = ReportStatus.completed
        self.original.deleted_at = datetime.now(timezone.utc)
        self.db.commit()
        self.assertFalse(self.service.get_report_detail(self.user, self.original.public_id).can_reanalyze_age)
        with self.assertRaises(HTTPException) as caught:
            self.service.reanalyze_report_age(self.user, self.original.public_id, self.payload)
        self.assertEqual(caught.exception.status_code, 404)

    def test_owner_with_non_student_role_is_forbidden(self):
        for role in (UserRole.coach, UserRole.admin):
            self.user.role = role
            self.db.commit()
            self.assertFalse(self.service.get_report_detail(self.user, self.original.public_id).can_reanalyze_age)
            with self.assertRaises(HTTPException) as caught:
                self.service.reanalyze_report_age(self.user, self.original.public_id, self.payload)
            self.assertEqual(caught.exception.status_code, 403)

    def test_malformed_frozen_template_blocks_without_internal_error(self):
        before = deepcopy(self.original.score_data)
        for metrics in (None, {}, [], [None], [{}], [{"metricId": "P_test"}, {"metricId": "P_test"}]):
            changed = deepcopy(before)
            changed["template_snapshot"]["metrics"] = metrics
            self.original.score_data = changed
            self.db.commit()
            self.assertFalse(self.service.get_report_detail(self.user, self.original.public_id).can_reanalyze_age)
            with self.assertRaises(HTTPException) as caught:
                self.service.reanalyze_report_age(self.user, self.original.public_id, self.payload)
            self.assertEqual(caught.exception.status_code, 409)

    def test_legacy_detail_fallback_does_not_enable_reanalysis(self):
        template = TrainingTemplate(template_code="historical", name="Historical", analysis_type=AnalysisType.training,
                                    current_version="v2")
        self.db.add(template)
        self.db.flush()
        version = TrainingTemplateVersion(template_id=template.id, version="v1", scoring_rules={
            "template": deepcopy(self.original.score_data["template_snapshot"])})
        self.db.add(version)
        self.original.training_template_id = template.id
        self.original.score_data = {key: value for key, value in self.original.score_data.items() if key != "template_snapshot"}
        self.db.commit()
        detail = self.service.get_report_detail(self.user, self.original.public_id)
        self.assertIsNotNone(detail.template_snapshot)
        self.assertFalse(detail.can_reanalyze_age)
        with self.assertRaises(HTTPException) as caught:
            self.service.reanalyze_report_age(self.user, self.original.public_id, self.payload)
        self.assertEqual(caught.exception.status_code, 409)

    def test_nested_invalid_client_results_return_validation_error(self):
        mutations = (
            ("weights", {"posture": float("nan"), "execution": 0, "consistency": 0}),
            ("breakdown", {"posture": float("inf"), "execution": 0, "consistency": 0}),
            ("availability", {"posture": 1, "execution": False, "consistency": False}),
            ("findings", [{**score_result()["findings"][0], "hint": {"bad": "object"}}]),
            ("findings", [{**score_result()["findings"][0], "score": True}]),
            ("findings", [{**score_result()["findings"][0], "isMissing": None}]),
        )
        for key, value in mutations:
            changed = self.payload.model_copy(update={"score_data": {**score_result(), key: value}})
            with self.assertRaises(HTTPException) as caught:
                self.service.reanalyze_report_age(self.user, self.original.public_id, changed)
            self.assertEqual(caught.exception.status_code, 422)
        self.assertEqual(self.db.scalar(select(func.count(AnalysisReport.id))), 1)

    def test_extra_client_result_fields_are_not_saved(self):
        result = score_result()
        result["weights"]["untrusted"] = float("nan")
        result["findings"][0]["untrusted"] = "ignored"
        changed = self.payload.model_copy(update={"score_data": result})
        saved = self.service.reanalyze_report_age(self.user, self.original.public_id, changed)
        self.assertNotIn("untrusted", saved.score_data["weights"])
        self.assertNotIn("untrusted", saved.score_data["findings"][0])

    def test_failed_commit_rolls_back_report_and_snapshot(self):
        with patch.object(self.db, "commit", side_effect=RuntimeError("Synthetic commit failure")):
            with self.assertRaises(RuntimeError):
                self.service.reanalyze_report_age(self.user, self.original.public_id, self.payload)
        self.assertEqual(self.db.scalar(select(func.count(AnalysisReport.id))), 1)
        self.assertEqual(self.db.scalar(select(func.count(ReportSnapshot.id))), 0)
        saved = self.service.reanalyze_report_age(self.user, self.original.public_id, self.payload)
        self.assertEqual(saved.public_id, self.payload.request_id)

    def test_normal_save_cannot_spoof_comparison_provenance(self):
        # Shooting permits its historical free-practice save contract without a catalog entry.
        self.original.analysis_type = self.session.analysis_type = AnalysisType.shooting
        self.db.commit()
        payload = SaveReportRequest(session_public_id=self.session.public_id, template_code="historical", template_version="v1",
            overall_score=75, grade="C", score_data={"score_context": {
                "source_report_public_id": str(uuid4()), "source": "report_age_reanalysis", "age_group": "7-10"}},
            summary_data={"source_report_public_id": str(uuid4()), "source": "report_age_reanalysis", "age_group": "7-10"})
        with patch.object(self.service, "_upsert_daily_growth_snapshot"), patch.object(self.service, "_unlock_achievements_if_needed", return_value=[]):
            saved = self.service.save_report(self.user, payload)
        self.assertFalse(saved.is_age_comparison)
        self.assertEqual(saved.score_data["score_context"], {"age_group": "7-10"})
        self.assertEqual(saved.summary_data, {"age_group": "7-10"})
        self.assertEqual(self.db.scalars(select(AnalysisReport).where(_original_reports_only())).all(), [self.original])

    def test_changed_catalog_rules_do_not_replace_frozen_report_rules(self):
        frozen = deepcopy(self.original.score_data["template_snapshot"])
        template = TrainingTemplate(template_code="historical", name="Changed catalog", analysis_type=AnalysisType.training,
                                    current_version="v2")
        self.db.add(template)
        self.db.flush()
        changed_rules = {**deepcopy(frozen), "metrics": [{"metricId": "P_changed"}]}
        self.db.add(TrainingTemplateVersion(template_id=template.id, version="v1", scoring_rules={"template": changed_rules}))
        self.original.training_template_id = template.id
        self.db.commit()
        saved = self.service.reanalyze_report_age(self.user, self.original.public_id, self.payload)
        self.assertEqual(saved.template_snapshot, frozen)
        self.assertEqual(saved.template_version, "v1")
        self.assertEqual(saved.score_data["findings"][0]["id"], "P_test")
        self.assertEqual(self.service.get_report_detail(self.user, self.original.public_id).template_snapshot, frozen)
