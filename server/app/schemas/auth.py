from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.verification_code import VerificationTargetType
from app.schemas.user import UserRead


class SendCodeRequest(BaseModel):
    phone_number: str = Field(min_length=6, max_length=32)
    email: EmailStr | None = None


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=8, max_length=128)
    phone_number: str = Field(min_length=6, max_length=32)
    phone_code: str = Field(min_length=4, max_length=10)
    email: EmailStr | None = None
    email_code: str | None = Field(default=None, min_length=4, max_length=10)

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, value: str, info) -> str:
        password = info.data.get("password")
        if password and value != password:
            raise ValueError("confirm_password must match password")
        return value


class LoginPasswordCodeRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    verify_code: str = Field(min_length=4, max_length=10)


class PhoneSendCodeRequest(BaseModel):
    phone_number: str = Field(min_length=6, max_length=32)


class EmailSendCodeRequest(BaseModel):
    email: EmailStr


class PhoneCodeLoginRequest(BaseModel):
    phone_number: str = Field(min_length=6, max_length=32)
    code: str = Field(min_length=4, max_length=10)


class EmailCodeLoginRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=10)


class SendResetCodeRequest(BaseModel):
    target: str = Field(min_length=3, max_length=255)
    target_type: VerificationTargetType


class PasswordResetRequest(BaseModel):
    target: str = Field(min_length=3, max_length=255)
    target_type: VerificationTargetType
    code: str = Field(min_length=4, max_length=10)
    new_password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=8, max_length=128)

    @field_validator("confirm_password")
    @classmethod
    def reset_passwords_match(cls, value: str, info) -> str:
        password = info.data.get("new_password")
        if password and value != password:
            raise ValueError("confirm_password must match new_password")
        return value


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserRead

    model_config = ConfigDict(from_attributes=True)


class TokenRefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
