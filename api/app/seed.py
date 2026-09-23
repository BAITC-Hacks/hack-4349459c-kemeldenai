"""Deterministically seed the local demo database without overwriting user edits."""

from __future__ import annotations

from uuid import UUID

from api.app.database import Proposal, Task, Team, utcnow
from api.app.scoring import score_card
from sqlalchemy import select

SCORING_COLUMNS = {
    "context": "context",
    "need": "need",
    "dataMaterials": "data_materials",
    "expectedResult": "expected_result",
    "successCriteria": "success_criteria",
    "constraints": "constraints",
    "users": "users",
    "contact": "contact",
    "interaction": "interaction",
}


def _score_task_fields(fields: dict[str, str]) -> dict:
    """Score database column names using the same camelCase contract as live cards."""
    return score_card(
        {api_name: fields.get(column, "") for api_name, column in SCORING_COLUMNS.items()}
    )


def seed_database(engine, factory) -> None:
    published_cards = [
        {
            "title": "Сократить отходы упаковки",
            "industry": "Розничная торговля",
            "topic": "Экология",
            "description": "Сократить одноразовую упаковку при доставке заказов.",
            "context": "Городские магазины отправляют 500 заказов в день.",
            "need": "Снизить отходы упаковки без повреждения товаров.",
            "users": "Сотрудники магазина и покупатели доставки.",
            "data_materials": "Доступны записи о заказах и упаковке за шесть месяцев.",
            "constraints": "Использовать текущие станции упаковки; пилот длится два месяца.",
            "expected_result": "Проверенная рекомендация и работающий прототип.",
            "success_criteria": "Снизить массу упаковки на 20% без роста повреждений.",
            "contact": "Руководитель службы доставки",
            "interaction": "Еженедельная встреча с руководителем.",
        },
        {
            "title": "Упростить запись в поликлинику",
            "industry": "Здравоохранение",
            "topic": "Сервисы",
            "description": "Сделать запись на приём удобнее для районной поликлиники.",
            "context": "Поликлиника принимает 140 пациентов в будний день.",
            "need": "Снизить число пропущенных приёмов и ожидание по телефону.",
            "users": "Регистраторы и взрослые пациенты.",
            "data_materials": "Есть обезличенные сводки о записях и звонках.",
            "expected_result": "Прототип записи и рекомендации по внедрению.",
            "success_criteria": "Сократить ожидание по телефону на 15% за четыре недели.",
            # Missing constraints, contact, and interaction: 80 points.
        },
        {
            "title": "Спланировать запасы мастерской",
            "industry": "Производство",
            "topic": "Аналитика",
            "description": "Помочь ремонтной мастерской держать нужные запчасти в наличии.",
            "context": "Мастера ремонтируют бытовую технику в двух точках.",
            "need": "Уменьшить дефицит ходовых деталей и избыток залежавшихся.",
            "users": "Мастера и сотрудники закупок.",
            "constraints": "Рекомендации должны выгружаться в таблицу.",
            "expected_result": "Панель запасов и руководство по повторным заказам.",
            "interaction": "Обсуждение результатов раз в две недели.",
            # Missing data, success criteria, and contact: 60 points.
        },
        {
            "title": "Сделать остановки доступнее",
            "industry": "Транспорт",
            "topic": "Доступность",
            "description": "Улучшить информацию о доступности автобусных остановок.",
            "context": "Перевозчик обслуживает 42 маршрута и 620 остановок.",
            "need": "Помочь пассажирам найти маршрут при закрытии остановки.",
            "users": "Пассажиры с ограниченной мобильностью и нарушением зрения.",
            # A deliberately low-readiness, but published, task: 30 points.
        },
        {
            "title": "Сократить пищевые отходы столовой",
            "industry": "Общественное питание",
            "topic": "Экология",
            "description": "Улучшить ежедневное планирование обедов в столовой.",
            "context": "Столовая готовит обеды примерно для 300 сотрудников.",
            "need": "Снизить остатки съедобной еды, сохранив популярные блюда.",
            "users": "Повара и сотрудники компании.",
            "data_materials": "Записываются меню, число порций и масса остатков.",
            "expected_result": "Прототип прогноза и план корректировки меню.",
            "success_criteria": "Сократить съедобные остатки на 15% за шесть недель.",
            "contact": "Руководитель столовой",
            "interaction": "Еженедельный очный разбор.",
            # Missing constraints: 90 points.
        },
    ]
    drafts = [
        {
            "title": "Изучить потребление энергии",
            "industry": "Управление зданиями",
            "topic": "Энергия",
            "description": "Найти закономерности потребления энергии в здании.",
        },
        {
            "title": "Улучшить обратную связь",
            "industry": "Розничная торговля",
            "topic": "Исследования",
            "description": "Понять частые жалобы покупателей.",
            "need": "Найти повторяющиеся проблемы сервиса.",
        },
        {
            "title": "Повысить безопасность мастерской",
            "industry": "Производство",
            "topic": "Безопасность",
            "description": "Сделать инструкции по безопасности понятнее.",
            "context": "Три мастерские используют бумажные чек-листы.",
            "users": "Сотрудники мастерских.",
        },
        {
            "title": "Создать карту города",
            "industry": "Туризм",
            "topic": "Карты",
            "description": "Помочь гостям находить культурные места.",
            "context": "Гости приезжают поездом и автобусом.",
            "need": "Показать малоизвестные места.",
            "users": "Гости и местные гиды.",
            "constraints": "Поддерживать мобильный браузер.",
        },
        {
            "title": "Оцифровать бумажные обращения",
            "industry": "Госуслуги",
            "topic": "Автоматизация",
            "description": "Ускорить обработку бумажных обращений.",
            "context": "Небольшой офис принимает обращения лично.",
            "need": "Сократить повторный ввод данных.",
            "users": "Сотрудники офиса и жители.",
            "data_materials": "Есть обезличенные образцы бланков.",
            "contact": "Координатор офиса.",
        },
    ]
    team_rows = [
        (
            "Steppe Coders",
            ["госуслуги", "карты"],
            ["разработка интерфейсов", "исследования"],
            ["React", "Figma"],
        ),
        (
            "Data Nomads",
            ["операции", "экология"],
            ["аналитика", "серверная разработка"],
            ["Python", "PostgreSQL"],
        ),
        (
            "Qadam Lab",
            ["доступность", "здоровье"],
            ["дизайн", "прототипирование"],
            ["TypeScript", "Figma"],
        ),
        (
            "Green Bytes",
            ["еда", "энергия"],
            ["анализ данных", "продукт"],
            ["Python", "scikit-learn"],
        ),
        (
            "Orda Makers",
            ["производство", "транспорт"],
            ["электроника", "разработка"],
            ["Arduino", "React"],
        ),
    ]
    task_ids = [str(UUID(int=1001 + i)) for i in range(10)]
    team_ids = [str(UUID(int=2001 + i)) for i in range(5)]
    with factory() as session, session.begin():
        for i, fields in enumerate(published_cards):
            key = f"demo-published-{i + 1}"
            if session.scalar(select(Task.id).where(Task.seed_key == key)):
                continue
            complete_fields = {field: "" for field in published_cards[0]}
            complete_fields.update(fields)
            scoring = _score_task_fields(complete_fields)
            session.add(
                Task(
                    id=task_ids[i],
                    seed_key=key,
                    **complete_fields,
                    status="published",
                    confirmed_at=utcnow(),
                    score=scoring["score"],
                    readiness=scoring["readiness"],
                    breakdown=scoring["breakdown"],
                    missing=scoring["missing"],
                )
            )
        for i, fields in enumerate(drafts):
            key = f"demo-draft-{i + 1}"
            if session.scalar(select(Task.id).where(Task.seed_key == key)):
                continue
            complete_fields = {field: "" for field in published_cards[0]}
            complete_fields.update(fields)
            session.add(Task(id=task_ids[i + 5], seed_key=key, **complete_fields, status="draft"))
        for i, (name, interests, skills, technologies) in enumerate(team_rows):
            key = f"demo-team-{i + 1}"
            if session.scalar(select(Team.id).where(Team.seed_key == key)):
                continue
            session.add(
                Team(
                    id=team_ids[i],
                    seed_key=key,
                    name=name,
                    interests=interests,
                    skills=skills,
                    technologies=technologies,
                    progress_points=0,
                )
            )
        session.flush()
        for i in range(5):
            key = f"demo-proposal-{i + 1}"
            existing = session.scalar(select(Proposal).where(Proposal.seed_key == key))
            example_url = f"https://example.org/prototypes/demo-{i + 1}"
            if existing:
                if not existing.prototype_url:
                    existing.prototype_url = example_url
                continue
            session.add(
                Proposal(
                    id=str(UUID(int=3001 + i)),
                    seed_key=key,
                    task_id=task_ids[i],
                    team_id=team_ids[i],
                    idea=f"Подготовить прототип для задачи «{published_cards[i]['title']}».",
                    plan="Поговорить с пользователями, спроектировать решение и проверить небольшой прототип.",
                    timeline="Три недели",
                    prototype_url=example_url,
                    decision="pending",
                )
            )


if __name__ == "__main__":
    from api.app.database import Base, make_engine, session_factory

    engine = make_engine()
    Base.metadata.create_all(engine)
    seed_database(engine, session_factory(engine))
