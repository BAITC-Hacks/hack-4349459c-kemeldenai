import type { ProposalDraft } from './proposalDraftStorage'

export const ASSISTED_FIELDS = ['idea', 'plan', 'timeline'] as const
export type AssistedField = typeof ASSISTED_FIELDS[number]
type Requirements = { dataMaterials: string; expectedResult: string; successCriteria: string; constraints: string }

function excerpt(text: string) {
  const value = text.trim().replace(/\s+/g, ' ')
  return value.length > 400 ? value.slice(0, 397) + '…' : value
}

export function suggestPlan(task: Requirements) {
  const material = excerpt(task.dataMaterials)
  const result = excerpt(task.expectedResult)
  const criteria = excerpt(task.successCriteria)
  const constraints = excerpt(task.constraints)
  return [
    '1. Согласовать с заказчиком границы задачи и вопросы, которые нужно уточнить.',
    material ? `2. Проверить доступность и качество материалов из карточки: «${material}».` : '2. Уточнить, какие материалы можно получить и как будет предоставлен доступ.',
    result ? `3. Подготовить решение с учётом ожидаемого результата: «${result}».` : '3. Согласовать ожидаемый результат и подготовить первую версию решения.',
    constraints ? `4. Проверить решение с учётом ограничений: «${constraints}».` : '4. Уточнить ограничения и учесть их при проверке решения.',
    criteria ? `5. Проверить результат с заказчиком по критериям: «${criteria}».` : '5. Согласовать измеримые критерии успеха и проверить результат с заказчиком.',
  ].join('\n')
}

export function applyAssistance(current: ProposalDraft, preview: Pick<ProposalDraft, AssistedField>, selected: AssistedField[]): ProposalDraft {
  const next = { ...current }
  for (const field of selected) {
    const value = preview[field].trim()
    if (!value || value.length > (field === 'timeline' ? 300 : 12000)) throw new Error('Проверьте длину и содержание выбранных полей.')
    next[field] = value
  }
  return next
}
