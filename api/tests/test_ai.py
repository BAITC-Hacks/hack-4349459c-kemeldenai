import asyncio
import json

import httpx
import pytest
from api.app import ai


def run(card=None):
    return asyncio.run(ai.analyze_questions("Нужен сервис для магазина", "Торговля", card))


@pytest.fixture(autouse=True)
def no_credentials(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_MODEL", raising=False)


def test_missing_key_fallback_is_relevant_unique_and_does_not_mutate_card():
    card = {"context": "Магазин получает 100 заявок в день"}
    original = card.copy()
    result = run(card)
    assert result["source"] == "fallback"
    assert len(result["questions"]) >= 3
    assert len({q["field"] for q in result["questions"]}) == len(result["questions"])
    assert "context" not in {q["field"] for q in result["questions"]}
    assert card == original


@pytest.mark.parametrize("payload", ["not JSON", "[]", '{"questions": null}', '{"questions":[7]}'])
def test_malformed_model_response_falls_back(monkeypatch, payload):
    monkeypatch.setenv("OPENAI_API_KEY", "test-not-a-real-key")

    async def provider(*args):
        return payload

    monkeypatch.setattr(ai, "_request_model", provider)
    assert run()["source"] == "fallback"
    assert len(run()["questions"]) >= 3


def test_partial_ai_questions_are_validated_deduplicated_and_filled(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-not-a-real-key")

    async def provider(*args):
        return json.dumps(
            {
                "questions": [
                    {"field": "need", "question": " Какую проблему решаем? "},
                    {"field": "need", "question": "Какую проблему решаем?"},
                    {"field": "users", "question": "Какую проблему решаем?"},
                    {"field": "madeUp", "question": "Какой секрет?"},
                    {"field": "context", "question": "Уже заполнено?"},
                    {"field": "constraints", "question": " "},
                ]
            }
        )

    monkeypatch.setattr(ai, "_request_model", provider)
    result = run({"context": "100 обращений в день"})
    assert result["source"] == "mixed"
    assert len(result["questions"]) >= 3
    assert result["questions"][0] == {"field": "need", "question": "Какую проблему решаем?"}
    assert len({q["question"] for q in result["questions"]}) == len(result["questions"])
    assert all(q["field"] not in {"context", "madeUp"} for q in result["questions"])


def test_provider_failure_logs_no_credentials_or_input(monkeypatch, caplog):
    secret = "test-not-a-real-key"
    monkeypatch.setenv("OPENAI_API_KEY", secret)

    async def provider(*args):
        raise httpx.ConnectError(f"{secret} Нужен сервис для магазина")

    monkeypatch.setattr(ai, "_request_model", provider)
    assert run()["source"] == "fallback"
    assert secret not in caplog.text
    assert "Нужен сервис" not in caplog.text


def test_complete_card_still_gets_three_refinement_questions():
    result = run(dict.fromkeys(ai.FIELD_QUESTIONS, "Подробная информация о задаче"))
    assert len(result["questions"]) >= 3


def test_description_facts_remove_redundant_fallback_questions():
    description = "Менеджеры вручную обрабатывают 100 заявок в день; нужен общий список заказов"
    result = asyncio.run(ai.analyze_questions(description, "Торговля"))
    assert 3 <= len(result["questions"]) <= 5
    assert not {"context", "users"} & {item["field"] for item in result["questions"]}


def test_only_exact_description_evidence_becomes_a_suggestion(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-not-a-real-key")
    excerpt = "Менеджеры вручную обрабатывают 100 заявок в день"

    async def provider(*args):
        payload = args[2]
        assert "contact" not in payload["card"]
        assert "secret@example.com" not in json.dumps(payload)
        return json.dumps({
            "questions": [
                {"field": "dataMaterials", "question": "Какие данные доступны?"},
                {"field": "successCriteria", "question": "Как измерите результат?"},
                {"field": "constraints", "question": "Какие есть ограничения?"},
            ],
            "suggestedFields": [
                {"field": "context", "value": excerpt, "evidence": excerpt},
                {"field": "need", "value": "Придуманная экономия 50%", "evidence": excerpt},
                {"field": "contact", "value": excerpt, "evidence": excerpt},
            ],
        })

    monkeypatch.setattr(ai, "_request_model", provider)
    result = asyncio.run(ai.analyze_questions(excerpt, "Торговля", {"contact": "secret@example.com"}))
    assert result["source"] == "ai"
    assert {item["field"] for item in result["suggestedFields"]} == {"context", "users"}
    assert next(item for item in result["suggestedFields"] if item["field"] == "context") == {
        "field": "context", "value": excerpt, "evidence": excerpt,
    }


def test_ai_cannot_repeat_explicit_description_fact(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-not-a-real-key")

    async def provider(*args):
        return json.dumps({"questions": [
            {"field": "users", "question": "Кто будет пользоваться?"},
            {"field": "context", "question": "Как сейчас устроен процесс?"},
            {"field": "dataMaterials", "question": "Какие данные доступны?"},
        ]})

    monkeypatch.setattr(ai, "_request_model", provider)
    result = asyncio.run(ai.analyze_questions(
        "Менеджеры вручную обрабатывают 100 заявок в день", "Торговля"
    ))
    assert not {"users", "context"} & {item["field"] for item in result["questions"]}
    assert result["source"] == "mixed"


def test_local_suggestions_are_verbatim_and_contact_details_are_redacted(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-not-a-real-key")
    description = (
        "Менеджеры вручную обрабатывают 100 заявок в день; нужен общий список заказов. "
        "Пишите на demo@example.com"
    )

    async def provider(*args):
        payload = args[2]
        assert "demo@example.com" not in json.dumps(payload)
        return '{"questions": []}'

    monkeypatch.setattr(ai, "_request_model", provider)
    result = asyncio.run(ai.analyze_questions(description, "Торговля"))
    assert result["source"] == "fallback"
    assert {item["field"] for item in result["suggestedFields"]} == {
        "context", "users", "expectedResult"
    }
    assert all(item["value"] == item["evidence"] for item in result["suggestedFields"])


def test_provider_makes_one_bounded_server_side_call(monkeypatch):
    calls = []

    class Client:
        def __init__(self, **kwargs):
            assert kwargs["timeout"] <= 20

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, **kwargs):
            calls.append((url, kwargs))
            return httpx.Response(
                200,
                json={"choices": [{"message": {"content": '{"questions": []}'}}]},
                request=httpx.Request("POST", url),
            )

    monkeypatch.setattr(ai.httpx, "AsyncClient", Client)
    monkeypatch.setenv("OPENAI_API_KEY", "test-not-a-real-key")
    run()
    assert len(calls) == 1
    url, request = calls[0]
    assert url == "https://api.openai.com/v1/chat/completions"
    assert request["json"]["stream"] is False
    assert request["json"]["model"] == "gpt-4o-mini"
    assert request["json"]["response_format"] == {"type": "json_object"}
    assert len(request["json"]["messages"]) == 2
    assert "test-not-a-real-key" not in json.dumps(request["json"])
