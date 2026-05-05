from __future__ import annotations

import unittest
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session, sessionmaker

from app.models.announcement import Announcement
from app.models.announcement_read import AnnouncementRead
from app.models.base import Base
from app.models.camp_class import CampClass
from app.models.class_member import ClassMember
from app.models.enums import UserRole, UserStatus
from app.models.notification import Notification
from app.models.training_camp import TrainingCamp
from app.models.user import User
from app.schemas.admin import (
    AdminBulkCreateClassMembersRequest,
    AdminCreateClassMemberRequest,
    AdminCreateUserRequest,
    AdminUpdateUserRequest,
)
from app.services.admin_service import AdminService
from app.services.me_service import MeService


_id_counters: defaultdict[str, int] = defaultdict(int)


def _assign_sqlite_bigint_id(_mapper, _connection, target) -> None:
    if getattr(target, "id", None) is not None:
        return
    table_name = target.__tablename__
    _id_counters[table_name] += 1
    target.id = 1000 + _id_counters[table_name]


for _model in (ClassMember, AnnouncementRead, Notification):
    event.listen(_model, "before_insert", _assign_sqlite_bigint_id)


class CampOperationsServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        engine = create_engine("sqlite:///:memory:", future=True)
        Base.metadata.create_all(
            engine,
            tables=[
                User.__table__,
                TrainingCamp.__table__,
                CampClass.__table__,
                ClassMember.__table__,
                Announcement.__table__,
                AnnouncementRead.__table__,
                Notification.__table__,
            ],
        )
        self.session_factory = sessionmaker(bind=engine, class_=Session, future=True)
        self.db = self.session_factory()
        self.now = datetime(2026, 5, 5, 10, tzinfo=timezone.utc)
        self._seed_base_rows()

    def tearDown(self) -> None:
        self.db.close()

    def _seed_base_rows(self) -> None:
        self.admin = User(
            id=1,
            username="admin",
            password_hash="x",
            phone_number="100",
            role=UserRole.admin,
            status=UserStatus.active,
        )
        self.student = User(
            id=2,
            username="student_one",
            password_hash="x",
            phone_number="200",
            email="student.one@example.com",
            role=UserRole.student,
            status=UserStatus.active,
        )
        self.coach = User(
            id=3,
            username="coach_one",
            password_hash="x",
            phone_number="300",
            email="coach.one@example.com",
            role=UserRole.coach,
            status=UserStatus.active,
        )
        self.other_student = User(
            id=4,
            username="student_two",
            password_hash="x",
            phone_number="400",
            email="student.two@example.com",
            role=UserRole.student,
            status=UserStatus.active,
        )
        self.camp = TrainingCamp(id=1, name="Sydney Camp", code="SYD")
        self.class_row = CampClass(id=1, camp_id=1, name="U14 Skills", code="U14")
        self.db.add_all([self.admin, self.student, self.coach, self.other_student, self.camp, self.class_row])
        self.db.commit()

    def test_me_announcements_are_filtered_and_marked_read(self) -> None:
        published_at = datetime(2020, 1, 1, 10, tzinfo=timezone.utc)
        membership = ClassMember(
            id=1,
            class_id=self.class_row.id,
            user_id=self.student.id,
            member_role="student",
            status="active",
            joined_at=self.now,
        )
        announcements = [
            Announcement(
                id=1,
                publisher_user_id=self.admin.id,
                scope_type="global",
                title="Global notice",
                content="Everyone sees this.",
                status="published",
                publish_at=published_at,
            ),
            Announcement(
                id=2,
                publisher_user_id=self.admin.id,
                scope_type="role",
                target_role="student",
                title="Student notice",
                content="Students see this.",
                status="published",
                publish_at=published_at,
            ),
            Announcement(
                id=3,
                publisher_user_id=self.coach.id,
                scope_type="class",
                camp_id=self.camp.id,
                class_id=self.class_row.id,
                title="Class notice",
                content="Class members see this.",
                status="published",
                publish_at=published_at,
            ),
            Announcement(
                id=4,
                publisher_user_id=self.admin.id,
                scope_type="camp",
                camp_id=self.camp.id,
                title="Camp notice",
                content="Camp members see this.",
                status="published",
                publish_at=published_at,
            ),
            Announcement(
                id=5,
                publisher_user_id=self.admin.id,
                scope_type="role",
                target_role="coach",
                title="Coach only",
                content="Students should not see this.",
                status="published",
                publish_at=published_at,
            ),
            Announcement(
                id=6,
                publisher_user_id=self.admin.id,
                scope_type="global",
                title="Draft notice",
                content="Drafts are hidden.",
                status="draft",
            ),
        ]
        self.db.add_all([membership, *announcements])
        self.db.add(
            AnnouncementRead(
                id=1,
                announcement_id=1,
                user_id=self.student.id,
                read_at=self.now,
            )
        )
        self.db.add(
            Notification(
                id=1,
                user_id=self.student.id,
                type="announcement",
                title="Class notice",
                business_type="announcement",
                business_id=3,
                is_read=False,
            )
        )
        self.db.commit()

        service = MeService(self.db)
        response = service.get_announcements(self.student, limit=10)
        titles = {item.title for item in response.items}

        self.assertEqual(titles, {"Global notice", "Student notice", "Class notice", "Camp notice"})
        self.assertEqual(response.unread_count, 3)

        read_item = service.mark_announcement_read(self.student, announcements[2].public_id)

        self.assertTrue(read_item.is_read)
        notification = self.db.scalar(select(Notification).where(Notification.id == 1))
        self.assertIsNotNone(notification)
        self.assertTrue(notification.is_read)
        self.assertEqual(service.get_announcements(self.student, limit=10).unread_count, 2)

    def test_me_notifications_are_user_scoped_and_marked_read(self) -> None:
        self.db.add_all(
            [
                Notification(
                    id=10,
                    user_id=self.coach.id,
                    type="announcement",
                    title="Coach announcement",
                    content="A visible coach notice.",
                    business_type="announcement",
                    business_id=100,
                    is_read=False,
                    created_at=self.now,
                ),
                Notification(
                    id=11,
                    user_id=self.coach.id,
                    type="task",
                    title="Coach task",
                    content="A task event.",
                    business_type="training_task",
                    business_id=200,
                    is_read=True,
                    read_at=self.now,
                    created_at=self.now,
                ),
                Notification(
                    id=12,
                    user_id=self.student.id,
                    type="announcement",
                    title="Student only",
                    content="Coach should not see this.",
                    business_type="announcement",
                    business_id=300,
                    is_read=False,
                    created_at=self.now,
                ),
            ]
        )
        self.db.commit()

        service = MeService(self.db)
        response = service.get_notifications(self.coach, limit=10)

        self.assertEqual({item.title for item in response.items}, {"Coach announcement", "Coach task"})
        self.assertEqual(response.unread_count, 1)

        unread = next(item for item in response.items if not item.is_read)
        read_item = service.mark_notification_read(self.coach, unread.public_id)

        self.assertTrue(read_item.is_read)
        self.assertIsNotNone(read_item.read_at)
        self.assertEqual(service.get_notifications(self.coach, limit=10).unread_count, 0)

    def test_admin_can_add_class_members_by_username_and_get_batch_errors(self) -> None:
        service = AdminService(self.db)

        member = service.add_class_member(
            self.admin,
            self.class_row.public_id,
            AdminCreateClassMemberRequest(username="student_one", member_role="student"),
        )

        self.assertEqual(member.username, "student_one")
        self.assertEqual(member.member_role, "student")

        with self.assertRaises(HTTPException) as duplicate:
            service.add_class_member(
                self.admin,
                self.class_row.public_id,
                AdminCreateClassMemberRequest(username="student_one", member_role="student"),
            )
        self.assertEqual(duplicate.exception.status_code, 409)

        with self.assertRaises(HTTPException) as mismatch:
            service.add_class_member(
                self.admin,
                self.class_row.public_id,
                AdminCreateClassMemberRequest(username="coach_one", member_role="student"),
            )
        self.assertEqual(mismatch.exception.status_code, 400)

        result = service.bulk_add_class_members(
            self.admin,
            self.class_row.public_id,
            AdminBulkCreateClassMembersRequest(
                identifiers=["coach_one", "missing_user", "student_two"],
                member_role="coach",
            ),
        )

        self.assertEqual([item.username for item in result.added], ["coach_one"])
        self.assertEqual({item.identifier for item in result.errors}, {"missing_user", "student_two"})

    def test_admin_user_identity_conflicts_report_field_level_details(self) -> None:
        service = AdminService(self.db)

        with self.assertRaises(HTTPException) as create_conflict:
            service.create_user(
                self.admin,
                AdminCreateUserRequest(
                    username="student_one",
                    password="password123",
                    phone_number="300",
                    email="coach.one@example.com",
                    role=UserRole.student,
                ),
            )

        self.assertEqual(create_conflict.exception.status_code, 409)
        self.assertEqual(
            create_conflict.exception.detail,
            [
                {"field": "username", "msg": "Username already exists."},
                {"field": "email", "msg": "Email already exists."},
                {"field": "phone_number", "msg": "Phone number already exists."},
            ],
        )

        with self.assertRaises(HTTPException) as update_conflict:
            service.update_user(
                self.admin,
                self.other_student.public_id,
                AdminUpdateUserRequest(
                    username="student_one",
                    phone_number="300",
                    email="coach.one@example.com",
                ),
            )

        self.assertEqual(update_conflict.exception.status_code, 409)
        self.assertEqual(
            [item["field"] for item in update_conflict.exception.detail],
            ["username", "email", "phone_number"],
        )


if __name__ == "__main__":
    unittest.main()
