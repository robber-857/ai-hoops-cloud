from __future__ import annotations

from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.achievement import Achievement
from app.models.analysis_report import AnalysisReport
from app.models.class_member import ClassMember
from app.models.enums import AnalysisType, ReportStatus, UserRole
from app.models.notification import Notification
from app.models.report_snapshot import ReportSnapshot
from app.models.student_achievement import StudentAchievement
from app.models.student_growth_snapshot import StudentGrowthSnapshot
from app.models.training_session import TrainingSession
from app.models.training_task_assignment import TrainingTaskAssignment
from app.models.training_template import TrainingTemplate
from app.models.training_template_version import TrainingTemplateVersion
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


def _template_snapshot_from_version(
    version: TrainingTemplateVersion | None,
    *,
    template_code: str,
    template_version: str | None,
) -> dict | None:
    if version is None or not isinstance(version.scoring_rules, dict):
        return None
    raw_template = version.scoring_rules.get("template")
    if not isinstance(raw_template, dict):
        return None

    snapshot = deepcopy(raw_template)
    snapshot.setdefault("templateId", template_code)
    if template_version:
        snapshot.setdefault("version", template_version)
    content_hash = version.scoring_rules.get("content_hash")
    if isinstance(content_hash, str) and content_hash:
        snapshot["contentHash"] = content_hash
    return snapshot


def _report_read(report: AnalysisReport, template_snapshot: dict | None = None) -> ReportRead:
    item = _report_list_item(report)
    return ReportRead(
        **item.model_dump(),
        score_data=report.score_data,
        timeline_data=report.timeline_data,
        summary_data=report.summary_data,
        template_snapshot=template_snapshot,
    )


class ReportService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _template_snapshot_for_report(self, report: AnalysisReport) -> dict | None:
        score_data = report.score_data if isinstance(report.score_data, dict) else {}
        stored_snapshot = score_data.get("template_snapshot")
        if isinstance(stored_snapshot, dict):
            return deepcopy(stored_snapshot)
        if not report.training_template_id or not report.template_version:
            return None

        version = self.db.scalar(
            select(TrainingTemplateVersion).where(
                TrainingTemplateVersion.template_id == report.training_template_id,
                TrainingTemplateVersion.version == report.template_version,
            )
        )
        return _template_snapshot_from_version(
            version,
            template_code=report.template_id,
            template_version=report.template_version,
        )

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

        strict_template_lock = (
            session.analysis_type == AnalysisType.training
            or getattr(session, "task_assignment", None) is not None
        )
        normalized_template_code = (
            session.template_code if strict_template_lock else payload.template_code
        )
        if strict_template_lock and not normalized_template_code:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This training session is missing its locked template.",
            )
        normalized_template_code = normalized_template_code or payload.template_code
        if strict_template_lock and payload.template_code != normalized_template_code:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The report template does not match the uploaded training session.",
            )

        template = self.db.scalar(
            select(TrainingTemplate).where(TrainingTemplate.template_code == normalized_template_code)
        )
        resolved_template_version: TrainingTemplateVersion | None = None
        if strict_template_lock:
            if not template:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="The report template no longer exists in the template catalog.",
                )
            if template.analysis_type != session.analysis_type:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="The report template does not support this session analysis type.",
                )

            if (
                session.template_version
                and payload.template_version
                and payload.template_version != session.template_version
            ):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="The report template version does not match the uploaded training session.",
                )
            normalized_template_version = (
                session.template_version
                or payload.template_version
                or template.current_version
            )
            if not normalized_template_version:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="The report template does not have a resolved version.",
                )
            resolved_template_version = self.db.scalar(
                select(TrainingTemplateVersion).where(
                    TrainingTemplateVersion.template_id == template.id,
                    TrainingTemplateVersion.version == normalized_template_version,
                )
            )
            if not resolved_template_version:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="The report template version does not exist.",
                )
        else:
            normalized_template_version = payload.template_version

        existing_report = self.db.scalar(
            select(AnalysisReport)
            .where(AnalysisReport.session_id == session.id)
            .order_by(AnalysisReport.created_at.desc())
        )
        if strict_template_lock and existing_report and (
            existing_report.template_id != normalized_template_code
            or existing_report.template_version != normalized_template_version
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An existing report is already locked to another template version.",
            )
        is_new_report = existing_report is None

        score_data = dict(payload.score_data)
        template_snapshot = _template_snapshot_from_version(
            resolved_template_version,
            template_code=normalized_template_code,
            template_version=normalized_template_version,
        )
        if template_snapshot is not None:
            score_data["template_snapshot"] = template_snapshot

        now = datetime.now(timezone.utc)
        report = existing_report or AnalysisReport(
            user_id=current_user.id,
            session_id=session.id,
            video_id=session.video_id,
            analysis_type=session.analysis_type,
            template_id=normalized_template_code,
            training_template_id=template.id if template else None,
            template_version=normalized_template_version,
            score_data=score_data,
        )

        report.user_id = current_user.id
        report.session_id = session.id
        report.video_id = session.video_id
        report.analysis_type = session.analysis_type
        report.template_id = normalized_template_code
        report.training_template_id = template.id if template else None
        report.template_version = normalized_template_version
        report.status = ReportStatus.completed
        report.overall_score = payload.overall_score
        report.grade = payload.grade
        report.score_data = score_data
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
            self._update_task_assignment(session.task_assignment)

        self._upsert_daily_growth_snapshot(current_user.id, report)
        unlocked = self._unlock_achievements_if_needed(current_user.id, report)

        if is_new_report:
            self.db.add(
                Notification(
                    user_id=current_user.id,
                    type="report_ready",
                    title="Your training report is ready",
                    content=f"{normalized_template_code} report has been saved.",
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
        return _report_read(report, self._template_snapshot_for_report(report))

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
        return _report_read(report, self._template_snapshot_for_report(report))

    def _can_access_report(self, current_user: User, report: AnalysisReport) -> bool:
        if current_user.role == UserRole.admin:
            return True
        if report.user_id == current_user.id:
            return True
        if current_user.role != UserRole.coach:
            return False

        if report.session.class_id:
            membership = self.db.scalar(
                select(ClassMember).where(
                    ClassMember.class_id == report.session.class_id,
                    ClassMember.user_id == current_user.id,
                    ClassMember.member_role == "coach",
                    ClassMember.status == "active",
                )
            )
            return membership is not None

        student_class_ids = (
            select(ClassMember.class_id)
            .where(
                ClassMember.user_id == report.user_id,
                ClassMember.member_role == "student",
                ClassMember.status == "active",
            )
        )
        membership = self.db.scalar(
            select(ClassMember).where(
                ClassMember.class_id.in_(student_class_ids),
                ClassMember.user_id == current_user.id,
                ClassMember.member_role == "coach",
                ClassMember.status == "active",
            )
            )
        return membership is not None

    def get_shared_report_detail(self, report_public_id: UUID) -> ReportRead:
        report = self.db.scalar(
            select(AnalysisReport)
            .options(
                selectinload(AnalysisReport.session),
                selectinload(AnalysisReport.video),
            )
            .where(
                AnalysisReport.public_id == report_public_id,
                AnalysisReport.deleted_at.is_(None),
                AnalysisReport.status == ReportStatus.completed,
            )
        )
        if not report:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")
        return _report_read(report, self._template_snapshot_for_report(report))

    def _update_task_assignment(self, assignment: TrainingTaskAssignment) -> None:
        stmt = (
            select(AnalysisReport)
            .join(TrainingSession, AnalysisReport.session_id == TrainingSession.id)
            .where(
                TrainingSession.task_assignment_id == assignment.id,
                AnalysisReport.status == ReportStatus.completed,
            )
        )
        task_analysis_type = getattr(assignment.task, "analysis_type", None)
        task_template_code = getattr(assignment.task, "template_code", None)
        if task_analysis_type:
            stmt = stmt.where(AnalysisReport.analysis_type == task_analysis_type)
        if task_template_code:
            stmt = stmt.where(AnalysisReport.template_id == task_template_code)
        reports = self.db.scalars(stmt).all()

        assignment.completed_sessions = len({report.session_id for report in reports})

        latest_report = max(
            reports,
            key=lambda item: item.analysis_finished_at or item.created_at or datetime.min.replace(tzinfo=timezone.utc),
            default=None,
        )
        assignment.last_submission_at = (
            latest_report.analysis_finished_at or latest_report.created_at if latest_report else None
        )
        assignment.latest_report_id = latest_report.id if latest_report else None

        scores = [
            score
            for score in (_numeric_to_float(report.overall_score) for report in reports)
            if score is not None
        ]
        assignment.best_score = max(scores) if scores else None

        target_config = assignment.task.target_config or {}
        target_sessions = int(target_config.get("target_sessions", 1))
        target_score = float(target_config.get("target_score", 0))

        session_progress = min(assignment.completed_sessions / max(target_sessions, 1), 1)
        best_score = _numeric_to_float(assignment.best_score) or 0
        score_progress = 1.0 if target_score <= 0 else min(best_score / target_score, 1)
        assignment.progress_percent = round(min(session_progress, score_progress) * 100, 2)

        meets_sessions = assignment.completed_sessions >= target_sessions
        meets_score = target_score <= 0 or best_score >= target_score
        if meets_sessions and meets_score:
            assignment.status = "completed"
            assignment.completed_at = assignment.last_submission_at
        elif assignment.completed_sessions > 0:
            assignment.status = "in_progress"
            assignment.completed_at = None
        else:
            assignment.status = "pending"
            assignment.completed_at = None

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
