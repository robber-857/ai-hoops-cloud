"""SQLAlchemy models."""

from app.models.achievement import Achievement
from app.models.analysis_report import AnalysisReport
from app.models.announcement import Announcement
from app.models.announcement_read import AnnouncementRead
from app.models.camp_class import CampClass
from app.models.class_member import ClassMember
from app.models.notification import Notification
from app.models.operation_log import OperationLog
from app.models.report_snapshot import ReportSnapshot
from app.models.student_achievement import StudentAchievement
from app.models.student_goal import StudentGoal
from app.models.student_growth_snapshot import StudentGrowthSnapshot
from app.models.template_example_video import TemplateExampleVideo
from app.models.training_camp import TrainingCamp
from app.models.training_session import TrainingSession
from app.models.training_task import TrainingTask
from app.models.training_task_assignment import TrainingTaskAssignment
from app.models.training_template import TrainingTemplate
from app.models.training_template_version import TrainingTemplateVersion
from app.models.upload_task import UploadTask
from app.models.user import User
from app.models.user_session import UserSession
from app.models.verification_code import VerificationCode
from app.models.video import Video

__all__ = [
    "AnalysisReport",
    "Achievement",
    "Announcement",
    "AnnouncementRead",
    "CampClass",
    "ClassMember",
    "Notification",
    "OperationLog",
    "ReportSnapshot",
    "StudentAchievement",
    "StudentGoal",
    "StudentGrowthSnapshot",
    "TemplateExampleVideo",
    "TrainingCamp",
    "TrainingSession",
    "TrainingTask",
    "TrainingTaskAssignment",
    "TrainingTemplate",
    "TrainingTemplateVersion",
    "UploadTask",
    "User",
    "UserSession",
    "VerificationCode",
    "Video",
]
