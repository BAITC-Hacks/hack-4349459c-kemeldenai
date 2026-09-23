"""Demo fixtures must reflect the public scoring and Russian-language contract."""

import re

from sqlalchemy import select

from api.app.database import Base, Proposal, Task, Team, make_engine, session_factory
from api.app.scoring import score_card
from api.app.seed import seed_database


CYRILLIC = re.compile(r"[А-Яа-яЁё]")


def seeded_database(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path}/seeds.db")
    Base.metadata.create_all(engine)
    factory = session_factory(engine)
    seed_database(engine, factory)
    return engine, factory


def test_seeded_cards_have_computed_scores_and_demo_readiness_range(tmp_path):
    engine, factory = seeded_database(tmp_path)
    with factory() as session:
        published = session.scalars(select(Task).where(Task.status == "published")).all()
        drafts = session.scalars(select(Task).where(Task.status == "draft")).all()
        assert len(published) == len(drafts) == 5
        assert len(session.scalars(select(Team)).all()) == 5
        assert len(session.scalars(select(Proposal)).all()) == 5
        assert {task.readiness for task in published} == {"draft", "workable", "ready", "priority"}
        for task in published:
            card = {
                "context": task.context,
                "need": task.need,
                "dataMaterials": task.data_materials,
                "expectedResult": task.expected_result,
                "successCriteria": task.success_criteria,
                "constraints": task.constraints,
                "users": task.users,
                "contact": task.contact,
                "interaction": task.interaction,
            }
            expected = score_card(card)
            assert (task.score, task.readiness, task.breakdown, task.missing) == (
                expected["score"], expected["readiness"], expected["breakdown"], expected["missing"]
            )
            assert task.confirmed_at is not None
        assert any(task.score < 40 for task in published)
    engine.dispose()


def test_seeded_user_facing_content_is_russian(tmp_path):
    engine, factory = seeded_database(tmp_path)
    with factory() as session:
        for task in session.scalars(select(Task)).all():
            for field in ("title", "industry", "topic", "description"):
                assert CYRILLIC.search(getattr(task, field)), (task.seed_key, field)
        for proposal in session.scalars(select(Proposal)).all():
            for field in ("idea", "plan", "timeline"):
                assert CYRILLIC.search(getattr(proposal, field)), (proposal.seed_key, field)
    engine.dispose()


def test_reseeding_preserves_existing_changes_and_counts(tmp_path):
    engine, factory = seeded_database(tmp_path)
    with factory() as session, session.begin():
        task = session.scalar(select(Task).where(Task.seed_key == "demo-published-1"))
        task.title = "Изменённая пользователем задача"
        task_id = task.id
    seed_database(engine, factory)
    with factory() as session:
        task = session.scalar(select(Task).where(Task.seed_key == "demo-published-1"))
        assert (task.id, task.title) == (task_id, "Изменённая пользователем задача")
        assert len(session.scalars(select(Task)).all()) == 10
        assert len(session.scalars(select(Team)).all()) == 5
        assert len(session.scalars(select(Proposal)).all()) == 5
    engine.dispose()
