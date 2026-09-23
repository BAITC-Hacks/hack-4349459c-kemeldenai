import assert from 'node:assert/strict'
import test from 'node:test'
import { reconcileTaskSuggestions, removeSuggestionEdit } from '../src/taskSuggestions.ts'

const oldContact = { field: 'contact', value: 'Алия', evidence: 'Контакт: Алия.' }
const newContact = { field: 'contact', value: 'Бекзат', evidence: 'Контакт: Бекзат.' }
const users = { field: 'users', value: 'Менеджеры', evidence: 'Сервис для менеджеров.' }

test('fresh analysis replaces changed proposals and removes obsolete evidence and edits', () => {
  const previous = [oldContact, users]
  const edits = { contact: 'Алия, руководитель', users: 'Менеджеры продаж' }
  const result = reconcileTaskSuggestions(previous, [newContact], edits)
  assert.deepEqual(result.suggestions, [newContact])
  assert.deepEqual(result.edits, {})
  assert.deepEqual(previous, [oldContact, users])
  assert.deepEqual(edits, { contact: 'Алия, руководитель', users: 'Менеджеры продаж' })
})

test('typed edits survive refresh only when field, value, and evidence all match', () => {
  const edits = { contact: 'Алия, руководитель', users: '' }
  const result = reconcileTaskSuggestions([oldContact, users], [{ ...users }, { ...oldContact }], edits)
  assert.deepEqual(result.suggestions, [users, oldContact])
  assert.deepEqual(result.edits, edits)
  for (const changed of [
    { ...oldContact, value: 'Динара' },
    { ...oldContact, evidence: 'Новое описание контакта: Алия.' },
    { ...oldContact, field: 'users' },
  ]) {
    assert.deepEqual(reconcileTaskSuggestions([oldContact], [changed], edits).edits, {})
  }
})

test('a result with no grounded suggestions clears previous proposals and edits', () => {
  assert.deepEqual(reconcileTaskSuggestions([oldContact], [], { contact: 'Старый текст' }), {
    suggestions: [], edits: {},
  })
})

test('accepting or rejecting one suggestion clears only its edit before regeneration', () => {
  const edits = { contact: 'Старое исправление', users: 'Менеджеры продаж' }
  const remainingEdits = removeSuggestionEdit(edits, 'contact')
  assert.deepEqual(remainingEdits, { users: 'Менеджеры продаж' })
  assert.deepEqual(edits, { contact: 'Старое исправление', users: 'Менеджеры продаж' })
  assert.deepEqual(reconcileTaskSuggestions([users], [oldContact, users], remainingEdits).edits, {
    users: 'Менеджеры продаж',
  })
})

test('inherited edits are never attached to a current suggestion', () => {
  const edits = Object.create({ contact: 'Не сохранённое собственное значение' })
  assert.deepEqual(reconcileTaskSuggestions([oldContact], [oldContact], edits).edits, {})
})
