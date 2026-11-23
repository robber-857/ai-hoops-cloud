import io
import json
import os
import unittest
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.main import app
from app.models.analysis_report import AnalysisReport
from app.models.camp_class import CampClass
from app.models.class_member import ClassMember
from app.models.enums import AnalysisType, UserRole
from app.models.operation_log import OperationLog
from app.models.training_camp import TrainingCamp
from app.models.training_session import TrainingSession
from app.models.user import User
from app.models.video import Video
from tools.training_test_support import UNIT_DATABASE, test_database_url


@unittest.skipUnless(os.environ.get("PLAYER_PROFILE_TEST_DATABASE_URL"), "Dedicated PostgreSQL test database required")
class PlayerWorkspaceCollaborationTests(unittest.TestCase):
    def setUp(self):
        url = test_database_url(os.environ["PLAYER_PROFILE_TEST_DATABASE_URL"], "test", {UNIT_DATABASE})
        engine = create_engine(url)
        self.addCleanup(engine.dispose)
        connection = engine.connect()
        self.addCleanup(connection.close)
        connection.begin()
        self.db = Session(connection, join_transaction_mode="create_savepoint")
        self.addCleanup(self.db.close)
        self.users = {}
        for name, role in (
            ("player", UserRole.student), ("other_player", UserRole.student),
            ("coach", UserRole.coach), ("other_coach", UserRole.coach),
            ("admin", UserRole.admin), ("system_admin", UserRole.super_admin),
        ):
            username = f"{name}_{uuid4().hex[:12]}"
            row = User(username=username, email=f"{username}@example.com", password_hash="test", role=role)
            self.db.add(row)
            self.users[name] = row
        camp = TrainingCamp(name="Test camp", code=uuid4().hex)
        self.db.add(camp)
        self.db.flush()
        klass = CampClass(camp_id=camp.id, name="Test class", code=uuid4().hex)
        self.db.add(klass)
        self.db.flush()
        for name in ("player", "other_player", "coach"):
            self.db.add(ClassMember(
                class_id=klass.id, user_id=self.users[name].id,
                member_role="coach" if name == "coach" else "student",
            ))

        self.reports = {}
        for name, score in (("player", 68), ("other_player", 13)):
            user = self.users[name]
            session = TrainingSession(student_id=user.id, analysis_type=AnalysisType.training, class_id=klass.id)
            video = Video(
                user_id=user.id, bucket_name="unit-only", object_key=uuid4().hex,
                file_name="private.mp4", content_type="video/mp4", file_size=1,
            )
            self.db.add_all([session, video])
            self.db.flush()
            report = AnalysisReport(
                user_id=user.id, session_id=session.id, video_id=video.id,
                analysis_type=AnalysisType.training, template_id="private-value", overall_score=score,
                score_data={"private": "private_pose_data"}, summary_data={"private": "private_summary_data"},
            )
            self.db.add(report)
            self.reports[name] = report
        self.db.commit()
        self.report_id = self.reports["player"].public_id
        self.actor = self.users["coach"]
        app.dependency_overrides[get_current_user] = lambda: self.actor
        app.dependency_overrides[get_db] = lambda: self.db
        self.addCleanup(app.dependency_overrides.clear)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def test_feedback_is_private_and_notifies_once_on_retry(self):
        path = f"/api/v1/reports/{self.report_id}/feedback"
        payload = {"body": "Stay low for the first three steps.", "request_id": str(uuid4())}
        self.assertTrue(self.client.get(path).json()["can_write"])
        added = self.client.post(path, json=payload)
        self.assertEqual(added.status_code, 201, added.text)
        self.assertEqual(self.client.post(path, json=payload).json()["public_id"], added.json()["public_id"])
        self.assertEqual(self.client.post(path, json={**payload, "body": "Changed"}).status_code, 409)

        self.actor = self.users["player"]
        thread = self.client.get(path).json()
        self.assertFalse(thread["can_write"])
        self.assertEqual([row["body"] for row in thread["items"]], [payload["body"]])
        self.assertEqual(self.client.post(path, json=payload).status_code, 403)
        inbox = self.client.get("/api/v1/me/notifications").json()
        self.assertEqual(inbox["unread_count"], 1)
        self.assertEqual(inbox["items"][0]["report_public_id"], str(self.report_id))
        self.assertEqual(inbox["items"][0]["content"], payload["body"])

        for name in ("other_player", "other_coach"):
            self.actor = self.users[name]
            self.assertEqual(self.client.get(path).status_code, 404)
            self.assertEqual(self.client.post(path, json=payload).status_code, 404)
        self.assertNotIn(payload["body"], self.client.get(f"/api/v1/reports/shared/{self.report_id}").text)
        self.assertEqual(self.client.get(f"/api/v1/reports/shared/{self.report_id}/feedback").status_code, 404)

    def test_only_system_admin_can_assign_admin_with_audit(self):
        player_path = f"/api/v1/admin/users/{self.users['player'].public_id}"
        system_path = f"/api/v1/admin/users/{self.users['system_admin'].public_id}"
        self.actor = self.users["admin"]
        self.assertEqual(self.client.patch(player_path, json={"role": "admin"}).status_code, 403)
        self.assertEqual(self.client.patch(system_path, json={"password": "not-permitted"}).status_code, 403)

        self.actor = self.users["system_admin"]
        self.assertEqual(self.client.get("/api/v1/admin/classes").status_code, 200)
        self.assertEqual(self.client.patch(player_path, json={"role": "super_admin"}).status_code, 403)
        promoted = self.client.patch(player_path, json={"role": "admin", "class_public_ids": []})
        self.assertEqual(promoted.status_code, 200, promoted.text)
        self.assertEqual(promoted.json()["role"], "admin")
        log = self.db.scalar(select(OperationLog).where(OperationLog.target_id == str(self.users["player"].public_id)))
        self.assertEqual(log.log_metadata, {"previous": "student", "role": "admin"})
        self.assertEqual(self.client.patch(system_path, json={"role": "coach"}).status_code, 403)

    def test_ai_uses_a_summary_of_the_current_players_report(self):
        self.actor = self.users["player"]
        provider_reply = {
            "status": "completed",
            "output": [{"type": "message", "content": [{
                "type": "output_text",
                "text": json.dumps({
                    "answer": "Your report recorded 68. The score is one observation from that session.",
                    "intent": "discussion", "request_quote": "", "recommendations": [], "training_priorities": [],
                }),
            }]}],
        }
        with patch("app.services.training_assistant.settings.training_assistant_api_key", "test-placeholder"), patch(
            "app.services.training_assistant.urlopen",
            return_value=io.BytesIO(json.dumps(provider_reply).encode("utf-8")),
        ) as upstream:
            response = self.client.post("/api/v1/me/assistant", json={
                "messages": [{"role": "user", "content": "How did I do?"}],
            })
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["recommendations"], [])
        request_data = json.loads(upstream.call_args.args[0].data)
        context = json.loads(request_data["input"][0]["content"])["practice_context"]
        self.assertEqual([row["score"] for row in context["recent_report_summaries"]], [68])
        self.assertFalse(request_data["store"])
        for private_value in ("private-video", "private.mp4", "private-value", "private_pose_data", "private_summary_data", self.actor.email):
            self.assertNotIn(private_value, json.dumps(request_data))
