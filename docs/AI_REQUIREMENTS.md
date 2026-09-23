# AI requirements and task assistant

This document compares the MVP with sections 2, 5, 9, and 11 of the HackAlem case and records the task assistant improvement. The assistant recognizes explicit facts in the business description, asks about remaining gaps, and offers evidence-backed text for review in the editable card. The 0–100 score stays deterministic, and the business controls publication and team selection.

## Implemented task assistant

- `POST /api/analyze` returns three to five questions and optional `suggestedFields` with exact evidence excerpts from the description. Clear process, user, and expected-result phrases can also produce local suggestions when OpenAI is unavailable.
- A narrow fact check excludes already stated users and current workflow from missing-field questions. The provider receives bounded text with common email and phone patterns redacted, and the timeout is seven seconds.
- Refreshing questions preserves typed answers. Transferring an answer twice does not duplicate an identical line. The review step lets the business accept, edit, or discard each suggestion; accepting never overwrites a nonempty field. Only card confirmation changes the score.
- `source` distinguishes `ai`, `mixed`, and `fallback`. A synthetic live provider call returned five targeted questions; an offline API call returned three questions and three verbatim suggestions. The backend tests, PostgreSQL flow, frontend build, and browser review path pass. The key remains in ignored local configuration.

The extraction rules deliberately cover only clear phrases; ambiguous descriptions still need questions and human editing. The provider uses JSON mode with strict server-side checks for field names and exact evidence, rather than a schema-enforced model response. Suggestions currently draw from the original description; typed answers are transferred to their mapped card fields for review.

## What the case requires

- At least one meaningful AI function: relevant clarification questions or help turning answers into a task card. At least three questions must be available, including when the provider fails.
- No invented facts. Generated text must be editable and confirmed by a person before publication.
- Demonstrate the prompt, input/output shape, and malformed-response handling. A local fallback is allowed when the external API is unavailable.
- AI may recommend tasks to students, but the full catalog stays open. AI must not select a team or use personal or sensitive participant attributes.
- The five-minute demonstration must show a weak description, improvements, score growth, publication, a student proposal, and a manual business decision.

## Baseline before the task assistant round

| Area | Implemented | Gap or risk |
| --- | --- | --- |
| Clarification | `POST /api/analyze` asks OpenAI `gpt-4o-mini` for JSON questions, checks fields and duplicates, and fills to at least three with deterministic questions. A private test key is configured on the current computer; the live API returned `source: "ai"`. | The key is local only. Mocked unit tests do not establish question quality, and another computer without a key uses fallback. |
| Relevance | The prompt includes the description and card, and asks about missing fields. | The missing-field list is computed from card fields only. Facts already stated in the free description can still be treated as missing. With no provider key, substantially different descriptions receive the same first questions. |
| Card handoff | A person types answers, transfers them into mapped card fields, edits, and confirms. | Transfer is literal append. Regenerating questions clears unsent answers; pressing transfer again can duplicate text. There is no suggested card text with visible evidence from the user's words. |
| Grounding | The prompt forbids invented facts; Pydantic rejects invalid shapes, unknown fields, blanks, and duplicates. | Shape validation does not prove a question or draft is grounded. A fluent but unsupported assumption could pass. |
| Scoring | Confirmed fields get a deterministic 0–100 score, breakdown, and missing-field list. The model never sets the number. | Presence is a proxy for usefulness: short but weak text can earn points. Keep scoring explainable; do not replace it with a model judgment. |
| Reliability and privacy | One bounded 12-second provider call; no retries; failures fall back and logs omit key/body/input. | A 12-second pause is long in a five-minute demo. The provider payload includes the contact field even though question generation does not need contact details. Mixed AI and fallback questions are labelled simply `ai`. |

## Baseline live test findings on 23 September 2026

Four synthetic inputs were sent to OpenAI with the private local key, and one additional request through the running `/api/analyze` endpoint returned HTTP 200 with `source: "ai"` and seven questions. The direct calls took 3.26–5.53 seconds. The key was never printed or added to Git.

- The weak and detailed descriptions both produced seven questions. The detailed case already named managers as users and described manual handling of 100 WhatsApp requests per day, yet the model asked again who would use the list and how requests are currently handled.
- A complete card produced useful refinement questions, but again seven at once. Three to five targeted questions would be easier to answer during the demo.
- The prompt-injection case stayed in the expected JSON question format. This is one successful example, not a general security guarantee.
- The provider connection and response format work. Relevance and question count are the next quality bottlenecks.

## Options considered

| Option | Work | Result | Recommendation |
| --- | --- | --- | --- |
| A. Stabilize the existing question flow | Keep the private key local; prevent answer loss and duplicate transfers; ask three to five nonredundant questions; shorten the bounded wait; test realistic inputs. | Smoothest low-risk demo, but AI still only asks questions. | Do this first. |
| B. Grounded task assistant | Do A, then extract only explicit facts from description/answers into reviewable field suggestions with short evidence excerpts; ask questions for the remaining gaps. | Less retyping and a visibly useful AI contribution to card quality. | Recommended next feature if time permits. |
| C. Student matching | Rank tasks by team interests and skills, with explanations and full-catalog access. | Useful later, but it adds little to the required five-minute business journey. | Defer. |

## Target behavior for option B

1. The business enters a short description. The assistant returns three to five questions prioritized by missing score-bearing fields. It avoids asking for a fact that is already clear in the description or card.
2. If the description explicitly states a fact, the assistant may suggest a card field containing only that fact. Each suggestion shows a short supporting excerpt from the user's input. If evidence is absent or ambiguous, leave the field blank and ask a question instead.
3. The business answers the questions. Suggested values and answers appear in a review step beside the editable card. Applying them once must not overwrite existing text or create duplicates. The business can edit, discard, and confirm.
4. Only confirmation updates the published score. AI cannot set points, invent business details, publish, or select teams.
5. If the provider is unavailable, show the deterministic questions promptly and clearly label them as local fallback. Already typed answers remain intact.

The `questions` response remains compatible; `suggestedFields` and `mixed` extend it. OpenAI's [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs) distinguishes schema adherence from JSON mode. This implementation keeps JSON mode and validates every suggestion's evidence against the submitted description. A later quality round could adopt schema-enforced responses and evaluate more languages and phrasing without loosening the exact-evidence rule.

## Acceptance examples

| Input or event | Expected result |
| --- | --- |
| “Нужен сервис для магазина” | At least three relevant questions; no fabricated users, data, budget, or success metric. |
| “Менеджеры вручную обрабатывают 100 заявок в день; нужен общий список заказов” | Recognize the current workflow and user group; ask for data availability, measurable success, and constraints rather than repeating known facts. |
| A fully filled card | Ask refinement questions rather than inventing missing facts or returning fewer than three questions. |
| Provider timeout, invalid JSON, or unsupported field | Return useful fallback questions; keep the card and typed answers unchanged. |
| Repeated apply or re-analysis | No duplicate card text and no silent loss of typed answers. |
| Prompt injection inside a business description | Treat it as user data; never change the response shape, scoring, or team-selection rules. |
| Live demo with a configured key | Record provider source and latency without logging the key or full input; show one live AI result and one offline fallback path. |

## Completed task-focused work packages

- **Question quality and reliability:** missing-information selection, three to five nonredundant questions, answer preservation during refresh, idempotent transfer, bounded and redacted provider context, and live/fallback checks now span the API and UI.
- **Grounded card suggestions:** exact-evidence field suggestions and accept/edit/discard controls now let the business review text before confirmation. The score remains unchanged until confirmation.
- **End-to-end acceptance:** backend tests, the PostgreSQL flow, frontend build, and browser checks covered the real API and no-key fallback. The provider key remains only in local configuration. The full timed five-minute presentation remains a human rehearsal item.

Do not add an AI-generated readiness score, automatic team assignment, chat, embeddings, or a vector database for this round.
