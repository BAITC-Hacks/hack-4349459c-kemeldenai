import { CARD_FIELDS, type CardField, type ClarifyingQuestion, type EditableCard } from './types.ts'

export function transferClarificationAnswers(card: EditableCard, questions: ClarifyingQuestion[], answers: Record<number, string>): EditableCard {
  const next = { ...card }
  questions.forEach((item, index) => {
    const answer = answers[index]?.trim()
    if (!answer) return
    const field: CardField = CARD_FIELDS.includes(item.field as CardField) ? item.field as CardField : 'description'
    const normalize = (value: string) => value.trim().split('\n').map((line) => line.trim().replace(/\s+/g, ' ')).join('\n')
    if ((`\n${normalize(next[field])}\n`).includes(`\n${normalize(answer)}\n`)) return
    next[field] = next[field].trim() ? `${next[field].trim()}\n${answer}` : answer
  })
  return next
}
