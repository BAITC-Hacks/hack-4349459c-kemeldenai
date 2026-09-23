"""Deterministic readiness scoring for human-confirmed task cards."""

from __future__ import annotations

import re
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
    "...",
    "-",
}


def is_meaningful(value: str) -> bool:
    """Return whether a field contains useful information rather than a placeholder."""
    raw = str(value or "").casefold().strip()
    normalized = re.sub(r"[^\w]+", " ", raw, flags=re.UNICODE).strip()
    return (
        bool(normalized)
        and raw not in PLACEHOLDERS
        and normalized not in PLACEHOLDERS
        and len(normalized) > 1
    )


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
