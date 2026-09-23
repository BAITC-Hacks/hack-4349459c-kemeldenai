import test from 'node:test'
import assert from 'node:assert/strict'
import { suggestPlan, applyAssistance } from '../src/proposalAssistance.ts'

test('plan uses supplied requirements and requests clarification for missing facts', () => {
  const plan = suggestPlan({ dataMaterials: 'Обезличенные записи', expectedResult: 'Панель запасов', constraints: 'Экспорт в CSV', successCriteria: 'Снизить дефицит на 10%' })
  for (const text of ['Обезличенные записи', 'Панель запасов', 'Экспорт в CSV', 'Снизить дефицит на 10%']) assert.ok(plan.includes(text))
  const sparse = suggestPlan({ dataMaterials: '', expectedResult: '', constraints: '', successCriteria: '' })
  assert.ok(sparse.includes('Уточнить, какие материалы'))
  assert.ok(sparse.includes('Согласовать измеримые критерии'))
  assert.ok(!sparse.includes('недел'))
})

test('only selected fields change; existing text and prototype are preserved', () => {
  const current = { idea: 'Моя идея', plan: 'Мой план', timeline: '3 недели', prototypeUrl: 'https://example.org/real' }
  const preview = { idea: 'Новая идея', plan: ' Новый план ', timeline: '1 неделя' }
  const result = applyAssistance(current, preview, ['plan'])
  assert.deepEqual(result, { ...current, plan: 'Новый план' })
  assert.equal(current.plan, 'Мой план')
  assert.deepEqual(applyAssistance(current, preview, []), current)
})

test('blank and oversized selected fields are rejected without changing the draft', () => {
  const current = { idea: 'Идея', plan: 'План', timeline: 'Неделя', prototypeUrl: '' }
  assert.throws(() => applyAssistance(current, { ...current, idea: '  ' }, ['idea']))
  assert.throws(() => applyAssistance(current, { ...current, timeline: 'x'.repeat(301) }, ['timeline']))
  assert.equal(current.idea, 'Идея')
})
