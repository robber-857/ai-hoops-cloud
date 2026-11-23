"""PostgreSQL regressions for approval and class video access."""

import os
import unittest
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.main import create_app
from app.models.camp_class import CampClass
from app.models.class_collaboration import ClassInvitation, ClassJoinRequest
from app.models.class_member import ClassMember
from app.models.enums import UserRole
from app.models.notification import Notification
from app.models.training_camp import TrainingCamp
from app.models.user import User
from tools.training_test_support import UNIT_DATABASE, test_database_url


@unittest.skipUnless(os.environ.get("PLAYER_PROFILE_TEST_DATABASE_URL"), "Dedicated test DB required")
class ClassCollaborationTests(unittest.TestCase):
    def setUp(self):
        url = test_database_url(os.environ["PLAYER_PROFILE_TEST_DATABASE_URL"], "test", {UNIT_DATABASE})
        engine = create_engine(url)
        self.addCleanup(engine.dispose)
        connection = engine.connect()
        self.addCleanup(connection.close)
        transaction = connection.begin()
        self.addCleanup(transaction.rollback)
        self.db = Session(connection, join_transaction_mode="create_savepoint")
        self.addCleanup(self.db.close)
        self.users = {}
        for label, role in (
            ("coach", UserRole.coach), ("outsider", UserRole.coach), ("player", UserRole.student),
            ("peer", UserRole.student), ("pending", UserRole.student), ("sysadmin", UserRole.super_admin),
        ):
            name = f"cl_{uuid4().hex[:15]}"
            self.users[label] = User(username=name, email=f"{name}@example.com", role=role, password_hash="unused")
        camp = TrainingCamp(name="Skills course", code=uuid4().hex)
        self.db.add_all([camp, *self.users.values()])
        self.db.flush()
        self.class_row = CampClass(camp_id=camp.id, name="Saturday group", code=uuid4().hex, max_students=2)
        self.other_class = CampClass(camp_id=camp.id, name="Sunday group", code=uuid4().hex)
        self.db.add_all([self.class_row, self.other_class])
        self.db.flush()
        for class_row, label, role in (
            (self.class_row, "coach", "coach"), (self.class_row, "peer", "student"),
            (self.other_class, "outsider", "coach"),
        ):
            self.db.add(ClassMember(class_id=class_row.id, user_id=self.users[label].id, member_role=role))
        self.db.commit()
        self.class_id = self.class_row.public_id
        self.base = f"/api/v1/coach/classes/{self.class_id}"
        self.me_videos = "/api/v1/me/class-videos"
        self.who = None
        app = create_app()

        def current_user():
            if self.who is None:
                raise HTTPException(401, "Authentication required.")
            return self.users[self.who]

        app.dependency_overrides[get_current_user] = current_user
        app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def request(self, user, method, path, **kwargs):
        self.who = user
        return self.client.request(method, path, **kwargs)

    def issue(self, actor="coach"):
        response = self.request(actor, "POST", f"{self.base}/invitation")
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()["token"]

    def apply(self, actor, token):
        return self.request(actor, "POST", "/api/v1/class-invitations/apply", json={"token": token})

    def review(self, actor, join_id, decision):
        return self.request(actor, "PATCH", f"{self.base}/join-requests/{join_id}", json={"decision": decision})

    def test_approval_gates_membership_and_capacity(self):
        self.assertEqual(self.request("outsider", "POST", f"{self.base}/invitation").status_code, 404)
        token = self.issue()
        invitation = self.db.get(ClassInvitation, self.class_row.id)
        self.assertNotEqual(invitation.token_hash, token)
        preview = self.request(None, "POST", "/api/v1/class-invitations/preview", json={"token": token})
        self.assertEqual(preview.json(), {"class_name": "Saturday group", "course_name": "Skills course"})
        self.assertEqual(self.apply(None, token).status_code, 401)
        self.assertEqual(self.apply("outsider", token).status_code, 403)
        self.assertEqual(self.apply("player", token).json()["status"], "pending")
        self.assertEqual(self.apply("player", token).json()["status"], "pending")
        request = self.db.scalar(select(ClassJoinRequest).where(ClassJoinRequest.class_id == self.class_row.id))
        self.assertEqual(self.db.scalar(select(func.count()).select_from(ClassMember).where(
            ClassMember.class_id == self.class_row.id, ClassMember.user_id == self.users["player"].id,
        )), 0)
        self.assertEqual(self.review("outsider", request.public_id, "approved").status_code, 404)
        self.assertEqual(self.review("coach", request.public_id, "approved").json()["status"], "approved")
        self.assertEqual(self.review("coach", request.public_id, "approved").status_code, 200)
        self.assertEqual(self.review("coach", request.public_id, "declined").status_code, 409)
        member = self.db.scalar(select(ClassMember).where(
            ClassMember.class_id == self.class_row.id, ClassMember.user_id == self.users["player"].id,
        ))
        self.assertEqual(member.status, "active")
        self.assertEqual(self.db.scalar(select(func.count()).select_from(Notification).where(
            Notification.user_id == member.user_id, Notification.business_id == request.id,
        )), 1)

        rotated = self.issue("sysadmin")
        self.assertNotEqual(token, rotated)
        self.assertEqual(self.apply("pending", token).status_code, 404)
        self.assertEqual(self.apply("pending", rotated).json()["status"], "pending")
        waiting = self.db.scalar(select(ClassJoinRequest).where(
            ClassJoinRequest.class_id == self.class_row.id, ClassJoinRequest.student_id == self.users["pending"].id,
        ))
        self.assertEqual(self.review("coach", waiting.public_id, "approved").status_code, 409)
        self.assertEqual(self.request("coach", "DELETE", f"{self.base}/invitation").status_code, 204)
        self.assertEqual(self.apply("pending", rotated).status_code, 404)
        self.assertEqual(self.review("coach", waiting.public_id, "declined").json()["status"], "declined")

    @patch("app.api.v1.class_collaboration.ClassVideoStorage")
    def test_video_upload_and_playback_are_class_scoped(self, storage):
        def check_upload(key, contents, content_type, size):
            self.assertTrue(key.startswith(f"{self.class_id}/"))
            self.assertEqual(content_type, "video/mp4")
            self.assertEqual(size, len(contents.read()))

        storage.return_value.upload.side_effect = check_upload
        storage.return_value.playback_url.return_value = "https://example.invalid/signed-video"
        raw = b"\x00\x00\x00\x14ftypisom"
        upload_path = f"{self.base}/videos?title=Passing+drill"
        mime = {"Content-Type": "video/mp4"}
        self.assertEqual(self.request("outsider", "POST", upload_path, headers=mime, content=raw).status_code, 404)
        self.assertEqual(self.request("peer", "POST", upload_path, headers=mime, content=raw).status_code, 403)
        self.assertEqual(self.request("coach", "POST", upload_path, headers=mime, content=b"forged").status_code, 415)
        response = self.request("coach", "POST", upload_path, headers=mime, content=raw)
        self.assertEqual(response.status_code, 201, response.text)
        item = response.json()
        self.assertNotIn("object_key", item)
        self.assertEqual(item["title"], "Passing drill")
        self.assertEqual(storage.return_value.upload.call_count, 1)
        video_id = item["public_id"]
        playback = f"/api/v1/class-videos/{video_id}/playback"
        token = self.issue()
        self.assertEqual(self.apply("pending", token).json()["status"], "pending")
        for viewer in ("outsider", "player", "pending"):
            self.assertEqual(self.request(viewer, "GET", self.me_videos).json()["items"], [])
            self.assertEqual(self.request(viewer, "GET", playback).status_code, 404)
        self.assertEqual(self.request(None, "GET", playback).status_code, 401)
        for viewer in ("peer", "coach", "sysadmin"):
            self.assertEqual(self.request(viewer, "GET", self.me_videos).json()["items"], [item])
            watch = self.request(viewer, "GET", playback)
            self.assertEqual(watch.json()["url"], "https://example.invalid/signed-video")
            self.assertEqual(watch.headers["Cache-Control"], "private, no-store")
        self.assertEqual(storage.return_value.playback_url.call_count, 3)
        archive_path = f"{self.base}/videos/{video_id}"
        self.assertEqual(self.request("outsider", "DELETE", archive_path).status_code, 404)
        self.assertEqual(self.request("coach", "DELETE", archive_path).status_code, 204)
        self.assertEqual(self.request("peer", "GET", playback).status_code, 404)
