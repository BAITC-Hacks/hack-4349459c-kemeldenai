"""FastAPI application and HTTP contract."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from uuid import UUID, uuid4

from api.app import ai
from api.app.applications import router as applications_router
from api.app.database import Base, make_engine, session_factory, utcnow
from api.app.database import Milestone as MilestoneRow
from api.app.database import Proposal as ProposalRow
from api.app.database import Task as TaskRow
from api.app.database import Team as TeamRow
from api.app.models import (
    AnalyzeInput,
    AnalyzeOutput,
    ErrorResponse,
    HealthResponse,
    Milestone,
    MilestoneInput,
    Proposal,
    ProposalDecision,
    ProposalInput,
    TaskCard,
    TaskInput,
    TeamProfile,
    to_camel,
)
from api.app.recommendations import router as recommendations_router
from api.app.scoring import score_card
from api.app.seed import seed_database as seed_demo_database
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, text, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


def _card_values(payload: TaskInput) -> dict:
    return payload.model_dump()


def _task_response(row: TaskRow) -> TaskCard:
    return TaskCard.model_validate(row)


def _proposal_response(row: ProposalRow) -> Proposal:
    return Proposal.model_validate(row)


def _milestone_response(row: MilestoneRow) -> Milestone:
    return Milestone.model_validate(row)


def _team_response(row: TeamRow) -> TeamProfile:
    return TeamProfile.model_validate(row)


def create_app(database_url: str | None = None, seed: bool = True) -> FastAPI:
    """Create an app instance; schema creation and seeding happen in lifespan startup."""

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        engine = make_engine(database_url)
        factory = session_factory(engine)
        app.state.engine = engine
        app.state.session_factory = factory
        app.state.seed_database = lambda: seed_demo_database(engine, factory)
        try:
            Base.metadata.create_all(engine)
            if seed:
                seed_demo_database(engine, factory)
            yield
        finally:
            engine.dispose()

    error_responses = {code: {"model": ErrorResponse} for code in (400, 404, 409, 422, 500, 503)}
    app = FastAPI(
        title="HackAlem MVP API", version="1.0.0", lifespan=lifespan, responses=error_responses
    )
    app.include_router(recommendations_router)
    app.include_router(applications_router)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )

    def get_session(request: Request):
        with request.app.state.session_factory() as session:
            yield session

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(status_code=422, content={"error": "Данные запроса заполнены неверно"})

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(request: Request, exc: StarletteHTTPException):
        if isinstance(exc.detail, str):
            message = {
                "Not Found": "Ресурс не найден",
                "Method Not Allowed": "Метод не поддерживается",
            }.get(exc.detail, exc.detail)
        else:
            message = "Не удалось выполнить запрос"
        return JSONResponse(
            status_code=exc.status_code, content={"error": message}, headers=exc.headers
        )

    @app.exception_handler(SQLAlchemyError)
    async def database_error_handler(request: Request, exc: SQLAlchemyError):
        logger.warning("Database operation failed (%s)", type(exc).__name__)
        return JSONResponse(status_code=503, content={"error": "База данных временно недоступна"})

    @app.exception_handler(Exception)
    async def unexpected_error_handler(request: Request, exc: Exception):
        logger.error("Unhandled API failure (%s)", type(exc).__name__)
        return JSONResponse(status_code=500, content={"error": "Внутренняя ошибка сервера"})

    @app.get(
        "/api/health", response_model=HealthResponse, responses={503: {"model": ErrorResponse}}
    )
    def health(session: Session = Depends(get_session)):
        session.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}

    @app.post(
        "/api/analyze",
        response_model=AnalyzeOutput,
        responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    )
    async def analyze(payload: AnalyzeInput):
        card = {to_camel(key): value for key, value in (payload.card or {}).items()}
        result = await ai.analyze_questions(payload.description, payload.industry, card)
        return result

    @app.get(
        "/api/tasks",
        response_model=list[TaskCard],
        responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    )
    def list_tasks(
        topic: str | None = Query(default=None, max_length=120),
        readiness: str | None = Query(default=None, pattern="^(draft|workable|ready|priority)$"),
        session: Session = Depends(get_session),
    ):
        query = select(TaskRow).where(TaskRow.status == "published")
        if topic:
            query = query.where(func.trim(TaskRow.topic) == topic.strip())
        if readiness:
            query = query.where(TaskRow.readiness == readiness)
        return [
            _task_response(row)
            for row in session.scalars(
                query.order_by(TaskRow.score.desc(), TaskRow.created_at.desc())
            ).all()
        ]

    @app.get(
        "/api/tasks/{task_id}",
        response_model=TaskCard,
        responses={
            404: {"model": ErrorResponse},
            422: {"model": ErrorResponse},
            503: {"model": ErrorResponse},
        },
    )
    def get_task(task_id: UUID, session: Session = Depends(get_session)):
        row = session.get(TaskRow, str(task_id))
        if row is None:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        return _task_response(row)

    @app.post(
        "/api/tasks",
        response_model=TaskCard,
        status_code=201,
        responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    )
    def create_task(payload: TaskInput, session: Session = Depends(get_session)):
        row = TaskRow(
            id=str(uuid4()),
            **_card_values(payload),
            status="draft",
            readiness="draft",
            breakdown=[],
            missing=[],
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return _task_response(row)

    @app.put(
        "/api/tasks/{task_id}",
        response_model=TaskCard,
        responses={
            404: {"model": ErrorResponse},
            409: {"model": ErrorResponse},
            422: {"model": ErrorResponse},
            503: {"model": ErrorResponse},
        },
    )
    def update_draft(task_id: UUID, payload: TaskInput, session: Session = Depends(get_session)):
        row = session.scalar(select(TaskRow).where(TaskRow.id == str(task_id)).with_for_update())
        if row is None:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        if row.status != "draft":
            raise HTTPException(
                status_code=409,
                detail="Опубликованную задачу можно изменить только после подтверждения",
            )
        for key, value in _card_values(payload).items():
            setattr(row, key, value)
        row.confirmed_at = None
        row.score = None
        row.readiness = "draft"
        row.breakdown = []
        row.missing = []
        session.commit()
        session.refresh(row)
        return _task_response(row)

    @app.post(
        "/api/tasks/{task_id}/confirm",
        response_model=TaskCard,
        responses={
            404: {"model": ErrorResponse},
            422: {"model": ErrorResponse},
            503: {"model": ErrorResponse},
        },
    )
    def confirm_task(task_id: UUID, payload: TaskInput, session: Session = Depends(get_session)):
        row = session.scalar(select(TaskRow).where(TaskRow.id == str(task_id)).with_for_update())
        if row is None:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        values = _card_values(payload)
        result = score_card({to_camel(key): value for key, value in values.items()})
        # All card fields and derived score data are written in one transaction.
        for key, value in values.items():
            setattr(row, key, value)
        row.confirmed_at = utcnow()
        row.score = result["score"]
        row.readiness = result["readiness"]
        row.breakdown = result["breakdown"]
        row.missing = result["missing"]
        session.commit()
        session.refresh(row)
        return _task_response(row)

    @app.post(
        "/api/tasks/{task_id}/publish",
        response_model=TaskCard,
        responses={
            404: {"model": ErrorResponse},
            409: {"model": ErrorResponse},
            422: {"model": ErrorResponse},
            503: {"model": ErrorResponse},
        },
    )
    def publish_task(task_id: UUID, session: Session = Depends(get_session)):
        row = session.scalar(select(TaskRow).where(TaskRow.id == str(task_id)).with_for_update())
        if row is None:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        if row.confirmed_at is None:
            raise HTTPException(status_code=409, detail="Сначала подтвердите карточку задачи")
        row.status = "published"
        session.commit()
        session.refresh(row)
        return _task_response(row)

    @app.get(
        "/api/teams", response_model=list[TeamProfile], responses={503: {"model": ErrorResponse}}
    )
    def list_teams(session: Session = Depends(get_session)):
        return [
            _team_response(row)
            for row in session.scalars(select(TeamRow).order_by(TeamRow.name)).all()
        ]

    @app.get(
        "/api/tasks/{task_id}/proposals",
        response_model=list[Proposal],
        responses={
            404: {"model": ErrorResponse},
            409: {"model": ErrorResponse},
            422: {"model": ErrorResponse},
            503: {"model": ErrorResponse},
        },
    )
    def list_proposals(task_id: UUID, session: Session = Depends(get_session)):
        task_id = str(task_id)
        task = session.get(TaskRow, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        if task.status != "published":
            raise HTTPException(
                status_code=409,
                detail="Принимать предложения можно только для опубликованной задачи",
            )
        rows = session.scalars(
            select(ProposalRow)
            .where(ProposalRow.task_id == task_id)
            .order_by(ProposalRow.created_at)
        ).all()
        return [_proposal_response(row) for row in rows]

    @app.post(
        "/api/tasks/{task_id}/proposals",
        response_model=Proposal,
        status_code=201,
        responses={
            404: {"model": ErrorResponse},
            409: {"model": ErrorResponse},
            422: {"model": ErrorResponse},
            503: {"model": ErrorResponse},
        },
    )
    def create_proposal(
        task_id: UUID, payload: ProposalInput, session: Session = Depends(get_session)
    ):
        task_id = str(task_id)
        task = session.get(TaskRow, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        if task.status != "published":
            raise HTTPException(
                status_code=409,
                detail="Принимать предложения можно только для опубликованной задачи",
            )
        team = session.get(TeamRow, str(payload.team_id))
        if team is None:
            raise HTTPException(status_code=404, detail="Команда не найдена")
        row = ProposalRow(
            id=str(uuid4()),
            task_id=task_id,
            team_id=str(payload.team_id),
            **payload.model_dump(exclude={"team_id"}),
            decision="pending",
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return _proposal_response(row)

    @app.patch(
        "/api/proposals/{proposal_id}",
        response_model=Proposal,
        responses={
            404: {"model": ErrorResponse},
            422: {"model": ErrorResponse},
            503: {"model": ErrorResponse},
        },
    )
    def decide_proposal(
        proposal_id: UUID, payload: ProposalDecision, session: Session = Depends(get_session)
    ):
        row = session.scalar(
            select(ProposalRow).where(ProposalRow.id == str(proposal_id)).with_for_update()
        )
        if row is None:
            raise HTTPException(status_code=404, detail="Предложение не найдено")
        row.decision = payload.decision
        session.commit()
        session.refresh(row)
        return _proposal_response(row)

    @app.get(
        "/api/proposals/{proposal_id}/milestones",
        response_model=list[Milestone],
        responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
    )
    def list_milestones(proposal_id: UUID, session: Session = Depends(get_session)):
        proposal_id = str(proposal_id)
        if session.get(ProposalRow, proposal_id) is None:
            raise HTTPException(status_code=404, detail="Предложение не найдено")
        row = session.scalar(select(MilestoneRow).where(MilestoneRow.proposal_id == proposal_id))
        return [_milestone_response(row)] if row is not None else []

    @app.post(
        "/api/proposals/{proposal_id}/milestones",
        response_model=Milestone,
        status_code=201,
        responses={
            404: {"model": ErrorResponse},
            409: {"model": ErrorResponse},
            422: {"model": ErrorResponse},
        },
    )
    def confirm_milestone(
        proposal_id: UUID, payload: MilestoneInput, session: Session = Depends(get_session)
    ):
        proposal_id = str(proposal_id)
        proposal = session.scalar(
            select(ProposalRow).where(ProposalRow.id == proposal_id).with_for_update()
        )
        if proposal is None:
            raise HTTPException(status_code=404, detail="Предложение не найдено")
        if proposal.decision != "selected":
            raise HTTPException(status_code=409, detail="Сначала выберите команду")
        if session.scalar(select(MilestoneRow.id).where(MilestoneRow.proposal_id == proposal_id)):
            raise HTTPException(status_code=409, detail="Этап уже подтверждён")
        row = MilestoneRow(
            id=str(uuid4()),
            proposal_id=proposal_id,
            description=payload.description,
            points_awarded=10,
            confirmed_at=utcnow(),
        )
        try:
            session.add(row)
            session.flush()
            session.execute(
                update(TeamRow)
                .where(TeamRow.id == proposal.team_id)
                .values(progress_points=TeamRow.progress_points + 10)
            )
            session.commit()
        except IntegrityError:
            session.rollback()
            raise HTTPException(status_code=409, detail="Этап уже подтверждён") from None
        session.refresh(row)
        return _milestone_response(row)

    return app


app = create_app()
