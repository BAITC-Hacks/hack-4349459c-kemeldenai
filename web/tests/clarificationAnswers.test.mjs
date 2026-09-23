import assert from 'node:assert/strict'
import test from 'node:test'
import { transferClarificationAnswers } from '../src/clarificationAnswers.ts'

const questions = [{ field: 'context', question: 'Как устроен процесс?' }, { field: 'users', question: 'Кто пользуется решением?' }]

test('transferring the same answers twice does not duplicate text or overwrite existing detail', () => {
  const card = { context: 'Заявки поступают по почте.', users: 'Менеджеры', description: 'Нужен список заявок' }
  const answers = { context: 'Обрабатываем 100 заявок в день.\nРаботают две смены.', users: 'Менеджеры' }
  const once = transferClarificationAnswers(card, questions, answers)
  assert.equal(once.context, 'Заявки поступают по почте.\nОбрабатываем 100 заявок в день.\nРаботают две смены.')
  assert.equal(once.users, 'Менеджеры')
  assert.deepEqual(transferClarificationAnswers(once, questions, answers), once)
  assert.equal(card.context, 'Заявки поступают по почте.')
})

test('whitespace variants of existing answers are not appended, genuinely new detail is', () => {
  const card = { context: '100 заявок в день', users: '', description: '' }
  assert.equal(transferClarificationAnswers(card, questions, { context: ' 100   заявок в день ' }).context, card.context)
  assert.equal(transferClarificationAnswers(card, questions, { context: '100 заявок в неделю' }).context, '100 заявок в день\n100 заявок в неделю')
  assert.deepEqual(transferClarificationAnswers(card, questions, { context: '   ' }), card)
})

test('unrecognized question fields cannot overwrite metadata or object prototypes', () => {
  const card = { context: '', users: '', description: 'Исходный текст', score: 30 }
  const result = transferClarificationAnswers(card, [{field:'score'}, {field:'__proto__'}], {score:'100', ['__proto__']:'Пример'})
  assert.equal(result.score, 30)
  assert.equal(result.description, 'Исходный текст\n100\nПример')
  assert.equal(Object.getPrototypeOf(result), Object.prototype)
})

test('answers follow their fields when refreshed questions change order', () => {
  const card = { context: '', users: '', description: '' }
  const result = transferClarificationAnswers(card, [...questions].reverse(), { context: '100 заявок в день', users: 'Менеджеры' })
  assert.equal(result.context, '100 заявок в день')
  assert.equal(result.users, 'Менеджеры')
})

test('inherited answer properties are never transferred', () => {
  const card = { description: 'Исходный текст' }
  assert.deepEqual(transferClarificationAnswers(card, [{ field: '__proto__' }], {}), card)
})
