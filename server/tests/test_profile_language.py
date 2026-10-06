"""Persisted language/API contracts on a temporary database, never application DB."""

from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import BigInteger, create_engine, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.main import create_app
from app.models.enums import UserRole
from app.models.user import User
from app.services.profile_service import ProfileService
from tools.training_test_support import TMP_ROOT


@compiles(BigInteger, "sqlite")
def _sqlite_bigint(_type, _compiler, **_kwargs):
    return "INTEGER"


class ProfileLanguagePersistenceTests(unittest.TestCase):
    def setUp(self):
        TMP_ROOT.mkdir(parents=True, exist_ok=True)
        folder = TemporaryDirectory(prefix="profile-language-", dir=TMP_ROOT)
        self.assertTrue(Path(folder.name).resolve().is_relative_to(TMP_ROOT.resolve()))
        self.addCleanup(folder.cleanup)
        self.engine = create_engine(f"sqlite:///{Path(folder.name) / 'profiles.sqlite'}",
                                    connect_args={"check_same_thread": False})
        self.addCleanup(self.engine.dispose)
        User.__table__.create(self.engine)
        with Session(self.engine) as db:
            users = [User(username=name, password_hash="unused", email=f"{name}@example.com",
                          role=UserRole.student, nickname=name, training_started_on=date(2020, 1, 1))
                     for name in ("language-owner", "language-peer")]
            db.add_all(users)
            db.commit()
            self.owner_id, self.peer_id = [user.id for user in users]
        self.active_user_id = self.owner_id
        self.app = create_app()
        def database():
            with Session(self.engine) as db:
                yield db
        def current_user():
            with Session(self.engine) as db:
                return db.get(User, self.active_user_id)
        self.app.dependency_overrides[get_db] = database
        self.app.dependency_overrides[get_current_user] = current_user
        self.addCleanup(self.app.dependency_overrides.clear)
        self.client = TestClient(self.app)
        self.addCleanup(self.client.close)

    def read(self):
        response = self.client.get("/api/v1/me/profile")
        self.assertEqual(response.status_code, 200)
        return response.json()

    def patch(self, payload):
        return self.client.patch("/api/v1/me/profile", json=payload)

    def test_english_is_default_for_orm_and_database_insert(self):
        self.assertEqual(self.read()["preferred_language"], "en")
        # Omit the language column entirely: this exercises the database default,
        # independently of the ORM's Python-side default.
        with self.engine.begin() as connection:
            connection.execute(text("""INSERT INTO users
                (public_id, username, password_hash, email, is_phone_verified, is_email_verified, status, role)
                VALUES (:public_id, 'raw-language-account', 'unused', 'raw-language@example.com', 0, 0, 'active', 'student')"""),
                {"public_id": uuid4().hex})
            self.assertEqual(connection.scalar(text("SELECT preferred_language FROM users WHERE username='raw-language-account'")), "en")

    def test_language_roundtrip_persists_across_fresh_sessions(self):
        for language in ("zh-CN", "en"):
            response = self.patch({"preferred_language": language})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["preferred_language"], language)
            with Session(self.engine) as fresh:
                result = ProfileService(fresh).read(fresh.get(User, self.owner_id))
                self.assertEqual(result.preferred_language, language)
            self.assertEqual(self.read()["preferred_language"], language)

    def test_omitted_language_preserves_choice_and_other_profile_fields_keep_contract(self):
        self.assertEqual(self.patch({"preferred_language": "zh-CN"}).status_code, 200)
        before = self.read()
        self.assertEqual(self.patch({}).json(), before)
        saved = self.patch({"nickname": "Alex"}).json()
        self.assertEqual(saved["preferred_language"], "zh-CN")
        self.assertEqual(saved["training_started_on"], "2020-01-01")
        cleared = self.patch({"nickname": None, "training_started_on": None}).json()
        self.assertIsNone(cleared["nickname"])
        self.assertIsNone(cleared["training_started_on"])
        self.assertEqual(cleared["preferred_language"], "zh-CN")
        with Session(self.engine) as fresh:
            owner = fresh.get(User, self.owner_id)
            self.assertEqual((owner.role, owner.email), (UserRole.student, "language-owner@example.com"))

    def test_explicit_null_and_unsupported_language_are_rejected_without_mutation(self):
        self.assertEqual(self.patch({"preferred_language": "zh-CN"}).status_code, 200)
        before = self.read()
        for value in (None, "", "zh", "zh_CN", "EN", "fr", 1, True):
            with self.subTest(language=value):
                response = self.patch({"preferred_language": value, "nickname": "Unwanted change"})
                self.assertEqual(response.status_code, 422)
                self.assertEqual(self.read(), before)

    def test_language_is_account_scoped_and_owner_injection_is_forbidden(self):
        self.assertEqual(self.patch({"preferred_language": "zh-CN"}).status_code, 200)
        for forbidden in ({"user_id": self.peer_id}, {"role": "admin"}, {"email": "changed@example.com"}):
            response = self.patch({"preferred_language": "en", **forbidden})
            self.assertEqual(response.status_code, 422)
        self.active_user_id = self.peer_id
        self.assertEqual(self.read()["preferred_language"], "en")
        self.assertEqual(self.read()["nickname"], "language-peer")
        self.active_user_id = self.owner_id
        self.assertEqual(self.read()["preferred_language"], "zh-CN")

    def test_database_rejects_null_and_unsupported_language(self):
        for value in (None, "fr"):
            with self.subTest(language=value), self.assertRaises(IntegrityError):
                with self.engine.begin() as connection:
                    connection.execute(text("UPDATE users SET preferred_language=:language WHERE id=:id"),
                                       {"language": value, "id": self.owner_id})
        self.assertEqual(self.read()["preferred_language"], "en")
