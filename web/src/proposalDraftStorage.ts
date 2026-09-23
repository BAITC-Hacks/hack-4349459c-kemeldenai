export type ProposalDraft = { idea: string; plan: string; timeline: string; prototypeUrl: string }
export const DRAFT_PREFIX = 'hackalem.proposalDraft.v1:'
const fields = ['idea', 'plan', 'timeline', 'prototypeUrl'] as const
const keyPattern = /^[0-9a-f-]{36}:[0-9a-f-]{36}$/i

export function readProposalDrafts(storage: Storage) {
  const drafts: Record<string, ProposalDraft> = {}
  let error = ''
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index)
      if (!key?.startsWith(DRAFT_PREFIX)) continue
      const id = key.slice(DRAFT_PREFIX.length)
      if (!keyPattern.test(id)) continue
      try {
        const record = JSON.parse(storage.getItem(key) ?? 'null')
        if (record?.version !== 1 || !record.draft || !fields.every((field) => typeof record.draft[field] === 'string')) throw new Error()
        drafts[id] = Object.fromEntries(fields.map((field) => [field, record.draft[field]])) as ProposalDraft
      } catch { error = 'Не удалось восстановить часть черновиков. Повреждённые записи сохранены в браузере.' }
    }
  } catch { error = 'Браузер не разрешил загрузить черновики.' }
  return { drafts, error }
}

export function persistProposalDraft(storage: Storage, key: string, draft: ProposalDraft) {
  if (!keyPattern.test(key)) throw new Error('Invalid team/task key')
  if (fields.every((field) => !draft[field])) storage.removeItem(DRAFT_PREFIX + key)
  else storage.setItem(DRAFT_PREFIX + key, JSON.stringify({ version: 1, draft }))
}
