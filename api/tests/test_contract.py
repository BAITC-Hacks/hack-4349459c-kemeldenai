"""Black-box contract checks beyond the main demo path."""

import pytest
from fastapi.testclient import TestClient

from api.app.main import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "")
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path}/contract.db", seed=True)) as client:
        yield client


def test_partial_draft_has_usable_lists_and_server_owned_metadata(client):
    response = client.post("/api/tasks", json={})
    assert response.status_code == 201
    task = response.json()
    assert task["score"] is None
    assert task["readiness"] == "draft"
    assert isinstance(task["breakdown"], list)
    assert isinstance(task["missing"], list)
    assert task["confirmedAt"] is None
    for metadata in ({"score": 100}, {"confirmedAt": "2026-01-01T00:00:00Z"}, {"status": "published"}):
        assert client.post("/api/tasks", json=metadata).status_code == 422


def test_published_edit_requires_atomic_confirmation(client):
    task = client.get("/api/tasks").json()[0]
    task_id = task["id"]
    response = client.put(f"/api/tasks/{task_id}", json={"title": "Неподтверждённая правка"})
    assert response.status_code == 409
    assert client.get(f"/api/tasks/{task_id}").json() == task
    changed = client.post(f"/api/tasks/{task_id}/confirm", json={"title": "Подтверждённая правка"}).json()
    assert changed["title"] == "Подтверждённая правка"
    assert changed["status"] == "published"
    assert changed["score"] == 0
    assert changed["readiness"] == "draft"
    assert any(row["id"] == task_id for row in client.get("/api/tasks", params={"readiness": "draft"}).json())


def test_same_team_can_submit_repeatedly_and_select_multiple(client):
    task = client.get("/api/tasks").json()[-1]
    team = client.get("/api/teams").json()[0]
    body = {"teamId": team["id"], "idea": "Проверить гипотезу", "plan": "Собрать прототип", "timeline": "Две недели"}
    first = client.post(f"/api/tasks/{task['id']}/proposals", json=body)
    second = client.post(f"/api/tasks/{task['id']}/proposals", json=body)
    assert first.status_code == second.status_code == 201
    assert first.json()["id"] != second.json()["id"]
    for proposal in (first.json(), second.json()):
        assert proposal["decision"] == "pending"
        assert client.patch(f"/api/proposals/{proposal['id']}", json={"decision": "selected"}).status_code == 200


def test_draft_proposals_and_unknown_teams_are_rejected(client):
    draft = client.post("/api/tasks", json={"title": "Черновик"}).json()
    team = client.get("/api/teams").json()[0]
    body = {"teamId": team["id"], "idea": "Идея", "plan": "План", "timeline": "Неделя"}
    assert client.post(f"/api/tasks/{draft['id']}/proposals", json=body).status_code == 409
    assert client.get(f"/api/tasks/{draft['id']}/proposals").status_code == 409
    task = client.get("/api/tasks").json()[0]
    body["teamId"] = "00000000-0000-0000-0000-000000000001"
    assert client.post(f"/api/tasks/{task['id']}/proposals", json=body).status_code == 404


@pytest.mark.parametrize("field", ["idea", "plan", "timeline"])
def test_proposals_reject_whitespace_required_content(client, field):
    task = client.get("/api/tasks").json()[0]
    team = client.get("/api/teams").json()[0]
    body = {"teamId": team["id"], "idea": "Идея", "plan": "План", "timeline": "Неделя", field: " \n "}
    response = client.post(f"/api/tasks/{task['id']}/proposals", json=body)
    assert response.status_code == 422
    assert set(response.json()) == {"error"}


def test_unknown_route_and_method_have_error_envelope(client):
    for response in (client.get("/api/unknown"), client.delete("/api/tasks")):
        assert response.status_code in (404, 405)
        assert set(response.json()) == {"error"}


def test_ai_card_values_are_bounded_and_filter_validated(client):
    response = client.post("/api/analyze", json={"description": "Нужен сервис", "card": {"context": "x" * 12001}})
    assert response.status_code == 422
    assert client.get("/api/tasks?readiness=unknown").status_code == 422


def test_openapi_uses_contract_responses_and_camel_case(client):
    schema = client.get("/openapi.json").json()
    assert schema["components"]["schemas"]["TaskCard"]["properties"].keys() >= {"confirmedAt", "dataMaterials", "createdAt", "successCriteria"}
    for path, methods in schema["paths"].items():
        if path.startswith("/api/"):
            for operation in methods.values():
                assert operation["responses"]["422"]["content"]["application/json"]["schema"]["$ref"].endswith("/ErrorResponse")


def test_topic_filter_returns_matching_russian_tasks_and_no_sql_wildcards(client):
    task = client.get("/api/tasks").json()[0]
    matches = client.get("/api/tasks", params={"topic": task["topic"]}).json()
    assert matches
    assert all(row["topic"] == task["topic"] for row in matches)
    assert client.get("/api/tasks", params={"topic": "%"}).json() == []


def test_database_failure_has_safe_error_and_recovers(client, caplog):
    from sqlalchemy import event
    from sqlalchemy.exc import OperationalError

    def fail(*args):
        raise OperationalError("secret-query", {}, Exception("secret-password"))

    engine = client.app.state.engine
    event.listen(engine, "before_cursor_execute", fail)
    try:
        response = client.get("/api/health")
        assert response.status_code == 503
        assert set(response.json()) == {"error"}
        assert "secret" not in response.text + caplog.text
    finally:
        event.remove(engine, "before_cursor_execute", fail)
    assert client.get("/api/health").status_code == 200


def test_unknown_resources_and_invalid_decisions(client):
    missing = "00000000-0000-0000-0000-000000000001"
    for method, path, body in [
        ("GET", f"/api/tasks/{missing}", None),
        ("PUT", f"/api/tasks/{missing}", {}),
        ("POST", f"/api/tasks/{missing}/confirm", {}),
        ("POST", f"/api/tasks/{missing}/publish", None),
        ("GET", f"/api/tasks/{missing}/proposals", None),
        ("PATCH", f"/api/proposals/{missing}", {"decision": "selected"}),
    ]:
        response = client.request(method, path, json=body)
        assert response.status_code == 404
        assert set(response.json()) == {"error"}
    assert client.patch(f"/api/proposals/{missing}", json={"decision": "pending"}).status_code == 422
