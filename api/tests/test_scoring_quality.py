"""Readiness rewards supplied information, not obvious filler."""

import pytest
from api.app.main import create_app
from api.app.scoring import ITEMS, is_meaningful, score_card
from fastapi.testclient import TestClient


@pytest.mark.parametrize(
    "value",
    [
        "Тест",
        " TEST! ",
        "тест тест тест",
        "тестовый текст",
        "test text",
        "заглушка",
        "Lorem ipsum dolor sit amet.",
        "TBD / TBD",
        "qwerty",
        "asdfgh",
        "йцукен",
        "фыва",
        "аааааааа",
        "xxxxxx",
        "___",
        "Т\u200bест",
        "ＴＥＳＴ",
    ],
)
def test_obvious_filler_does_not_earn_readiness(value):
    assert not is_meaningful(value)


@pytest.mark.parametrize(
    "value",
    [
        "IT",
        "ИИ",
        "CSV",
        "1С",
        "20%",
        "+7 777 000 11 22",
        "Анна",
        "SQL",
        "Кафе",
        "На русском и казахском",
        "Бюджет 0 ₸",
        "Ограничений нет",
        "Тест прототипа с 5 пользователями",
        "Тесты проходят в 99% случаев",
        "A/B test with 20 customers",
        "test@example.org",
    ],
)
def test_short_facts_and_testing_domain_content_remain_meaningful(value):
    assert is_meaningful(value)


def test_filling_every_scored_field_with_test_cannot_produce_100_points():
    result = score_card({field: "Тест" for _, _, _, field in ITEMS})

    assert result["score"] == 0
    assert result["readiness"] == "draft"
    assert result["missing"] == [field for _, _, _, field in ITEMS]
    assert all(item["earned"] == 0 for item in result["breakdown"])
    assert sum(item["maximum"] for item in result["breakdown"]) == 100


def test_short_useful_card_keeps_full_score_and_existing_weights():
    card = {
        "context": "Кафе",
        "need": "Сократить очереди",
        "dataMaterials": "CSV заказов",
        "expectedResult": "Прототип",
        "successCriteria": "Ожидание < 5 минут",
        "constraints": "Бюджет 0 ₸",
        "users": "Кассиры",
        "contact": "Анна",
        "interaction": "Zoom по пятницам",
    }
    assert score_card(card)["score"] == 100

    card["dataMaterials"] = "qwerty"
    result = score_card(card)
    assert result["score"] == 80
    assert result["missing"] == ["dataMaterials"]
    assert next(row for row in result["breakdown"] if row["key"] == "dataMaterials") == {
        "key": "dataMaterials",
        "label": "Доступные данные и материалы",
        "earned": 0,
        "maximum": 20,
    }


def test_placeholder_card_still_publishes_and_improves_only_after_confirmation(tmp_path):
    card = {field: "Тест" for _, _, _, field in ITEMS}
    card.update(title="Проверка рейтинга", description="Сократить очереди в кафе")
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path}/scoring.db", seed=False)) as c:
        draft = c.post("/api/tasks", json=card).json()
        task_id = draft["id"]
        assert draft["score"] is None
        assert c.post(f"/api/tasks/{task_id}/confirm", json=card).json()["score"] == 0
        assert c.post(f"/api/tasks/{task_id}/publish").status_code == 200
        assert any(task["id"] == task_id for task in c.get("/api/tasks").json())

        card["users"] = "Кассиры"
        assert c.get(f"/api/tasks/{task_id}").json()["score"] == 0
        confirmed = c.post(f"/api/tasks/{task_id}/confirm", json=card).json()
        assert confirmed["score"] == 10
        assert "users" not in confirmed["missing"]
        assert confirmed["status"] == "published"
