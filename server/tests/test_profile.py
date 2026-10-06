"""Profile contract tests and opt-in checks against a dedicated local PostgreSQL."""
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import Mock
from uuid import uuid4

from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, func, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.main import create_app
from app.models.enums import UserRole
from app.models.player_profile_revision import PlayerProfileRevision
from app.models.user import User
from app.schemas.player_profile import PlayerProfileCreate, PlayerProfileRead
from app.schemas.profile import ProfileUpdate
from app.services.player_profile_service import PlayerProfileService
from app.services.profile_service import ProfileService


def user_fixture(**changes):
    values = dict(
        id=10,
        username="profile-player",
        password_hash="unused",
        nickname="Alex",
        email="profile-fixture@example.com",
        role=UserRole.student,
        training_started_on=date(2020, 1, 1),
        preferred_language="en",
        updated_at=datetime(2026, 10, 1, tzinfo=timezone.utc),
    )
    values.update(changes)
    return User(**values)


def measurement_payload(**changes):
    values = dict(
        request_id=uuid4(), date_of_birth=date(2014, 1, 1),
        measured_on=date(2026, 9, 27), height_cm="152.50", weight_kg="42.25", sex=None,
    )
    values.update(changes)
    return PlayerProfileCreate(**values)


class ProfileValidationTests(unittest.TestCase):
    def test_partial_fields_clear_and_unknown_fields(self):
        self.assertEqual(ProfileUpdate(nickname="  Alex  ").nickname, "Alex")
        self.assertIsNone(ProfileUpdate(nickname=" ").nickname)
        self.assertEqual(ProfileUpdate(nickname=None).model_fields_set, {"nickname"})
        self.assertEqual(ProfileUpdate().model_fields_set, set())
        for extra in ({"role": "admin"}, {"email": "new@example.com"}, {"user_id": 20}):
            with self.assertRaises(ValidationError):
                ProfileUpdate(**extra)
        with self.assertRaises(ValidationError):
            ProfileUpdate(nickname="x" * 101)

    def test_dates_and_version_token(self):
        with self.assertRaises(ValidationError):
            ProfileUpdate(training_started_on=date.today() + timedelta(days=3))
        with self.assertRaises(ValidationError):
            ProfileUpdate(expected_updated_at="2026-10-01T10:00:00")
        self.assertIsNotNone(ProfileUpdate(expected_updated_at="2026-10-01T10:00:00Z").expected_updated_at)

    def test_legacy_measurement_bmi_is_derived_without_mutating_snapshot(self):
        legacy = dict(
            public_id=uuid4(), date_of_birth=date(2014, 1, 1), measured_on=date(2026, 9, 27),
            height_cm=Decimal("152.50"), weight_kg=Decimal("42.25"), sex=None,
            created_at=datetime(2026, 9, 27, tzinfo=timezone.utc),
        )
        original = deepcopy(legacy)
        result = PlayerProfileRead.model_validate(legacy)
        self.assertEqual(result.bmi, Decimal("18.17"))
        self.assertEqual(result.model_dump(mode="json")["bmi"], "18.17")
        self.assertEqual(legacy, original)
        rounded = PlayerProfileRead.model_validate({**legacy, "height_cm": Decimal("200"), "weight_kg": Decimal("40.02")})
        self.assertEqual(rounded.bmi, Decimal("10.01"))


class ProfileServiceTests(unittest.TestCase):
    def setUp(self):
        self.user = user_fixture()
        self.db = Mock()
        self.db.scalar.return_value = self.user
        self.service = ProfileService(self.db)

    def test_partial_update_preserves_training_date_and_account_permissions(self):
        result = self.service.update(self.user, ProfileUpdate(nickname="Sam", expected_updated_at=self.user.updated_at))
        self.assertEqual(result.nickname, "Sam")
        self.assertEqual(result.training_started_on, date(2020, 1, 1))
        self.assertEqual(self.user.email, "profile-fixture@example.com")
        self.assertEqual(self.user.role, UserRole.student)
        self.db.commit.assert_called_once()

    def test_training_date_before_latest_known_birth_is_rejected(self):
        self.db.scalar.side_effect = [self.user, date(2014, 1, 1)]
        with self.assertRaises(HTTPException) as raised:
            self.service.update(self.user, ProfileUpdate(nickname="Sam", training_started_on=date(2013, 12, 31)))
        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(self.user.nickname, "Alex")
        self.assertEqual(self.user.training_started_on, date(2020, 1, 1))
        self.db.commit.assert_not_called()

    def test_unknown_birth_allows_date_and_explicit_null_clears(self):
        self.db.scalar.side_effect = [self.user, None]
        self.assertEqual(self.service.update(self.user, ProfileUpdate(training_started_on=date(2016, 1, 1))).training_started_on, date(2016, 1, 1))
        self.db.scalar.side_effect = None
        result = self.service.update(self.user, ProfileUpdate(nickname=None, training_started_on=None))
        self.assertIsNone(result.nickname)
        self.assertIsNone(result.training_started_on)

    def test_stale_version_rejects_without_mutation_and_empty_patch_is_noop(self):
        old = self.user.updated_at
        with self.assertRaises(HTTPException) as raised:
            self.service.update(self.user, ProfileUpdate(nickname="Sam", expected_updated_at=old - timedelta(seconds=1)))
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(self.user.nickname, "Alex")
        result = self.service.update(self.user, ProfileUpdate())
        self.assertEqual(result.updated_at, old)
        self.db.commit.assert_not_called()

    def test_saved_measurement_retry_precedes_new_training_date_checks(self):
        data = measurement_payload()
        row = PlayerProfileRevision(
            user_id=self.user.id, public_id=data.request_id,
            created_at=datetime(2026, 9, 27, tzinfo=timezone.utc),
            **data.model_dump(exclude={"request_id"}),
        )
        self.user.training_started_on = date(2010, 1, 1)
        self.db.scalar.return_value = row
        result = PlayerProfileService(self.db).create(self.user, data)
        self.assertEqual(result.public_id, data.request_id)
        self.assertEqual(self.db.scalar.call_count, 1)
        self.db.add.assert_not_called()

    def test_new_measurement_cannot_move_birth_after_training_start(self):
        self.db.scalar.side_effect = [None, self.user, None]
        with self.assertRaises(HTTPException) as raised:
            PlayerProfileService(self.db).create(self.user, measurement_payload(date_of_birth=date(2021, 1, 1)))
        self.assertEqual(raised.exception.status_code, 422)
        self.db.add.assert_not_called()

    def test_authenticated_api_contract_and_owner_injection(self):
        app = create_app()
        with TestClient(app) as client:
            self.assertEqual(client.get("/api/v1/me/profile").status_code, 401)
            self.assertEqual(client.patch("/api/v1/me/profile", json={"nickname": "Sam"}).status_code, 401)
        app.dependency_overrides[get_current_user] = lambda: self.user
        app.dependency_overrides[get_db] = lambda: self.db
        with TestClient(app) as client:
            result = client.get("/api/v1/me/profile")
            self.assertEqual(result.status_code, 200)
            self.assertEqual(set(result.json()), {"nickname", "training_started_on", "preferred_language", "updated_at"})
            self.assertEqual(client.patch("/api/v1/me/profile", json={"nickname": "Sam"}).status_code, 200)
            for extra in ({"role": "admin"}, {"email": "new@example.com"}, {"user_id": 20}):
                self.assertEqual(client.patch("/api/v1/me/profile", json=extra).status_code, 422)

    def test_language_updates_share_profile_optimistic_lock(self):
        token = self.user.updated_at
        saved = self.service.update(self.user, ProfileUpdate(preferred_language="zh-CN", expected_updated_at=token))
        self.assertEqual(saved.preferred_language, "zh-CN")
        self.assertEqual(saved.nickname, "Alex")
        self.assertEqual(saved.training_started_on, date(2020, 1, 1))
        self.assertEqual((self.user.role, self.user.email), (UserRole.student, "profile-fixture@example.com"))
        with self.assertRaises(HTTPException) as caught:
            self.service.update(self.user, ProfileUpdate(preferred_language="en", expected_updated_at=token))
        self.assertEqual(caught.exception.status_code, 409)
        self.assertEqual(self.user.preferred_language, "zh-CN")
        self.db.commit.assert_called_once()


TEST_DATABASE_URL = os.environ.get("PLAYER_PROFILE_TEST_DATABASE_URL")


@unittest.skipUnless(TEST_DATABASE_URL, "Dedicated PostgreSQL test URL not configured")
class ProfilePostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url = make_url(TEST_DATABASE_URL)
        if url.host not in ("localhost", "127.0.0.1") or url.database != "ai_hoops_p2_test":
            raise RuntimeError("Refusing non-dedicated database")
        cls.engine = create_engine(url)

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()

    def setUp(self):
        self.db = Session(self.engine)
        self.user = User(username=f"profile-{uuid4().hex[:12]}", password_hash="unused", email=f"{uuid4().hex}@example.com")
        self.db.add(self.user)
        self.db.commit()
        self.db.refresh(self.user)

    def tearDown(self):
        self.db.close()

    def test_partial_patch_read_owner_and_concurrent_stale_token(self):
        service = ProfileService(self.db)
        before = service.read(self.user)
        saved = service.update(self.user, ProfileUpdate(nickname="Alex", training_started_on=date(2020, 1, 1), expected_updated_at=before.updated_at))
        self.assertEqual(service.read(self.user).nickname, "Alex")
        other = User(username=f"other-{uuid4().hex[:12]}", password_hash="unused", email=f"{uuid4().hex}@example.com")
        self.db.add(other)
        self.db.commit()
        self.assertIsNone(service.read(other).nickname)
        self.db.rollback()
        token, user_id = saved.updated_at, self.user.id

        def save_name(name):
            with Session(self.engine) as db:
                owner = db.get(User, user_id)
                try:
                    ProfileService(db).update(owner, ProfileUpdate(nickname=name, expected_updated_at=token))
                    return 200
                except HTTPException as exc:
                    db.rollback()
                    return exc.status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(save_name, ["First", "Second"]))
        self.assertEqual(sorted(outcomes), [200, 409])

    def test_measurement_and_training_date_race_cannot_commit_inconsistent_birth(self):
        PlayerProfileService(self.db).create(self.user, measurement_payload(date_of_birth=date(2014, 1, 1)))
        self.db.rollback()
        user_id = self.user.id

        def save_start():
            with Session(self.engine) as db:
                try:
                    ProfileService(db).update(db.get(User, user_id), ProfileUpdate(training_started_on=date(2015, 1, 1)))
                    return 200
                except HTTPException as exc:
                    db.rollback()
                    return exc.status_code

        def save_birth():
            with Session(self.engine) as db:
                try:
                    PlayerProfileService(db).create(db.get(User, user_id), measurement_payload(date_of_birth=date(2016, 1, 1), measured_on=date(2026, 9, 28)))
                    return 200
                except HTTPException as exc:
                    db.rollback()
                    return exc.status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(save_start), pool.submit(save_birth)]
            outcomes = [future.result(timeout=20) for future in futures]
        self.assertEqual(sorted(outcomes), [200, 422])
        self.db.expire_all()
        start = self.db.get(User, user_id).training_started_on
        birth = self.db.scalar(select(PlayerProfileRevision.date_of_birth).where(PlayerProfileRevision.user_id == user_id).order_by(PlayerProfileRevision.measured_on.desc(), PlayerProfileRevision.id.desc()).limit(1))
        self.assertTrue(start is None or start >= birth)

    def test_latest_measurement_birth_and_retry_remain_consistent(self):
        old = measurement_payload(date_of_birth=date(2014, 1, 1), measured_on=date(2026, 9, 26))
        PlayerProfileService(self.db).create(self.user, old)
        PlayerProfileService(self.db).create(self.user, measurement_payload(date_of_birth=date(2013, 1, 1)))
        ProfileService(self.db).update(self.user, ProfileUpdate(training_started_on=date(2013, 6, 1)))
        retry = PlayerProfileService(self.db).create(self.user, old)
        self.assertEqual(retry.public_id, old.request_id)
        self.assertEqual(self.db.scalar(select(func.count()).select_from(PlayerProfileRevision).where(PlayerProfileRevision.public_id == old.request_id)), 1)

    def test_language_roundtrip_stale_token_and_account_isolation(self):
        service = ProfileService(self.db)
        before = service.read(self.user)
        self.assertEqual(before.preferred_language, "en")
        saved = service.update(self.user, ProfileUpdate(preferred_language="zh-CN", expected_updated_at=before.updated_at))
        other = User(username=f"language-{uuid4().hex[:12]}", password_hash="unused", email=f"{uuid4().hex}@example.com")
        self.db.add(other)
        self.db.commit()
        owner_id, other_id = self.user.id, other.id
        with Session(self.engine) as fresh:
            self.assertEqual(ProfileService(fresh).read(fresh.get(User, owner_id)).preferred_language, "zh-CN")
            self.assertEqual(ProfileService(fresh).read(fresh.get(User, other_id)).preferred_language, "en")
        with self.assertRaises(HTTPException) as caught:
            service.update(self.user, ProfileUpdate(preferred_language="en", expected_updated_at=before.updated_at))
        self.assertEqual(caught.exception.status_code, 409)
        self.db.rollback()
        current = service.read(self.user)
        self.assertEqual(current.updated_at, saved.updated_at)
        self.assertEqual(service.update(self.user, ProfileUpdate(preferred_language="en", expected_updated_at=current.updated_at)).preferred_language, "en")


if __name__ == "__main__":
    unittest.main()
