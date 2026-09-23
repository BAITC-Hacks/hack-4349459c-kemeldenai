from datetime import timedelta
from uuid import uuid4

from api.app.database import Task, TaskClick, Team, utcnow
from api.app.main import create_app
from fastapi.testclient import TestClient
from sqlalchemy import func, select


def test_personalization_clicks_reset_and_persistence(tmp_path):
    url = f"sqlite:///{tmp_path}/recommendations.db"
    app = create_app(database_url=url, seed=False)
    team_id, other_id = str(uuid4()), str(uuid4())
    eco, similar, high, draft = [str(uuid4()) for _ in range(4)]
    with TestClient(app) as client:
        with app.state.session_factory() as session:
            session.add_all([
                Team(id=team_id, name="Eco", interests=["Экология"], skills=[], technologies=[]),
                Team(id=other_id, name="Other", interests=[], skills=[], technologies=[]),
                Task(id=eco, topic="Экология", status="published", score=10),
                Task(id=similar, topic="Экология", status="published", score=0),
                Task(id=high, topic="Финансы", status="published", score=100),
                Task(id=draft, topic="Экология", status="draft", score=100),
            ])
            session.commit()
        path = f"/api/teams/{team_id}"
        ranked = client.get(path + "/recommendations").json()
        assert ranked[0]["taskId"] == eco
        assert {item["taskId"] for item in ranked} == {eco, similar, high}
        assert "Фокус команды" in ranked[0]["reasons"][0]
        assert client.put(path + "/focus", json={"interests": []}).status_code == 200
        assert client.get(path + "/recommendations").json()[0]["taskId"] == high
        for _ in range(3):
            assert client.post(path + f"/clicks/{eco}").status_code == 200
        ranked = client.get(path + "/recommendations").json()
        assert ranked[0]["taskId"] == similar
        assert "просмотренное" in ranked[0]["reasons"][0]
        assert client.get(f"/api/teams/{other_id}/recommendations").json()[0]["taskId"] == high
        with app.state.session_factory() as session:
            assert session.scalar(select(func.count()).select_from(TaskClick)) == 1
        assert client.post(path + f"/clicks/{draft}").status_code == 404
        assert client.post(path + f"/clicks/{uuid4()}").status_code == 404
        assert client.get(f"/api/teams/{uuid4()}/recommendations").status_code == 404
        assert client.get("/api/teams/invalid/recommendations").status_code == 422
    # Both the click and the edited profile survive a server restart.
    app = create_app(database_url=url, seed=False)
    with TestClient(app) as client:
        assert client.get(path + "/recommendations").json()[0]["taskId"] == similar
        with app.state.session_factory() as session:
            click = session.get(TaskClick, (team_id, eco))
            click.clicked_at = utcnow() - timedelta(days=91)
            session.commit()
        assert client.get(path + "/recommendations").json()[0]["taskId"] == high
        client.post(path + f"/clicks/{eco}")
        assert client.delete(path + "/clicks").status_code == 200
        assert client.get(path + "/recommendations").json()[0]["taskId"] == high
        with app.state.session_factory() as session:
            assert session.scalar(select(func.count()).select_from(TaskClick)) == 0


def test_focus_validation_and_matching(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path}/focus.db")) as client:
        team = client.get("/api/teams").json()[0]
        path = f"/api/teams/{team['id']}/focus"
        for interests in [[" "], ["x" * 81], ["x"] * 13, [1]]:
            assert client.put(path, json={"interests": interests}).status_code == 422
        response = client.put(path, json={"interests": [" Экология ", "экология"]})
        assert response.status_code == 200
        assert response.json()["interests"] == ["Экология"]
        assert response.json()["skills"] == team["skills"]


def test_bookmarks_are_idempotent_isolated_and_persistent(tmp_path):
    url = f"sqlite:///{tmp_path}/bookmarks.db"
    app = create_app(database_url=url)
    with TestClient(app) as client:
        teams = client.get("/api/teams").json()
        team_id, other_id = teams[0]["id"], teams[1]["id"]
        tasks = client.get("/api/tasks").json()
        task_id = tasks[0]["id"]
        path = f"/api/teams/{team_id}/bookmarks"
        assert client.get(path).json() == []
        for _ in range(3):
            assert client.put(path + f"/{task_id}").status_code == 200
        assert client.get(path).json() == [task_id]
        assert client.get(f"/api/teams/{other_id}/bookmarks").json() == []
        assert client.put(path + f"/{uuid4()}").status_code == 404
        with app.state.session_factory() as session:
            draft_id = session.scalar(select(Task.id).where(Task.status == "draft"))
        assert client.put(path + f"/{draft_id}").status_code == 404
        assert client.get(f"/api/teams/{uuid4()}/bookmarks").status_code == 404
        assert client.get("/api/teams/invalid/bookmarks").status_code == 422
    with TestClient(create_app(database_url=url)) as client:
        assert client.get(path).json() == [task_id]
        for _ in range(2):
            assert client.delete(path + f"/{task_id}").status_code == 200
        assert client.get(path).json() == []


def test_bookmark_is_stronger_than_click_and_removal_reverses_signal(tmp_path):
    app = create_app(database_url=f"sqlite:///{tmp_path}/signal.db", seed=False)
    team_id = str(uuid4())
    saved, similar, clicked, click_similar = [str(uuid4()) for _ in range(4)]
    with TestClient(app) as client:
        with app.state.session_factory() as session:
            session.add(Team(id=team_id, name="Team", interests=[], skills=[], technologies=[]))
            session.add_all([
                Task(id=saved, topic="Экология", status="published", score=0),
                Task(id=similar, topic="Экология", status="published", score=0),
                Task(id=clicked, topic="Карты", status="published", score=0),
                Task(id=click_similar, topic="Карты", status="published", score=0),
            ])
            session.commit()
        path = f"/api/teams/{team_id}"
        client.post(path + f"/clicks/{clicked}")
        baseline = client.get(path + "/recommendations").json()
        client.put(path + f"/bookmarks/{saved}")
        ranked = client.get(path + "/recommendations").json()
        assert ranked[0]["taskId"] == similar
        assert "сохранённые" in ranked[0]["reasons"][0]
        client.delete(path + f"/bookmarks/{saved}")
        after = client.get(path + "/recommendations").json()
        assert [item["taskId"] for item in after] == [item["taskId"] for item in baseline]
