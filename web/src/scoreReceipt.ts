import type { TaskCard } from './types'

type ScoreCard = Pick<TaskCard, 'id' | 'score' | 'confirmedAt'>

export interface ConfirmedScore {
  taskId: string
  score: number
}

export function confirmedScore(task: ScoreCard | null): ConfirmedScore | null {
  if (!task?.confirmedAt || task.score === null || !Number.isFinite(task.score) || task.score < 0 || task.score > 100) return null
  return { taskId: task.id, score: task.score }
}

export function scoreReceipt(previous: ConfirmedScore | null, task: ScoreCard | null) {
  const next = confirmedScore(task)
  if (!next) return null
  const before = previous?.taskId === next.taskId ? previous.score : null
  const delta = before === null ? null : next.score - before
  const tone = delta === null ? 'first' : delta > 0 ? 'improved' : delta < 0 ? 'decreased' : 'unchanged'
  return { taskId: next.taskId, before, after: next.score, delta, tone }
}
