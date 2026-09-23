import test from 'node:test'
import assert from 'node:assert/strict'
import { teamRank } from '../src/teamRanks.ts'

test('ranks change only at the defined earned point thresholds', () => {
  for (const [points, id] of [[0, 'starter'], [9, 'starter'], [10, 'bronze'], [29, 'bronze'], [30, 'silver'], [59, 'silver'], [60, 'gold'], [99, 'gold'], [100, 'platinum'], [1000, 'platinum']]) {
    assert.equal(teamRank(points).current.id, id)
  }
})

test('progress resets at promotion and completes at the top rank', () => {
  assert.equal(teamRank(20).progress, 50)
  assert.equal(teamRank(20).remaining, 10)
  assert.equal(teamRank(30).progress, 0)
  assert.equal(teamRank(30).remaining, 30)
  assert.equal(teamRank(100).next, null)
  assert.equal(teamRank(100).progress, 100)
  for (const invalid of [-10, NaN, Infinity]) assert.equal(teamRank(invalid).points, 0)
})
