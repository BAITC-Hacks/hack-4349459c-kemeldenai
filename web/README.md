# Agent B frontend

Russian-language React/Vite/TypeScript UI for demo participant entry, the business task builder, readiness score, student catalog, proposal submission, manual business decisions, and confirmed progress.

## Run

Use Node.js 20.19+ or 22.12+. Start the root PostgreSQL Compose service and Agent A's FastAPI server first. The Vite dev server proxies `/api` to `http://127.0.0.1:8000`.

```sh
cd web
npm ci
npm run dev
```

Open the local URL printed by Vite. Run `npm run build` for TypeScript and production-bundle validation. For a separately hosted API, set `VITE_API_BASE_URL` to its origin before building and configure the API to allow that origin; do not put API keys in Vite environment variables.

The frontend calls only endpoints in [the shared contract](../docs/MAIN_TASK.md). Request/response types live in `src/types.ts`, and all HTTP calls live in `src/api.ts`. Until Agent A's API is running, the UI displays a connection error rather than substituting fake catalog data.

## Demo path

1. On **Демо-вход**, choose the prefilled business profile. Enter a short description and request clarification questions.
2. Answer at least three questions, transfer answers to the editable card, and confirm it. Add more detail and confirm again to show the rating increase.
3. Publish the task. Choose **Сменить участника** and enter as a seeded student team (Data Nomads is preselected). Find the task and submit an idea, plan, timeline, and HTTP(S) prototype link. The active team is attached automatically.
4. Return as business, manually select or reject the proposal, and confirm one completed stage for a selected team. The stage awards 10 progress points once; the student team sees its updated total after switching back.

The participant entry is for the hackathon demo; it is not authentication or server-side access control. Its selection is saved on this device. A published task remains visible and accepts proposals even at a low readiness score. The confirmed-stage UI uses the `GET` and `POST /api/proposals/{id}/milestones` contract in [docs/NEXT_TASK.md](../docs/NEXT_TASK.md); it becomes functional against PostgreSQL when Agent A's next branch is integrated.

Review screenshots with synthetic data: [demo entry desktop](screenshots/demo-entry-desktop.png), [demo entry mobile](screenshots/demo-entry-mobile.png), [selected team's confirmed stage](screenshots/milestone-desktop.png), [desktop catalog](screenshots/student-catalog-desktop.png), and [mobile catalog](screenshots/student-catalog-mobile.png). See [HANDOFF.md](HANDOFF.md) for the branch validation and integration notes.
