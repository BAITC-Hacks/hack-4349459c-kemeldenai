import type { CardField, SuggestedField } from './types.ts'

export function reconcileTaskSuggestions(previous: SuggestedField[], incoming: SuggestedField[], edits: Record<string, string>) {
  const retainedEdits = incoming.filter((item) => Object.hasOwn(edits, item.field) && previous.some((old) =>
    old.field === item.field && old.value === item.value && old.evidence === item.evidence,
  ))
  return {
    suggestions: [...incoming],
    edits: Object.fromEntries(retainedEdits.map((item) => [item.field, edits[item.field]])),
  }
}

export function removeSuggestionEdit(edits: Record<string, string>, field: CardField): Record<string, string> {
  return Object.fromEntries(Object.entries(edits).filter(([key]) => key !== field))
}
