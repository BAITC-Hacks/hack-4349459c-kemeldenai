"""Exercise the full API on PostgreSQL in a disposable, uniquely named schema.

Run from the repository root: python -m api.verify_postgres
Writes OpenAPI and endpoint examples without touching the application's tables.
"""

import json
from pathlib import Path
from uuid import uuid4

from api.app.database import make_engine
from api.app.main import create_app
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text


def main():
    engine = make_engine()
    if engine.dialect.name != "postgresql":
        raise RuntimeError("This check requires PostgreSQL")
    schema = "verify_agent_a_" + uuid4().hex
    with engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    isolated_url = engine.url.update_query_dict({"options": f"-csearch_path={schema}"})
    app = None
    try:
        app = create_app(database_url=isolated_url.render_as_string(hide_password=False), seed=True)
        examples = []
        with TestClient(app) as client:

            def call(method, path, body=None, expected=200):
                response = (
                    client.request(method, path, json=body)
                    if body is not None
                    else client.request(method, path)
                )
                assert response.status_code == expected, (
                    method,
                    path,
                    response.status_code,
                    response.text,
                )
                result = response.json()
                examples.append(
                    {
                        "method": method,
                        "path": path,
                        "request": body,
                        "status": expected,
                        "response": result,
                    }
                )
                return result

            call("GET", "/api/health")
            questions = call(
                "POST",
                "/api/analyze",
                {"description": "Нужен сервис для магазина", "industry": "Торговля"},
            )
            assert len(questions["questions"]) >= 3
            cards = call("GET", "/api/tasks")
            assert len(cards) == 5
            assert {card["readiness"] for card in cards} == {
                "draft",
                "workable",
                "ready",
                "priority",
            }
            teams = call("GET", "/api/teams")
            assert len(teams) == 5
            weak = {
                "title": "Сервис для магазина",
                "industry": "Торговля",
                "description": "Помочь с заказами",
                "topic": "Автоматизация",
            }
            draft = call("POST", "/api/tasks", weak, 201)
            path = f"/api/tasks/{draft['id']}"
            call("GET", path)
            call("POST", path + "/publish", expected=409)
            full = {
                **weak,
                "context": "Магазин вручную обрабатывает 100 заявок в день",
                "need": "Снизить время обработки заявок",
                "users": "Менеджеры магазина",
                "dataMaterials": "Доступны обезличенные заказы за полгода",
                "constraints": "Работать в браузере; пилот за месяц",
                "expectedResult": "Прототип панели обработки заказов",
                "successCriteria": "Сократить среднее время обработки на 20%",
                "contact": "Менеджер демо-магазина, demo@example.org",
                "interaction": "Еженедельная проверка прототипа",
            }
            call("PUT", path, full)
            confirmed = call("POST", path + "/confirm", full)
            assert confirmed["score"] == 100
            call("POST", path + "/publish")
            call("PUT", path, weak, expected=409)
            assert call("GET", path)["score"] == 100
            for i in range(2):
                proposal = call(
                    "POST",
                    path + "/proposals",
                    {
                        "teamId": teams[i]["id"],
                        "idea": "Панель очереди заявок",
                        "plan": "Интервью, прототип, проверка на примерах",
                        "timeline": "Три недели",
                        "prototypeUrl": "https://example.org/prototype",
                    },
                    201,
                )
                call("PATCH", f"/api/proposals/{proposal['id']}", {"decision": "selected"})
            assert len(call("GET", path + "/proposals")) == 2
            low = cards[-1]
            assert low["score"] < 40
            proposal = call(
                "POST",
                f"/api/tasks/{low['id']}/proposals",
                {
                    "teamId": teams[0]["id"],
                    "idea": "Уточнить процесс",
                    "plan": "Провести интервью",
                    "timeline": "Неделя",
                    "prototypeUrl": "",
                },
                201,
            )
            call("PATCH", f"/api/proposals/{proposal['id']}", {"decision": "rejected"})
            output = Path(__file__).parent
            (output / "openapi.json").write_text(
                json.dumps(client.get("/openapi.json").json(), ensure_ascii=False, indent=2) + "\n"
            )
            (output / "examples.json").write_text(
                json.dumps(examples, ensure_ascii=False, indent=2) + "\n"
            )
        # Reopening the application must retain committed data and avoid duplicate seeds.
        with TestClient(
            create_app(database_url=isolated_url.render_as_string(hide_password=False), seed=True)
        ) as client:
            assert len(client.get("/api/tasks").json()) == 6
            assert len(client.get("/api/teams").json()) == 5
            assert client.get(path).json()["score"] == 100
        print(
            f"PostgreSQL API flow passed: {len(examples)} requests, restart persistence, seed idempotence. Exported api/openapi.json and api/examples.json."
        )
    finally:
        if app is not None and hasattr(app.state, "engine"):
            app.state.engine.dispose()
        cleanup = create_engine(engine.url)
        with cleanup.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        cleanup.dispose()
        engine.dispose()


if __name__ == "__main__":
    main()
