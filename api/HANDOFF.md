# Agent A backend handoff

Implemented on `codex/agent-a-api`. Scope is `api/` and the backend README sections; no frontend or shared contract changes. Full browser integration and merging remain the integrator's responsibility.

## Start

Follow the root README to create `api/.venv`, install `api/requirements.txt`, configure `.env`, and run:

```sh
docker compose up -d db
api/.venv/bin/python -m api.app.seed
api/.venv/bin/python -m uvicorn api.app.main:app --host 127.0.0.1 --port 8000 --reload
```

The current machine uses PostgreSQL port `55432` because `5432` was occupied; that change is only in ignored `.env`. The API is at `http://127.0.0.1:8000`, Swagger at `/docs`, and the live schema at `/openapi.json`.

## UI integration

- All twelve contract operations are implemented. Read [`openapi.json`](openapi.json) for types and [`examples.json`](examples.json) for executed request/response examples of every operation, including failure responses. Collections are plain arrays, not paginated envelopes.
- Send only editable fields when creating, saving, confirming, or analyzing a card. Server-owned IDs, score, timestamps and status are rejected in task write bodies. `analyze.card` accepts an editable-field map, not the entire `TaskCard` response.
- `POST /tasks` accepts omitted fields and blanks. `PUT /tasks/{id}` and `POST /tasks/{id}/confirm` are **full editable-snapshot replacements**: omitted fields become empty strings. Send the complete form state when preserving existing values.
- Unconfirmed drafts have `score: null`, `confirmedAt: null`, readiness `draft`, and empty `breakdown`/`missing` lists. After confirmation the score is an integer and the breakdown contains nine subparts totaling 100. `context`/`need` and `contact`/`interaction` split the two combined categories.
- `GET /tasks/{id}` can retrieve drafts for the demo business flow. `GET /tasks` lists only published cards. `topic` uses exact matching (with surrounding query whitespace trimmed); `readiness` accepts exactly `draft`, `workable`, `ready`, or `priority`.
- Unconfirmed publication, draft proposal access and direct published-card PUT return 409. Invalid bodies/UUIDs return 422; unknown resources return 404; database unavailability returns 503. Errors use `{ "error": "Russian-language message" }`.
- Multiple proposals from one team and multiple selected teams are allowed. Decisions accept only `selected`/`rejected`; a newly created proposal stays `pending` until decided. Empty prototype URL is allowed; supplied URLs must be HTTP(S).
- Keep unconfirmed published-card edits in browser state. Successful confirm updates fields and score atomically. PostgreSQL row locks serialize competing save/confirm/publish transitions.
- Five published seed cards score 30, 60, 80, 90 and 100; there are also five unconfirmed drafts, five teams and five proposals. UUIDs are stable and reruns preserve edits. Seeded teams have zero progress points; the optional milestone extension is deferred until frontend integration is stable.
- No endpoint or JSON name deviates from the shared contract. The nullable unconfirmed score, draft retrieval and replacement semantics above resolve unspecified details without adding routes. Agent B should use the supplied response types.

## Validation evidence

Validation on this machine used Python 3.14.0 and PostgreSQL 17 (Compose `postgres:17-alpine`). Dependencies are pinned in `requirements.txt`.

| Command | Observed result |
| --- | --- |
| `docker compose up -d db` | Healthy on local port 55432 |
| `api/.venv/bin/python -m api.app.seed` | Exit 0, idempotent setup and seed |
| `api/.venv/bin/python -m pytest api/tests --cov=api.app --cov-config=api/pyproject.toml --cov-report=term-missing --cov-fail-under=80` | 36 passed, 93.53% combined line/branch coverage |
| `api/.venv/bin/ruff check api` | All checks passed |
| `api/.venv/bin/python -m api.verify_postgres` | 19 API requests passed; restart persistence and repeat seed checked in isolated PostgreSQL schema |
| HTTP `GET /api/health` on live Uvicorn | `{"status":"ok","database":"ok"}` |

One upstream Starlette warning notes future deprecation of its HTTPX test-client adapter; tests pass on the pinned environment. No live model key was configured, so the real-provider path is validated with mocked HTTP responses and the live API was verified using fallback. No browser integration test is claimed before Agent B's UI exists.

## Test-first record

The journeys were derived from [`../docs/MAIN_TASK.md`](../docs/MAIN_TASK.md) and captured in [`IMPLEMENTATION.md`](IMPLEMENTATION.md).

| Guarantee | Evidence |
| --- | --- |
| Confirm/publish/propose/manual decision, low-score eligibility and all eight band boundaries | `tests/test_core.py`; initial RED failed because `api.app` did not exist; GREEN in the 36-test run |
| Partial drafts, no unconfirmed published edits, repeated proposals, validation and error envelopes | `tests/test_contract.py`; RED missing routes, then GREEN |
| Exact Russian topic filtering, database failure redaction and recovery | `tests/test_contract.py`; RED returned an empty list for a seeded Cyrillic topic; exact-equality fix is GREEN |
| Missing key, malformed JSON, deduplication, complete-card refinement, one bounded provider call | `tests/test_ai.py`; RED missing AI implementation; GREEN |
| Russian seeds across all readiness bands, recalculated scores, counts and preservation on rerun | `tests/test_seeds.py`; RED had uniform English seeds, then GREEN |
| Real database transactions, seed foreign keys, all endpoints, persistence after restart | `verify_postgres.py`; 19-request acceptance run passed |

RED checkpoints: `6bf101d`, `9ddb1de`, `e3c8c8e`, `795ac63`. Preserve this evidence if the branch is squash-merged. Remaining coverage gaps are uncommon exception/configuration branches and the seed CLI wrapper; the seed CLI was also run against PostgreSQL.

## Remaining integration work

Agent B needs to connect the UI and run the five-minute browser scenario from the README. The integrator reviews both branches before merging. This is an unauthenticated local demo, with initial idempotent schema creation rather than versioned production migrations. Deployment, authentication, chat and a project tracker remain outside scope.
