# Verification after pulling main — 23 September 2026

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

Remaining limits: a timed five-minute rehearsal was not performed in this round; one live provider example does not prove broad question quality; matching and proposal templates are deterministic helpers. Evidence-backed business-card suggestions are an optional next feature, not part of these fixes. Demo identities remain shared synthetic profiles without authentication, as scoped for the MVP.

The test run reports one upstream Starlette/httpx deprecation warning; all tests pass.
