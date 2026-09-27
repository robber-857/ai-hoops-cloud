from uuid import uuid4
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.models.camp_lesson import CampLesson, CampLessonRevision
from app.models.camp_plan import CampPlan
from app.models.camp_class import CampClass
from app.models.class_member import ClassMember
from app.models.user import User
from app.schemas.camp_lesson import (
    LessonContent,
    LessonRead,
    LessonsRead,
    LessonSummary,
    LessonHistory,
    LessonHistoryEntry,
)
from app.services.camp_plan_service import CampPlanService


class CampLessonService:
    def __init__(self, db: Session):
        self.db = db

    def _class(self, user, class_id):
        return CampPlanService(self.db)._class(user, class_id)

    def _lesson(self, user, class_id, lesson_id, lock=False):
        klass = self._class(user, class_id)
        stmt = select(CampLesson).where(
            CampLesson.class_id == klass.id, CampLesson.public_id == lesson_id
        )
        if lock:
            stmt = stmt.with_for_update().execution_options(populate_existing=True)
        row = self.db.scalar(stmt)
        if not row:
            raise HTTPException(404, "Lesson not found.")
        return row

    def _read(self, row, content=None, version=None, updated_at=None):
        klass = self.db.get(CampClass, row.class_id)
        return LessonRead(
            **(content or row.content),
            public_id=row.public_id,
            class_public_id=klass.public_id,
            class_name=klass.name,
            version=version or row.version,
            source_plan=row.source_plan,
            roster=row.roster,
            updated_at=updated_at or row.updated_at
        )

    def create(self, user, class_id, payload):
        klass = self._class(user, class_id)
        original = payload.model_dump(mode="json")
        existing = self.db.scalar(
            select(CampLesson).where(CampLesson.public_id == payload.request_id)
        )
        if existing:
            if (
                existing.class_id != klass.id
                or existing.created_by_user_id != user.id
                or existing.creation_payload != original
            ):
                raise HTTPException(409, "Request ID already used for another lesson.")
            return self._read(existing)
        plan = self.db.scalar(
            select(CampPlan).where(
                CampPlan.public_id == payload.plan_public_id,
                CampPlan.class_id == klass.id,
                CampPlan.status == "published",
            )
        )
        if not plan:
            raise HTTPException(422, "Choose a published plan from this class.")
        stmt = (
            select(User)
            .join(ClassMember, ClassMember.user_id == User.id)
            .where(
                ClassMember.class_id == klass.id,
                ClassMember.member_role == "student",
                ClassMember.status == "active",
            )
            .order_by(User.id)
        )
        if plan.student_id:
            stmt = stmt.where(User.id == plan.student_id)
        students = self.db.scalars(stmt).all()
        if not students or len(students) > 300:
            raise HTTPException(
                422,
                "A lesson requires 1–300 active players in its plan recipient group.",
            )
        roster = [
            dict(student_public_id=str(s.public_id), name=s.nickname or s.username)
            for s in students
        ]
        items = [
            dict(
                item_id=str(uuid4()),
                name=i["name"],
                actual_minutes=None,
                notes=i.get("instructions"),
            )
            for i in plan.items
        ]
        participants = [
            dict(
                student_public_id=s["student_public_id"],
                status="unconfirmed",
                notes=None,
                items=[dict(item_id=i["item_id"], minutes=None) for i in items],
            )
            for s in roster
        ]
        content = LessonContent(
            title=plan.title,
            held_on=payload.held_on,
            items=items,
            participants=participants,
        ).model_dump(mode="json")
        row = CampLesson(
            public_id=payload.request_id,
            class_id=klass.id,
            plan_id=plan.id,
            created_by_user_id=user.id,
            held_on=payload.held_on,
            version=1,
            content=content,
            source_plan=CampPlanService(self.db)._read(plan).model_dump(mode="json"),
            roster=roster,
            creation_payload=original,
        )
        try:
            self.db.add(row)
            self.db.flush()
            self.db.add(
                CampLessonRevision(
                    public_id=payload.request_id,
                    lesson_id=row.id,
                    version=1,
                    saved_by_user_id=user.id,
                    content=content,
                    request_payload=original,
                )
            )
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            existing = self.db.scalar(
                select(CampLesson).where(CampLesson.public_id == payload.request_id)
            )
            if (
                existing
                and existing.class_id == klass.id
                and existing.created_by_user_id == user.id
                and existing.creation_payload == original
            ):
                return self._read(existing)
            raise HTTPException(
                409, "Lesson request conflicts with an existing record."
            )
        return self._read(row)

    def update(self, user, class_id, lesson_id, payload):
        row = self._lesson(user, class_id, lesson_id, lock=True)
        original = payload.model_dump(mode="json")
        previous = self.db.scalar(
            select(CampLessonRevision).where(
                CampLessonRevision.public_id == payload.request_id
            )
        )
        if previous:
            if (
                previous.lesson_id != row.id
                or previous.saved_by_user_id != user.id
                or previous.request_payload != original
            ):
                raise HTTPException(409, "Save request ID already used.")
            return self._read(row)
        if row.version != payload.expected_version:
            raise HTTPException(
                409,
                "This lesson changed. Reload the latest saved version before editing.",
            )
        if {str(p.student_public_id) for p in payload.participants} != {
            p["student_public_id"] for p in row.roster
        }:
            raise HTTPException(
                422,
                "Keep the original lesson roster. Record absence instead of removing a player.",
            )
        content = payload.model_dump(
            mode="json", include=set(LessonContent.model_fields)
        )
        row.content = content
        row.held_on = payload.held_on
        row.version += 1
        self.db.add(
            CampLessonRevision(
                public_id=payload.request_id,
                lesson_id=row.id,
                version=row.version,
                saved_by_user_id=user.id,
                content=content,
                request_payload=original,
            )
        )
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                409,
                "Save request conflicts with an existing record. Reload the lesson.",
            )
        return self._read(row)

    def get(self, user, class_id, lesson_id):
        return self._read(self._lesson(user, class_id, lesson_id))

    def list(self, user, class_id, limit=20, offset=0):
        klass = self._class(user, class_id)
        rows = self.db.scalars(
            select(CampLesson)
            .where(CampLesson.class_id == klass.id)
            .order_by(
                CampLesson.held_on.desc(),
                CampLesson.created_at.desc(),
                CampLesson.id.desc(),
            )
            .offset(offset)
            .limit(limit + 1)
        ).all()
        return LessonsRead(
            items=[
                LessonSummary(
                    public_id=r.public_id,
                    title=r.content["title"],
                    held_on=r.held_on,
                    version=r.version,
                    unconfirmed_count=sum(
                        p["status"] == "unconfirmed" for p in r.content["participants"]
                    ),
                    missing_minutes_count=sum(
                        i["actual_minutes"] is None for i in r.content["items"]
                    ),
                )
                for r in rows[:limit]
            ],
            has_more=len(rows) > limit,
        )

    def history(self, user, class_id, lesson_id, limit=20, offset=0):
        row = self._lesson(user, class_id, lesson_id)
        records = self.db.scalars(
            select(CampLessonRevision)
            .where(CampLessonRevision.lesson_id == row.id)
            .order_by(CampLessonRevision.version.desc())
            .offset(offset)
            .limit(limit + 1)
        ).all()
        return LessonHistory(
            items=[
                LessonHistoryEntry(version=r.version, saved_at=r.created_at)
                for r in records[:limit]
            ],
            has_more=len(records) > limit,
        )

    def revision(self, user, class_id, lesson_id, version):
        row = self._lesson(user, class_id, lesson_id)
        saved = self.db.scalar(
            select(CampLessonRevision).where(
                CampLessonRevision.lesson_id == row.id,
                CampLessonRevision.version == version,
            )
        )
        if not saved:
            raise HTTPException(404, "Saved version not found.")
        return self._read(row, saved.content, saved.version, saved.created_at)
