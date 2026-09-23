# HackAlem AI task readiness MVP

Runnable five-hour MVP: a business user improves and publishes a task, student teams submit proposals, and the business manually decides which teams to work with.

The [main task and agent handoff](docs/MAIN_TASK.md) records scope, API shapes, scoring, and the demo acceptance test. The API lives in `api/`; the React UI lives in `web/`.

The [completed demo round](docs/NEXT_TASK.md) records participant entry and confirmed progress points. The [AI task assistant record](docs/AI_REQUIREMENTS.md) documents the next completed task-focused round and its remaining limits. Each computer should branch from the latest `origin/main` for its chosen task.

## Development database

Docker Compose starts PostgreSQL. Run the API and Vite on the host using the commands below. Each computer runs its own local database; the Git repository carries code and seed definitions, not database state.

```sh
cp .env.example .env
docker compose up -d db
docker compose ps
```

The API runs on the host during development and connects through `DATABASE_URL` from `.env`.
If you change `POSTGRES_PASSWORD`, update the password in `DATABASE_URL` too.

Do not commit `.env`, API keys, or local database files. Stop the database with `docker compose down`; use `docker compose down -v` only when intentionally deleting local development data.

## Parallel branches

- Initial Computer A branch: `codex/agent-a-api`
- Initial Computer B branch: `codex/agent-b-ui`

The initial API and UI branches are integrated on `main`. For future parallel work, divide ownership by complete user-facing tasks rather than by frontend and backend layers. Each task includes its necessary UI, API, data, tests, and documentation. Both computers should pull the latest `origin/main`, work on separate branches, and integrate against the contract in [docs/MAIN_TASK.md](docs/MAIN_TASK.md) before merging.

## Backend

Python 3.11+ runs FastAPI, Pydantic validation and SQLAlchemy persistence against PostgreSQL 17. JSON uses camelCase. `/docs` is the interactive API explorer; `/openapi.json` is the machine-readable contract. All application errors use `{ "error": "..." }`. The service is a local demo without authentication: the business/student switch is a UI mode, not an authorization boundary.

From the repository root:

```sh
python3 -m venv api/.venv
api/.venv/bin/python -m pip install -r api/requirements.txt
# Copy the example only if .env does not already exist, then edit local values.
cp -n .env.example .env
docker compose up -d db
api/.venv/bin/python -m api.app.seed
api/.venv/bin/python -m uvicorn api.app.main:app --host 127.0.0.1 --port 8000 --reload
```

If port 5432 is occupied, set `POSTGRES_PORT=55432` and change the port in `DATABASE_URL` to `55432` in `.env`, then rerun Compose. No backend credentials are sent to the frontend. Vite development origins `http://localhost:5173` and `http://127.0.0.1:5173` are allowed by CORS.

Idempotent schema setup creates missing tables; this initial MVP does not migrate existing column definitions. Seeds contain five incomplete drafts, five confirmed published cards of different readiness, five teams and five proposals. Stable seed IDs prevent duplicates, and the live scoring function calculates seed scores. Re-running seeds must preserve user edits and decisions. SQLite is used only for isolated fast tests; the development application uses PostgreSQL.

### Confirmation and scoring

Draft fields may be omitted or blank. New and saved unconfirmed drafts have `confirmedAt: null`, `score: null`, readiness `draft`, and no earned points. `PUT` saves only unpublished drafts and clears earlier confirmation. `POST .../confirm` submits the complete editable snapshot and atomically saves its fields, confirmation timestamp and deterministic score. Keep local edits in the browser until that call succeeds. Published cards reject `PUT`; reconfirm them to update their visible fields and rating. `POST .../publish` requires confirmation, including for cards scoring zero.

Scoring checks meaningful, non-placeholder values in these seven categories:

| Category | Maximum |
| --- | ---: |
| Context and need | 20 |
| Data/materials | 20 |
| Expected result | 15 |
| Success criteria | 15 |
| Constraints | 10 |
| Users | 10 |
| Business contact and interaction | 10 |

Context/need split into 10 points each; contact/interaction split into 5 each. Each subpart earns its full weight or zero. Empty strings, whitespace and obvious placeholders earn zero. This transparent completeness score is not a claim that the business facts are correct. `breakdown` exposes earned/max values and `missing` names the fields to improve. The four bands are `draft` (0–39), `workable` (40–69), `ready` (70–89), and `priority` (90–100); these are independent of publication status.

The catalog includes **every** published card, sorted by score descending. Optional `topic` and `readiness` filters narrow it only when requested. Low scores never block proposals. A team may submit more than once, and the business may select multiple proposals, reject them, or leave them pending. No model chooses a team. After a selected team completes a stage, the business can confirm it once and award 10 persistent progress points through `POST /api/proposals/{id}/milestones`; repeats return 409.

### AI task assistant

Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in the server's `.env`. The default model is `gpt-4o-mini`. The adapter makes one non-streaming request with a 7-second timeout to OpenAI's [chat completions API](https://developers.openai.com/api/reference/cli/resources/chat), using [JSON mode](https://developers.openai.com/api/docs/guides/structured-outputs). There are no retries or automatic card writes. Without a key, or on network/API/JSON failure, deterministic questions use the same schema and `source: "fallback"`. The key stays on the server; restart the API after changing `.env`.

The full system prompt lives in [`api/app/ai.py`](api/app/ai.py). It treats the description and card as untrusted data, asks three to five Russian questions about gaps not already explicit in the text, and forbids team selection. The response also has `suggestedFields`: optional verbatim excerpts for empty card fields, each with matching `value` and `evidence`. Unsupported model suggestions are discarded. Narrow, exact excerpts from clear process, user, and expected-result phrases remain available locally when the provider fails. Suggestions appear for human accept, edit, or discard; neither they nor answers change the confirmed score until the business confirms the card. The contact field is omitted, and common email and phone patterns are redacted before the provider call.

Example request:

```json
{"description":"Нужен сервис для магазина","industry":"Торговля"}
```

Fallback response:

```json
{
  "questions": [
    {"field":"need","question":"Какую конкретную проблему бизнеса нужно решить и почему это важно?"},
    {"field":"users","question":"Кто будет пользоваться решением и какие действия им нужны?"},
    {"field":"dataMaterials","question":"Какие данные, примеры и материалы доступны команде?"}
  ],
  "suggestedFields":[],
  "source":"fallback"
}
```

For invalid output such as `{"questions":null}`, the questions fall back. With partially valid output, unknown fields, blank questions and duplicates are discarded and deterministic questions fill the response to at least three. `source: "ai"` means at least three validated model questions survived; `mixed` means partial model output was supplemented, and `fallback` means the questions were local. Logs report only failure class names, never the key, response body or full user input. Unit tests mock the provider, including malformed responses, and require no key or paid requests.

### Backend verification and handoff

```sh
api/.venv/bin/python -m pytest api/tests --cov=api.app --cov-config=api/pyproject.toml --cov-report=term-missing --cov-fail-under=80
api/.venv/bin/ruff check api
api/.venv/bin/python -m api.verify_postgres
```

See [`api/IMPLEMENTATION.md`](api/IMPLEMENTATION.md) for the initial implementation plan and [`api/HANDOFF.md`](api/HANDOFF.md) for endpoint examples, PostgreSQL verification and current limitations. [`api/openapi.json`](api/openapi.json) and [`api/examples.json`](api/examples.json) are generated from the running implementation for any task owner changing the API or UI.

The PostgreSQL check creates a uniquely named temporary schema, verifies the full API flow and persistence across application restarts, regenerates the two contract files, and removes only its own schema. It leaves application records untouched. When a provider key is configured, this command makes one live clarification call; unit tests always disable live calls.

## Frontend

With PostgreSQL and the API running, start the UI in a second terminal:

```sh
cd web
npm ci
npm run dev
```

Open the local URL printed by Vite. The development server proxies `/api` to `http://127.0.0.1:8000`. See [web/README.md](web/README.md) for frontend build and handoff details.

### Five-minute demo

1. **0:00–0:45:** In business mode, enter «Нужен сервис для магазина» and show three clarification questions.
2. **0:45–2:00:** Save a weak draft, confirm it, then add context, available data and measurable acceptance criteria. Confirm again and show the increase and category breakdown.
3. **2:00–2:30:** Publish; switch to student mode and find the card in the score-sorted catalog. Show that a low-rated seed card is also visible.
4. **2:30–3:30:** Choose a demo team and submit an idea, plan, timeline and required HTTP(S) prototype URL.
5. **3:30–4:30:** Return to business mode, select the proposal, then show another proposal can be selected or rejected manually.
6. **4:30–5:00:** Show the published card's missing-information hints and the deterministic fallback indicator when no AI key is configured.
