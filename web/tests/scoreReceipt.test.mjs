import assert from 'node:assert/strict'
import test from 'node:test'
import { confirmedScore, scoreReceipt } from '../src/scoreReceipt.ts'

const task = (score, confirmedAt = '2026-09-23T12:00:00Z', id = 'task-a') => ({ id, score, confirmedAt })

test('an initial confirmed score has no invented baseline or increase', () => {
  assert.deepEqual(scoreReceipt(null, task(30)), {
    taskId: 'task-a', before: null, after: 30, delta: null, tone: 'first',
  })
})

test('a second confirmation reports the real increase, unchanged score, or decrease', () => {
  const previous = confirmedScore(task(30))
  for (const [next, delta, tone] of [[80, 50, 'improved'], [30, 0, 'unchanged'], [10, -20, 'decreased']]) {
    assert.deepEqual(scoreReceipt(previous, task(next)), {
      taskId: 'task-a', before: 30, after: next, delta, tone,
    })
  }
})

test('a verified zero is a valid baseline', () => {
  assert.equal(scoreReceipt(confirmedScore(task(0)), task(20)).delta, 20)
})

test('drafts and invalid scores never produce a confirmation receipt', () => {
  for (const next of [null, task(30, null), task(null), task(NaN), task(-1), task(101)]) {
    assert.equal(confirmedScore(next), null)
    assert.equal(scoreReceipt(null, next), null)
  }
})

test('switching tasks cannot reuse the previous task score as a baseline', () => {
  const result = scoreReceipt(confirmedScore(task(90)), task(30, '2026-09-23T12:00:00Z', 'task-b'))
  assert.equal(result.before, null)
  assert.equal(result.delta, null)
  assert.equal(result.taskId, 'task-b')
})
