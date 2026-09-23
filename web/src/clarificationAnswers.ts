import { CARD_FIELDS, type CardField, type ClarifyingQuestion, type EditableCard } from './types.ts'

const normalize = (value: string) => value.trim().split('\n').map((line) => line.trim().replace(/\s+/g, ' ')).join('\n')

export function transferClarificationAnswers(card: EditableCard, questions: ClarifyingQuestion[], answers: Record<string, string>): EditableCard {
  const next = { ...card }
  questions.forEach((item) => {
    const answer = Object.hasOwn(answers, item.field) ? answers[item.field]?.trim() : ''
    if (!answer) return
    const field: CardField = CARD_FIELDS.includes(item.field as CardField) ? item.field as CardField : 'description'
    if ((`\n${normalize(next[field])}\n`).includes(`\n${normalize(answer)}\n`)) return
    next[field] = next[field].trim() ? `${next[field].trim()}\n${answer}` : answer
  })
  return next
}
