# HackAlem AI task readiness MVP

Shared starting point for a five-hour MVP: a business user improves and publishes a task, student teams submit proposals, and the business manually decides which teams to work with.

The [main task and agent handoff](docs/MAIN_TASK.md) is the source of truth for scope, API shapes, scoring, ownership, and the demo acceptance test. Agent A and Agent B should branch from this `main` commit on their own computers before implementing code.

## Development database

Docker Compose starts only PostgreSQL at this stage. The application services belong to the agents' implementation branches. Each computer runs its own local database; the Git repository carries code and seed definitions, not database state.

```sh
cp .env.example .env
docker compose up -d db
docker compose ps
```

The API runs on the host during development and connects through `DATABASE_URL` from `.env`. When Agent A adds the API service to Compose, it should use `db` as the hostname inside that container and wait for the database health check.
If you change `POSTGRES_PASSWORD`, update the password in `DATABASE_URL` too.

Do not commit `.env`, API keys, or local database files. Stop the database with `docker compose down`; use `docker compose down -v` only when intentionally deleting local development data.

## Branches

- Computer A: `codex/agent-a-api`
- Computer B: `codex/agent-b-ui`

Both start from `origin/main`, make their changes on separate branches, and open pull requests. Integrate against the contract in [docs/MAIN_TASK.md](docs/MAIN_TASK.md) before merging.
