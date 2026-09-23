"""Team application history and business-confirmed progress."""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from api.app.database import Milestone, Proposal, Task, Team
from api.app.models import ApiModel, TeamProfile
from api.app.models import Proposal as ProposalResponse
from api.app.recommendations import require_team, session_for
from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field, field_validator
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

router = APIRouter(prefix="/api")


class MilestoneResponse(ApiModel):
    id: UUID
    proposal_id: UUID
    description: str
    points_awarded: int
    confirmed_at: datetime

    @field_validator("confirmed_at")
    @classmethod
    def utc_timestamp(cls, value):
        # SQLite drops timezone metadata; keep the API representation stable on reload.
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


class MilestoneInput(ApiModel):
    description: str = Field(min_length=1, max_length=4000)

    @field_validator("description")
    @classmethod
    def meaningful_description(cls, value):
        if not value.strip():
            raise ValueError("Describe the completed stage")
        return value.strip()


class ApplicationResponse(ApiModel):
    proposal: ProposalResponse
    task_title: str
    task_available: bool
    milestones: list[MilestoneResponse]


class ApplicationsResponse(ApiModel):
    team: TeamProfile
    applications: list[ApplicationResponse]


@router.get("/teams/{team_id}/applications", response_model=ApplicationsResponse)
def list_applications(team_id: UUID, session=Depends(session_for)):
    team = require_team(session, team_id)
    rows = session.execute(
        select(Proposal, Task, Milestone)
        .join(Task, Task.id == Proposal.task_id)
        .outerjoin(Milestone, Milestone.proposal_id == Proposal.id)
        .where(Proposal.team_id == str(team_id))
        .order_by(Proposal.created_at.desc(), Proposal.id)
    ).all()
    return {
        "team": team,
        "applications": [
            {"proposal": proposal, "task_title": task.title,
             "task_available": task.status == "published",
             "milestones": [milestone] if milestone else []}
            for proposal, task, milestone in rows
        ],
    }


@router.get("/proposals/{proposal_id}/milestones", response_model=list[MilestoneResponse])
def list_milestones(proposal_id: UUID, session=Depends(session_for)):
    if session.get(Proposal, str(proposal_id)) is None:
        raise HTTPException(404, "Предложение не найдено")
    return session.scalars(select(Milestone).where(Milestone.proposal_id == str(proposal_id))).all()


@router.post("/proposals/{proposal_id}/milestones", response_model=MilestoneResponse, status_code=201)
def confirm_milestone(proposal_id: UUID, payload: MilestoneInput, session=Depends(session_for)):
    proposal = session.scalar(
        select(Proposal).where(Proposal.id == str(proposal_id)).with_for_update()
    )
    if proposal is None:
        raise HTTPException(404, "Предложение не найдено")
    if proposal.decision != "selected":
        raise HTTPException(409, "Подтвердить этап можно только у выбранной команды")
    milestone = Milestone(id=str(uuid4()), proposal_id=str(proposal_id), description=payload.description)
    session.add(milestone)
    try:
        # Uniqueness is enforced before the atomic increment, in the same transaction.
        session.flush()
        session.execute(update(Team).where(Team.id == proposal.team_id)
                        .values(progress_points=Team.progress_points + 10))
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, "Этап уже подтверждён") from None
    return milestone
