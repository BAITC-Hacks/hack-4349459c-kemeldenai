"""Regressions from the portal flow audit, using isolated local databases."""

import asyncio
import json
from datetime import datetime, timedelta, timezone

from api.app import ai
from api.app.database import Task
from api.app.main import create_app
from api.app.models import TaskCard
from fastapi.testclient import TestClient
from sqlalchemy import select


def test_all_seeded_drafts_can_be_loaded_as_unconfirmed_cards(tmp_path):
    app = create_app(database_url=f"sqlite:///{tmp_path}/seeded.db")
    with TestClient(app, raise_server_exceptions=False) as client:
        with app.state.session_factory() as session:
            ids = session.scalars(select(Task.id).where(Task.status == "draft")).all()
        assert len(ids) == 5
        for task_id in ids:
            response = client.get(f"/api/tasks/{task_id}")
            assert response.status_code == 200
            card = response.json()
            assert card["score"] is None
            assert card["confirmedAt"] is None
            assert card["readiness"] == "draft"
            assert card["breakdown"] == card["missing"] == []


def test_existing_seeded_draft_metadata_is_backfilled_without_resetting_edits(tmp_path):
    url = f"sqlite:///{tmp_path}/legacy.db"
    app = create_app(database_url=url)
    with TestClient(app) as client:
        user_draft = client.post("/api/tasks", json={"title": "Моя новая задача"}).json()
        with app.state.session_factory() as session:
            legacy = session.scalar(select(Task).where(Task.seed_key == "demo-draft-1"))
            legacy.title = "Название изменено бизнесом"
            legacy.context = "Отредактированные данные остаются на месте"
            legacy.readiness = legacy.breakdown = legacy.missing = None
            legacy_id = legacy.id
            session.commit()
    app = create_app(database_url=url)
    with TestClient(app, raise_server_exceptions=False) as client:
        for _ in range(2):
            app.state.seed_database()
            response = client.get(f"/api/tasks/{legacy_id}")
            assert response.status_code == 200
            card = response.json()
            assert card["title"] == "Название изменено бизнесом"
            assert card["context"] == "Отредактированные данные остаются на месте"
            assert card["score"] is None
            assert card["confirmedAt"] is None
            assert card["readiness"] == "draft"
            assert card["breakdown"] == card["missing"] == []
            assert client.get(f"/api/tasks/{user_draft['id']}").json() == user_draft


def test_sqlite_task_proposal_and_milestone_times_include_utc_offset(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path}/times.db")) as client:
        created = client.post("/api/tasks", json={"title": "Задача"}).json()
        confirmed = client.post(f"/api/tasks/{created['id']}/confirm", json={"title": "Задача"}).json()
        published = client.get("/api/tasks").json()[0]
        proposal = client.get(f"/api/tasks/{published['id']}/proposals").json()[0]
        client.patch(f"/api/proposals/{proposal['id']}", json={"decision": "selected"})
        milestone = client.post(
            f"/api/proposals/{proposal['id']}/milestones",
            json={"description": "Прототип проверен с бизнесом"},
        ).json()
        for timestamp in (
            created["createdAt"], created["updatedAt"], confirmed["confirmedAt"],
            proposal["createdAt"], milestone["confirmedAt"],
        ):
            assert datetime.fromisoformat(timestamp).utcoffset() == timedelta(0)
        # Schemas must retain an already-aware timestamp instead of reinterpreting it.
        offset_time = datetime(2026, 9, 23, 17, tzinfo=timezone(timedelta(hours=5)))
        card = TaskCard.model_validate({**created, "createdAt": offset_time})
        assert card.created_at == offset_time
        assert card.created_at.utcoffset() == timedelta(hours=5)


def test_partial_ai_reply_does_not_duplicate_a_fallback_question(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-not-a-real-key")

    async def provider(*_args):
        return json.dumps({"questions": [
            {"field": "need", "question": ai.FIELD_QUESTIONS["users"]},
            {"field": "users", "question": ai.FIELD_QUESTIONS["users"]},
        ]})

    monkeypatch.setattr(ai, "_request_model", provider)
    result = asyncio.run(ai.analyze_questions("Нужен сервис для магазина", "Торговля"))
    texts = [" ".join(item["question"].casefold().split()) for item in result["questions"]]
    assert len(texts) == len(set(texts)) >= 3
    assert result["source"] == "mixed"


def test_complete_card_still_has_three_questions_after_fallback_dedup(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-not-a-real-key")

    async def provider(*_args):
        return json.dumps({"questions": [
            {"field": "successCriteria", "question": ai.REFINEMENT_QUESTIONS["dataMaterials"]},
        ]})

    monkeypatch.setattr(ai, "_request_model", provider)
    result = asyncio.run(ai.analyze_questions(
        "Нужен сервис", "Торговля", dict.fromkeys(ai.FIELD_QUESTIONS, "Подробное описание поля")
    ))
    texts = [" ".join(item["question"].casefold().split()) for item in result["questions"]]
    assert len(texts) == len(set(texts)) >= 3
    assert len({item["field"] for item in result["questions"]}) == len(texts)


def test_topic_filter_matches_plain_and_existing_space_padded_topics(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path}/topics.db", seed=False)) as client:
        ids = []
        for topic in (" Экология ", "Экология", "Аналитика"):
            payload = {"title": "Задача для фильтра", "description": "Описание задачи", "topic": topic}
            created = client.post("/api/tasks", json=payload).json()
            client.post(f"/api/tasks/{created['id']}/confirm", json=payload)
            client.post(f"/api/tasks/{created['id']}/publish")
            ids.append(created["id"])
        # Values already stored with spaces must remain reachable without rewriting rows.
        for query in ("Экология", " Экология "):
            response = client.get("/api/tasks", params={"topic": query})
            assert response.status_code == 200
            assert {item["id"] for item in response.json()} == set(ids[:2])
        response = client.get("/api/tasks", params={"topic": "Аналитика"})
        assert [item["id"] for item in response.json()] == [ids[2]]
        assert client.get("/api/tasks", params={"topic": "%"}).json() == []
