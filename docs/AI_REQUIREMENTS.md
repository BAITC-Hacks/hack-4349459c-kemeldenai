# AI requirements and task assistant

This document compares the MVP with sections 2, 5, 9, and 11 of the HackAlem case. The current integration combines the task assistant from `origin/main` at `495c623` with the demo verification fixes. The sections below distinguish implemented behavior from historical test evidence; verification of the combined revision is recorded below. The 0–100 score stays deterministic, and the business controls publication and team selection.

## What the case requires

- At least one meaningful AI function: relevant clarification questions or help turning answers into a task card. At least three questions must be available, including when the provider fails.
- No invented facts. Suggested text must be editable and confirmed by a person before publication.
- Demonstrate the prompt, input/output shape, and malformed-response handling. A local fallback is allowed when the external API is unavailable.
- AI may recommend tasks to students, but the full catalog stays open. AI must not select a team or use personal or sensitive participant attributes.
- The five-minute demonstration must show a weak description, improvements, score growth, publication, a student proposal, and a manual business decision.

## Implemented behavior and limits

| Area | Implemented | Limit |
| --- | --- | --- |
| Clarification | `POST /api/analyze` asks OpenAI `gpt-4o-mini` (or the configured model) for JSON questions, validates allowed fields and duplicates, and returns three to five questions. Invalid or insufficient model output is supplemented with deterministic questions; no key uses fallback. | Shape checks and examples do not establish broad question quality. New wording and languages still need evaluation. |
| Relevance | Missing card fields and narrow Russian description rules guide question priority. Clearly stated users and current workflow can be excluded from missing-field questions; complete cards receive refinements. | The rules do not cover arbitrary wording or establish the truth of a statement. An ambiguous description still needs questions and human review. |
| Grounded suggestions | `suggestedFields` contains optional values with identical, verbatim evidence excerpts from the description. Unsupported model suggestions are discarded. Narrow local extraction for clear process, user, and expected-result phrases remains available without the provider. | Suggestions draw from the original description, not from a complete semantic analysis. Exact evidence establishes textual support, not that the field assignment is correct or the statement is true. Suggestions never populate confirmed facts automatically. |
| Card handoff | Refreshing questions preserves typed answers by their target fields and retains answered questions. Transfer appends new text while skipping an identical block after line-by-line whitespace normalization. The review step offers accept, edit, and discard for suggestions; accepting never overwrites a nonempty field. New analysis replaces stale suggestions and retains an edit only when its field, value, and evidence are unchanged; accepting or discarding clears the matching edit. | Deduplication is textual, not semantic: paraphrases and differently organized answers may still append. Unsaved answers and edits remain in browser memory. Only explicit card confirmation changes the score. |
| Grounding and response validation | The prompt treats the description as untrusted data and forbids invented facts and team selection. Pydantic and server checks validate shapes, allowed fields, nonblank questions, duplicates, and exact suggestion evidence. | JSON mode is not a schema-enforced model response. Validation cannot prove every question or interpretation is grounded. |
| Scoring | Confirmed fields receive a deterministic 0–100 score, breakdown, and missing-field list. Obvious filler such as “Тест”, placeholder phrases, known keyboard sequences, and repeated single-letter filler earns no points. Short facts remain eligible. | This is a completeness check, not semantic validation or a judgment of truth. Other weak or irrelevant text may still earn points. Existing scores recalculate on the next confirmation. The model never sets the number. |
| Reliability and privacy | One provider request has a seven-second timeout and no retries. Failures fall back; logs omit keys, bodies, and full input. The structured contact field is omitted, input is bounded, and common email and phone patterns are redacted before the provider call. `source` distinguishes `ai`, `mixed`, and `fallback`. | Pattern-based redaction is not comprehensive anonymization: names, unusual contact formats, or other sensitive free text may remain. Provider provenance describes the response, not the truth of its content. |
| Student matching and proposal help | Main already includes explained deterministic recommendations using team interests, skills, technologies, and bounded interaction signals; bookmarks and application history; and an editable proposal-plan template with selective transfer and browser draft storage. The shared catalog defaults to readiness order, with recommendations optional. Explicit task links return to the full catalog; business review selects the newly published task. | The proposal helper is a template. Teams supply their own approach, realistic timeline, and prototype; business selection stays manual. Dismissals affect only the recommendation view, and low-rated published tasks remain open. |

## Historical baseline live findings on 23 September 2026

Before either improvement round, four synthetic inputs were sent to OpenAI with a private local key, and one additional request through the running `/api/analyze` endpoint returned HTTP 200 with `source: "ai"` and seven questions. The direct calls took 3.26–5.53 seconds. The key was never printed or added to Git. These observations describe that earlier version, not the current integration.

- The weak and detailed descriptions both produced seven questions. The detailed case already named managers as users and described manual handling of 100 WhatsApp requests per day, yet the model asked again who would use the list and how requests were handled.
- A complete card produced useful refinement questions, but again seven at once. Three to five targeted questions were identified as a better demo size.
- The prompt-injection case stayed in the expected JSON question format. This was one successful example, not a general security guarantee.
- At that checkpoint the provider connection and response format worked, while relevance and question count were the next quality bottlenecks. Later changes added the three-to-five cap, prioritization, and grounded suggestions.

## Verification recorded before this integration

The demo-fix branch passed 98 backend pytest tests with 95.85% combined coverage and nine frontend tests. Its isolated PostgreSQL flow passed all 27 requests, including restart persistence and concurrent milestone confirmation. Browser checks covered pending-answer preservation, score growth from 30 to 80, publication, the student proposal helper and submission, application navigation for a dismissed task, manual selection, and a single 10-point milestone award visible in student history. A synthetic live request returned `source: "ai"` with five questions in 2.68 seconds without repeating the explicitly named managers or workflow. The isolated browser preview used no-key fallback. See [DEMO_VERIFICATION.md](DEMO_VERIFICATION.md) for that branch's evidence and limits.

Separately, the incoming task-assistant round recorded a synthetic live result with five targeted questions and an offline API result with three questions and three verbatim suggestions. Its handoff reported backend tests, PostgreSQL acceptance, frontend build, and browser suggestion review. Those results apply to the incoming revision before merging the demo fixes.

After conflict resolution, the combined revision passed 109 backend tests (95.61% combined coverage), 16 frontend tests, Python lint, the frontend build, and the 27-request isolated PostgreSQL acceptance flow. Focused browser checks passed for pending-answer refresh, evidence-backed suggestion review, changed-description replacement of stale suggestions and edits, accept/edit/discard, and confirmation at 30 points. A timed five-minute presentation remains a separate rehearsal item; individual live examples do not establish broad language understanding.

## Task assistant interaction

1. The business enters a short description. The assistant returns three to five questions prioritized by missing information and can offer suggestions grounded in exact excerpts.
2. Every suggestion shows its supporting excerpt. The business may accept, edit, or discard it. If the target field is already filled, the UI asks the business to review it manually instead of overwriting it.
3. Answers stay associated with their target fields when questions refresh. Transferring them appends new information to the editable card and skips an equivalent answer block after whitespace normalization.
4. Only confirmation updates the published fields and score. AI cannot assign points, publish the task, or select teams.
5. If the provider fails, deterministic questions and narrow local suggestions remain available. The UI distinguishes AI, mixed, and fallback results while preserving typed answers.

The `questions` response remains compatible; `suggestedFields` and `mixed` extend it. OpenAI's [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs) distinguishes schema adherence from JSON mode. This implementation keeps JSON mode and validates suggestion evidence against the submitted description. A later quality round could adopt schema-enforced responses and evaluate more languages and phrasing without loosening the evidence rule.

## Integrated acceptance checklist

| Input or event | Expected result |
| --- | --- |
| “Нужен сервис для магазина” | At least three relevant questions; no fabricated users, data, budget, or success metric. |
| Description clearly naming managers and their current workflow | Avoid repeating those basic facts; offer only supported excerpts for review and ask about remaining gaps. |
| A fully filled card | Ask refinement questions rather than inventing missing facts or returning fewer than three questions. |
| Unsupported, invented, or mismatched suggestion evidence | Discard the suggestion; do not change card fields or score. |
| Provider timeout, invalid JSON, or unsupported question field | Return fallback questions within the bounded provider wait; keep the card and typed answers intact. |
| Repeated transfer or refreshed questions | Skip an identical normalized answer block and preserve field-associated pending answers across refresh. |
| Accept a suggestion for an already filled field | Preserve existing text and request manual review. |
| Prompt injection inside a business description | Treat it as user data; preserve response validation, deterministic scoring, and manual team-selection rules. |
| Catalog and explicit task navigation | Show all published tasks in readiness order by default, including low scores; application-history links and return-to-business review select the intended task. |
| Live demo with a configured key | Record source and latency without logging the key or full input; demonstrate both live and offline paths. |

## Remaining work

- Rehearse the complete presentation within five minutes against the intended demo database.
- Expand synthetic quality fixtures for ambiguous wording, unsupported assumptions, and unrecognized contact formats. Keep the extraction and redaction limits explicit.

Do not add an AI-generated readiness score, automatic team assignment, chat, embeddings, or a vector database for this round.
