from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.achievement import Achievement
from app.models.analysis_report import AnalysisReport
from app.models.class_member import ClassMember
from app.models.enums import ReportStatus, UserRole
from app.models.notification import Notification
from app.models.report_snapshot import ReportSnapshot
from app.models.student_achievement import StudentAchievement
from app.models.student_growth_snapshot import StudentGrowthSnapshot
from app.models.training_session import TrainingSession
from app.models.training_task_assignment import TrainingTaskAssignment
from app.models.training_template import TrainingTemplate
from app.models.user import User
from app.schemas.report import ReportListItem, ReportRead, SaveReportRequest


COACH_ROLES = {UserRole.coach, UserRole.admin}
STUDENT_ROLES = {UserRole.user, UserRole.student}


def _numeric_to_float(value: Decimal | float | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _report_list_item(report: AnalysisReport) -> ReportListItem:
    video = report.video
    video_url = None
    if video:
        video_url = video.cdn_url or video.url

    return ReportListItem(
        public_id=report.public_id,
        session_public_id=report.session.public_id,
        video_public_id=report.video.public_id,
        analysis_type=report.analysis_type,
        template_code=report.template_id,
        template_version=report.template_version,
        overall_score=_numeric_to_float(report.overall_score),
        grade=report.grade,
        status=report.status.value,
        video_url=video_url,
        created_at=report.created_at,
        analysis_finished_at=report.analysis_finished_at,
    )


def _report_read(report: AnalysisReport) -> ReportRead:
    item = _report_list_item(report)
    return ReportRead(
        **item.model_dump(),
        score_data=report.score_data,
        timeline_data=report.timeline_data,
        summary_data=report.summary_data,
    )


class ReportService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def save_report(self, current_user: User, payload: SaveReportRequest) -> ReportRead:
        if current_user.role not in STUDENT_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only students can submit training reports.",
            )

        session = self.db.scalar(
            select(TrainingSession)
            .options(
                selectinload(TrainingSession.video),
                selectinload(TrainingSession.task_assignment).selectinload(TrainingTaskAssignment.task),
                selectinload(TrainingSession.analysis_reports),
            )
            .where(
                TrainingSession.public_id == payload.session_public_id,
                TrainingSession.student_id == current_user.id,
            )
        )
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training session not found.")
        if not session.video:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The training session has not completed video upload yet.",
            )

        template = self.db.scalar(
            select(TrainingTemplate).where(TrainingTemplate.template_code == payload.template_code)
        )
        existing_report = self.db.scalar(
            select(AnalysisReport)
            .where(AnalysisReport.session_id == session.id)
            .order_by(AnalysisReport.created_at.desc())
        )

        now = datetime.now(timezone.utc)
        report = existing_report or AnalysisReport(
            user_id=current_user.id,
            session_id=session.id,
            video_id=session.video_id,
            analysis_type=session.analysis_type,
            template_id=payload.template_code,
            training_template_id=template.id if template else None,
            template_version=payload.template_version,
            score_data=payload.score_data,
        )

        report.user_id = current_user.id
        report.session_id = session.id
        report.video_id = session.video_id
        report.analysis_type = session.analysis_type
        report.template_id = payload.template_code
        report.training_template_id = template.id if template else None
        report.template_version = payload.template_version
        report.status = ReportStatus.completed
        report.overall_score = payload.overall_score
        report.grade = payload.grade
        report.score_data = payload.score_data
        report.timeline_data = payload.timeline_data
        report.summary_data = payload.summary_data
        report.analysis_started_at = payload.analysis_started_at or session.analysis_started_at or now
        report.analysis_finished_at = payload.analysis_finished_at or now

        self.db.add(report)
        self.db.flush()

        snapshot = ReportSnapshot(
            report_id=report.id,
            template_version=report.template_version or "v1",
            score_data=report.score_data,
            timeline_data=report.timeline_data,
            summary_data=report.summary_data,
        )
        self.db.add(snapshot)

        session.status = "completed"
        session.analysis_started_at = report.analysis_started_at
        session.completed_at = report.analysis_finished_at
        self.db.add(session)

        if session.task_assignment:
            self._update_task_assignment(session.task_assignment, report)

        self._upsert_daily_growth_snapshot(current_user.id, report)
        unlocked = self._unlock_achievements_if_needed(current_user.id, report)

        self.db.add(
            Notification(
                user_id=current_user.id,
                type="report_ready",
                title="Your training report is ready",
                content=f"{payload.template_code} report has been saved.",
                business_type="analysis_report",
                business_id=report.id,
                is_read=False,
            )
        )
        for achievement in unlocked:
            self.db.add(
                Notification(
                    user_id=current_user.id,
                    type="achievement_unlocked",
                    title="Achievement unlocked",
                    content=f"You unlocked {achievement.achievement.name}.",
                    business_type="student_achievement",
                    business_id=achievement.id,
                    is_read=False,
                )
            )

        self.db.commit()
        self.db.refresh(report)
        report = self.db.scalar(
            select(AnalysisReport)
            .options(selectinload(AnalysisReport.session), selectinload(AnalysisReport.video))
            .where(AnalysisReport.id == report.id)
        ) or report
        return _report_read(report)

    def list_my_reports(self, current_user: User, limit: int = 20) -> list[ReportListItem]:
        reports = self.db.scalars(
            select(AnalysisReport)
            .options(selectinload(AnalysisReport.session), selectinload(AnalysisReport.video))
            .where(AnalysisReport.user_id == current_user.id)
            .order_by(AnalysisReport.created_at.desc())
            .limit(limit)
        ).all()
        return [_report_list_item(report) for report in reports]

    def get_report_detail(self, current_user: User, report_public_id: UUID) -> ReportRead:
        report = self.db.scalar(
            select(AnalysisReport)
            .options(
                selectinload(AnalysisReport.session),
                selectinload(AnalysisReport.video),
            )
            .where(AnalysisReport.public_id == report_public_id)
        )
        if not report:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")
        if not self._can_access_report(current_user, report):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view this report.",
            )
        return _report_read(report)

    def _can_access_report(self, current_user: User, report: AnalysisReport) -> bool:
        if current_user.role == UserRole.admin:
            return True
        if report.user_id == current_user.id:
            return True
        if current_user.role != UserRole.coach or not report.session.class_id:
            return False

        membership = self.db.scalar(
            select(ClassMember).where(
                ClassMember.class_id == report.session.class_id,
                ClassMember.user_id == current_user.id,
                ClassMember.member_role == "coach",
                ClassMember.status == "active",
            )
        )
        return membership is not None

    def _update_task_assignment(self, assignment: TrainingTaskAssignment, report: AnalysisReport) -> None:
        assignment.completed_sessions = int(assignment.completed_sessions) + 1
        assignment.last_submission_at = report.analysis_finished_at
        assignment.latest_report_id = report.id

        report_score = _numeric_to_float(report.overall_score) or 0
        if assignment.best_score is None or report_score > float(assignment.best_score):
            assignment.best_score = report_score

        target_config = assignment.task.target_config or {}
        target_sessions = int(target_config.get("target_sessions", 1))
        target_score = float(target_config.get("target_score", 0))

        session_progress = min(assignment.completed_sessions / max(target_sessions, 1), 1)
        score_progress = 1.0 if target_score <= 0 else min(report_score / target_score, 1)
        assignment.progress_percent = round(max(session_progress, score_progress) * 100, 2)

        meets_sessions = assignment.completed_sessions >= target_sessions
        meets_score = target_score <= 0 or report_score >= target_score
        if meets_sessions and meets_score:
            assignment.status = "completed"
            assignment.completed_at = report.analysis_finished_at
        elif assignment.completed_sessions > 0:
            assignment.status = "in_progress"
        else:
            assignment.status = "pending"

        self.db.add(assignment)

    def _upsert_daily_growth_snapshot(self, student_id: int, report: AnalysisReport) -> None:
        snapshot_day = (report.analysis_finished_at or report.created_at or datetime.now(timezone.utc)).date()
        snapshot = self.db.scalar(
            select(StudentGrowthSnapshot).where(
                StudentGrowthSnapshot.student_id == student_id,
                StudentGrowthSnapshot.snapshot_date == snapshot_day,
                StudentGrowthSnapshot.period_type == "day",
                StudentGrowthSnapshot.analysis_type == report.analysis_type,
            )
        )

        recent_reports = self.db.scalars(
            select(AnalysisReport).where(
                AnalysisReport.user_id == student_id,
                AnalysisReport.analysis_type == report.analysis_type,
                func.date(AnalysisReport.created_at) == snapshot_day,
            )
        ).all()

        scores = [float(item.overall_score) for item in recent_reports if item.overall_score is not None]
        snapshot = snapshot or StudentGrowthSnapshot(
            student_id=student_id,
            snapshot_date=snapshot_day,
            period_type="day",
            analysis_type=report.analysis_type,
        )
        snapshot.session_count = len(recent_reports)
        snapshot.average_score = round(sum(scores) / len(scores), 2) if scores else None
        snapshot.best_score = max(scores) if scores else None
        snapshot.training_days_count = 1 if recent_reports else 0
        snapshot.streak_days = self._calculate_streak_days(student_id, report.analysis_type, snapshot_day)
        snapshot.improvement_delta = None
        snapshot.metric_summary = report.summary_data
        self.db.add(snapshot)

    def _calculate_streak_days(self, student_id: int, analysis_type, current_day: date) -> int:
        days = self.db.scalars(
            select(func.date(AnalysisReport.created_at))
            .where(
                AnalysisReport.user_id == student_id,
                AnalysisReport.analysis_type == analysis_type,
                AnalysisReport.created_at >= current_day - timedelta(days=90),
            )
            .distinct()
            .order_by(func.date(AnalysisReport.created_at).desc())
        ).all()
        if not days:
            return 0

        normalized_days = [day if isinstance(day, date) else day.date() for day in days]
        streak = 0
        cursor = current_day
        day_set = set(normalized_days)
        while cursor in day_set:
            streak += 1
            cursor = cursor - timedelta(days=1)
        return streak

    def _unlock_achievements_if_needed(self, student_id: int, report: AnalysisReport) -> list[StudentAchievement]:
        existing_ids = set(
            self.db.scalars(
                select(StudentAchievement.achievement_id).where(StudentAchievement.student_id == student_id)
            ).all()
        )
        achievements = self.db.scalars(
            select(Achievement).where(Achievement.status == "active")
        ).all()

        total_sessions = self.db.scalar(
            select(func.count(TrainingSession.id)).where(
                TrainingSession.student_id == student_id,
                TrainingSession.status == "completed",
            )
        ) or 0
        best_score = self.db.scalar(
            select(func.max(AnalysisReport.overall_score)).where(AnalysisReport.user_id == student_id)
        )
        best_score_value = float(best_score) if best_score is not None else 0.0

        unlocked: list[StudentAchievement] = []
        for achievement in achievements:
            if achievement.id in existing_ids:
                continue
            if self._achievement_matches(achievement, total_sessions, best_score_value):
                student_achievement = StudentAchievement(
                    student_id=student_id,
                    achievement_id=achievement.id,
                    source_report_id=report.id,
                    source_task_assignment_id=report.session.task_assignment_id,
                    unlocked_at=report.analysis_finished_at or datetime.now(timezone.utc),
                )
                self.db.add(student_achievement)
                self.db.flush()
                unlocked.append(student_achievement)
        return unlocked

    def _achievement_matches(self, achievement: Achievement, total_sessions: int, best_score: float) -> bool:
        config = achievement.rule_config or {}
        if achievement.rule_type == "total_sessions":
            return total_sessions >= int(config.get("count", 0))
        if achievement.rule_type == "best_score":
            return best_score >= float(config.get("score", 0))
        return False
