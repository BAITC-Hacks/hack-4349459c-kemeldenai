# Agent A implementation plan

This plan follows [`docs/MAIN_TASK.md`](../docs/MAIN_TASK.md). Agent A owns `api/`, database setup and seeds, API tests, and backend README content. Keep JSON field names and endpoint paths in the shared contract; coordinate any change with Agent B before changing it. The optional milestone endpoint waits until the core flow is stable.

1. Define Pydantic request and response models, camelCase serialization, consistent `{ "error": "..." }` responses, and all agreed routes. Publish `/openapi.json` and one example response per route early for the UI client.
2. Add idempotent PostgreSQL schema setup and seed scripts. Seed at least five draft cards of varied completeness, five task cards, five teams, and five proposals. Calculate seed scores with the same scoring function used by live confirmations; never store a hand-written score.
3. Implement draft create/save, atomic confirmation, and publish. Saving a draft clears its confirmation and score. Confirmation persists the submitted card fields and their new score together. A published card changes only when a new confirmation succeeds; unconfirmed edits remain in the browser.
4. Implement the seven-category, 100-point deterministic score from confirmed fields, with placeholder detection, visible breakdown, actionable missing hints, and readiness bands. Keep rating `draft` separate from card status `draft`.
5. Add published-card retrieval and score-descending catalog filters, then unlimited proposals and manual `selected`/`rejected` decisions. Published cards remain listed and proposal-eligible at every score, including 0–39. Multiple proposals may be selected for one task.
6. Add the single server-side AI clarification call and schema validation. Deduplicate and supplement malformed, empty, or short model output with at least three deterministic questions. Keep keys in the environment and avoid logging keys or full user input.
7. Document setup and exact run/test commands, scoring, fallback behavior, endpoint examples, and the API handoff. Run the full API scenario against PostgreSQL before opening the PR.

## Acceptance checklist

- [x] `docker compose up -d db` starts PostgreSQL; schema setup and seeds are repeatable without duplicate records.
- [x] OpenAPI shows the agreed paths, camelCase fields, UUID string IDs, ISO 8601 timestamps, request/response models, and documented error shape.
- [x] Five drafts, five task cards, five teams, and five proposals are seeded; seeded scores match a fresh scoring calculation.
- [x] A weak draft can be saved, receive three relevant questions, be edited, confirmed, published, proposed to, and manually decided through API calls.
- [x] Blank, whitespace, and obvious placeholder values earn no points; the seven category maxima total 100 and show specific missing hints.
- [x] Rating boundaries are covered at 0, 39, 40, 69, 70, 89, 90, and 100; score is never model-generated.
- [x] Draft saves clear confirmation and score; failed confirmations leave the prior published card and score intact; a successful published-card confirmation updates fields and score atomically.
- [x] An unconfirmed draft cannot publish; a confirmed 0–39 card can publish, appears in the default catalog, and accepts proposals.
- [x] Catalog sorts all published tasks by descending score and filters by topic/readiness without hiding lower scores by default.
- [x] Proposal creation has no per-task limit; business may select multiple proposals or reject them, with no automatic decision.
- [x] A missing key, provider failure, and malformed provider JSON all return at least three valid, nonduplicate questions without leaking secrets.
- [x] API tests pass; the README records commands, example requests/responses, and any unresolved contract question.

## Resolved details for Agent B

Draft writes accept omitted fields and empty strings. Save/confirm replace the full editable snapshot. Readiness filters use the four rating labels. GET by ID exposes drafts for business mode while catalog/proposals require publication. See HANDOFF.md for types, examples, validation evidence and the remaining frontend integration gate.
