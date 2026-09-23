from api.app.main import create_app
from fastapi.testclient import TestClient


def test_selected_stage_awards_once_and_survives_restart(tmp_path):
    database_url = f"sqlite:///{tmp_path}/milestones.db"
    proposal_id = None
    team_id = None
    with TestClient(create_app(database_url=database_url, seed=True)) as client:
        task = client.get("/api/tasks").json()[0]
        team = client.get("/api/teams").json()[0]
        team_id = team["id"]
        baseline = team["progressPoints"]
        proposal = client.post(
            f"/api/tasks/{task['id']}/proposals",
            json={
                "teamId": team_id,
                "idea": "Проверить рабочий процесс",
                "plan": "Сделать и проверить прототип",
                "timeline": "Две недели",
                "prototypeUrl": "https://example.org/prototype",
            },
        )
        assert proposal.status_code == 201
        proposal_id = proposal.json()["id"]
        path = f"/api/proposals/{proposal_id}/milestones"
        assert client.get(path).json() == []
        assert client.post(path, json={"description": "Проверили прототип"}).status_code == 409
        assert client.patch(f"/api/proposals/{proposal_id}", json={"decision": "selected"}).status_code == 200
        assert client.post(path, json={"description": "  "}).status_code == 422

        first = client.post(path, json={"description": "  Прототип проверен с заказчиком  "})
        assert first.status_code == 201
        milestone = first.json()
        assert milestone["proposalId"] == proposal_id
        assert milestone["description"] == "Прототип проверен с заказчиком"
        assert milestone["pointsAwarded"] == 10
        assert milestone["confirmedAt"]
        assert client.get(path).json() == [milestone]
        assert client.post(path, json={"description": "Повтор"}).status_code == 409
        assert next(t for t in client.get("/api/teams").json() if t["id"] == team_id)[
            "progressPoints"
        ] == baseline + 10

        # A later decision change does not take away completed progress.
        client.patch(f"/api/proposals/{proposal_id}", json={"decision": "rejected"})
        assert client.get(path).json() == [milestone]

    with TestClient(create_app(database_url=database_url, seed=True)) as client:
        assert client.get(f"/api/proposals/{proposal_id}/milestones").json() == [milestone]
        assert next(t for t in client.get("/api/teams").json() if t["id"] == team_id)[
            "progressPoints"
        ] == baseline + 10


def test_rejected_unknown_and_invalid_prototypes(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path}/other.db", seed=True)) as client:
        missing = "00000000-0000-0000-0000-000000000001"
        path = f"/api/proposals/{missing}/milestones"
        assert client.get(path).status_code == 404
        assert client.post(path, json={"description": "Прототип готов"}).status_code == 404

        task = client.get("/api/tasks").json()[0]
        team = client.get("/api/teams").json()[0]
        body = {
            "teamId": team["id"],
            "idea": "Идея",
            "plan": "План",
            "timeline": "Неделя",
            "prototypeUrl": "https://example.org/prototype",
        }
        for bad_url in (None, "", " ", "ftp://example.org/file"):
            bad_body = {**body, "prototypeUrl": bad_url}
            assert client.post(f"/api/tasks/{task['id']}/proposals", json=bad_body).status_code == 422

        proposal = client.post(f"/api/tasks/{task['id']}/proposals", json=body).json()
        client.patch(f"/api/proposals/{proposal['id']}", json={"decision": "rejected"})
        rejected_path = f"/api/proposals/{proposal['id']}/milestones"
        assert client.post(rejected_path, json={"description": "Прототип готов"}).status_code == 409
        assert client.get(rejected_path).json() == []
