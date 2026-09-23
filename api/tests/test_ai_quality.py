"""Question relevance regressions; no live provider credentials are used."""

import asyncio
import json

import pytest
from api.app import ai

DETAILED_DESCRIPTION = (
    "Менеджеры вручную обрабатывают 100 заявок в день; нужен общий список заказов."
)


def analyze(description=DETAILED_DESCRIPTION, card=None):
    return asyncio.run(ai.analyze_questions(description, "Торговля", card))


@pytest.fixture(autouse=True)
def no_provider_credentials(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_MODEL", raising=False)


def test_fallback_prioritizes_gaps_over_explicit_workflow_and_users():
    card = {"description": DETAILED_DESCRIPTION}
    result = analyze(card=card)
    fields = [question["field"] for question in result["questions"]]
    assert result["source"] == "fallback"
    assert 3 <= len(fields) <= 5
    assert "context" not in fields
    assert "users" not in fields
    assert "dataMaterials" in fields
    assert card == {"description": DETAILED_DESCRIPTION}


@pytest.mark.parametrize(
    "description",
    [
        "Нужен сервис для магазина",
        "Будут ли менеджеры вручную обрабатывать заказы?",
        "Менеджеры обрабатывают заявки? Пока не знаем, кто будет пользователем.",
        "Пользователи: пока не знаю. Контекст: не указано.",
        "Пользователи: еще не определены. Контекст: пока не известен.",
        "Пользователи: предположительно менеджеры. Контекст: возможно, ручная обработка.",
    ],
)
def test_weak_or_uncertain_description_keeps_foundational_questions(description):
    fields = [question["field"] for question in analyze(description)["questions"]]
    assert fields == ["context", "need", "users"]


def test_explicit_description_labels_are_respected_without_populating_card():
    result = analyze(
        "Контекст: заказы вручную переносят из почты в Excel. "
        "Пользователи: три менеджера по продажам."
    )
    fields = [question["field"] for question in result["questions"]]
    assert "context" not in fields
    assert "users" not in fields


def test_complete_card_gets_specific_refinements_instead_of_repeating_basics():
    card = dict.fromkeys(ai.FIELD_QUESTIONS, "Подробная информация о задаче")
    result = analyze(card=card)
    assert [question["field"] for question in result["questions"]] == [
        "successCriteria",
        "dataMaterials",
        "constraints",
    ]
    assert all(
        question["question"] != "Уточните: " + ai.FIELD_QUESTIONS[question["field"]].lower()
        for question in result["questions"]
    )


def test_provider_context_excludes_contact_and_already_explained_fields(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-not-a-real-key")
    payloads = []

    async def provider(_key, _model, payload):
        payloads.append(payload)
        return '{"questions": []}'

    monkeypatch.setattr(ai, "_request_model", provider)
    analyze(card={"contact": "Person, private@example.test", "metadata": "not context"})
    assert len(payloads) == 1
    payload = payloads[0]
    assert "contact" not in payload["card"]
    assert "private@example.test" not in json.dumps(payload)
    assert "metadata" not in payload["card"]
    assert not {"context", "users", "contact"}.intersection(payload["missingFields"])
    assert "context" not in payload["refinementFields"]
    assert "users" not in payload["refinementFields"]


def test_valid_ai_batch_is_limited_to_five_questions(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-not-a-real-key")

    async def provider(*_args):
        return json.dumps(
            {"questions": [{"field": field, "question": text} for field, text in ai.FIELD_QUESTIONS.items()]}
        )

    monkeypatch.setattr(ai, "_request_model", provider)
    result = analyze("Нужен сервис")
    assert result["source"] == "ai"
    assert len(result["questions"]) == 5


@pytest.mark.parametrize("content", ["not JSON", '{"questions": null}', None, "x" * 20_001])
def test_invalid_provider_content_keeps_relevant_deterministic_fallback(monkeypatch, content):
    expected = analyze()
    monkeypatch.setenv("OPENAI_API_KEY", "test-not-a-real-key")

    async def provider(*_args):
        return content

    monkeypatch.setattr(ai, "_request_model", provider)
    assert analyze() == expected
