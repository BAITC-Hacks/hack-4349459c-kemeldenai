import type { TaskCard } from './types.ts'

export type TaskRestoreResult =
  | { kind: 'restored'; task: TaskCard }
  | { kind: 'missing' }
  | { kind: 'retry'; id: string; message: string }

export async function restoreTask(id: string, load: (id: string) => Promise<TaskCard>): Promise<TaskRestoreResult> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { kind: 'missing' }
  try {
    return { kind: 'restored', task: await load(id) }
  } catch (failure) {
    if (failure && typeof failure === 'object' && 'status' in failure && failure.status === 404) return { kind: 'missing' }
    return {
      kind: 'retry', id,
      message: failure instanceof Error && failure.message ? failure.message : 'Не удалось восстановить сохранённую карточку. Повторите загрузку.',
    }
  }
}
