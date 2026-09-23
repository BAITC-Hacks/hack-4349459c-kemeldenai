# Demo verification — 23 September 2026

## Integrated main update

Combined the demo fixes with `origin/main` at `495c623`, retaining the grounded task assistant: three to five questions, verbatim evidence suggestions, accept/edit/discard, contact-pattern redaction, mixed provenance, and a seven-second timeout. Answers remain attached to their fields across refresh and use normalized multiline deduplication. Uncertain statements and questions do not become suggested facts. Refresh now replaces stale suggestion evidence and edits instead of preserving obsolete text.

The combined revision passed **109 backend tests (95.61% combined coverage), 16 frontend tests, Python lint, and the frontend build**. PostgreSQL acceptance passed 27 requests, restart persistence, seed idempotence, and concurrent milestone protection. The merged schema includes all 18 API paths.

Focused browser acceptance passed with fallback: existing answers survive question refresh; suggestions show exact evidence; changing the description replaces old evidence and edited text; suggestions can be edited, accepted, and discarded; accepted text earns points only after card confirmation (30 points in the verification task). Existing demo records were preserved. Live-provider results and the full browser proposal journey below describe the earlier checks, not a new live request or repeated timed presentation.

## Earlier demo-fix verification

Baseline: `origin/main` at `f519e84`, including task summaries, saved proposal drafts, recommendation controls, and guided proposal writing. Fixes were developed on `codex/demo-spec-fixes`.

## Fixes

- Clarification regeneration preserves pending answers. Repeated transfers skip an identical answer block after whitespace normalization while retaining existing card text.
- Questions are capped at five and always include at least three. Narrow description patterns reduce repetition of explicit users and current workflow; complete cards receive focused follow-ups. These hints never populate or confirm card fields.
- Structured contact values are omitted from provider context. Free text remains unredacted, and the existing 12-second timeout remains in place.
- Obvious scoring filler (`Тест`, keyboard sequences, repeated single-letter strings) earns zero. Short concrete values remain eligible. This does not assess factual truth or semantic relevance; previously confirmed scores change only on reconfirmation.
- The shared catalog defaults to readiness order. Opening a task from application history resets recommendation filters so dismissed tasks still open correctly. Publishing and returning as business select the correct task for responses.
- Restarted the stale local APIs and connected the preview directly to repository source. Existing local records were retained. Regenerated the OpenAPI artifact to include routes added on main.

## Evidence

| Check | Result |
| --- | --- |
| Backend suite | 98 passed; 95.85% combined line/branch coverage; AI and scoring modules each 100% |
| Python lint | `api/.venv/bin/ruff check api` passed |
| Frontend logic | `npm --prefix web test`: 9 passed |
| Production build | `npm --prefix web run build` passed |
| PostgreSQL acceptance | 27 requests passed in a disposable schema; restart persistence, idempotent seeds, multiple selected teams, low-rated proposals, and concurrent milestone requests awarding points once |
| Browser with no provider key | Weak description → three questions → answers survive attempted regeneration → transfer → confirmation at 30 → improved confirmation at 80 → publication |
| Student/business browser flow | Correct published task opens; bookmark saves; editable proposal helper transfers selected fields; proposal submits; dismissed task opens correctly from applications; business selects correct proposal; one confirmed stage awards 10 points, shown in student history |
| Main API after restart | Health 200 and current applications/bookmarks/recommendation routes present |
| Fresh live AI request | Synthetic description with explicit managers/current workflow returned HTTP 200, `source: "ai"`, five questions in 2.68 seconds; no repeated users/workflow questions |
| Browser console | No error entries during the final workflow |

The PostgreSQL verifier ran from a temporary copy with provider calls disabled and contract output redirected outside the repository. Only the updated OpenAPI artifact was copied back. The browser used the separate SQLite preview on ports 5180/8010; PostgreSQL was verified independently. No production tables were reset.

Focused tests were run before implementation: scoring regressions first failed, AI quality regressions first failed, and clarification transfer tests reproduced duplicate text with the previous implementation. They all passed after the fixes. The frontend test checkpoint is `abc67c3`.

## Original-brief readiness

The mandatory functional journey is implemented and passes the checks above: business clarification and editable confirmation, deterministic rating growth, publication and open catalog, proposals, manual selection, and confirmed progress. Seed tests cover the required five-record datasets. Provider failure/malformed-output handling is covered by tests and the browser fallback path.

At this earlier checkpoint, evidence-backed business-card suggestions were still a next feature; they are included in the integrated main update above. A timed five-minute rehearsal remains outstanding, one live provider example does not prove broad question quality, and matching and proposal templates are deterministic helpers. Demo identities remain shared synthetic profiles without authentication, as scoped for the MVP.

The test run reports one upstream Starlette/httpx deprecation warning; all tests pass.
