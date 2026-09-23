"""CamelCase API schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

from .scoring import is_meaningful


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid", from_attributes=True
    )


class TaskInput(ApiModel):
    title: str = Field(default="", max_length=200)
    industry: str = Field(default="", max_length=120)
    topic: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=12000)
    context: str = Field(default="", max_length=12000)
    need: str = Field(default="", max_length=12000)
    users: str = Field(default="", max_length=12000)
    data_materials: str = Field(default="", max_length=12000)
    constraints: str = Field(default="", max_length=12000)
    expected_result: str = Field(default="", max_length=12000)
    success_criteria: str = Field(default="", max_length=12000)
    contact: str = Field(default="", max_length=4000)
    interaction: str = Field(default="", max_length=4000)


class BreakdownItem(ApiModel):
    key: str
    label: str
    earned: int
    maximum: int


class TaskCard(ApiModel):
    id: UUID
    title: str
    industry: str
    topic: str
    description: str
    context: str
    need: str
    users: str
    data_materials: str
    constraints: str
    expected_result: str
    success_criteria: str
    contact: str
    interaction: str
    status: Literal["draft", "published"]
    confirmed_at: datetime | None
    score: int | None
    readiness: Literal["draft", "workable", "ready", "priority"]
    breakdown: list[BreakdownItem]
    missing: list[str]
    created_at: datetime
    updated_at: datetime


class TeamProfile(ApiModel):
    id: UUID
    name: str
    interests: list[str]
    skills: list[str]
    technologies: list[str]
    progress_points: int


class ProposalInput(ApiModel):
    team_id: UUID
    idea: str = Field(min_length=1, max_length=12000)
    plan: str = Field(min_length=1, max_length=12000)
    timeline: str = Field(min_length=1, max_length=300)
    prototype_url: str = Field(min_length=1, max_length=2048)

    @field_validator("prototype_url")
    @classmethod
    def validate_http_url(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("prototypeUrl is required")
        parsed = HttpUrl(value)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("prototypeUrl must use HTTP or HTTPS")
        return value

    @field_validator("idea", "plan", "timeline")
    @classmethod
    def reject_whitespace_only(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Field must not be blank")
        return value.strip()


class Proposal(ApiModel):
    id: UUID
    task_id: UUID
    team_id: UUID
    idea: str
    plan: str
    timeline: str
    prototype_url: str
    decision: Literal["pending", "selected", "rejected"]
    created_at: datetime


class ProposalDecision(ApiModel):
    decision: Literal["selected", "rejected"]


class MilestoneInput(ApiModel):
    description: str = Field(min_length=3, max_length=2000)

    @field_validator("description")
    @classmethod
    def meaningful_description(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3 or not is_meaningful(value):
            raise ValueError("Describe the completed stage")
        return value


class Milestone(ApiModel):
    id: UUID
    proposal_id: UUID
    description: str
    points_awarded: int
    confirmed_at: datetime


class AnalyzeInput(ApiModel):
    description: str = Field(min_length=1, max_length=12000)
    industry: str = Field(default="", max_length=120)
    card: dict[str, str] | None = None

    @field_validator("card")
    @classmethod
    def validate_card(cls, value: dict[str, str] | None) -> dict[str, str] | None:
        if value is None:
            return value
        allowed = set(TaskInput.model_fields)
        camel_allowed = {to_camel(field) for field in allowed}
        cleaned = {}
        for key, item in value.items():
            if key not in allowed and key not in camel_allowed:
                raise ValueError("Card contains an unknown field")
            if not isinstance(item, str) or len(item) > 12000:
                raise ValueError("Card fields must be strings up to 12000 characters")
            cleaned[key] = item
        if len(value) > 20:
            raise ValueError("Card contains too many fields")
        return cleaned


class Question(ApiModel):
    field: str
    question: str


class SuggestedField(ApiModel):
    field: str
    value: str
    evidence: str


class AnalyzeOutput(ApiModel):
    questions: list[Question]
    suggested_fields: list[SuggestedField] = Field(default_factory=list)
    source: Literal["ai", "mixed", "fallback"]


class ErrorResponse(BaseModel):
    error: str


class HealthResponse(BaseModel):
    status: Literal["ok"]
    database: Literal["ok"]
