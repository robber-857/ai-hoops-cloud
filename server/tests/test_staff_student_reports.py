"""Real database regressions for student privacy, profile visibility and paging."""
import os
import unittest
from datetime import date, datetime, timezone
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.enums import UserRole, AnalysisType
from app.models.training_camp import TrainingCamp
from app.models.camp_class import CampClass
from app.models.class_member import ClassMember
from app.models.training_session import TrainingSession
from app.models.video import Video
from app.models.analysis_report import AnalysisReport
from app.models.player_profile_revision import PlayerProfileRevision
from app.services.coach_service import CoachService
from app.services.me_service import MeService


@unittest.skipUnless(os.environ.get("PLAYER_PROFILE_TEST_DATABASE_URL"), "Dedicated test DB required")
class StaffStudentReportsTests(unittest.TestCase):
    def setUp(self):
        url = make_url(os.environ["PLAYER_PROFILE_TEST_DATABASE_URL"])
        if url.host not in ("localhost", "127.0.0.1") or url.database != "ai_hoops_p2_test":
            raise RuntimeError("Refusing non-test database")
        engine = create_engine(url)
        self.addCleanup(engine.dispose)
        self.db = Session(engine)
        self.addCleanup(self.db.close)  # Rolls back this test's uncommitted synthetic rows.
        self.users = {}
        for label, role in (("player", UserRole.student), ("peer", UserRole.student), ("coach", UserRole.coach), ("outsider", UserRole.coach), ("admin", UserRole.admin)):
            name = f"paging_{uuid4().hex[:16]}"
            row = User(username=name, email=f"{name}@example.com", password_hash="unused", role=role, training_started_on=date(2020, 1, 1))
            self.db.add(row)
            self.users[label] = row
        camp = TrainingCamp(name="Paging test", code=uuid4().hex)
        self.db.add(camp); self.db.flush()
        klass = CampClass(camp_id=camp.id, name="Paging class", code=uuid4().hex)
        self.db.add(klass); self.db.flush()
        for label, role in (("player", "student"), ("coach", "coach")):
            self.db.add(ClassMember(class_id=klass.id, user_id=self.users[label].id, member_role=role))
        for label, count in (("player", 65), ("peer", 1)):
            user = self.users[label]
            video = Video(user_id=user.id, bucket_name="test", object_key=uuid4().hex, file_name="test.mp4", content_type="video/mp4", file_size=1)
            session = TrainingSession(student_id=user.id, analysis_type=AnalysisType.training)
            self.db.add_all([video, session]); self.db.flush()
            for i in range(count):
                self.db.add(AnalysisReport(user_id=user.id, session_id=session.id, video_id=video.id, analysis_type=AnalysisType.training if i % 2 == 0 else AnalysisType.dribbling, template_id="test", score_data={}, overall_score=80, created_at=datetime(2026, 1, 1, tzinfo=timezone.utc)))
        self.db.flush()

    def test_reports_page_past_old_cap_and_filter_before_paging(self):
        service = MeService(self.db)
        player = self.users["player"]
        pages = [service.get_reports(player, limit=10, offset=i * 10) for i in range(7)]
        self.assertEqual([len(p.items) for p in pages], [10, 10, 10, 10, 10, 10, 5])
        self.assertEqual({p.total for p in pages}, {65})
        self.assertEqual(len({r.public_id for p in pages for r in p.items}), 65)
        filtered = service.get_reports(player, limit=10, offset=30, analysis_type=AnalysisType.training)
        self.assertEqual((filtered.total, len(filtered.items)), (33, 3))
        self.assertTrue(all(r.analysis_type == AnalysisType.training for r in filtered.items))
        self.assertEqual(service.get_reports(self.users["peer"]).total, 1)

    def test_coach_pages_and_unrelated_coach_denied(self):
        service = CoachService(self.db)
        player = self.users["player"]
        pages = [service.list_student_reports(self.users["coach"], player.public_id, 10, i * 10) for i in range(7)]
        self.assertEqual([len(p) for p in pages], [10, 10, 10, 10, 10, 10, 5])
        self.assertEqual(len({r.public_id for p in pages for r in p}), 65)
        self.assertEqual(service.count_student_reports(self.users["coach"], player.public_id), 65)
        with self.assertRaises(HTTPException):
            service.list_student_reports(self.users["outsider"], player.public_id)
        with self.assertRaises(HTTPException):
            service.get_student_profile(self.users["peer"], player.public_id)

    def test_latest_profile_visible_only_to_authorized_staff(self):
        player = self.users["player"]
        service = CoachService(self.db)
        self.assertIsNone(service.get_student_profile(self.users["coach"], player.public_id).latest_measurement)
        for day, height in ((2, 155), (1, 150)):
            self.db.add(PlayerProfileRevision(user_id=player.id, date_of_birth=date(2014, 1, 1), measured_on=date(2026, 1, day), height_cm=height, weight_kg=45))
        self.db.flush()
        for role in ("coach", "admin"):
            profile = service.get_student_profile(self.users[role], player.public_id)
            self.assertEqual(profile.latest_measurement.height_cm, 155)
            self.assertEqual(profile.training_started_on, date(2020, 1, 1))
        with self.assertRaises(HTTPException):
            service.get_student_profile(self.users["outsider"], player.public_id)
