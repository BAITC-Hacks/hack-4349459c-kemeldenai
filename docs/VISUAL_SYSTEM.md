# Graphite & cobalt

Applied on 23 September 2026 after pulling main through `db42b22`. This implements
the selected third visual concept alongside the portal audit fixes.

## Palette and hierarchy

| Role | Color | Use |
| --- | --- | --- |
| Ink | `#202936` | Navigation, readiness panel, primary text |
| Canvas | `#F2F4F7` | Page background |
| Surface | `#FFFFFF` | Forms, cards, dialogs |
| Muted surface | `#E9EDF5` | Supporting controls and previews |
| Action | `#335CB8` | Primary buttons, active navigation, focus |
| Accent | `#5C8BAA` | Restrained brand rule |
| Muted text | `#546173` | Labels and supporting copy |

Tokens live in `web/src/styles.css`, including separate success, warning, danger,
and inverse-surface tokens. Core contrast checks: white on cobalt 6.24:1; muted
text on white 6.30:1; muted text on canvas 5.72:1. The 24px grid is confined to the
readiness panel. There are no animated backgrounds or new visual dependencies.

## Layout and behavior

- A single header groups identity, rank, and earned points. Rank details remain
  in the existing keyboard-accessible dialog.
- Recommendation settings are collapsed initially. Collapsing preserves edits;
  request status and errors remain visible outside the disclosure.
- Catalog cards show title, readiness, and three supplied facts: result,
  materials, and interaction. The full brief remains available in task details.
- The builder has one primary action and a compact secondary row at narrow
  widths. Saving, manual entry, editing, confirmation, and publication remain
  available in their original steps.
- A confirmation receipt shows actual readiness changes. It handles first
  confirmation, zero, increases, decreases, and unchanged scores without carrying
  a baseline across tasks. It does not change the scoring algorithm or award
  team progress points.
- Hover feedback is 140ms; panel entry is 200–220ms. Existing score animation and
  reduced-motion support are retained. Receipts also honor reduced motion.

## Verification

- 115 backend tests passed; 95.55% combined coverage; Ruff passed.
- 32 frontend tests passed, including five score-receipt regressions.
- TypeScript and Vite production build passed. No new dependencies.
- Browser checks at 320, 375, 1024, and 1440px, including narrow receipt sizing.
  The initial mobile action bar measured 146px at 375px, compared with about
  260px in the earlier audit.
- Created a task, confirmed it at 25, added four supplied fields, and confirmed
  it at 80. The receipt displayed 25 → 80 and +55; publication succeeded.
- Publication and rank dialogs fit at phone widths; Escape closed the dialogs.
- Entered as another team, opened the published task, added an assisted plan,
  kept it when replacement was offered, submitted a proposal, and opened the
  matching application history.
- Recommendation edits survived closing/reopening, saving succeeded, and an
  80-character unbroken interest wrapped without horizontal overflow at 320px.
  The original test team's interests were restored afterward.
- Found and fixed application-card overflow at 320px. Catalog, builder, and
  application history passed the checked horizontal-overflow cases.

Browser checks used the separate local preview database and synthetic content.
The checks do not constitute exhaustive browser, load, or screen-reader testing.
