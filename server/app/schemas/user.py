from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.enums import UserRole


class UserRead(BaseModel):
    id: int
    public_id: UUID
    username: str
    phone_number: str
    email: EmailStr | None = None
    nickname: str | None = None
    avatar_url: str | None = None
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
