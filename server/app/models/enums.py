from enum import Enum


class UserStatus(str, Enum):
    active = "active"
    disabled = "disabled"
    locked = "locked"


class UserRole(str, Enum):
    user = "user"
    student = "student"
    admin = "admin"
    coach = "coach"


class VerificationTargetType(str, Enum):
    phone = "phone"
    email = "email"


class VerificationScene(str, Enum):
    register = "register"
    login = "login"
    reset_password = "reset_password"


class VerificationCodeStatus(str, Enum):
    pending = "pending"
    used = "used"
    expired = "expired"
    invalidated = "invalidated"


class SessionStatus(str, Enum):
    active = "active"
    revoked = "revoked"
    expired = "expired"


class StorageProvider(str, Enum):
    s3 = "s3"
    supabase = "supabase"


class VideoUploadStatus(str, Enum):
    pending = "pending"
    uploaded = "uploaded"
    failed = "failed"
    deleted = "deleted"


class VideoVisibility(str, Enum):
    private = "private"
    public = "public"


class AnalysisType(str, Enum):
    shooting = "shooting"
    dribbling = "dribbling"
    training = "training"
    comprehensive = "comprehensive"


class UploadTaskStatus(str, Enum):
    created = "created"
    uploading = "uploading"
    uploaded = "uploaded"
    failed = "failed"
    expired = "expired"


class ReportStatus(str, Enum):
    processing = "processing"
    completed = "completed"
    failed = "failed"
