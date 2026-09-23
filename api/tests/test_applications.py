from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from api.app.database import Proposal, Task, Team
from api.app.main import create_app
from fastapi.testclient import TestClient
from sqlalchemy import select


def test_application_history_is_team_scoped_and_keeps_completed_work(tmp_path):
    app = create_app(database_url=f"sqlite:///{tmp_path}/applications.db")
    with TestClient(app) as client:
        teams = client.get("/api/teams").json()
        team_id = teams[0]["id"]
        path = f"/api/teams/{team_id}/applications"
        snapshot = client.get(path).json()
        assert snapshot["team"]["id"] == team_id
        assert snapshot["applications"]
        assert all(item["proposal"]["teamId"] == team_id for item in snapshot["applications"])
        other = client.get(f"/api/teams/{teams[1]['id']}/applications").json()
        assert all(item["proposal"]["teamId"] == teams[1]["id"] for item in other["applications"])
        application = snapshot["applications"][0]
        proposal_id = application["proposal"]["id"]
        assert application["taskTitle"]
        assert application["taskAvailable"]
        assert application["milestones"] == []
        client.patch(f"/api/proposals/{proposal_id}", json={"decision": "selected"})
        response = client.post(f"/api/proposals/{proposal_id}/milestones", json={"description": "Проверен прототип"})
        assert response.status_code == 201
        client.patch(f"/api/proposals/{proposal_id}", json={"decision": "rejected"})
        result = client.get(path).json()
        changed = next(item for item in result["applications"] if item["proposal"]["id"] == proposal_id)
        assert changed["proposal"]["decision"] == "rejected"
        assert changed["milestones"] == [response.json()]
        assert result["team"]["progressPoints"] == snapshot["team"]["progressPoints"] + 10
        with app.state.session_factory() as session:
            task = session.get(Task, application["proposal"]["taskId"])
            task.status = "draft"
            session.commit()
        changed = next(item for item in client.get(path).json()["applications"] if item["proposal"]["id"] == proposal_id)
        assert changed["taskAvailable"] is False
        assert changed["milestones"]


def test_empty_missing_team_and_invalid_id(tmp_path):
    app = create_app(database_url=f"sqlite:///{tmp_path}/empty.db", seed=False)
    team_id = str(uuid4())
    with TestClient(app) as client:
        with app.state.session_factory() as session:
            session.add(Team(id=team_id, name="New team", interests=[], skills=[], technologies=[]))
            session.commit()
        assert client.get(f"/api/teams/{team_id}/applications").json()["applications"] == []
        assert client.get(f"/api/teams/{uuid4()}/applications").status_code == 404
        assert client.get("/api/teams/invalid/applications").status_code == 422


def test_simultaneous_milestones_award_points_once(tmp_path):
    app = create_app(database_url=f"sqlite:///{tmp_path}/concurrent.db")
    with TestClient(app) as client:
        with app.state.session_factory() as session:
            proposal = session.scalar(select(Proposal))
            proposal.decision = "selected"
            proposal_id, team_id = proposal.id, proposal.team_id
            baseline = session.get(Team, team_id).progress_points
            session.commit()
        def confirm(_):
            return client.post(f"/api/proposals/{proposal_id}/milestones", json={"description": "Проверен результат"}).status_code
        with ThreadPoolExecutor(max_workers=2) as executor:
            assert sorted(executor.map(confirm, range(2))) == [201, 409]
        with app.state.session_factory() as session:
            assert session.get(Team, team_id).progress_points == baseline + 10
