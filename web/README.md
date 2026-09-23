# Agent B frontend

Russian-language React/Vite/TypeScript UI for the business task builder, readiness score, student catalog, proposal submission, and manual business decision.

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

1. In **Для бизнеса**, enter a short description and request clarification questions.
2. Answer at least three questions, transfer answers to the editable card, and confirm it. Add more detail and confirm again to show the rating increase.
3. Publish the task. In **Для студентов**, find it in the catalog and submit an idea, plan, timeline, and prototype link for a team.
4. Return to **Для бизнеса → Отклики команд** and manually select or reject the proposal.

The role switch is for the hackathon demo; it is not authentication. A published task remains visible and accepts proposals even at a low readiness score.

Review screenshots with synthetic data: [desktop catalog](screenshots/student-catalog-desktop.png) and [mobile catalog](screenshots/student-catalog-mobile.png).
