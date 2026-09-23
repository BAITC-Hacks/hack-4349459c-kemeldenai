"""Cold-start content ranking with bounded, time-decayed team click signals."""

import re
from datetime import timedelta, timezone
from uuid import UUID

from api.app.database import Task, TaskClick, Team, utcnow
from api.app.models import ApiModel, TeamProfile
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

router = APIRouter(prefix="/api/teams")


class FocusInput(ApiModel):
    interests: list[str] = Field(max_length=12)

    @field_validator("interests")
    @classmethod
    def clean_interests(cls, values):
        cleaned = []
        for value in values:
            value = value.strip()
            if not value or len(value) > 80:
                raise ValueError("Focus fields must contain 1–80 characters")
            if value.casefold() not in {item.casefold() for item in cleaned}:
                cleaned.append(value)
        return cleaned


class Recommendation(ApiModel):
    task_id: UUID
    relevance: float
    reasons: list[str]


def session_for(request: Request):
    with request.app.state.session_factory() as session:
        yield session


def require_team(session, team_id):
    team = session.get(Team, str(team_id))
    if team is None:
        raise HTTPException(404, "Команда не найдена")
    return team


def tokens(value):
    return set(re.findall(r"[\w]+", value.casefold()))


def rank_tasks(tasks, team, clicks, now):
    ranked = []
    for task in tasks:
        text = tokens(" ".join(getattr(task, key) or "" for key in (
            "title", "topic", "industry", "description", "need", "data_materials",
            "expected_result",
        )))
        focus = [value for value in team.interests if tokens(value) and tokens(value) <= text]
        skills = [value for value in team.skills + team.technologies
                  if tokens(value) and tokens(value) <= text]
        profile = min(1.0, len(focus) * 0.7 + len(skills) * 0.3)
        behavior = 0.0
        similar_topic = ""
        for clicked, timestamp in clicks:
            if clicked.id == task.id:
                continue
            age = max(0, (now - timestamp.replace(tzinfo=timezone.utc)).total_seconds() / 86400)
            affinity = 0.0
            if task.topic and task.topic.casefold() == clicked.topic.casefold():
                affinity = 1.0
            elif task.industry and task.industry.casefold() == clicked.industry.casefold():
                affinity = 0.5
            weight = affinity * 0.5 ** (age / 14)
            if weight > behavior:
                behavior = weight
                similar_topic = clicked.topic or clicked.industry
        reasons = []
        if focus:
            reasons.append("Фокус команды: " + ", ".join(focus[:2]))
        if skills:
            reasons.append("Навыки команды: " + ", ".join(skills[:2]))
        if behavior:
            reasons.append("Похоже на просмотренное: " + similar_topic)
        if not reasons:
            reasons.append("По готовности задачи — пока нет совпадений с интересами")
        score = 0.6 * profile + 0.3 * behavior + 0.1 * (task.score or 0) / 100
        ranked.append(Recommendation(task_id=task.id, relevance=round(score, 6), reasons=reasons))
    return sorted(ranked, key=lambda item: (-item.relevance, str(item.task_id)))


@router.put("/{team_id}/focus", response_model=TeamProfile)
def update_focus(team_id: UUID, payload: FocusInput, session=Depends(session_for)):
    team = require_team(session, team_id)
    team.interests = payload.interests
    session.commit()
    return team


@router.get("/{team_id}/recommendations", response_model=list[Recommendation])
def recommendations(team_id: UUID, session=Depends(session_for)):
    team = require_team(session, team_id)
    now = utcnow()
    tasks = session.scalars(select(Task).where(Task.status == "published")).all()
    clicks = session.execute(
        select(Task, TaskClick.clicked_at).join(TaskClick, TaskClick.task_id == Task.id)
        .where(TaskClick.team_id == str(team_id), Task.status == "published",
               TaskClick.clicked_at >= now - timedelta(days=90))
        .order_by(TaskClick.clicked_at.desc()).limit(50)
    ).all()
    return rank_tasks(tasks, team, clicks, now)


@router.post("/{team_id}/clicks/{task_id}")
def record_click(team_id: UUID, task_id: UUID, session=Depends(session_for)):
    require_team(session, team_id)
    task = session.get(Task, str(task_id))
    if task is None or task.status != "published":
        raise HTTPException(404, "Опубликованная задача не найдена")
    insert = pg_insert if session.bind.dialect.name == "postgresql" else sqlite_insert
    statement = insert(TaskClick).values(
        team_id=str(team_id), task_id=str(task_id), clicked_at=utcnow(),
    )
    session.execute(statement.on_conflict_do_update(
        index_elements=["team_id", "task_id"], set_={"clicked_at": statement.excluded.clicked_at},
    ))
    session.commit()
    return {"status": "ok"}


@router.delete("/{team_id}/clicks")
def clear_clicks(team_id: UUID, session=Depends(session_for)):
    require_team(session, team_id)
    session.execute(delete(TaskClick).where(TaskClick.team_id == str(team_id)))
    session.commit()
    return {"status": "ok"}
