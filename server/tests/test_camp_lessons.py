import os
import unittest
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session
from app.main import create_app
from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.enums import UserRole
from app.models.training_camp import TrainingCamp
from app.models.camp_class import CampClass
from app.models.class_member import ClassMember
from app.models.camp_lesson import CampLesson, CampLessonRevision
from app.schemas.camp_plan import PlanCreate
from app.schemas.camp_lesson import LessonCreate, LessonUpdate, LessonContent
from app.services.camp_plan_service import CampPlanService
from app.services.camp_lesson_service import CampLessonService


def content(status="unconfirmed", minutes=(None, None), actual=("10", "20")):
    ids = [uuid4(), uuid4()]
    return dict(
        title="Actual lesson",
        held_on="2026-10-06",
        items=[
            dict(item_id=ids[i], name=f"Activity {i}", actual_minutes=actual[i])
            for i in range(2)
        ],
        participants=[
            dict(
                student_public_id=uuid4(),
                status=status,
                items=[dict(item_id=ids[i], minutes=minutes[i]) for i in range(2)],
            )
        ],
    )


class LessonValidationTests(unittest.TestCase):
    def test_all_participation_states(self):
        for status, minutes in [
            ("unconfirmed", (None, None)),
            ("present", ("10", "20")),
            ("absent", ("0", "0")),
            ("left_early", ("10", "5")),
            ("partial", ("0", "15")),
        ]:
            LessonContent(**content(status, minutes))
        LessonContent(**content("absent", ("0", "0"), (None, None)))

    def test_impossible_participation(self):
        for status, minutes in [
            ("unconfirmed", ("0", None)),
            ("present", ("10", "19")),
            ("absent", ("1", "0")),
            ("partial", ("10", "20")),
            ("partial", ("0", "0")),
            ("partial", ("11", "0")),
            ("left_early", ("5", "3")),
        ]:
            with self.assertRaises(ValidationError):
                LessonContent(**content(status, minutes))
        with self.assertRaises(ValidationError):
            LessonContent(**content("present", ("10", "20"), ("10", None)))

    def test_identity_duration_bounds(self):
        base = content()
        base["items"][1]["item_id"] = base["items"][0]["item_id"]
        with self.assertRaises(ValidationError):
            LessonContent(**base)
        for duration in ("-1", "NaN", "2.123", "1441"):
            with self.assertRaises(ValidationError):
                LessonContent(**content(actual=(duration, "20")))
        base = content()
        base["participants"][0]["items"].pop()
        with self.assertRaises(ValidationError):
            LessonContent(**base)


@unittest.skipUnless(
    os.environ.get("PLAYER_PROFILE_TEST_DATABASE_URL"), "Dedicated PostgreSQL required"
)
class CampLessonTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url = make_url(os.environ["PLAYER_PROFILE_TEST_DATABASE_URL"])
        if (
            url.host not in ("localhost", "127.0.0.1")
            or url.database != "ai_hoops_p2_test"
        ):
            raise RuntimeError("Dedicated DB only")
        cls.engine = create_engine(url)

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()

    def setUp(self):
        self.db = Session(self.engine)
        self.coach = self.user(UserRole.coach)
        self.student = self.user(UserRole.student)
        self.peer = self.user(UserRole.student)
        self.outsider = self.user(UserRole.coach)
        camp = TrainingCamp(name="Lesson synthetic camp", code=uuid4().hex)
        self.db.add(camp)
        self.db.flush()
        self.klass = CampClass(camp_id=camp.id, name="Lesson class", code=uuid4().hex)
        self.db.add(self.klass)
        self.db.flush()
        for user, role in [
            (self.coach, "coach"),
            (self.student, "student"),
            (self.peer, "student"),
        ]:
            self.db.add(
                ClassMember(class_id=self.klass.id, user_id=user.id, member_role=role)
            )
        self.db.commit()
        self.plans = CampPlanService(self.db)
        self.service = CampLessonService(self.db)
        self.plan = self.make_plan()

    def user(self, role):
        user = User(
            username=uuid4().hex,
            email=f"{uuid4().hex}@example.com",
            password_hash="unused",
            role=role,
        )
        self.db.add(user)
        self.db.flush()
        return user

    def tearDown(self):
        self.db.close()

    def make_plan(self, personal=False, publish=True):
        p = self.plans.create(
            self.coach,
            self.klass.public_id,
            PlanCreate(
                request_id=uuid4(),
                title="Lesson source",
                planned_on="2026-10-06",
                student_public_id=self.student.public_id if personal else None,
                items=[
                    dict(name="Warmup", duration_minutes=10),
                    dict(name="Basketball", duration_minutes=20),
                ],
            ),
        )
        return (
            self.plans.publish(self.coach, self.klass.public_id, p.public_id, p.version)
            if publish
            else p
        )

    def create(self, plan=None, request=None):
        return self.service.create(
            self.coach,
            self.klass.public_id,
            LessonCreate(
                request_id=request or uuid4(),
                plan_public_id=(plan or self.plan).public_id,
                held_on="2026-10-06",
            ),
        )

    def update_payload(self, row):
        return LessonUpdate(
            **{
                k: v
                for k, v in row.model_dump(mode="json").items()
                if k in LessonContent.model_fields
            },
            request_id=uuid4(),
            expected_version=row.version,
        )

    def test_initial_unknown_snapshot_and_personal_roster(self):
        row = self.create()
        self.assertEqual(len(row.roster), 2)
        self.assertTrue(all(i.actual_minutes is None for i in row.items))
        self.assertTrue(all(p.status == "unconfirmed" for p in row.participants))
        self.assertEqual(row.source_plan["items"][0]["duration_minutes"], 10)
        personal = self.create(self.make_plan(personal=True))
        self.assertEqual(len(personal.roster), 1)
        self.assertEqual(
            personal.roster[0]["student_public_id"], str(self.student.public_id)
        )
        with self.assertRaises(HTTPException):
            self.create(self.make_plan(publish=False))

    def test_roundtrip_history_and_restore(self):
        row = self.create()
        data = self.update_payload(row).model_dump(mode="json")
        data["items"][0]["actual_minutes"] = "12"
        data["items"][1]["actual_minutes"] = "18"
        for index, p in enumerate(data["participants"]):
            p["status"] = "present" if index == 0 else "absent"
            for i, entry in enumerate(p["items"]):
                entry["minutes"] = (
                    data["items"][i]["actual_minutes"] if index == 0 else "0"
                )
        saved = self.service.update(
            self.coach, self.klass.public_id, row.public_id, LessonUpdate(**data)
        )
        self.assertEqual(saved.version, 2)
        self.db.expire_all()
        restored = self.service.get(self.coach, self.klass.public_id, row.public_id)
        self.assertEqual(restored.participants[0].status, "present")
        old = self.service.revision(self.coach, self.klass.public_id, row.public_id, 1)
        self.assertIsNone(old.items[0].actual_minutes)
        restore = self.update_payload(old).model_copy(
            update={"expected_version": saved.version}
        )
        next_saved = self.service.update(
            self.coach, self.klass.public_id, row.public_id, restore
        )
        self.assertEqual(next_saved.version, 3)
        self.assertEqual(
            len(
                self.service.history(
                    self.coach, self.klass.public_id, row.public_id
                ).items
            ),
            3,
        )
        self.assertTrue(
            self.service.history(
                self.coach, self.klass.public_id, row.public_id, limit=1
            ).has_more
        )

    def test_retry_conflict_and_roster_tampering(self):
        request = uuid4()
        row = self.create(request=request)
        self.assertEqual(row.public_id, self.create(request=request).public_id)
        update = self.update_payload(row)
        saved = self.service.update(
            self.coach, self.klass.public_id, row.public_id, update
        )
        self.assertEqual(
            saved.version,
            self.service.update(
                self.coach, self.klass.public_id, row.public_id, update
            ).version,
        )
        with self.assertRaises(HTTPException):
            self.service.update(
                self.coach,
                self.klass.public_id,
                row.public_id,
                self.update_payload(row),
            )
        self.db.rollback()
        bad = self.update_payload(saved).model_copy(update={"participants": []})
        with self.assertRaises(HTTPException):
            self.service.update(self.coach, self.klass.public_id, row.public_id, bad)

    def test_authorization_history_and_revoked_coach(self):
        row = self.create()
        for user in (self.student, self.outsider):
            for call in (
                lambda: self.service.get(user, self.klass.public_id, row.public_id),
                lambda: self.service.history(user, self.klass.public_id, row.public_id),
                lambda: self.service.update(
                    user, self.klass.public_id, row.public_id, self.update_payload(row)
                ),
            ):
                with self.assertRaises(HTTPException):
                    call()
        member = self.db.scalar(
            select(ClassMember).where(
                ClassMember.class_id == self.klass.id,
                ClassMember.user_id == self.coach.id,
            )
        )
        member.status = "inactive"
        self.db.commit()
        with self.assertRaises(HTTPException):
            self.service.get(self.coach, self.klass.public_id, row.public_id)

    def test_revision_database_immutability(self):
        row = self.create()
        for sql in (
            "UPDATE camp_lesson_revisions SET version=99 WHERE public_id=:id",
            "DELETE FROM camp_lesson_revisions WHERE public_id=:id",
        ):
            with self.assertRaises(DBAPIError):
                self.db.execute(text(sql), {"id": row.public_id})
                self.db.commit()
            self.db.rollback()
        self.assertEqual(
            self.service.history(self.coach, self.klass.public_id, row.public_id)
            .items[0]
            .version,
            1,
        )

    def test_concurrent_create_save_and_same_day_lessons(self):
        coach_id = self.coach.id
        class_id = self.klass.public_id
        data = LessonCreate(
            request_id=uuid4(), plan_public_id=self.plan.public_id, held_on="2026-10-06"
        )

        def create(_):
            with Session(self.engine) as db:
                return CampLessonService(db).create(
                    db.get(User, coach_id), class_id, data
                )

        with ThreadPoolExecutor(max_workers=2) as executor:
            rows = list(executor.map(create, range(2)))
        self.assertEqual(rows[0].public_id, rows[1].public_id)
        update = self.update_payload(rows[0])

        def save(_):
            with Session(self.engine) as db:
                return CampLessonService(db).update(
                    db.get(User, coach_id), class_id, rows[0].public_id, update
                )

        with ThreadPoolExecutor(max_workers=2) as executor:
            saved = list(executor.map(save, range(2)))
        self.assertEqual([r.version for r in saved], [2, 2])
        self.create()
        self.assertEqual(len(self.service.list(self.coach, class_id).items), 2)

    def test_api_and_source_plan_lookup(self):
        app = create_app()
        with TestClient(app) as client:
            path = f"/api/v1/coach/classes/{self.klass.public_id}/lessons"
            self.assertEqual(client.get(path).status_code, 401)
            app.dependency_overrides[get_current_user] = lambda: self.coach
            app.dependency_overrides[get_db] = lambda: self.db
            response = client.post(
                path,
                json={
                    "request_id": str(uuid4()),
                    "plan_public_id": str(self.plan.public_id),
                    "held_on": "2026-10-06",
                },
            )
            self.assertEqual(response.status_code, 201, response.text)
            self.assertEqual(client.get(path + "?limit=0").status_code, 422)
            self.assertEqual(
                client.get(
                    f"/api/v1/coach/classes/{self.klass.public_id}/plans/{self.plan.public_id}"
                ).status_code,
                200,
            )
            app.dependency_overrides[get_current_user] = lambda: self.outsider
            self.assertEqual(
                client.get(
                    f"/api/v1/coach/classes/{self.klass.public_id}/plans/{self.plan.public_id}"
                ).status_code,
                404,
            )
