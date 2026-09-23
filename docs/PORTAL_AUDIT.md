# Portal flow audit — 23 September 2026

Audited from main commit `6c38abd`, then integrated the newer main updates through
`8664d43` (team ranks and jury README). The fixes are on `codex/portal-flow-audit`.
No remaining flow blocker was observed in the scenarios below. This is a bounded
regression audit, not a claim that every possible defect has been excluded.

## Confirmed issues and fixes

| Issue | User impact | Fix |
| --- | --- | --- |
| A failed saved-task request removed the local task ID | A temporary API outage made an unpublished draft inaccessible through automatic recovery | Keep the ID on transient failures, offer retry, and disable editing until recovery finishes. Clear only invalid IDs or confirmed 404s. Ignore stale responses. |
| Five seeded drafts had null response metadata | Loading a seeded draft returned HTTP 500 | Initialize metadata and idempotently repair missing metadata on existing unconfirmed seeded drafts, preserving business edits. |
| Partially usable AI output could repeat a fallback question | Clarification could show duplicate questions | Deduplicate normalized question text as well as fields; use additional refinements to retain at least three questions. |
| SQLite timestamps lost their UTC offset | Browsers in other time zones could show the wrong time or day | Restore the UTC offset during response validation while preserving already-aware timestamps. |
| Topic filtering compared against untrimmed values | Tasks with space-padded topics disappeared from a matching filter, and the browser offered duplicate-looking topic options | Normalize both the API equality query and browser options/filter comparisons without rewriting task content. |
| Milestone evidence remained editable while confirmation was pending | Text entered after submission could be cleared when the earlier request completed | Disable the evidence field and retry control during submission. |
| Three small secondary-text styles had insufficient contrast | Participant details, team details, and footer were hard to read | Replace the pale hard-coded colors with the existing muted-text token. |

## Verification performed

- **115 backend tests passed**, with **95.55% combined coverage**; Ruff passed.
- **27 frontend logic tests passed**; TypeScript and Vite production build passed
  after integrating the latest main changes.
- A **27-request PostgreSQL acceptance check** passed, including restart persistence,
  seed idempotence, multiple teams, a low-score task proposal, and concurrent stage
  confirmation awarding points only once. It used an isolated temporary schema.
- Browser checks used the local preview and a separate SQLite database with
  synthetic content. At **375 × 812**, task editing and proposal forms did not
  overflow horizontally; publication dialogs fit the viewport.
- Published a task rated **30**, switched to another team, found it, and submitted
  a valid proposal. Low readiness did not block participation.
- Empty proposal fields and an invalid `javascript:` prototype link produced
  validation feedback and focus on the first invalid field. HTTP(S) submission
  succeeded. Reload restored the draft for its team and task; submission cleared it.
- Search with no matches displayed an empty state; reset restored the catalog.
- Saved a business draft, stopped the preview API, and reloaded. Recovery retained
  the saved reference, blocked editing, and offered retry. After restarting the API,
  retry restored the exact saved description. Cancelling the new-task dialog kept
  recovery available.
- Checked publication dialog keyboard focus and Escape behavior.
- After integrating main, verified participant switching, the catalog topic filter
  and reset, and application history. Data Nomads consistently showed Bronze and
  10 earned points in the entry screen, header, progress panel, and history.
- The three corrected text pairs previously measured about **3.16:1**, **3.01:1**,
  and **2.30:1**. Their replacement token exceeds **5:1** on those backgrounds.

The API-outage scenario deliberately generated failed requests. The backend suite
also emitted an upstream Starlette/httpx deprecation warning; it did not fail.
This run did not include a live paid AI-provider call, load testing, a complete
screen-reader audit, or all browser/device combinations. Demo participant selection
remains a demo identity mechanism, not production authentication.

## Visual direction proposed

Recommended palette: **Ink & paper**. Use warm off-white `#F5F4EF` for the page,
white for editable surfaces, navy `#12283D` for headings and the readiness panel,
teal `#08736C` for primary actions, and muted text `#52616F`. Use brass `#C89C57`
sparingly as decoration rather than small text. The core text contrast pairs are
approximately 13.7:1 for ink on canvas, 5.7:1 for white on teal, and 6.4:1 for muted
text on white.

The strongest visual moment should be the readiness panel and its confirmation:
a restrained blueprint grid, a clear score, and a short receipt showing the change
from the previous confirmed score. Keep the editing area calm and readable.

Four structural improvements would give the existing interface more room:

1. Combine the header identity and repeated team banner into one identity line,
   retaining the team's progress points.
2. Collapse the recommendation profile behind “Настроить рекомендации” so tasks
   appear earlier.
3. Shorten catalog rows to title, readiness, and three useful facts; keep the full
   brief in task details.
4. Reduce the mobile action bar from three stacked actions to one primary action
   and a compact secondary row, moving rare actions into a menu. The current bar
   occupies about one third of the tested phone viewport.

Keep hover feedback around 140 ms and panel/dialog entry around 180–220 ms. Retain
the existing score animation, honor reduced motion, and avoid continuous animated
backgrounds. Consolidate remaining hard-coded greens into semantic color tokens.

A separate interactive concept board compares Ink & paper, Forest & copper, and
Graphite & cobalt using business and student layouts. It is a design proposal;
the full palette/layout redesign is not applied by these bug fixes.
