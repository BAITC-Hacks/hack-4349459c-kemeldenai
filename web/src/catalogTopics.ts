export function catalogTopics(cards: readonly { topic: string }[]): string[] {
  return Array.from(new Set(cards.map((item) => item.topic.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ru'))
}

export function matchesTopic(topic: string, selected: string): boolean {
  return !selected.trim() || topic.trim() === selected.trim()
}
