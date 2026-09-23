# Team task recommendations

The student catalog defaults to personalized ranking, with the original readiness ordering available as “По приоритету”. Search and filters apply to both modes; all published tasks remain eligible. The displayed readiness score is unchanged and is not a recommendation probability.

The first version uses an explainable content baseline, without an external service or model training. Case-insensitive whole-word matches connect team interests, skills, and technologies to task title, topic, industry, description, need, materials, and expected result. It does not understand synonyms, Russian inflection, or semantic similarity.

Ranking combines 60% profile match, 30% similarity to recently clicked tasks, and 10% readiness. The profile signal is capped at one, with 0.7 per matching focus and 0.3 per matching skill/technology. Click similarity uses the strongest recent match: one for the same topic, or 0.5 for the same industry. A click's weight halves every 14 days. Ranking uses at most 50 distinct clicked tasks from the last 90 days. These are initial heuristic weights, not learned or validated quality estimates.

Only explicit task-card opens create clicks; automatic selection, rendering, and filters do not. PostgreSQL stores the latest timestamp for each team/task pair using an atomic upsert, so repeated or concurrent clicks do not multiply its weight. Older rows remain stored but do not affect ranking. The reset action deletes the team's click records. Editing focus updates the existing team interests; skills and technologies stay intact. Startup creates the new `task_clicks` table without modifying existing table columns.

The API remains an unauthenticated local demo. Settings and history belong to the selected demo team, shared by everyone using that identity; they are not private per-student accounts.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/teams/{teamId}/recommendations` | Returns `{taskId, relevance, reasons}[]` for published tasks, in descending relevance order. |
| `PUT /api/teams/{teamId}/focus` | Saves `{interests: string[]}`; up to 12 nonblank entries of at most 80 characters; returns the team. |
| `POST /api/teams/{teamId}/clicks/{taskId}` | Records an explicit open of a published task. |
| `DELETE /api/teams/{teamId}/clicks` | Clears that team's click history. |

Recommendation failures fall back to readiness ordering with a retry action. Click tracking runs asynchronously in the UI and does not block opening a task or sending a proposal.

## Open-source model options

- [LightFM](https://github.com/lyst/lightfm): hybrid recommendations using interaction data and user/item attributes. A candidate for combining team focus and task content with clicks when the dataset grows.
- [Implicit](https://github.com/benfred/implicit): collaborative filtering from implicit feedback, including ALS and BPR. A candidate once many teams have overlapping interaction histories.

Neither model is installed in this baseline. Before adopting a trained model, collect impression context and stronger feedback such as proposals, then compare against this baseline using a chronological holdout, Recall@K/NDCG@K, and proposal conversion. Clicks alone carry position bias and do not prove task suitability. Keep a content fallback for new teams and tasks.

Validation covers focus-based ranking, click-based reordering, isolation between teams, repeated-click deduplication, draft exclusion, invalid inputs, expiry, reset, and persistence across application restarts. The local browser check also verified the PostgreSQL click path and visible recommendation explanations.
