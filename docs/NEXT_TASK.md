# Next A/B round: demo personas and confirmed progress

The integrated MVP already demonstrates clarification, task scoring, publication, proposals, and manual team selection. The next round should make the two participant journeys feel distinct and complete the case's final result step, while keeping the live walkthrough under five minutes. Both agents branch from the latest `origin/main`; neither reuses the first-round branches.

## Decision: a visible demo entry, not real authentication

The case explicitly does not require full registration, password recovery, or a complex role model. Use a clearly labelled **«Демо-вход»** with prefilled synthetic identities and one click to continue. Do not ask for a password or call this secure authentication. The existing API remains unauthenticated, so this round separates the journeys in the UI rather than enforcing access control on the server.

| Option | Scope | Recommendation |
| --- | --- | --- |
| Demo persona selection in the browser | Prefilled business identity and seeded team picker; remembers the chosen persona on this device; routes to the matching workspace. | **Use now.** Fast, understandable on stage, and within the case's five-hour scope. |
| Server-side demo accounts and role checks | Login endpoint, sessions, task ownership, authorization across existing endpoints, and migration of seed data. | Defer unless the demo must prove access control. This is a separate feature, not a cosmetic login. |

The business demo identity is a synthetic display name and company, such as «Представитель бизнеса · Демо-компания». Student identities come from the five existing `GET /api/teams` records. Show one selected team, defaulting to Data Nomads when available. The login screen may prefill the identity fields, but it must not prefill the business task: the presenter still types a weak description and confirms the card in the live demo.

Persist `{version: 1, role: "business" | "student", teamId?: string}` in browser storage. Validate a saved student `teamId` against the current team list and return to the demo entry if it is stale. A visible «Сменить участника» action returns to the entry screen without deleting the business draft or published task. The selected student team determines `teamId` in proposal requests; remove the separate team chooser from the proposal form. Business navigation exposes only the task builder and proposal decisions; student navigation exposes only the catalog and proposal form. The header shows the active demo identity. The browser selection does not imply task ownership or protect API routes.

## Shared contract for the result step

After a business manually selects a proposal, it can confirm one completed stage with a short description. The server awards **10 progress points once per selected proposal** to that proposal's team. This is a record of actual confirmed work, not a bonus for merely being selected. A second submission for the same proposal returns `409` and awards no more points. Pending or rejected proposals also return `409`. Points persist in PostgreSQL and appear through the existing `Team.progressPoints` field.

| Method and path | Request | Response |
| --- | --- | --- |
| `POST /api/proposals/{id}/milestones` | `{ "description": "Прототип проверен с заказчиком" }` | `201` with `{id, proposalId, description, pointsAwarded: 10, confirmedAt}`. |
| `GET /api/proposals/{id}/milestones` | — | Array containing zero or one confirmed milestone, using the same object shape. |

Keep camelCase JSON and `{ "error": "..." }` failures. The description must contain meaningful text; the business confirms it explicitly. Use a transaction and a uniqueness constraint so concurrent requests cannot double-award points. The UI can refresh `GET /api/teams` after confirmation to show the new total. A later change to the proposal decision does not erase already earned progress points.

The case lists a prototype link as part of a team proposal. Align the existing proposal form and API validation with that requirement: a new proposal must include a valid HTTP(S) `prototypeUrl`. Update the five synthetic proposal records to use harmless example links. Existing stored proposals with an empty link may remain readable.

## Agent A on computer A — API and PostgreSQL

Create `codex/agent-a-milestones` from the latest `origin/main`. Own `api/` and the backend handoff only. Add the milestone table, the two endpoints above, validation, and transaction-safe point updates. Require a valid prototype URL on new proposals and update synthetic proposal links. Test selected, pending, rejected, duplicate, concurrent duplicate, proposal validation, and persistence after restart. Extend the isolated PostgreSQL acceptance script and publish sample requests/responses in `api/HANDOFF.md`. Do not edit `web/`, the root README, or this contract without coordinating a change first.

Exit gate: backend tests pass; one selected proposal earns exactly 10 points after a confirmed stage; every replay or concurrent duplicate leaves the total unchanged; the PostgreSQL flow passes.

## Agent B on computer B — demo entry and role journey

Create `codex/agent-b-demo-roles` from the latest `origin/main`. Own `web/` and the frontend handoff only. Build the demo entry and active-identity header; persist and validate the selected persona; remove the always-visible role toggle; preselect and lock the student team from the active persona. Keep the business draft intact when changing participants. Require and validate the prototype link in the proposal form. Add a simple milestone confirmation control and progress-points display using the shared contract; develop against a local mock until Agent A's endpoints are available. Preserve the existing loading, error, catalog, and proposal states.

Exit gate: the frontend builds; the business and student journeys are distinct; changing participants takes one click from the header; proposal `teamId` always matches the active student persona; the completed-stage control is shown only for a selected proposal and cannot award points twice in the UI.

## Integrator acceptance

1. Open the app and choose the prefilled business demo identity. Enter a weak description, answer at least three questions, confirm improvements, and publish.
2. Choose «Сменить участника», enter as Data Nomads, find the published task, and submit a proposal with a prototype link without choosing a team again.
3. Return as business, manually select that proposal, enter a completed-stage description, and confirm it. The team gains exactly 10 points.
4. Return as Data Nomads and see the updated total. Reload both journeys to verify the persona and points persist. A duplicate milestone attempt must not add points.
5. Keep a low-rated published task visible and open to proposals, and retain the ability to select more than one team. Run once with no AI key to show the documented fallback.

The two entry transitions and stage confirmation should add no more than about 30 seconds to the existing five-minute demonstration. The integrator merges only after testing this complete path against the real API and PostgreSQL.
