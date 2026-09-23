# AI requirements and next improvement round

This plan compares the MVP with sections 2, 5, 9, and 11 of the HackAlem case. The current-behavior section includes the local fixes made after pulling main; the dated live-test section records the earlier audit, not validation of those fixes. A possible next AI feature is a grounded task assistant that offers evidence-backed field suggestions for human review. Keep the 0–100 score deterministic and the business in control of publication and team selection.

## What the case requires

- At least one meaningful AI function: relevant clarification questions or help turning answers into a task card. At least three questions must be available, including when the provider fails.
- No invented facts. Generated text must be editable and confirmed by a person before publication.
- Demonstrate the prompt, input/output shape, and malformed-response handling. A local fallback is allowed when the external API is unavailable.
- AI may recommend tasks to students, but the full catalog stays open. AI must not select a team or use personal or sensitive participant attributes.
- The five-minute demonstration must show a weak description, improvements, score growth, publication, a student proposal, and a manual business decision.

## Current behavior after pulling main and applying local fixes

| Area | Implemented | Gap or risk |
| --- | --- | --- |
| Clarification | `POST /api/analyze` asks OpenAI `gpt-4o-mini` (or the configured model) for JSON questions, checks allowed fields and duplicates, and returns three to five questions. Invalid or insufficient model output is supplemented with deterministic questions; no key uses fallback. | One fresh synthetic live request returned five questions in 2.68 seconds without repeating the explicit users or workflow. This single example does not establish broad question quality. |
| Relevance | Missing card fields guide questions. Narrow Russian description patterns recognize explicitly labelled context/users and certain statements of current workflow, reducing repeated questions. Complete cards receive specific refinement questions. | These patterns only prioritize questions: they do not extract or insert card facts, and do not cover arbitrary wording or other languages. The model and fallback can still ask about information already present outside the recognized patterns. |
| Card handoff | A person types answers, transfers them into mapped card fields, edits, and confirms. Re-analysis is blocked while nonblank answers await transfer. Transfer appends new text and skips an exact matching block after line-by-line whitespace normalization. | Deduplication is textual, not semantic: paraphrases and differently organized answers may still append. There is no evidence-backed business-card suggestion feature. |
| Grounding | The prompt forbids invented facts; Pydantic and server checks reject invalid shapes, unknown fields, blanks, and duplicates. | Shape validation does not prove a question or draft is grounded. A fluent but unsupported assumption could pass. |
| Scoring | Confirmed fields get a deterministic 0–100 score, breakdown, and missing-field list. Obvious filler such as “Тест”, placeholder phrases, known keyboard sequences, and repeated single-letter filler earns no points. Short facts remain eligible. | This is a completeness check, not semantic validation or a judgment of truth. Other weak or irrelevant text may still earn points. The model never sets the number. |
| Reliability and privacy | One bounded 12-second provider call; no retries; failures fall back and logs omit key/body/input. The structured `contact` field is omitted from provider context, while its presence still affects question selection. | The timeout remains 12 seconds. The raw description and other supplied fields are not redacted, so contact details entered there can still be sent. Mixed AI and fallback questions are labelled simply `ai`. |
| Student matching and proposal help | Pulled main already includes explained deterministic recommendations using team interests, skills, technologies, and bounded interaction signals; bookmarks and application history; and an editable proposal-plan template with selective transfer and browser draft storage. The shared catalog now defaults to readiness order, with recommendations optional. | These helpers are not model-based matching or evidence-backed business-card suggestions. Teams must supply their own approach, realistic timeline, and prototype; business selection stays manual. |

## Historical live test findings on 23 September 2026

Before the fixes described above, four synthetic inputs were sent to OpenAI with the private local key, and one additional request through the running `/api/analyze` endpoint returned HTTP 200 with `source: "ai"` and seven questions. The direct calls took 3.26–5.53 seconds. The key was never printed or added to Git. These measurements and observations apply to that earlier version; the fresh check is recorded separately below.

- The weak and detailed descriptions both produced seven questions. The detailed case already named managers as users and described manual handling of 100 WhatsApp requests per day, yet the model asked again who would use the list and how requests are currently handled.
- A complete card produced useful refinement questions, but again seven at once. Three to five targeted questions would be easier to answer during the demo.
- The prompt-injection case stayed in the expected JSON question format. This is one successful example, not a general security guarantee.
- At that checkpoint, the provider connection and response format worked, while relevance and question count were the next quality bottlenecks. The new three-to-five cap and narrow prioritization rules address part of that finding, with broader live quality checks still useful.

## Verification of this fix round

98 backend pytest tests passed with 95.85% combined coverage; nine frontend tests passed. The isolated PostgreSQL acceptance flow passed all 27 requests, including restart persistence and concurrent milestone confirmation. The browser flow passed: pending-answer preservation, score growth from 30 to 80, publication, student proposal helper and submission, application navigation for a dismissed task, manual selection, and a single 10-point milestone award visible in student history. The restarted main API returned `source: "ai"` with five questions in 2.68 seconds for a synthetic description that explicitly named the managers and current workflow; those facts were not asked again. The isolated browser preview used no-key fallback. This is not a timed five-minute rehearsal or proof of broad language understanding. See [DEMO_VERIFICATION.md](DEMO_VERIFICATION.md) for evidence and limits.

## Options

| Option | Work | Result | Recommendation |
| --- | --- | --- | --- |
| A. Stabilize the existing question flow | Answer preservation, normalized duplicate prevention, the three-to-five cap, narrow prioritization, and structured-contact omission are implemented locally. Remaining work includes broader live quality checks and deciding whether the 12-second timeout should change. | A more reliable question flow; AI still only asks questions. | Complete a timed rehearsal before adding more scope. |
| B. Grounded task assistant | Do A, then extract only explicit facts from description/answers into reviewable field suggestions with short evidence excerpts; ask questions for the remaining gaps. | Less retyping and a visibly useful AI contribution to card quality. | Recommended next feature if time permits. |
| C. Student matching and proposal assistance | Existing deterministic recommendations, explanations, full-catalog access, and editable proposal-plan help are already on pulled main. | Supports the student journey without automatic team selection. | Verify the existing flow; no new matching model is needed for the required demo. |

## Recommended behavior for option B

1. The business enters a short description. The assistant returns three to five questions prioritized by missing score-bearing fields. It avoids asking for a fact that is already clear in the description or card.
2. If the description explicitly states a fact, the assistant may suggest a card field containing only that fact. Each suggestion shows a short supporting excerpt from the user's input. If evidence is absent or ambiguous, leave the field blank and ask a question instead.
3. The business answers the questions. Suggested values and answers appear in a review step beside the editable card. Applying them once must not overwrite existing text or create duplicates. The business can edit, discard, and confirm.
4. Only confirmation updates the published score. AI cannot set points, invent business details, publish, or select teams.
5. If the provider is unavailable, show the deterministic questions promptly and clearly label them as local fallback. Already typed answers remain intact.

Keep the current `questions` response compatible while coordinating any additional `suggestedFields` or per-question provenance between task owners. Prefer an explicit JSON schema for the new response, then continue server-side validation; OpenAI's [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs) distinguishes schema adherence from JSON mode. Verify any `evidence` excerpt against the actual submitted text before it reaches the UI. Bound the text sent to the provider and omit contact details and other unnecessary personal data.

## Acceptance examples and remaining targets

| Input or event | Expected result |
| --- | --- |
| “Нужен сервис для магазина” | At least three relevant questions; no fabricated users, data, budget, or success metric. |
| “Менеджеры вручную обрабатывают 100 заявок в день; нужен общий список заказов” | The implemented narrow rule deprioritizes workflow and user questions; fallback asks about need, materials, and constraints. Broader language understanding and consistently targeted live questions remain quality targets. |
| A fully filled card | Ask refinement questions rather than inventing missing facts or returning fewer than three questions. |
| Provider timeout, invalid JSON, or unsupported field | Return useful fallback questions; keep the card and typed answers unchanged. |
| Repeated apply or re-analysis | An exact answer block after whitespace normalization is not appended twice; pending nonblank answers block regeneration until transferred. Semantic deduplication is not implemented. |
| Prompt injection inside a business description | Treat it as user data; never change the response shape, scoring, or team-selection rules. |
| Live demo with a configured key | Record provider source and latency without logging the key or full input; show one live AI result and one offline fallback path. |

## Remaining task-focused work packages

- **Question quality and reliability:** verify the revised three-to-five question flow with fresh synthetic live inputs and fallback. The local fixes preserve pending answers, skip normalized duplicate transfers, and omit structured contact data. Evaluate question relevance beyond the narrow description patterns and the remaining 12-second timeout; do not describe unredacted free text as anonymized.
- **Grounded card suggestions:** one owner adds evidence-backed field suggestions, validates excerpts against the submitted text, provides accept/edit/discard controls, and verifies that no suggestion changes the score until human confirmation. Coordinate the JSON contract before editing shared files.
- **End-to-end acceptance:** one owner runs the weak-to-strong score journey and complete five-minute flow against the real API and PostgreSQL, compares the quality fixtures, and verifies no-key fallback. The provider key stays only in local environment.

Do not add an AI-generated readiness score, automatic team assignment, chat, embeddings, or a vector database for this round.
