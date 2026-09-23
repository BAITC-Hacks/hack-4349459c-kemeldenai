# Agent B demo roles handoff

Branch: `codex/agent-b-demo-roles`. Changes stay under `web/`.

## Delivered UI

- A visible «Демо-вход» offers a prefilled synthetic business identity or one of the five seeded teams. Data Nomads is the default student team. There are no passwords or implied API access controls.
- The active persona is shown in the header and stored under `hackalem.demoPersona`. «Сменить участника» preserves the business draft. A stale saved team ID returns to the entry screen.
- Business sees the builder and proposal inbox. Students see the catalog and proposal form. The active student team supplies `teamId` automatically; the proposal form requires an HTTP(S) prototype link.
- Selected proposals load `GET /api/proposals/{id}/milestones`. Business can describe and confirm one completed stage with `POST` to the same path. A confirmed stage is shown as complete, its submit control disappears, and team progress points refresh. A `409` reloads the stage so an already-confirmed result is shown without awarding again.

## Validation

`cd web && npm run build` passes. A Chrome browser walkthrough against the running FastAPI/PostgreSQL app covered demo entry, participant switching, preserved business draft, three clarification questions, confirmed score growth from 30 to 80, publication, Data Nomads proposal submission with the correct `teamId`, required prototype link, persisted student persona, and stale-persona recovery. Only the two new milestone endpoints and resulting point increase were mocked, following `docs/NEXT_TASK.md`; one completed-stage confirmation displayed 10 points and no duplicate control. No browser errors occurred. Desktop and mobile entry layouts were inspected; the 390 px mobile viewport had no horizontal overflow.

## Integration with Agent A

Agent A must implement the two milestone endpoints and require a valid prototype link for new proposals. Once that branch lands, rerun the same browser path without mocking milestone requests and check the point increase persists after a PostgreSQL restart. The current `main` API returns 404 for milestone requests, which the selected-proposal panel displays as a retryable loading error until Agent A's branch is integrated.
