# AI requirements and next improvement round

This plan compares the current MVP with sections 2, 5, 9, and 11 of the HackAlem case. The best next AI improvement is a grounded task assistant: recognize facts already present in the business description, ask only for genuinely missing information, and offer evidence-backed text for review in the editable card. Keep the 0–100 score deterministic and the business in control of publication and team selection.

## What the case requires

- At least one meaningful AI function: relevant clarification questions or help turning answers into a task card. At least three questions must be available, including when the provider fails.
- No invented facts. Generated text must be editable and confirmed by a person before publication.
- Demonstrate the prompt, input/output shape, and malformed-response handling. A local fallback is allowed when the external API is unavailable.
- AI may recommend tasks to students, but the full catalog stays open. AI must not select a team or use personal or sensitive participant attributes.
- The five-minute demonstration must show a weak description, improvements, score growth, publication, a student proposal, and a manual business decision.

## Current state on main

| Area | Implemented | Gap or risk |
| --- | --- | --- |
| Clarification | `POST /api/analyze` asks OpenAI `gpt-4o-mini` for JSON questions, checks fields and duplicates, and fills to at least three with deterministic questions. | The local `.env` has no `OPENAI_API_KEY`, so the running demo currently uses fallback. Mocked tests do not establish live question quality. |
| Relevance | The prompt includes the description and card, and asks about missing fields. | The missing-field list is computed from card fields only. Facts already stated in the free description can still be treated as missing. With no provider key, substantially different descriptions receive the same first questions. |
| Card handoff | A person types answers, transfers them into mapped card fields, edits, and confirms. | Transfer is literal append. Regenerating questions clears unsent answers; pressing transfer again can duplicate text. There is no suggested card text with visible evidence from the user's words. |
| Grounding | The prompt forbids invented facts; Pydantic rejects invalid shapes, unknown fields, blanks, and duplicates. | Shape validation does not prove a question or draft is grounded. A fluent but unsupported assumption could pass. |
| Scoring | Confirmed fields get a deterministic 0–100 score, breakdown, and missing-field list. The model never sets the number. | Presence is a proxy for usefulness: short but weak text can earn points. Keep scoring explainable; do not replace it with a model judgment. |
| Reliability and privacy | One bounded 12-second provider call; no retries; failures fall back and logs omit key/body/input. | A 12-second pause is long in a five-minute demo. The provider payload includes the contact field even though question generation does not need contact details. Mixed AI and fallback questions are labelled simply `ai`. |

## Options

| Option | Work | Result | Recommendation |
| --- | --- | --- | --- |
| A. Stabilize the existing question flow | Add a private OpenAI key, run a live smoke test, prevent answer loss and duplicate transfers, shorten the bounded wait, and test realistic inputs. | Smoothest low-risk demo, but AI still only asks questions. | Do this first. |
| B. Grounded task assistant | Do A, then extract only explicit facts from description/answers into reviewable field suggestions with short evidence excerpts; ask questions for the remaining gaps. | Less retyping and a visibly useful AI contribution to card quality. | Recommended next feature if time permits. |
| C. Student matching | Rank tasks by team interests and skills, with explanations and full-catalog access. | Useful later, but it adds little to the required five-minute business journey. | Defer. |

## Recommended behavior for option B

1. The business enters a short description. The assistant returns three to five questions prioritized by missing score-bearing fields. It avoids asking for a fact that is already clear in the description or card.
2. If the description explicitly states a fact, the assistant may suggest a card field containing only that fact. Each suggestion shows a short supporting excerpt from the user's input. If evidence is absent or ambiguous, leave the field blank and ask a question instead.
3. The business answers the questions. Suggested values and answers appear in a review step beside the editable card. Applying them once must not overwrite existing text or create duplicates. The business can edit, discard, and confirm.
4. Only confirmation updates the published score. AI cannot set points, invent business details, publish, or select teams.
5. If the provider is unavailable, show the deterministic questions promptly and clearly label them as local fallback. Already typed answers remain intact.

Keep the current `questions` response compatible while coordinating any additional `suggestedFields` or per-question provenance with both agents. Prefer an explicit JSON schema for the new response, then continue server-side validation; OpenAI's [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs) distinguishes schema adherence from JSON mode. Verify any `evidence` excerpt against the actual submitted text before it reaches the UI. Bound the text sent to the provider and omit contact details and other unnecessary personal data.

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

## Work split after the current A/B integration

- **Agent A, backend:** improve missing-information selection; add bounded grounded suggestions and evidence validation; exclude contact text; tune timeout/fallback; add a small quality fixture set and one live-key smoke procedure that does not run in normal tests. Keep response contract changes coordinated with B.
- **Agent B, frontend:** preserve answers across re-analysis; make transfer idempotent; show accepted/rejected field suggestions and their evidence; distinguish AI, mixed, and local fallback clearly; keep card editing and manual confirmation obvious.
- **Integrator:** test the weak-to-strong score journey and complete five-minute flow against the real API and PostgreSQL, with the provider key loaded only from local environment. Compare the five fixture inputs before and after the change, then test the fallback without a key.

Do not add an AI-generated readiness score, automatic team assignment, chat, embeddings, or a vector database for this round.
