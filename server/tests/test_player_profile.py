"""Validation tests plus opt-in tests against a dedicated local PostgreSQL database."""
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.main import create_app
from app.models.user import User
from app.models.player_profile_revision import PlayerProfileRevision
from app.schemas.auth import RegisterRequest
from app.schemas.player_profile import PlayerProfileCreate
from app.services.auth_service import AuthService
from app.services.player_profile_service import PlayerProfileService


def payload(**changes):
    values = dict(request_id=uuid4(), date_of_birth="2014-01-01", measured_on="2026-09-27", height_cm="152.50", weight_kg="42.25", sex=None)
    values.update(changes)
    return PlayerProfileCreate(**values)


class PlayerProfileValidationTests(unittest.TestCase):
    def test_age_boundaries_and_dates(self):
        for birth in ("2022-09-27", "2007-09-28"):
            payload(date_of_birth=birth)
        for birth in ("2022-09-28", "2007-09-27"):
            with self.assertRaises(ValidationError): payload(date_of_birth=birth)
        with self.assertRaises(ValidationError): payload(measured_on=str(date.today() + timedelta(days=3)))

    def test_values_and_owner_injection(self):
        for changes in ({"height_cm":"0"}, {"weight_kg":"-1"}, {"weight_kg":"NaN"}, {"height_cm":"150.123"}, {"user_id":999}):
            with self.assertRaises(ValidationError): payload(**changes)

    def test_optional_phone_still_requires_verified_email_fields(self):
        values = dict(username="player", password="long-password", confirm_password="long-password", email="fixture@example.com", email_code="123456")
        self.assertIsNone(RegisterRequest(**values).phone_number)
        self.assertIsNone(RegisterRequest(**values, phone_number=" ").phone_number)
        with self.assertRaises(ValidationError): RegisterRequest(**values, phone_number="invalid")
        with self.assertRaises(ValidationError): RegisterRequest(**{**values, "email_code":""})


@unittest.skipUnless(os.environ.get("PLAYER_PROFILE_TEST_DATABASE_URL"), "Dedicated PostgreSQL test URL not configured")
class PlayerProfilePostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url = make_url(os.environ["PLAYER_PROFILE_TEST_DATABASE_URL"])
        if url.host not in ("localhost", "127.0.0.1") or url.database != "ai_hoops_p2_test":
            raise RuntimeError("Refusing non-dedicated database")
        cls.engine = create_engine(url)

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()

    def setUp(self):
        self.db = Session(self.engine)
        self.user = User(username=f"test-{uuid4().hex[:12]}", password_hash="unused", phone_number=None, email=f"{uuid4().hex}@example.com")
        self.db.add(self.user); self.db.commit(); self.db.refresh(self.user)
        self.service = PlayerProfileService(self.db)

    def tearDown(self):
        self.db.close()

    def test_append_idempotency_conflict_and_order(self):
        first = payload()
        saved = self.service.create(self.user, first)
        self.assertEqual(saved.public_id, self.service.create(self.user, first).public_id)
        self.service.create(self.user, payload(height_cm="154", measured_on="2026-09-27"))
        self.service.create(self.user, payload(height_cm="150", measured_on="2026-08-01"))
        page = self.service.history(self.user, limit=1)
        self.assertTrue(page.has_more)
        self.assertEqual(str(page.items[0].height_cm), "154.00")
        self.assertEqual(len(self.service.history(self.user, offset=1).items), 2)
        self.assertEqual(str(self.db.scalar(select(PlayerProfileRevision).where(PlayerProfileRevision.public_id == saved.public_id)).height_cm), "152.50")
        with self.assertRaises(HTTPException) as ctx: self.service.create(self.user, first.model_copy(update={"height_cm":Decimal("153")}))
        self.assertEqual(ctx.exception.status_code, 409)

    def test_database_enforces_immutable_history(self):
        row = self.service.create(self.user, payload())
        for sql in ("UPDATE player_profile_revisions SET weight_kg=80 WHERE public_id=:id", "DELETE FROM player_profile_revisions WHERE public_id=:id"):
            with self.assertRaises(DBAPIError):
                self.db.execute(text(sql), {"id":row.public_id}); self.db.commit()
            self.db.rollback()
        self.assertEqual(len(self.service.history(self.user).items), 1)

    def test_cross_user_read_and_request_collision(self):
        first = payload(); self.service.create(self.user, first)
        other = User(username=f"other-{uuid4().hex[:12]}", password_hash="unused", phone_number=f"{uuid4().hex[:15]}")
        self.db.add(other); self.db.commit()
        self.assertEqual(self.service.history(other).items, [])
        with self.assertRaises(HTTPException) as ctx: self.service.create(other, first)
        self.assertEqual(ctx.exception.status_code, 409)

    def test_concurrent_retry_creates_one_row(self):
        data=payload(); user_id=self.user.id
        def create(_):
            with Session(self.engine) as db:
                return PlayerProfileService(db).create(db.get(User,user_id),data).public_id
        with ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(create,range(2)))
        self.assertEqual(results[0],results[1])
        self.assertEqual(self.db.scalar(select(func.count()).select_from(PlayerProfileRevision).where(PlayerProfileRevision.public_id==data.request_id)),1)

    def test_email_only_register_and_code_verification(self):
        values=dict(username=f"new-{uuid4().hex[:12]}", password="valid-password",confirm_password="valid-password",email=f"{uuid4().hex}@example.com",email_code="123456")
        service=AuthService(self.db)
        with patch.object(service,"_verify_code_or_raise",side_effect=HTTPException(400,"Invalid code")):
            with self.assertRaises(HTTPException): service.register_user(RegisterRequest(**values))
        with patch.object(service,"_verify_code_or_raise") as verify:
            registered=service.register_user(RegisterRequest(**values))
            verify.assert_called_once()
        self.assertIsNone(registered.phone_number)
        self.assertEqual(registered.email, values["email"])
        with patch.object(service,"_verify_code_or_raise"):
            with self.assertRaises(HTTPException): service.register_user(RegisterRequest(**values))

    def test_contact_constraint(self):
        self.db.add(User(username=f"empty-{uuid4().hex[:12]}",password_hash="unused",phone_number=None,email=None))
        with self.assertRaises(IntegrityError): self.db.commit()
        self.db.rollback()

    def test_authenticated_api_and_owner_validation(self):
        app=create_app()
        with TestClient(app) as client:
            self.assertEqual(client.get("/api/v1/me/profile/measurements").status_code,401)
        app.dependency_overrides[get_current_user]=lambda:self.user
        app.dependency_overrides[get_db]=lambda:self.db
        with TestClient(app) as client:
            data=payload().model_dump(mode="json")
            self.assertEqual(client.post("/api/v1/me/profile/measurements",json=data).status_code,201)
            self.assertEqual(client.post("/api/v1/me/profile/measurements",json={**data,"user_id":1}).status_code,422)
            self.assertEqual(len(client.get("/api/v1/me/profile/measurements").json()["items"]),1)


if __name__ == "__main__": unittest.main()
