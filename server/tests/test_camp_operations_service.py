from __future__ import annotations

import unittest
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker

from app.models.analysis_report import AnalysisReport
from app.models.announcement import Announcement
from app.models.announcement_read import AnnouncementRead
from app.models.base import Base
from app.models.camp_class import CampClass
from app.models.class_member import ClassMember
from app.models.enums import (
    AnalysisType,
    ReportStatus,
    StorageProvider,
    UserRole,
    UserStatus,
    VideoUploadStatus,
)
from app.models.notification import Notification
from app.models.training_session import TrainingSession
from app.models.training_camp import TrainingCamp
from app.models.training_task import TrainingTask
from app.models.training_task_assignment import TrainingTaskAssignment
from app.models.training_template import TrainingTemplate
from app.models.user import User
from app.models.video import Video
from app.api.v1 import admin as admin_api
from app.api.v1 import me as me_api
from app.schemas.admin import (
    AdminBulkCreateClassMembersRequest,
    AdminCreateAnnouncementRequest,
    AdminCreateClassMemberRequest,
    AdminCreateUserRequest,
    AdminUpdateUserRequest,
)
from app.schemas.me import SubmitTaskReportRequest
from app.services.admin_service import AdminService
from app.services.me_service import MeService


@compiles(JSONB, "sqlite")
def _compile_jsonb_for_sqlite(_type, _compiler, **_kwargs) -> str:
    return "JSON"


_id_counters: defaultdict[str, int] = defaultdict(int)


def _assign_sqlite_bigint_id(_mapper, _connection, target) -> None:
    if getattr(target, "id", None) is not None:
        return
    table_name = target.__tablename__
    _id_counters[table_name] += 1
    target.id = 1000 + _id_counters[table_name]


for _model in (ClassMember, Announcement, AnnouncementRead, Notification):
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
                TrainingTemplate.__table__,
                TrainingTask.__table__,
                TrainingTaskAssignment.__table__,
                Video.__table__,
                TrainingSession.__table__,
                AnalysisReport.__table__,
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

    def test_student_task_submit_endpoint_returns_submission_history(self) -> None:
        assignment, session, report = self._seed_student_task_with_report(base_id=40)

        result = me_api.submit_task_report(
            assignment.public_id,
            SubmitTaskReportRequest(report_public_id=report.public_id),
            current_user=self.student,
            db=self.db,
        )

        self.assertEqual(result.public_id, assignment.public_id)
        self.assertEqual(result.status, "completed")
        self.assertEqual(result.latest_report_public_id, report.public_id)
        self.assertEqual(len(result.submission_reports), 1)
        self.assertEqual(result.submission_reports[0].report_public_id, report.public_id)
        self.assertEqual(result.submission_reports[0].session_public_id, session.public_id)
        self.assertEqual(result.submission_reports[0].overall_score, 86)

        detail_result = me_api.get_task(
            assignment.public_id,
            current_user=self.student,
            db=self.db,
        )

        self.assertEqual(
            [item.report_public_id for item in detail_result.submission_reports],
            [report.public_id],
        )

    def test_student_task_detail_endpoint_is_student_scoped(self) -> None:
        assignment, _session, report = self._seed_student_task_with_report(base_id=50)

        with self.assertRaises(HTTPException) as detail_missing:
            me_api.get_task(
                assignment.public_id,
                current_user=self.other_student,
                db=self.db,
            )
        with self.assertRaises(HTTPException) as submit_missing:
            me_api.submit_task_report(
                assignment.public_id,
                SubmitTaskReportRequest(report_public_id=report.public_id),
                current_user=self.other_student,
                db=self.db,
            )

        self.assertEqual(detail_missing.exception.status_code, 404)
        self.assertEqual(submit_missing.exception.status_code, 404)

    def test_student_can_submit_existing_report_to_visible_task(self) -> None:
        assignment, session, report = self._seed_student_task_with_report(base_id=20)

        service = MeService(self.db)
        result = service.submit_task_report(
            self.student,
            assignment.public_id,
            SubmitTaskReportRequest(report_public_id=report.public_id),
        )

        self.assertEqual(result.status, "completed")
        self.assertEqual(result.progress_percent, 100)
        self.assertEqual(result.best_score, 86)
        self.assertEqual(result.latest_report_public_id, report.public_id)
        self.assertEqual(len(result.submission_reports), 1)
        self.assertEqual(result.submission_reports[0].report_public_id, report.public_id)
        self.assertEqual(result.submission_reports[0].session_public_id, session.public_id)
        self.assertEqual(result.submission_reports[0].overall_score, 86)

        detail = service.get_task(self.student, assignment.public_id)
        self.assertEqual([item.report_public_id for item in detail.submission_reports], [report.public_id])

        self.db.refresh(session)
        self.db.refresh(assignment)
        self.assertEqual(session.task_assignment_id, assignment.id)
        self.assertEqual(session.class_id, self.class_row.id)
        self.assertEqual(session.source_type, "coach_task")

    def test_task_progress_is_limited_by_unmet_session_target(self) -> None:
        assignment, _session, report = self._seed_student_task_with_report(
            base_id=50,
            report_score=95,
            target_config={"target_sessions": 3, "target_score": 80},
        )

        service = MeService(self.db)
        result = service.submit_task_report(
            self.student,
            assignment.public_id,
            SubmitTaskReportRequest(report_public_id=report.public_id),
        )

        self.assertEqual(result.status, "in_progress")
        self.assertEqual(result.completed_sessions, 1)
        self.assertEqual(result.best_score, 95)
        self.assertEqual(result.progress_percent, 33.33)

    def test_task_progress_is_limited_by_unmet_score_target(self) -> None:
        assignment, _session, report = self._seed_student_task_with_report(
            base_id=51,
            report_score=40,
            target_config={"target_score": 80},
        )

        service = MeService(self.db)
        result = service.submit_task_report(
            self.student,
            assignment.public_id,
            SubmitTaskReportRequest(report_public_id=report.public_id),
        )

        self.assertEqual(result.status, "in_progress")
        self.assertEqual(result.completed_sessions, 1)
        self.assertEqual(result.best_score, 40)
        self.assertEqual(result.progress_percent, 50)

    def _seed_student_task_with_report(
        self,
        *,
        base_id: int,
        student: User | None = None,
        analysis_type: AnalysisType = AnalysisType.shooting,
        template_code: str = "shoot_front_form_close",
        report_score: int = 86,
        target_config: dict | None = None,
    ) -> tuple[TrainingTaskAssignment, TrainingSession, AnalysisReport]:
        task_student = student or self.student
        membership = ClassMember(
            id=base_id,
            class_id=self.class_row.id,
            user_id=task_student.id,
            member_role="student",
            status="active",
            joined_at=self.now,
        )
        task = TrainingTask(
            id=base_id,
            camp_id=self.camp.id,
            class_id=self.class_row.id,
            created_by_user_id=self.coach.id,
            title=f"Task {base_id}",
            description="Hit the target score with a fresh report.",
            analysis_type=analysis_type,
            template_code=template_code,
            target_config=target_config or {"target_sessions": 1, "target_score": 80},
            status="published",
            publish_at=self.now,
        )
        assignment = TrainingTaskAssignment(
            id=base_id,
            task_id=task.id,
            student_id=task_student.id,
            class_id=self.class_row.id,
            status="pending",
            progress_percent=0,
            completed_sessions=0,
        )
        video = Video(
            id=base_id,
            user_id=task_student.id,
            storage_provider=StorageProvider.supabase,
            bucket_name="training-videos",
            object_key=f"students/{task_student.username}/session/video-{base_id}.mp4",
            file_name=f"video-{base_id}.mp4",
            content_type="video/mp4",
            file_size=1024,
            upload_status=VideoUploadStatus.uploaded,
        )
        session = TrainingSession(
            id=base_id,
            student_id=task_student.id,
            analysis_type=analysis_type,
            template_code=template_code,
            template_version="v1",
            source_type="free_practice",
            status="completed",
            video_id=video.id,
            completed_at=self.now,
        )
        report = AnalysisReport(
            id=base_id,
            user_id=task_student.id,
            session_id=session.id,
            video_id=video.id,
            analysis_type=analysis_type,
            template_id=template_code,
            template_version="v1",
            status=ReportStatus.completed,
            overall_score=report_score,
            grade="A",
            score_data={"overall": report_score},
            analysis_finished_at=self.now,
        )
        self.db.add_all([membership, task, assignment, video, session, report])
        self.db.commit()
        return assignment, session, report

    def test_student_cannot_submit_mismatched_report_to_task(self) -> None:
        membership = ClassMember(
            id=30,
            class_id=self.class_row.id,
            user_id=self.student.id,
            member_role="student",
            status="active",
            joined_at=self.now,
        )
        task = TrainingTask(
            id=30,
            camp_id=self.camp.id,
            class_id=self.class_row.id,
            created_by_user_id=self.coach.id,
            title="Shooting only",
            analysis_type=AnalysisType.shooting,
            template_code="shoot_front_form_close",
            target_config={"target_sessions": 1},
            status="published",
            publish_at=self.now,
        )
        assignment = TrainingTaskAssignment(
            id=30,
            task_id=task.id,
            student_id=self.student.id,
            class_id=self.class_row.id,
            status="pending",
            progress_percent=0,
            completed_sessions=0,
        )
        video = Video(
            id=30,
            user_id=self.student.id,
            storage_provider=StorageProvider.supabase,
            bucket_name="training-videos",
            object_key="students/student_one/session/dribble.mp4",
            file_name="dribble.mp4",
            content_type="video/mp4",
            file_size=1024,
            upload_status=VideoUploadStatus.uploaded,
        )
        session = TrainingSession(
            id=30,
            student_id=self.student.id,
            analysis_type=AnalysisType.dribbling,
            template_code="dribble_front_narrow_crossover",
            source_type="free_practice",
            status="completed",
            video_id=video.id,
            completed_at=self.now,
        )
        report = AnalysisReport(
            id=30,
            user_id=self.student.id,
            session_id=session.id,
            video_id=video.id,
            analysis_type=AnalysisType.dribbling,
            template_id="dribble_front_narrow_crossover",
            status=ReportStatus.completed,
            overall_score=90,
            grade="S",
            score_data={"overall": 90},
            analysis_finished_at=self.now,
        )
        self.db.add_all([membership, task, assignment, video, session, report])
        self.db.commit()

        service = MeService(self.db)
        with self.assertRaises(HTTPException) as mismatch:
            service.submit_task_report(
                self.student,
                assignment.public_id,
                SubmitTaskReportRequest(report_public_id=report.public_id),
            )

        self.assertEqual(mismatch.exception.status_code, 400)
        self.db.refresh(session)
        self.assertIsNone(session.task_assignment_id)

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

    def test_non_admin_cannot_access_admin_user_management_endpoints(self) -> None:
        create_payload = AdminCreateUserRequest(
            username="blocked_student",
            password="password123",
            phone_number="900",
            email="blocked.student@example.com",
            role=UserRole.student,
        )
        update_payload = AdminUpdateUserRequest(nickname="Blocked update")
        attempts = [
            lambda: admin_api.list_users(current_user=self.coach, db=self.db),
            lambda: admin_api.create_user(create_payload, current_user=self.coach, db=self.db),
            lambda: admin_api.get_user_detail(
                self.student.public_id,
                current_user=self.coach,
                db=self.db,
            ),
            lambda: admin_api.update_user(
                self.student.public_id,
                update_payload,
                current_user=self.coach,
                db=self.db,
            ),
            lambda: admin_api.disable_user(
                self.student.public_id,
                current_user=self.coach,
                db=self.db,
            ),
        ]

        for attempt in attempts:
            with self.assertRaises(HTTPException) as denied:
                attempt()
            self.assertEqual(denied.exception.status_code, 403)

    def test_admin_disable_user_preserves_training_history(self) -> None:
        assignment, session, report = self._seed_student_task_with_report(base_id=60)
        service = AdminService(self.db)

        service.disable_user(self.admin, self.student.public_id)

        self.db.refresh(self.student)
        self.assertEqual(self.student.status, UserStatus.disabled)
        self.assertIsNotNone(self.student.deleted_at)
        self.assertEqual(
            self.db.scalar(
                select(func.count(AnalysisReport.id)).where(AnalysisReport.id == report.id)
            ),
            1,
        )
        self.assertEqual(
            self.db.scalar(
                select(func.count(TrainingSession.id)).where(TrainingSession.id == session.id)
            ),
            1,
        )
        self.assertEqual(
            self.db.scalar(
                select(func.count(TrainingTaskAssignment.id)).where(
                    TrainingTaskAssignment.id == assignment.id
                )
            ),
            1,
        )

        detail = service.get_user_detail(self.admin, self.student.public_id)

        self.assertEqual(detail.status, UserStatus.disabled)
        self.assertEqual(detail.report_count, 1)
        self.assertEqual(detail.task_assignment_count, 1)

    def test_admin_can_publish_class_announcement_and_notify_members(self) -> None:
        self.db.add_all(
            [
                ClassMember(
                    id=70,
                    class_id=self.class_row.id,
                    user_id=self.student.id,
                    member_role="student",
                    status="active",
                    joined_at=self.now,
                ),
                ClassMember(
                    id=71,
                    class_id=self.class_row.id,
                    user_id=self.coach.id,
                    member_role="coach",
                    status="active",
                    joined_at=self.now,
                ),
            ]
        )
        self.db.commit()

        result = admin_api.create_announcement(
            AdminCreateAnnouncementRequest(
                scope_type="class",
                class_public_id=self.class_row.public_id,
                title="Bring indoor shoes",
                content="Use indoor shoes for tomorrow's shooting block.",
                status="published",
                notify_recipients=True,
            ),
            current_user=self.admin,
            db=self.db,
        )

        self.assertEqual(result.scope_type, "class")
        self.assertEqual(result.class_public_id, self.class_row.public_id)
        self.assertEqual(result.status, "published")
        self.assertIsNotNone(result.publish_at)
        self.assertEqual(result.notification_count, 2)

        announcement = self.db.scalar(select(Announcement).where(Announcement.public_id == result.public_id))
        self.assertIsNotNone(announcement)
        notifications = self.db.scalars(
            select(Notification).where(
                Notification.business_type == "announcement",
                Notification.business_id == announcement.id,
            )
        ).all()

        self.assertEqual({item.user_id for item in notifications}, {self.student.id, self.coach.id})
        self.assertEqual({item.title for item in notifications}, {"Bring indoor shoes"})
        self.assertEqual({item.is_read for item in notifications}, {False})

        list_result = admin_api.list_announcements(
            scope_type="class",
            status_filter="published",
            target_role=None,
            camp_public_id=None,
            class_public_id=self.class_row.public_id,
            keyword=None,
            limit=100,
            current_user=self.admin,
            db=self.db,
        )

        listed = next(item for item in list_result.items if item.public_id == result.public_id)
        self.assertEqual(listed.notification_count, 2)
        self.assertEqual(listed.read_count, 0)

    def test_admin_can_archive_announcement_without_deleting_notifications(self) -> None:
        self.db.add(
            ClassMember(
                id=80,
                class_id=self.class_row.id,
                user_id=self.student.id,
                member_role="student",
                status="active",
                joined_at=self.now,
            )
        )
        self.db.commit()
        created = admin_api.create_announcement(
            AdminCreateAnnouncementRequest(
                scope_type="class",
                class_public_id=self.class_row.public_id,
                title="Court change",
                content="Use court two today.",
                status="published",
                notify_recipients=True,
            ),
            current_user=self.admin,
            db=self.db,
        )
        announcement = self.db.scalar(select(Announcement).where(Announcement.public_id == created.public_id))
        self.assertIsNotNone(announcement)
        self.assertEqual(
            self.db.scalar(
                select(func.count(Notification.id)).where(
                    Notification.business_type == "announcement",
                    Notification.business_id == announcement.id,
                )
            ),
            1,
        )

        response = admin_api.archive_announcement(
            created.public_id,
            current_user=self.admin,
            db=self.db,
        )

        self.assertEqual(response.status_code, 204)
        self.db.refresh(announcement)
        self.assertEqual(announcement.status, "archived")
        self.assertEqual(
            self.db.scalar(
                select(func.count(Notification.id)).where(
                    Notification.business_type == "announcement",
                    Notification.business_id == announcement.id,
                )
            ),
            1,
        )

        archived = admin_api.list_announcements(
            scope_type="class",
            status_filter="archived",
            target_role=None,
            camp_public_id=None,
            class_public_id=self.class_row.public_id,
            keyword=None,
            limit=100,
            current_user=self.admin,
            db=self.db,
        )

        self.assertEqual([item.public_id for item in archived.items], [created.public_id])
        self.assertEqual(archived.items[0].notification_count, 1)


if __name__ == "__main__":
    unittest.main()
