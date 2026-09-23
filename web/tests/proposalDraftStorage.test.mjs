import assert from 'node:assert/strict'
import test from 'node:test'
import { DRAFT_PREFIX, persistProposalDraft, readProposalDrafts } from '../src/proposalDraftStorage.ts'

const team = '00000000-0000-0000-0000-000000000001'
const task = '00000000-0000-0000-0000-000000000002'
const other = '00000000-0000-0000-0000-000000000003'
const key = `${team}:${task}`
const draft = { idea: 'Идея\nв две строки', plan: 'План', timeline: '2 недели', prototypeUrl: 'https://example.org/demo' }
const empty = { idea: '', plan: '', timeline: '', prototypeUrl: '' }
function storage() {
  const records = new Map()
  return {
    get length() { return records.size }, key: (index) => [...records.keys()][index],
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value), removeItem: (key) => records.delete(key),
  }
}

test('reload restores exact fields with independent team and task drafts', () => {
  const disk = storage()
  persistProposalDraft(disk, key, draft)
  persistProposalDraft(disk, `${other}:${task}`, { ...draft, idea: 'Другая команда' })
  persistProposalDraft(disk, `${team}:${other}`, { ...draft, idea: 'Другая задача' })
  const restored = readProposalDrafts(disk)
  assert.equal(restored.error, '')
  assert.deepEqual(restored.drafts[key], draft)
  assert.equal(restored.drafts[`${other}:${task}`].idea, 'Другая команда')
  assert.equal(restored.drafts[`${team}:${other}`].idea, 'Другая задача')
  persistProposalDraft(disk, key, empty)
  assert.equal(readProposalDrafts(disk).drafts[key], undefined)
  assert.equal(Object.keys(readProposalDrafts(disk).drafts).length, 2)
})

test('invalid records do not erase valid drafts or crash restoration', () => {
  const disk = storage()
  persistProposalDraft(disk, key, draft)
  disk.setItem(DRAFT_PREFIX + `${other}:${task}`, '{broken')
  disk.setItem(DRAFT_PREFIX + `${task}:${other}`, JSON.stringify({ version: 1, draft: { idea: 42 } }))
  const result = readProposalDrafts(disk)
  assert.deepEqual(result.drafts[key], draft)
  assert.ok(result.error)
  assert.equal(disk.length, 3)
})

test('storage write and deletion failures surface instead of pretending to save', () => {
  const disk = storage()
  disk.setItem = () => { throw new Error('Quota exceeded') }
  disk.removeItem = () => { throw new Error('Storage denied') }
  assert.throws(() => persistProposalDraft(disk, key, draft), /Quota/)
  assert.throws(() => persistProposalDraft(disk, key, empty), /denied/)
  const unavailable = { get length() { throw new Error('Access denied') } }
  assert.ok(readProposalDrafts(unavailable).error)
})
