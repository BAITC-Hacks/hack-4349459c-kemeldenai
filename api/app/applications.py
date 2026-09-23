"""Team application history and business-confirmed progress."""

from uuid import UUID

from api.app.database import Milestone, Proposal, Task
from api.app.models import ApiModel, TeamProfile
from api.app.models import Milestone as MilestoneResponse
from api.app.models import Proposal as ProposalResponse
from api.app.recommendations import require_team, session_for
from fastapi import APIRouter, Depends
from sqlalchemy import select

router = APIRouter(prefix="/api")


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
