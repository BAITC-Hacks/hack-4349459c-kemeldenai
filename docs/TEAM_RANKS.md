# Team ranks

Ranks are calculated in the frontend from the backend-owned `progressPoints` balance. The shared policy lives in `web/src/teamRanks.ts`. One business-confirmed completed stage awards 10 points; submitting proposals, being selected, clicks, and bookmarks award none. No rank field is stored or returned by the backend.

| Rank | Minimum points |
| --- | ---: |
| Старт | 0 |
| Бронза | 10 |
| Серебро | 30 |
| Золото | 60 |
| Платина | 100 |

The frontend displays the calculated rank in the student header, demo entry, team progress panel, application history, and company proposal review. Students see the next threshold and progress within the current rank. Platinum stays the highest rank while points can continue increasing. Company proposal cards show rank, points, and expandable rules without changing proposal order or selection eligibility. A rank measures recorded completed work, not an independent quality rating.

Existing milestone confirmation refreshes team data, updating displayed ranks after points are awarded. Entering company proposal review or refreshing its list also refreshes team data. Failed team fetches show a stale-rank warning on the company review screen.

Validation: rank threshold and promotion-progress tests in `web/tests/teamRanks.test.mjs`, production build, and browser checks of student progress and company proposal badges. Thresholds are initial product choices and may need tuning. Ranks reflect the demo’s shared team identities, not independently verified qualifications.
