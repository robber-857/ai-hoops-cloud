"""Real PostgreSQL regression tests using only the explicit, migrated test DB."""

from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import os
from threading import Barrier, Event
from time import monotonic
import unittest
from uuid import uuid4

from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, select, text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.main import create_app
from app.models import AnalysisReport, ReportSnapshot, TrainingSession, User, Video
from app.models.achievement import Achievement
from app.models.camp_class import CampClass
from app.models.class_member import ClassMember
from app.models.enums import AnalysisType, ReportStatus, UserRole
from app.models.notification import Notification
from app.models.student_achievement import StudentAchievement
from app.models.student_growth_snapshot import StudentGrowthSnapshot
from app.models.training_camp import TrainingCamp
from app.models.training_task import TrainingTask
from app.models.training_task_assignment import TrainingTaskAssignment
from app.schemas.me import SubmitTaskReportRequest
from app.schemas.report import ReanalyzeReportAgeRequest
from app.services.admin_service import AdminService
from app.services.coach_service import CoachService
from app.services.me_service import MeService
from app.services.report_service import ReportService
from tools.training_test_support import (
    UNIT_DATABASE, require_database_identity, require_migrated_schema, test_database_url,
)
from test_report_age_reanalysis import score_result


@unittest.skipUnless(os.environ.get("PLAYER_PROFILE_TEST_DATABASE_URL"), "Dedicated PostgreSQL required")
class ReportAgePostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url = test_database_url(os.environ.get("PLAYER_PROFILE_TEST_DATABASE_URL"),
                                os.environ.get("APP_ENV"), {UNIT_DATABASE})
        cls.engine = create_engine(url, connect_args={"connect_timeout": 5})
        with cls.engine.connect() as connection:
            require_database_identity(connection, UNIT_DATABASE)
            require_migrated_schema(connection)

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()

    def setUp(self):
        self.db = Session(self.engine)
        self.addCleanup(self.db.close)
        token = uuid4().hex
        phone_token = token[:20]
        self.user = User(username=f"age-pg-{token}", phone_number=f"age-{phone_token}",
                         password_hash="unused-test-hash", role=UserRole.student)
        self.coach = User(username=f"age-coach-{token}", phone_number=f"coach-{phone_token}",
                          password_hash="unused-test-hash", role=UserRole.coach)
        self.peer = User(username=f"age-peer-{token}", phone_number=f"peer-{phone_token}",
                         password_hash="unused-test-hash", role=UserRole.student)
        self.db.add_all([self.user, self.coach, self.peer])
        self.db.flush()
        self.camp = TrainingCamp(name="Age regression", code=f"age-{token}")
        self.db.add(self.camp)
        self.db.flush()
        self.klass = CampClass(camp_id=self.camp.id, name="Age regression", code="age")
        self.db.add(self.klass)
        self.db.flush()
        self.db.add_all([
            ClassMember(class_id=self.klass.id, user_id=self.user.id, member_role="student"),
            ClassMember(class_id=self.klass.id, user_id=self.coach.id, member_role="coach"),
        ])
        self.video = Video(user_id=self.user.id, bucket_name="age-test", object_key=f"{token}/clip",
                           file_name="clip.mp4", content_type="video/mp4", file_size=100)
        self.db.add(self.video)
        self.db.flush()
        self.original = self.make_source()
        self.db.commit()
        self.user_id = self.user.id
        self.original_id = self.original.id
        self.original_uuid = self.original.public_id
        self.payload = ReanalyzeReportAgeRequest(request_id=uuid4(), age_group="4-7", overall_score=80,
                                                 grade="B", score_data=score_result())

    def tearDown(self):
        self.db.rollback()
        self.db.close()

    def make_source(self):
        session = TrainingSession(student_id=self.user.id, video_id=self.video.id, camp_id=self.camp.id,
                                  class_id=self.klass.id, analysis_type=AnalysisType.training,
                                  template_code="age-historical", template_version="v1", status="completed")
        self.db.add(session)
        self.db.flush()
        report = AnalysisReport(user_id=self.user.id, session_id=session.id, video_id=self.video.id,
            analysis_type=AnalysisType.training, template_id="age-historical", template_version="v1",
            status=ReportStatus.completed, overall_score=70, grade="C", score_data={
                "overall": 70, "grade": "C", "saved_metrics": [{"name": "measured", "value": 10}],
                "score_context": {"age_group": "16-18", "handedness": "left"},
                "template_snapshot": {"templateId": "age-historical", "version": "v1", "mode": "training",
                                      "metrics": [{"metricId": "P_test"}]},
            }, timeline_data=[{"time": 1, "angles": [{"name": "measured", "value": 10}]}],
            summary_data={"age_group": "16-18"}, analysis_finished_at=datetime.now(timezone.utc))
        self.db.add(report)
        self.db.flush()
        return report

    def count(self, model, **filters):
        return self.db.scalar(select(func.count(model.id)).filter_by(**filters))

    def worker(self, source_uuid, payload, *, select_barrier=None, insert_barrier=None):
        with Session(self.engine) as db:
            db.execute(text("SET LOCAL statement_timeout = '10000ms'"))
            db.execute(text("SET LOCAL lock_timeout = '7000ms'"))
            user = db.get(User, self.user_id)
            if select_barrier is not None:
                def before_select(_connection, _cursor, statement, _params, _context, _many):
                    if "FOR UPDATE" in statement and "analysis_reports" in statement:
                        select_barrier.wait(timeout=5)
                event.listen(db.connection(), "before_cursor_execute", before_select)
            if insert_barrier is not None:
                def before_flush(session, _context, _instances):
                    if any(isinstance(item, AnalysisReport) and item.public_id == payload.request_id for item in session.new):
                        insert_barrier.wait(timeout=5)
                event.listen(db, "before_flush", before_flush)
            try:
                result = ReportService(db).reanalyze_report_age(user, source_uuid, payload)
                return 201, result.model_dump(mode="json")
            except HTTPException as exc:
                db.rollback()
                return exc.status_code, exc.detail

    def test_same_source_concurrent_retry_creates_one_report_and_snapshot(self):
        before = deepcopy(self.original.score_data)
        self.db.rollback()
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(self.worker, self.original_uuid, self.payload, select_barrier=barrier) for _ in range(2)]
            results = [future.result(timeout=15) for future in futures]
        self.assertEqual([result[0] for result in results], [201, 201])
        self.assertEqual(results[0][1], results[1][1])
        self.db.expire_all()
        saved = self.db.scalar(select(AnalysisReport).where(AnalysisReport.public_id == self.payload.request_id))
        self.assertEqual(self.count(AnalysisReport, user_id=self.user_id), 2)
        self.assertEqual(self.count(ReportSnapshot, report_id=saved.id), 1)
        self.assertEqual(self.count(TrainingSession, student_id=self.user_id), 1)
        self.assertEqual(self.original.score_data, before)
        self.assertEqual(self.count(Notification, user_id=self.user_id), 0)

    def test_same_source_concurrent_different_age_returns_conflict(self):
        changed = self.payload.model_copy(update={"age_group": "7-10"})
        self.db.rollback()
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(self.worker, self.original_uuid, payload, select_barrier=barrier)
                       for payload in (self.payload, changed)]
            results = [future.result(timeout=15) for future in futures]
        self.assertEqual(sorted(result[0] for result in results), [201, 409])
        saved = self.db.scalar(select(AnalysisReport).where(AnalysisReport.public_id == self.payload.request_id))
        self.assertEqual(self.count(ReportSnapshot, report_id=saved.id), 1)

    def test_different_sources_concurrent_same_uuid_rolls_back_loser(self):
        other = self.make_source()
        self.db.commit()
        other_uuid = other.public_id
        self.db.rollback()
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(self.worker, source, self.payload, insert_barrier=barrier)
                       for source in (self.original_uuid, other_uuid)]
            results = [future.result(timeout=15) for future in futures]
        self.assertEqual(sorted(result[0] for result in results), [201, 409])
        saved = self.db.scalar(select(AnalysisReport).where(AnalysisReport.public_id == self.payload.request_id))
        self.assertEqual(self.count(AnalysisReport, user_id=self.user_id), 3)
        self.assertEqual(self.count(ReportSnapshot, report_id=saved.id), 1)
        winner = saved.score_data["score_context"]["source_report_public_id"]
        # The losing request remains a clean HTTP conflict on retry, not a broken transaction/500.
        loser_uuid = other_uuid if winner == str(self.original_uuid) else self.original_uuid
        self.assertEqual(self.worker(loser_uuid, self.payload)[0], 409)

    def test_locked_source_refreshes_previously_loaded_identity(self):
        loaded, attempted = Event(), Event()
        worker_pid = []
        def worker():
            with Session(self.engine) as db:
                db.execute(text("SET LOCAL statement_timeout = '10000ms'"))
                db.execute(text("SET LOCAL lock_timeout = '7000ms'"))
                worker_pid.append(db.scalar(text("SELECT pg_backend_pid()")))
                user = db.get(User, self.user_id)
                cached = db.get(AnalysisReport, self.original_id)
                self.assertEqual(cached.score_data["saved_metrics"][0]["value"], 10)
                def before_select(_connection, _cursor, statement, _params, _context, _many):
                    if "FOR UPDATE" in statement and "analysis_reports" in statement:
                        attempted.set()
                event.listen(db.connection(), "before_cursor_execute", before_select)
                loaded.set()
                self.assertTrue(start.wait(timeout=5))
                return ReportService(db).reanalyze_report_age(user, self.original_uuid, self.payload)
        start = Event()
        self.db.rollback()
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(worker)
            try:
                self.assertTrue(loaded.wait(timeout=5))
                source = self.db.scalar(select(AnalysisReport).where(AnalysisReport.id == self.original_id)
                                        .with_for_update().execution_options(populate_existing=True))
                holder_pid = self.db.scalar(text("SELECT pg_backend_pid()"))
                data = deepcopy(source.score_data)
                data["saved_metrics"][0]["value"] = 20
                source.score_data = data
                self.db.flush()
                start.set()
                self.assertTrue(attempted.wait(timeout=5))
                # Observe PostgreSQL's actual blocker graph instead of assuming scheduling.
                deadline = monotonic() + 5
                with self.engine.connect() as observer:
                    blockers = []
                    while monotonic() < deadline:
                        blockers = observer.scalar(text("SELECT pg_blocking_pids(:pid)"), {"pid": worker_pid[0]})
                        if holder_pid in blockers:
                            break
                    self.assertIn(holder_pid, blockers, "Source SELECT must wait for the held row lock.")
                self.db.commit()
                saved = future.result(timeout=15)
            finally:
                start.set()
                self.db.rollback()
        self.assertEqual(saved.score_data["saved_metrics"][0]["value"], 20)

    def test_api_owner_status_schema_and_retry_contract(self):
        app = create_app()
        active_user = [self.user_id]
        def test_db():
            with Session(self.engine) as db:
                yield db
        def test_user():
            with Session(self.engine) as db:
                return db.get(User, active_user[0])
        app.dependency_overrides[get_db] = test_db
        app.dependency_overrides[get_current_user] = test_user
        path = f"/api/v1/reports/{self.original_uuid}/reanalyze-age"
        payload = self.payload.model_dump(mode="json")
        try:
            with TestClient(app) as client:
                active_user[0] = self.peer.id
                self.assertEqual(client.post(path, json=payload).status_code, 404)
                active_user[0] = self.coach.id
                self.assertEqual(client.post(path, json=payload).status_code, 404)
                active_user[0] = self.user_id
                self.assertEqual(client.post(path, json={**payload, "age_group": "adult"}).status_code, 422)
                self.assertEqual(client.post(path, json={**payload, "user_id": self.peer.id}).status_code, 422)
                self.original.status = ReportStatus.processing
                self.db.commit()
                self.assertEqual(client.post(path, json=payload).status_code, 409)
                self.original.status = ReportStatus.completed
                self.db.commit()
                first = client.post(path, json=payload)
                retry = client.post(path, json=payload)
                self.assertEqual((first.status_code, retry.status_code), (201, 201))
                self.assertEqual(first.json(), retry.json())
                read = client.get(f"/api/v1/reports/{self.payload.request_id}")
                self.assertTrue(read.json()["is_age_comparison"])
                self.assertTrue(read.json()["can_reanalyze_age"])
                shared = client.get(f"/api/v1/reports/shared/{self.payload.request_id}")
                self.assertFalse(shared.json()["can_reanalyze_age"])
        finally:
            app.dependency_overrides.clear()

    def test_comparisons_stay_in_history_but_not_stats_tasks_or_side_effects(self):
        task = TrainingTask(class_id=self.klass.id, camp_id=self.camp.id, created_by_user_id=self.coach.id,
            title="Original attempts only", analysis_type=AnalysisType.training, template_code="age-historical",
            status="published", target_config={"target_sessions": 2, "target_score": 85})
        self.db.add(task)
        self.db.flush()
        assignment = TrainingTaskAssignment(task_id=task.id, student_id=self.user_id, class_id=self.klass.id)
        self.db.add(assignment)
        achievement = Achievement(code=f"age-{uuid4().hex}", name="Original best", rule_type="best_score",
                                  rule_config={"score": 85})
        self.db.add(achievement)
        self.db.commit()
        me = MeService(self.db)
        me.submit_task_report(self.user, assignment.public_id,
                              SubmitTaskReportRequest(report_public_id=self.original_uuid))
        service = ReportService(self.db)
        service._upsert_daily_growth_snapshot(self.user_id, self.original)
        self.db.add(Notification(user_id=self.user_id, type="report_ready", title="Original", is_read=False))
        self.db.commit()
        snapshot = self.db.scalar(select(StudentGrowthSnapshot).where(StudentGrowthSnapshot.student_id == self.user_id))
        frozen_snapshot = (snapshot.session_count, snapshot.average_score, snapshot.best_score, deepcopy(snapshot.metric_summary))
        frozen_assignment = (assignment.completed_sessions, assignment.best_score, assignment.status,
                             assignment.latest_report_id, assignment.last_submission_at)
        improved = self.payload.model_copy(update={"overall_score": 90, "score_data": score_result(90)})
        saved = service.reanalyze_report_age(self.user, self.original_uuid, improved)
        self.db.expire_all()
        self.assertEqual((assignment.completed_sessions, assignment.best_score, assignment.status,
                          assignment.latest_report_id, assignment.last_submission_at), frozen_assignment)
        self.assertEqual((snapshot.session_count, snapshot.average_score, snapshot.best_score, snapshot.metric_summary), frozen_snapshot)
        self.assertEqual(self.count(Notification, user_id=self.user_id), 1)
        self.assertEqual(self.count(StudentAchievement, student_id=self.user_id), 0)
        stats = me._build_stats(self.user_id)
        self.assertEqual((stats.total_reports, stats.total_sessions, stats.best_score, stats.average_score), (1, 1, 70, 70))
        history = me.get_reports(self.user).items
        self.assertEqual(len(history), 2)
        self.assertEqual(sum(item.is_age_comparison for item in history), 1)
        self.assertEqual([item.report_public_id for item in me.get_task(self.user, assignment.public_id).submission_reports], [self.original_uuid])
        with self.assertRaises(HTTPException) as caught:
            me.submit_task_report(self.user, assignment.public_id, SubmitTaskReportRequest(report_public_id=saved.public_id))
        self.assertEqual(caught.exception.status_code, 404)
        service._update_task_assignment(assignment)
        self.assertEqual((assignment.completed_sessions, float(assignment.best_score), assignment.latest_report_id), (1, 70, self.original_id))
        service._unlock_achievements_if_needed(self.user_id, self.original)
        self.assertEqual(self.count(StudentAchievement, student_id=self.user_id, achievement_id=achievement.id), 0)
        coach = CoachService(self.db)
        dashboard = coach.get_dashboard(self.coach)
        self.assertEqual((dashboard.report_count, dashboard.recent_report_count), (1, 1))
        self.assertEqual(coach._student_report_stats(self.klass.id, [self.user_id])[self.user_id]["best_score"], 70)
        self.assertEqual(coach._student_report_stats_for_classes(self.user_id, [self.klass.id])["report_count"], 1)
        self.assertEqual(coach._recent_report_stats_by_class([self.klass.id], datetime.now(timezone.utc)-timedelta(days=7))[self.klass.id]["recent_report_count"], 1)
        self.assertEqual(AdminService(self.db)._user_summaries_by_user_id([self.user_id])[self.user_id]["report_count"], 1)
        coach_history = coach.list_class_reports(self.coach, self.klass.public_id)
        self.assertEqual(len(coach_history), 2)
        self.assertEqual(sum(item.is_age_comparison for item in coach_history), 1)
        # Exercise the no-growth-snapshot trend fallback without altering committed fixtures.
        self.db.delete(snapshot)
        self.db.flush()
        trends = me.get_trends(self.user, "30d", AnalysisType.training)
        self.assertEqual((len(trends.points), trends.points[0].session_count, trends.points[0].best_score), (1, 1, 70))
        service._upsert_daily_growth_snapshot(self.user_id, self.original)
        replacement = self.db.scalar(select(StudentGrowthSnapshot).where(StudentGrowthSnapshot.student_id == self.user_id))
        self.assertEqual((replacement.session_count, float(replacement.average_score), float(replacement.best_score)), (1, 70, 70))
