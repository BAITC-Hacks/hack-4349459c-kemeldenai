export const TEAM_RANKS = [
  { id: 'starter', label: 'Старт', minimum: 0 },
  { id: 'bronze', label: 'Бронза', minimum: 10 },
  { id: 'silver', label: 'Серебро', minimum: 30 },
  { id: 'gold', label: 'Золото', minimum: 60 },
  { id: 'platinum', label: 'Платина', minimum: 100 },
] as const

export function teamRank(value: number) {
  const points = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  let index = 0
  for (let position = 1; position < TEAM_RANKS.length; position++) {
    if (points >= TEAM_RANKS[position].minimum) index = position
  }
  const current = TEAM_RANKS[index]
  const next = TEAM_RANKS[index + 1] ?? null
  return { current, next, points, remaining: next ? next.minimum - points : 0,
    progress: next ? (points - current.minimum) / (next.minimum - current.minimum) * 100 : 100 }
}
