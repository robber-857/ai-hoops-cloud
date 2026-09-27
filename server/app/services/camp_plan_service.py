from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import select, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.models.camp_plan import CampPlan
from app.models.camp_class import CampClass
from app.models.class_member import ClassMember
from app.models.user import User
from app.services.template_service import TemplateService
from app.schemas.camp_plan import (
    PlanCreate,
    PlanUpdate,
    PlanRead,
    PlansRead,
    PlanContent,
)
from app.services.coach_service import CoachService


class CampPlanService:
    def __init__(self, db: Session):
        self.db = db

    def _class(self, user, public_id):
        row = CoachService(self.db)._get_accessible_class(user, public_id)
        if row.status != "active":
            raise HTTPException(409, "Class is not active.")
        return row

    def _student(self, class_id, public_id):
        if public_id is None:
            return None
        row = self.db.scalar(
            select(User)
            .join(ClassMember, ClassMember.user_id == User.id)
            .where(
                User.public_id == public_id,
                ClassMember.class_id == class_id,
                ClassMember.member_role == "student",
                ClassMember.status == "active",
            )
        )
        if not row:
            raise HTTPException(422, "Choose an active student in this class.")
        return row.id

    def _items(self, payload):
        items = []
        for entry in payload.items:
            item = entry.model_dump(mode="json")
            if entry.template_code:
                try:
                    template = TemplateService(self.db).get_template_by_code(
                        entry.template_code
                    )
                except HTTPException:
                    raise HTTPException(422, "Assessment template is not active.")
                if template.analysis_type.value not in (
                    "training",
                    "shooting",
                    "dribbling",
                ):
                    raise HTTPException(422, "Assessment type is not supported.")
                item.update(
                    analysis_type=template.analysis_type.value,
                    template_version=template.current_version,
                )
            items.append(item)
        return items

    def _read(self, row):
        klass = self.db.get(CampClass, row.class_id)
        student = self.db.get(User, row.student_id) if row.student_id else None
        previous = (
            self.db.get(CampPlan, row.supersedes_id) if row.supersedes_id else None
        )
        return PlanRead(
            public_id=row.public_id,
            class_public_id=klass.public_id,
            class_name=klass.name,
            student_public_id=student.public_id if student else None,
            student_name=(student.nickname or student.username) if student else None,
            title=row.title,
            planned_on=row.planned_on,
            focus=row.focus,
            notes=row.notes,
            items=row.items,
            status=row.status,
            version=row.version,
            published_at=row.published_at,
            supersedes_public_id=previous.public_id if previous else None,
        )

    def create(self, user, class_public_id, payload: PlanCreate):
        klass = self._class(user, class_public_id)
        original = payload.model_dump(mode="json")
        existing = self.db.scalar(
            select(CampPlan).where(CampPlan.public_id == payload.request_id)
        )
        if existing:
            if (
                existing.class_id != klass.id
                or existing.created_by_user_id != user.id
                or existing.creation_payload != original
            ):
                raise HTTPException(
                    409, "Request ID already used for a different plan."
                )
            return self._read(existing)
        student_id = self._student(klass.id, payload.student_public_id)
        previous = None
        if payload.supersedes_public_id:
            previous = self.db.scalar(
                select(CampPlan).where(
                    CampPlan.public_id == payload.supersedes_public_id,
                    CampPlan.class_id == klass.id,
                )
            )
            if (
                not previous
                or previous.status != "published"
                or previous.student_id != student_id
            ):
                raise HTTPException(
                    422,
                    "Revision must refer to a published plan for the same class and recipient.",
                )
        content = payload.model_dump(
            include=set(PlanContent.model_fields), exclude={"items"}
        )
        row = CampPlan(
            public_id=payload.request_id,
            class_id=klass.id,
            student_id=student_id,
            created_by_user_id=user.id,
            **content,
            items=self._items(payload),
            creation_payload=original,
            supersedes_id=previous.id if previous else None
        )
        self.db.add(row)
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            existing = self.db.scalar(
                select(CampPlan).where(CampPlan.public_id == payload.request_id)
            )
            if (
                existing
                and existing.class_id == klass.id
                and existing.created_by_user_id == user.id
                and existing.creation_payload == original
            ):
                return self._read(existing)
            raise HTTPException(
                409, "A revision already exists. Reload plans to continue."
            )
        return self._read(row)

    def _locked(self, user, class_public_id, plan_public_id):
        klass = self._class(user, class_public_id)
        row = self.db.scalar(
            select(CampPlan)
            .where(CampPlan.class_id == klass.id, CampPlan.public_id == plan_public_id)
            .with_for_update()
        )
        if not row:
            raise HTTPException(404, "Plan not found.")
        return row

    def update(self, user, class_public_id, plan_public_id, payload: PlanUpdate):
        row = self._locked(user, class_public_id, plan_public_id)
        if row.status != "draft" or row.version != payload.expected_version:
            raise HTTPException(
                409,
                "Plan changed. Reload before editing; published plans need a new revision.",
            )
        for key, value in payload.model_dump(
            include=set(PlanContent.model_fields), exclude={"items"}
        ).items():
            setattr(row, key, value)
        row.items = self._items(payload)
        row.version += 1
        self.db.commit()
        return self._read(row)

    def publish(self, user, class_public_id, plan_public_id, expected_version):
        row = self._locked(user, class_public_id, plan_public_id)
        if row.status == "published":
            return self._read(row)
        if row.version != expected_version:
            raise HTTPException(
                409, "Plan changed. Reload and review before publishing."
            )
        if row.student_id:
            self._student(row.class_id, self.db.get(User, row.student_id).public_id)
        # Revalidate linked assessments before locking the published snapshot.
        row.items = self._items(
            PlanContent(
                title=row.title,
                planned_on=row.planned_on,
                focus=row.focus,
                notes=row.notes,
                items=[
                    {
                        k: v
                        for k, v in item.items()
                        if k not in ("analysis_type", "template_version")
                    }
                    for item in row.items
                ],
            )
        )
        row.status = "published"
        row.published_at = datetime.now(timezone.utc)
        row.version += 1
        self.db.commit()
        return self._read(row)

    def coach_list(self, user, class_public_id, limit=20, offset=0):
        klass = self._class(user, class_public_id)
        return self._list(
            select(CampPlan).where(CampPlan.class_id == klass.id), limit, offset
        )

    def get(self, user, class_public_id, plan_public_id):
        klass = self._class(user, class_public_id)
        row = self.db.scalar(
            select(CampPlan).where(
                CampPlan.class_id == klass.id, CampPlan.public_id == plan_public_id
            )
        )
        if not row:
            raise HTTPException(404, "Plan not found.")
        return self._read(row)

    def student_list(self, user, limit=20, offset=0):
        stmt = (
            select(CampPlan)
            .join(CampClass, CampClass.id == CampPlan.class_id)
            .join(ClassMember, ClassMember.class_id == CampPlan.class_id)
            .where(
                ClassMember.user_id == user.id,
                ClassMember.member_role == "student",
                ClassMember.status == "active",
                CampClass.status == "active",
                CampPlan.status == "published",
                or_(CampPlan.student_id.is_(None), CampPlan.student_id == user.id),
            )
        )
        return self._list(stmt, limit, offset)

    def _list(self, stmt, limit, offset):
        rows = self.db.scalars(
            stmt.order_by(
                CampPlan.planned_on.desc(),
                CampPlan.created_at.desc(),
                CampPlan.id.desc(),
            )
            .offset(offset)
            .limit(limit + 1)
        ).all()
        return PlansRead(
            items=[self._read(row) for row in rows[:limit]], has_more=len(rows) > limit
        )
