import asyncio
import json

import httpx
import pytest
from api.app import ai


def run(card=None):
    return asyncio.run(ai.analyze_questions("Нужен сервис для магазина", "Торговля", card))


@pytest.fixture(autouse=True)
def no_credentials(monkeypatch):
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)
    monkeypatch.delenv("NVIDIA_MODEL", raising=False)


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
    monkeypatch.setenv("NVIDIA_API_KEY", "test-not-a-real-key")

    async def provider(*args):
        return payload

    monkeypatch.setattr(ai, "_request_model", provider)
    assert run()["source"] == "fallback"
    assert len(run()["questions"]) >= 3


def test_partial_ai_questions_are_validated_deduplicated_and_filled(monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "test-not-a-real-key")

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
    assert result["source"] == "ai"
    assert len(result["questions"]) >= 3
    assert result["questions"][0] == {"field": "need", "question": "Какую проблему решаем?"}
    assert len({q["question"] for q in result["questions"]}) == len(result["questions"])
    assert all(q["field"] not in {"context", "madeUp"} for q in result["questions"])


def test_provider_failure_logs_no_credentials_or_input(monkeypatch, caplog):
    secret = "test-not-a-real-key"
    monkeypatch.setenv("NVIDIA_API_KEY", secret)

    async def provider(*args):
        raise httpx.ConnectError(f"{secret} Нужен сервис для магазина")

    monkeypatch.setattr(ai, "_request_model", provider)
    assert run()["source"] == "fallback"
    assert secret not in caplog.text
    assert "Нужен сервис" not in caplog.text


def test_complete_card_still_gets_three_refinement_questions():
    result = run(dict.fromkeys(ai.FIELD_QUESTIONS, "Подробная информация о задаче"))
    assert len(result["questions"]) >= 3


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
    monkeypatch.setenv("NVIDIA_API_KEY", "test-not-a-real-key")
    run()
    assert len(calls) == 1
    url, request = calls[0]
    assert url == "https://integrate.api.nvidia.com/v1/chat/completions"
    assert request["json"]["stream"] is False
    assert len(request["json"]["messages"]) == 2
    assert "test-not-a-real-key" not in json.dumps(request["json"])
