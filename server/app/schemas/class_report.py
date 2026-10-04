from pydantic import BaseModel, ConfigDict, Field
class LessonPublish(BaseModel):
    model_config = ConfigDict(extra='forbid')
    expected_version: int = Field(ge=1)
    expected_preview_fingerprint: str | None = Field(default=None, pattern=r'^[a-f0-9]{64}$')
