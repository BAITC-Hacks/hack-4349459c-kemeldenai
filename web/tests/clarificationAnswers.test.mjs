import assert from 'node:assert/strict'
import test from 'node:test'
import { transferClarificationAnswers } from '../src/clarificationAnswers.ts'

const questions = [{ field: 'context', question: 'Как устроен процесс?' }, { field: 'users', question: 'Кто пользуется решением?' }]

test('transferring the same answers twice does not duplicate text or overwrite existing detail', () => {
  const card = { context: 'Заявки поступают по почте.', users: 'Менеджеры', description: 'Нужен список заявок' }
  const answers = { 0: 'Обрабатываем 100 заявок в день.\nРаботают две смены.', 1: 'Менеджеры' }
  const once = transferClarificationAnswers(card, questions, answers)
  assert.equal(once.context, 'Заявки поступают по почте.\nОбрабатываем 100 заявок в день.\nРаботают две смены.')
  assert.equal(once.users, 'Менеджеры')
  assert.deepEqual(transferClarificationAnswers(once, questions, answers), once)
  assert.equal(card.context, 'Заявки поступают по почте.')
})

test('whitespace variants of existing answers are not appended, genuinely new detail is', () => {
  const card = { context: '100 заявок в день', users: '', description: '' }
  assert.equal(transferClarificationAnswers(card, questions, { 0: ' 100   заявок в день ' }).context, card.context)
  assert.equal(transferClarificationAnswers(card, questions, { 0: '100 заявок в неделю' }).context, '100 заявок в день\n100 заявок в неделю')
  assert.deepEqual(transferClarificationAnswers(card, questions, { 0: '   ' }), card)
})

test('unrecognized question fields cannot overwrite metadata or object prototypes', () => {
  const card = { context: '', users: '', description: 'Исходный текст', score: 30 }
  const result = transferClarificationAnswers(card, [{field:'score'}, {field:'__proto__'}], {0:'100', 1:'Пример'})
  assert.equal(result.score, 30)
  assert.equal(result.description, 'Исходный текст\n100\nПример')
  assert.equal(Object.getPrototypeOf(result), Object.prototype)
})
