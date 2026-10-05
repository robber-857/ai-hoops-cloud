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
from app.models.enums import UserRole, AnalysisType
from app.models.training_camp import TrainingCamp
from app.models.camp_class import CampClass
from app.models.class_member import ClassMember
from app.models.camp_plan import CampPlan
from app.models.training_template import TrainingTemplate
from app.models.training_template_version import TrainingTemplateVersion
from app.schemas.camp_plan import PlanCreate, PlanUpdate
from app.services.camp_plan_service import CampPlanService


def payload(**changes):
    values = dict(
        request_id=uuid4(),
        title="Court fundamentals",
        planned_on="2026-10-06",
        items=[
            dict(name="Warm up", duration_minutes=10),
            dict(name="Layup", sets=3, reps=10),
        ],
    )
    values.update(changes)
    return PlanCreate(**values)


class PlanValidationTests(unittest.TestCase):
    def test_invalid_inputs(self):
        for values in (
            dict(title="  "),
            dict(items=[]),
            dict(items=[dict(name="Run", duration_minutes=-1)]),
            dict(items=[dict(name="Run", sets=1.5)]),
            dict(items=[dict(name="Run", duration_minutes=float("nan"))]),
            dict(focus="weight_loss"),
            dict(user_id=1),
        ):
            with self.assertRaises(ValidationError):
                payload(**values)


@unittest.skipUnless(
    os.environ.get("PLAYER_PROFILE_TEST_DATABASE_URL"),
    "Dedicated PostgreSQL URL required",
)
class CampPlanTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url = make_url(os.environ["PLAYER_PROFILE_TEST_DATABASE_URL"])
        if (
            url.host not in ("127.0.0.1", "localhost")
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
        self.other = self.user(UserRole.student)
        self.outsider = self.user(UserRole.coach)
        camp = TrainingCamp(name="Synthetic camp", code=uuid4().hex)
        self.db.add(camp)
        self.db.flush()
        self.klass = CampClass(
            camp_id=camp.id, name="Synthetic class", code=uuid4().hex
        )
        self.db.add(self.klass)
        self.db.flush()
        for user, role in (
            (self.coach, "coach"),
            (self.student, "student"),
            (self.other, "student"),
        ):
            self.db.add(
                ClassMember(class_id=self.klass.id, user_id=user.id, member_role=role)
            )
        self.db.commit()
        self.service = CampPlanService(self.db)

    def user(self, role):
        user = User(
            username=uuid4().hex,
            password_hash="unused",
            email=f"{uuid4().hex}@example.com",
            role=role,
        )
        self.db.add(user)
        self.db.flush()
        return user

    def tearDown(self):
        self.db.close()

    def create(self, **kw):
        return self.service.create(self.coach, self.klass.public_id, payload(**kw))

    def publish(self, plan):
        return self.service.publish(
            self.coach, self.klass.public_id, plan.public_id, plan.version
        )

    def test_draft_publish_and_personal_isolation(self):
        plan = self.create()
        self.assertEqual(self.service.student_list(self.student).items, [])
        first = self.publish(plan)
        again = self.publish(plan)
        self.assertEqual(first.published_at, again.published_at)
        personal = self.publish(self.create(student_public_id=self.student.public_id))
        self.assertEqual(len(self.service.student_list(self.student).items), 2)
        self.assertEqual(len(self.service.student_list(self.other).items), 1)
        self.assertEqual(self.service.student_list(self.outsider).items, [])
        self.assertTrue(self.service.student_list(self.student, limit=1).has_more)
        self.assertEqual(
            len(self.service.student_list(self.student, offset=1).items), 1
        )

    def test_authorization_and_active_membership(self):
        for user in (self.outsider, self.student):
            with self.assertRaises(HTTPException):
                self.service.create(user, self.klass.public_id, payload())
        with self.assertRaises(HTTPException):
            self.create(student_public_id=self.outsider.public_id)
        self.publish(self.create())
        member = self.db.scalar(
            select(ClassMember).where(
                ClassMember.user_id == self.student.id,
                ClassMember.class_id == self.klass.id,
            )
        )
        member.status = "inactive"
        self.db.commit()
        self.assertEqual(self.service.student_list(self.student).items, [])
        self.klass.status = "archived"
        self.db.commit()
        with self.assertRaises(HTTPException):
            self.create()

    def test_update_conflict_and_immutable_revision(self):
        plan = self.create()
        data = payload().model_dump(
            exclude={"request_id", "student_public_id", "supersedes_public_id"}
        )
        data["title"] = "Edited draft"
        changed = self.service.update(
            self.coach,
            self.klass.public_id,
            plan.public_id,
            PlanUpdate(**data, expected_version=plan.version),
        )
        with self.assertRaises(HTTPException):
            self.service.update(
                self.coach,
                self.klass.public_id,
                plan.public_id,
                PlanUpdate(**data, expected_version=plan.version),
            )
        self.db.rollback()
        published = self.publish(changed)
        with self.assertRaises(HTTPException):
            self.service.update(
                self.coach,
                self.klass.public_id,
                plan.public_id,
                PlanUpdate(**data, expected_version=published.version),
            )
        self.db.rollback()
        revision = self.create(
            supersedes_public_id=published.public_id, title="Revised plan"
        )
        self.publish(revision)
        old = self.db.scalar(
            select(CampPlan).where(CampPlan.public_id == published.public_id)
        )
        self.assertEqual(old.title, "Edited draft")
        with self.assertRaises(DBAPIError):
            self.db.execute(
                text("UPDATE camp_plans SET title='Tampered' WHERE public_id=:id"),
                {"id": published.public_id},
            )
            self.db.commit()
        self.db.rollback()
        with self.assertRaises(HTTPException):
            self.create(supersedes_public_id=published.public_id)

    def test_request_retry_and_concurrent_publish(self):
        data = payload()
        first = self.service.create(self.coach, self.klass.public_id, data)
        self.assertEqual(
            first.public_id,
            self.service.create(self.coach, self.klass.public_id, data).public_id,
        )
        with self.assertRaises(HTTPException):
            self.service.create(
                self.coach,
                self.klass.public_id,
                data.model_copy(update={"title": "Different"}),
            )
        coach_id = self.coach.id
        class_id = self.klass.public_id
        self.db.rollback()

        def run(_):
            with Session(self.engine) as db:
                return (
                    CampPlanService(db)
                    .publish(
                        db.get(User, coach_id), class_id, first.public_id, first.version
                    )
                    .published_at
                )

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(run, range(2)))
        self.assertEqual(results[0], results[1])

    def test_template_snapshot(self):
        with self.assertRaises(HTTPException):
            self.create(items=[dict(name="Assess", template_code="missing")])
        template = TrainingTemplate(
            template_code=uuid4().hex,
            name="Synthetic assessment",
            analysis_type=AnalysisType.training,
            status="active",
            current_version="v1",
        )
        self.db.add(template)
        self.db.flush()
        self.db.add(
            TrainingTemplateVersion(
                template_id=template.id, version="v1", status="active", scoring_rules={}
            )
        )
        self.db.commit()
        published = self.publish(
            self.create(
                items=[dict(name="Assess", template_code=template.template_code)]
            )
        )
        self.assertEqual(published.items[0].template_version, "v1")
        template.current_version = "v2"
        self.db.commit()
        self.assertEqual(
            self.service.student_list(self.student).items[0].items[0].template_version,
            "v1",
        )

    def test_concurrent_creation_and_revoked_coach(self):
        data = payload()
        coach_id = self.coach.id
        class_id = self.klass.public_id

        def run(_):
            with Session(self.engine) as db:
                return (
                    CampPlanService(db)
                    .create(db.get(User, coach_id), class_id, data)
                    .public_id
                )

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(run, range(2)))
        self.assertEqual(results[0], results[1])
        member = self.db.scalar(
            select(ClassMember).where(
                ClassMember.user_id == coach_id, ClassMember.class_id == self.klass.id
            )
        )
        member.status = "inactive"
        self.db.commit()
        with self.assertRaises(HTTPException):
            self.service.coach_list(self.coach, class_id)

    def test_api_auth_and_schema(self):
        app = create_app()
        with TestClient(app) as client:
            self.assertEqual(client.get("/api/v1/me/plans").status_code, 401)
            app.dependency_overrides[get_current_user] = lambda: self.coach
            app.dependency_overrides[get_db] = lambda: self.db
            response = client.post(
                f"/api/v1/coach/classes/{self.klass.public_id}/plans",
                json=payload().model_dump(mode="json"),
            )
            self.assertEqual(response.status_code, 201, response.text)
            self.assertEqual(client.get("/api/v1/me/plans?limit=0").status_code, 422)
