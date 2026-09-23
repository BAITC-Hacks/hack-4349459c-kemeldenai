# Agent B frontend

Russian-language React/Vite/TypeScript UI for demo participant entry, the business task builder, readiness score, student catalog, proposal submission, manual business decisions, and confirmed progress.

## Run

Use Node.js 20.19+ or 22.12+. Start the root PostgreSQL Compose service and FastAPI server first. The Vite dev server proxies `/api` to `http://127.0.0.1:8000` by default; set `API_PROXY_TARGET` for another local API port.

```sh
cd web
npm ci
npm run dev
```

Open the local URL printed by Vite. Run `npm run build` for TypeScript and production-bundle validation. For a separately hosted API, set `VITE_API_BASE_URL` to its origin before building and configure the API to allow that origin; do not put API keys in Vite environment variables.

The frontend calls only endpoints in [the shared contract](../docs/MAIN_TASK.md). Request/response types live in `src/types.ts`, and all HTTP calls live in `src/api.ts`. Until the API is running, the UI displays a connection error rather than substituting fake catalog data.

## Demo path

1. On **Демо-вход**, choose the prefilled business profile. Enter a short description and request clarification questions.
2. Answer at least three questions; optionally refresh them without losing typed answers. Transfer answers, review any evidence-backed field suggestions, and confirm the editable card. Add more detail and confirm again to show the rating increase.
3. Publish the task. Choose **Сменить участника** and enter as a seeded student team (Data Nomads is preselected). Find the task and submit an idea, plan, timeline, and HTTP(S) prototype link. The active team is attached automatically.
4. Return as business, manually select or reject the proposal, and confirm one completed stage for a selected team. The stage awards 10 progress points once; the student team sees its updated total after switching back.

The participant entry is for the hackathon demo; it is not authentication or server-side access control. Its selection is saved on this device. A published task remains visible and accepts proposals even at a low readiness score. The confirmed-stage UI uses the `GET` and `POST /api/proposals/{id}/milestones` contract in [docs/NEXT_TASK.md](../docs/NEXT_TASK.md), now implemented by the API.

Review screenshots with synthetic data: [demo entry desktop](screenshots/demo-entry-desktop.png), [demo entry mobile](screenshots/demo-entry-mobile.png), [selected team's confirmed stage](screenshots/milestone-desktop.png), [desktop catalog](screenshots/student-catalog-desktop.png), and [mobile catalog](screenshots/student-catalog-mobile.png). See [HANDOFF.md](HANDOFF.md) for the branch validation and integration notes.

## Guided UI

The business builder separates description, clarification, card review, and publication. A sticky action bar shows the current step, unsaved state, and the relevant action. Clarification can be skipped for manual entry. Saving a draft does not confirm it; publication always requires the current card to be confirmed. The publication preview and rating show the last confirmed version, with an explanation when edits are pending. Missing readiness fields link back to their inputs.

Starting a new task asks before discarding unsaved card content or unanswered clarification work. A browser unload warning also covers unsaved card content, clarification answers, and proposal drafts. These drafts are kept in memory, not autosaved; saved task IDs are restored from local storage as before.

The student catalog includes keyword search, topic/readiness filters, and a reset control. At widths of 820px or below, selecting a task opens its details in place of the list, with a back button. Proposal drafts are retained separately for each team and task during the session. Required fields show inline errors, focus moves to the first invalid field, and successful submission is confirmed beside the form.

### Browser regression checks

Use a separate seeded test database when another test run is active. Verify:

- Blank description/title validation focuses the missing input; clarification answers transfer into the right fields.
- A new task is not scored until confirmation. A low-rated confirmed task can still publish.
- Missing-field links focus inputs; unconfirmed edits keep the old rating and disable publication with an explanation.
- New-task protection preserves entered work when cancelled. Saving a draft and reopening it preserves saved fields.
- At desktop and phone widths, action controls remain usable, and the phone catalog has a working back path.
- Search, empty results, and filter reset work. Proposal drafts do not leak between tasks.
- Submitting a valid proposal clears only that task's draft and shows a nearby confirmation.
- Business review loads the submitted proposal; manual selection and refresh retain the correct decision.

## Motion and loading

Step panels enter over 200ms; the active step background moves between positions. On phones, task details enter from the side over 240ms, and the back button restores the list's prior scroll offset. Navigation changes remain immediately interactive, without waiting for an exit animation.

The readiness ring animates confirmed score changes over 520ms, cancelling an interrupted animation before starting another. Initial scores and catalog selection render immediately. Screen readers receive the confirmed target score, not every intermediate number. `prefers-reduced-motion` disables movement, counting, pulsing, spinning, and smooth scrolling, including when the preference changes during a session.

Initial loads use skeleton cards. Refresh retains existing results and shows a compact loading state on the refresh button. Busy labels reserve the space needed by both states; required fields reserve validation-message space. Saving a draft briefly displays a nearby checkmark. No additional animation package is required.

Motion checks: verify step navigation and editing during transitions; compare button widths before/during requests; verify first-load skeletons and retained refresh results with a throttled test API; confirm a score change interpolates and reaches the target; open/back from a scrolled phone catalog and check its offset; enable reduced motion and confirm immediate updates without movement.
