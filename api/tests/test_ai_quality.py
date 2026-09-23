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
    result = analyze(description)
    fields = [question["field"] for question in result["questions"]]
    assert fields == ["need", "users", "dataMaterials"]
    assert result["suggestedFields"] == []


@pytest.mark.parametrize("description", [
    "Нужен общий список заказов?",
    "Возможно, нужен прототип приложения для операторов.",
    "Менеджеры не обрабатывают заявки вручную.",
    "Менеджеры вручную обрабатывают заявки; контакт demo@example.test",
])
def test_fallback_suggestions_do_not_promote_uncertainty_or_contact_details(description):
    result = analyze(description)
    if "контакт" in description:
        assert all("demo@" not in item["value"] for item in result["suggestedFields"])
    else:
        assert result["suggestedFields"] == []


def test_provider_cannot_extract_a_fact_from_an_uncertain_sentence(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-not-a-real-key")

    async def provider(*_args):
        return json.dumps({"questions": [], "suggestedFields": [
            {"field": "users", "value": "Менеджеры", "evidence": "Менеджеры"},
            {"field": "context", "value": "вручную обрабатывают заявки",
             "evidence": "вручную обрабатывают заявки"},
        ]})

    monkeypatch.setattr(ai, "_request_model", provider)
    result = analyze("Менеджеры вручную обрабатывают заявки?")
    assert result["suggestedFields"] == []
    assert result["source"] == "fallback"


def test_verbatim_provider_evidence_can_include_sentence_punctuation(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-not-a-real-key")
    excerpt = "У отдела продаж растет очередь заказов."

    async def provider(*_args):
        return json.dumps({"questions": [], "suggestedFields": [
            {"field": "context", "value": excerpt, "evidence": excerpt},
        ]})

    monkeypatch.setattr(ai, "_request_model", provider)
    result = analyze(excerpt)
    assert result["suggestedFields"] == [
        {"field": "context", "value": excerpt, "evidence": excerpt},
    ]
    assert result["source"] == "mixed"


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
