from api.app.main import create_app
from api.app.scoring import is_meaningful, readiness_for_score, score_card
from fastapi.testclient import TestClient


def full_card(**overrides):
    card = {
        "title": "Reduce packaging waste",
        "industry": "Retail",
        "topic": "Sustainability",
        "description": "Find ways to reduce packaging waste in deliveries.",
        "context": "Our city stores ship 500 orders each day.",
        "need": "We need to reduce single-use packaging.",
        "users": "Store operations staff and delivery customers.",
        "dataMaterials": "Six months of order and packaging records are available.",
        "constraints": "Must work with current packing stations and a 2 month pilot.",
        "expectedResult": "A tested recommendation and working prototype.",
        "successCriteria": "Reduce packaging weight by 20 percent without increasing damage.",
        "contact": "Demo Business",
        "interaction": "Weekly review with the operations lead.",
    }
    card.update(overrides)
    return card


def client(tmp_path):
    app = create_app(database_url=f"sqlite:///{tmp_path}/test.db", seed=True)
    return TestClient(app)


def test_scoring_readiness_band_boundaries():
    assert [readiness_for_score(n) for n in (0, 39, 40, 69, 70, 89, 90, 100)] == [
        "draft",
        "draft",
        "workable",
        "workable",
        "ready",
        "ready",
        "priority",
        "priority",
    ]


def test_blank_and_placeholder_values_are_not_meaningful():
    for value in ("", "  \n", "TBD", "n/a", "не знаю", "placeholder"):
        assert not is_meaningful(value)
    assert is_meaningful("We have six months of customer order records.")


def test_confirmed_score_uses_only_meaningful_fields_and_reports_missing():
    result = score_card(full_card(context=" TBD ", users=" "))
    assert result["score"] < 100
    assert "context" in result["missing"]
    assert "users" in result["missing"]
    assert result["readiness"] == readiness_for_score(result["score"])
    assert sum(row["earned"] for row in result["breakdown"]) == result["score"]
    assert sum(row["maximum"] for row in result["breakdown"]) == 100


def test_health_and_seed_counts(tmp_path):
    with client(tmp_path) as c:
        assert c.get("/api/health").status_code == 200
        assert len(c.get("/api/teams").json()) == 5
        tasks = c.get("/api/tasks").json()
        assert len(tasks) == 5
        assert all(task["status"] == "published" for task in tasks)
        assert len(c.get(f"/api/tasks/{tasks[0]['id']}/proposals").json()) >= 1


def test_seed_is_idempotent(tmp_path):
    app = create_app(database_url=f"sqlite:///{tmp_path}/test.db", seed=True)
    with TestClient(app) as c:
        ids_before = {task["id"] for task in c.get("/api/tasks").json()}
        from api.app.database import Task

        with app.state.session_factory() as session:
            counts_before = session.query(Task).count()
        app.state.seed_database()
        with app.state.session_factory() as session:
            assert session.query(Task).count() == counts_before
            assert session.query(Task).filter(Task.status == "draft").count() == 5
        assert {task["id"] for task in c.get("/api/tasks").json()} == ids_before
        assert len(ids_before) == 5


def test_draft_confirmation_publication_proposals_and_manual_decisions(tmp_path):
    with client(tmp_path) as c:
        created = c.post("/api/tasks", json=full_card(description="A short task.")).json()
        task_id = created["id"]
        assert created["status"] == "draft"
        assert created["score"] is None

        saved = c.put(f"/api/tasks/{task_id}", json=full_card()).json()
        assert saved["confirmedAt"] is None
        assert saved["score"] is None

        confirmed = c.post(f"/api/tasks/{task_id}/confirm", json=full_card()).json()
        assert confirmed["confirmedAt"] is not None
        assert confirmed["score"] == 100

        # Unconfirmed edits never leak into the confirmed/published card.
        c.put(f"/api/tasks/{task_id}", json=full_card(title="Unconfirmed title"))
        assert c.post(f"/api/tasks/{task_id}/publish").status_code == 409
        reconfirmed = c.post(f"/api/tasks/{task_id}/confirm", json=full_card()).json()
        assert reconfirmed["title"] == "Reduce packaging waste"
        assert c.post(f"/api/tasks/{task_id}/publish").json()["status"] == "published"

        teams = c.get("/api/teams").json()
        proposals = []
        for team in teams[:2]:
            response = c.post(
                f"/api/tasks/{task_id}/proposals",
                json={
                    "teamId": team["id"],
                    "idea": "Reuse delivery totes",
                    "plan": "Test a route",
                    "timeline": "Two weeks",
                    "prototypeUrl": "https://example.org/demo",
                },
            )
            assert response.status_code == 201
            proposals.append(response.json())
        assert len(c.get(f"/api/tasks/{task_id}/proposals").json()) == 2
        for proposal, decision in zip(proposals, ("selected", "rejected"), strict=True):
            result = c.patch(f"/api/proposals/{proposal['id']}", json={"decision": decision})
            assert result.status_code == 200
            assert result.json()["decision"] == decision
        third = c.post(
            f"/api/tasks/{task_id}/proposals",
            json={
                "teamId": teams[2]["id"],
                "idea": "Another idea",
                "plan": "Run a second route",
                "timeline": "Three weeks",
                "prototypeUrl": "https://example.org/another-demo",
            },
        ).json()
        assert (
            c.patch(f"/api/proposals/{third['id']}", json={"decision": "selected"}).json()[
                "decision"
            ]
            == "selected"
        )
        assert (
            sum(
                p["decision"] == "selected" for p in c.get(f"/api/tasks/{task_id}/proposals").json()
            )
            == 2
        )


def test_failed_confirmation_does_not_change_published_snapshot(tmp_path):
    with client(tmp_path) as c:
        original = full_card()
        task = c.post("/api/tasks", json=original).json()
        c.post(f"/api/tasks/{task['id']}/confirm", json=original)
        c.post(f"/api/tasks/{task['id']}/publish")
        changed = full_card(title="New title")
        bad = c.post(
            f"/api/tasks/{task['id']}/confirm", json={**changed, "description": "x" * 12001}
        )
        assert bad.status_code == 422
        fetched = c.get(f"/api/tasks/{task['id']}").json()
        assert fetched["title"] == original["title"]
        assert fetched["status"] == "published"
        assert fetched["score"] == 100


def test_low_score_confirmed_task_can_be_published_and_proposed_to(tmp_path):
    with client(tmp_path) as c:
        low = full_card(
            context="",
            need="",
            users="",
            dataMaterials="",
            constraints="",
            expectedResult="",
            successCriteria="",
            contact="",
            interaction="",
        )
        task = c.post("/api/tasks", json=low).json()
        confirmed = c.post(f"/api/tasks/{task['id']}/confirm", json=low).json()
        assert confirmed["score"] < 40
        assert c.post(f"/api/tasks/{task['id']}/publish").status_code == 200
        catalog = c.get("/api/tasks").json()
        assert any(row["id"] == task["id"] for row in catalog)
        team = c.get("/api/teams").json()[0]
        response = c.post(
            f"/api/tasks/{task['id']}/proposals",
            json={
                "teamId": team["id"],
                "idea": "An idea",
                "plan": "A plan",
                "timeline": "One month",
                "prototypeUrl": "https://example.org/low-score-demo",
            },
        )
        assert response.status_code == 201


def test_catalog_filters_and_sorts_published_cards(tmp_path):
    with client(tmp_path) as c:
        rows = c.get("/api/tasks").json()
        assert [row["score"] for row in rows] == sorted(
            (row["score"] for row in rows), reverse=True
        )
        topic = rows[0]["topic"]
        assert all(
            row["topic"] == topic for row in c.get("/api/tasks", params={"topic": topic}).json()
        )
        readiness = rows[0]["readiness"]
        assert all(
            row["readiness"] == readiness
            for row in c.get("/api/tasks", params={"readiness": readiness}).json()
        )


def test_analyze_has_three_questions_and_error_envelopes(tmp_path):
    with client(tmp_path) as c:
        result = c.post(
            "/api/analyze",
            json={"description": "Need a better delivery process", "industry": "Retail"},
        )
        assert result.status_code == 200
        assert result.json()["source"] in ("ai", "fallback")
        assert len(result.json()["questions"]) >= 3
        missing = c.get("/api/tasks/not-a-uuid")
        assert missing.status_code == 422
        assert "error" in missing.json()
        invalid = c.post("/api/tasks", json={"unexpected": "value"})
        assert invalid.status_code == 422
        assert "error" in invalid.json()


def test_validation_rejects_oversize_and_non_http_urls(tmp_path):
    with client(tmp_path) as c:
        too_long = full_card(description="x" * 12001)
        assert c.post("/api/tasks", json=too_long).status_code == 422
        created = c.post("/api/tasks", json=full_card()).json()
        team = c.get("/api/teams").json()[0]
        bad_url = c.post(
            f"/api/tasks/{created['id']}/proposals",
            json={
                "teamId": team["id"],
                "idea": "idea",
                "plan": "plan",
                "timeline": "now",
                "prototypeUrl": "javascript:alert(1)",
            },
        )
        assert bad_url.status_code == 422
