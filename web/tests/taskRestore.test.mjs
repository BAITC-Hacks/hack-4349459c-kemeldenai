import assert from 'node:assert/strict'
import test from 'node:test'
import { restoreTask } from '../src/taskRestore.ts'

const id = '16eb89b7-5a68-4ba5-a241-e2711c33b2b5'
const card = { id, title: 'Сохранённый черновик', status: 'draft' }
const failure = (status) => Object.assign(new Error('Не удалось загрузить карточку.'), { status })

test('temporary failures keep the saved id available for retry', async () => {
  for (const status of [0, 500, 503, 200, 401, 422]) {
    assert.deepEqual(await restoreTask(id, async () => { throw failure(status) }), {
      kind: 'retry', id, message: 'Не удалось загрузить карточку.',
    })
  }
})

test('retry restores the same saved card after a temporary failure', async () => {
  const first = await restoreTask(id, async () => { throw failure(503) })
  assert.equal(first.kind, 'retry')
  const second = await restoreTask(first.id, async (requested) => {
    assert.equal(requested, id)
    return card
  })
  assert.deepEqual(second, { kind: 'restored', task: card })
})

test('a confirmed missing card can release the saved pointer', async () => {
  assert.deepEqual(await restoreTask(id, async () => { throw failure(404) }), { kind: 'missing' })
})

test('invalid saved identifiers are discarded without a request', async () => {
  for (const invalid of ['', 'undefined', '../../tasks', 'not-a-uuid']) {
    let requests = 0
    assert.deepEqual(await restoreTask(invalid, async () => { requests++; return card }), { kind: 'missing' })
    assert.equal(requests, 0)
  }
})

test('successful restoration returns the complete saved snapshot unchanged', async () => {
  assert.deepEqual(await restoreTask(id, async () => card), { kind: 'restored', task: card })
})

test('unknown failures still offer recovery with a readable message', async () => {
  const result = await restoreTask(id, async () => { throw null })
  assert.equal(result.kind, 'retry')
  assert.equal(result.id, id)
  assert.ok(result.message.length > 0)
})
