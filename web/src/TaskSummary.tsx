import type { TaskCard } from './types'

const fields = [
  ['expectedResult', 'Что сделать'],
  ['dataMaterials', 'Материалы'],
  ['constraints', 'Ограничения'],
  ['interaction', 'Формат связи'],
  ['contact', 'Контакт'],
] as const

/** Render only supplied facts; missing fields are not estimates or recommendations. */
export function TaskSummary({ task }: { task: TaskCard }) {
  return <span className="task-summary">
    {fields.map(([field, label]) => {
      const value = task[field].trim()
      return <span className={`task-summary__row ${value ? '' : 'task-summary__row--missing'}`} key={field}>
        <span className="task-summary__label">{label}</span>
        <span className="task-summary__value" title={value || undefined}>{value || 'Не указано'}</span>
      </span>
    })}
    <span className="task-summary__hint">Открыть полную карточку →</span>
  </span>
}
