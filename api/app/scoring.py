"""Deterministic readiness scoring for human-confirmed task cards."""

from __future__ import annotations

import re
import unicodedata
from typing import Any

PLACEHOLDERS = {
    "tbd",
    "t b d",
    "to be determined",
    "todo",
    "n a",
    "na",
    "none",
    "нет",
    "не знаю",
    "пока не знаю",
    "не указано",
    "уточнить",
    "placeholder",
    "test",
    "test text",
    "тест",
    "тестовый текст",
    "заглушка",
    "lorem ipsum",
    "lorem ipsum dolor sit amet",
    "...",
    "-",
}

# Only recognizable keyboard filler is rejected; there is no language dictionary
# or minimum word count that could penalize short facts, names, or abbreviations.
KEYBOARD_FILLER = {
    "qwerty",
    "qwertyuiop",
    "asdf",
    "asdfgh",
    "asdfghjkl",
    "zxcv",
    "zxcvbnm",
    "йцукен",
    "йцукенгшщзхъ",
    "фыва",
    "фывапролджэ",
    "ячсм",
    "ячсмитьбю",
}
FILLER_WORDS = {word for word in PLACEHOLDERS if " " not in word} | KEYBOARD_FILLER


def is_meaningful(value: str) -> bool:
    """Exclude obvious filler, without claiming to judge a fact's truth or relevance."""
    raw = unicodedata.normalize("NFKC", str(value or "")).casefold()
    # Ignore invisible formatting characters when identifying a placeholder.
    raw = "".join(char for char in raw if unicodedata.category(char) != "Cf")
    normalized = re.sub(r"[\W_]+", " ", raw, flags=re.UNICODE).strip()
    if len(normalized) < 2 or normalized in PLACEHOLDERS:
        return False
    words = normalized.split()
    if all(word in FILLER_WORDS for word in words):
        return False
    letters = "".join(words)
    if len(letters) >= 4 and letters.isalpha() and len(set(letters)) == 1:
        return False
    return True


# Each visible item is scored independently; combined categories retain their contract totals.
ITEMS = (
    ("context", "Контекст бизнеса", 10, "context"),
    ("need", "Потребность бизнеса", 10, "need"),
    ("dataMaterials", "Доступные данные и материалы", 20, "dataMaterials"),
    ("expectedResult", "Ожидаемый результат", 15, "expectedResult"),
    ("successCriteria", "Критерии успеха", 15, "successCriteria"),
    ("constraints", "Ограничения", 10, "constraints"),
    ("users", "Пользователи", 10, "users"),
    ("contact", "Контакт бизнеса", 5, "contact"),
    ("interaction", "Формат взаимодействия", 5, "interaction"),
)


def readiness_for_score(score: int) -> str:
    if score < 40:
        return "draft"
    if score < 70:
        return "workable"
    if score < 90:
        return "ready"
    return "priority"


def score_card(card: dict[str, Any]) -> dict[str, Any]:
    breakdown = []
    missing = []
    score = 0
    for key, label, maximum, field in ITEMS:
        snake_key = re.sub(r"(?<!^)(?=[A-Z])", "_", field).lower()
        earned = maximum if is_meaningful(str(card.get(field, card.get(snake_key, "")))) else 0
        score += earned
        breakdown.append({"key": key, "label": label, "earned": earned, "maximum": maximum})
        if earned == 0:
            missing.append(field)
    return {
        "score": score,
        "readiness": readiness_for_score(score),
        "breakdown": breakdown,
        "missing": missing,
    }
