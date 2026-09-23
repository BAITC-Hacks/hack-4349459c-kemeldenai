import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogTopics, matchesTopic } from '../src/catalogTopics.ts'

test('topic options combine padded labels and exclude blank topics without changing cards', () => {
  const cards = Object.freeze([
    Object.freeze({ topic: ' Экология ' }),
    Object.freeze({ topic: 'Экология' }),
    Object.freeze({ topic: 'Аналитика' }),
    Object.freeze({ topic: '' }),
    Object.freeze({ topic: '   ' }),
  ])
  assert.deepEqual(catalogTopics(cards), ['Аналитика', 'Экология'])
  assert.deepEqual(cards.map((card) => card.topic), [' Экология ', 'Экология', 'Аналитика', '', '   '])
})

test('a topic selection includes plain and padded cards but excludes unrelated topics', () => {
  const cards = [
    { id: 'padded', topic: ' Экология ' },
    { id: 'plain', topic: 'Экология' },
    { id: 'other', topic: 'Аналитика' },
  ]
  for (const selected of ['Экология', ' Экология ']) {
    assert.deepEqual(cards.filter((card) => matchesTopic(card.topic, selected)).map((card) => card.id), ['padded', 'plain'])
  }
})

test('clearing the topic filter includes cards with and without topics', () => {
  for (const topic of ['Экология', ' Экология ', '', '   ']) {
    assert.equal(matchesTopic(topic, ''), true)
  }
  assert.deepEqual(catalogTopics([]), [])
})
