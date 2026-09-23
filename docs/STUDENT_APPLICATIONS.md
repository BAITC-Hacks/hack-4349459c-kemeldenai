# My applications

## Proposal-writing assistance

The proposal form has an expandable “Нужна помощь с откликом?” helper. It gives guidance and inserts a suggested plan directly into the main form. Suggested steps use the task materials, deliverables, constraints, and success criteria; missing information becomes a clarification step. This is a deterministic template with no external provider.

The student supplies the idea and timeline. Replacing an existing plan requires explicit confirmation. If that plan changes before confirmation, replacement is blocked. Idea, timeline, and prototype link are preserved. The updated plan uses existing local draft storage and never submits the proposal. There is no separate preview to maintain.

Template and storage tests: `cd web && node --experimental-strip-types --test tests/proposalAssistance.test.mjs tests/proposalDraftStorage.test.mjs`.

Self-critique: the helper provides structure, not original technical insight. Teams still need to tailor the suggested steps, evaluate feasibility, and supply realistic timelines.

Students can switch between the catalog and “Мои отклики”. This team-scoped history lists all submitted proposals, newest first, with the current decision, expandable proposal details, a safe HTTP(S) prototype link when present, and business-confirmed stages. A status filter narrows the history. Empty, loading, and retry states are explicit; a failed refresh labels retained data as previously loaded.

Opening an application’s task clears catalog filters and the saved-only view so the requested task is visible. Proposal drafts are saved synchronously to browser storage per team/task pair and restored on reload. They are local to the browser, not shared across devices. Successful submission removes only the submitted draft; failures retain it. Storage errors show a retry action and preserve the leave-page warning. Malformed stored records are reported without removing them. Concurrent tabs have no conflict resolution (last write wins). Successful submission offers a direct link to application history. History reloads on entry and through the refresh button; there are no push notifications or automatic polling.

`GET /api/teams/{teamId}/applications` returns `{team, applications}`. Each application contains `{proposal, taskTitle, taskAvailable, milestones}`. Proposal and milestone objects retain their camelCase contracts. An unpublished task stays in the history with `taskAvailable: false`; the task-open action is disabled by omission. Invalid or missing team IDs return 422 or 404. This is a demo-team filter, not an authentication boundary.

The missing milestone backend is now implemented for the existing business confirmation panel:

- `GET /api/proposals/{id}/milestones` returns zero or one confirmed stage.
- `POST /api/proposals/{id}/milestones` accepts a nonblank `description`, 3–2,000 meaningful characters, and returns a stage with 10 awarded points.

A selected proposal is required. A unique constraint on proposal ID plus an atomic team-point increment in the same transaction prevents double awards. PostgreSQL locks the proposal row to coordinate with decision updates. Completed stages and points survive subsequent decision changes. Startup creates the new `milestones` table without changing existing columns. The application history reuses the shared milestone response schema.

Verification covers team isolation, empty history, invalid IDs, unavailable tasks, retained completed work, restart persistence, and simultaneous duplicate confirmations. Browser verification covers history entry, proposal expansion, and opening the correct task.

Self-critique: the page answers “what happened to my proposal?” but students must refresh for new decisions. There is no rejection explanation because the current API stores only a decision. The demo uses shared team identities; private student accounts and pagination are outside this increment.

Draft storage checks: `cd web && node --experimental-strip-types --test tests/proposalDraftStorage.test.mjs`. They cover exact restoration, team/task isolation, clearing one draft, corrupt records, and denied/quota-limited storage. A browser reload was also verified with a temporary draft, then the test text was cleared.
