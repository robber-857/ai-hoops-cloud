from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator


class AssistantMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2400)]


class AssistantRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    messages: list[AssistantMessage] = Field(min_length=1, max_length=9)

    @model_validator(mode="after")
    def validate_exchange(self):
        if self.messages[-1].role != "user" or any(
            message.role != ("user" if index % 2 == 0 else "assistant")
            for index, message in enumerate(self.messages)
        ):
            raise ValueError("Send alternating messages ending with your training question.")
        return self


class AssistantRecommendation(BaseModel):
    title: str
    kind: Literal["task", "exercise"]
    href: str


class AssistantResponse(BaseModel):
    answer: str
    recommendations: list[AssistantRecommendation]


class ModelAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answer: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2400)]
    recommended_ids: list[str]
