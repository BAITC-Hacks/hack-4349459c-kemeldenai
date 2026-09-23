import { useRef, useState } from 'react'
import { persistProposalDraft, readProposalDrafts, type ProposalDraft } from './proposalDraftStorage'

const empty: ProposalDraft = { idea: '', plan: '', timeline: '', prototypeUrl: '' }

function restore() {
  try { return readProposalDrafts(window.localStorage) }
  catch { return { drafts: {} as Record<string, ProposalDraft>, error: 'Браузер не разрешил загрузить черновики.' } }
}

export function useProposalDrafts() {
  const [initial] = useState(restore)
  const [drafts, setDrafts] = useState(initial.drafts)
  const latest = useRef(initial.drafts)
  const [errors, setErrors] = useState<Record<string, string>>({})
  function save(key: string, draft: ProposalDraft) {
    let error = ''
    try { persistProposalDraft(window.localStorage, key, draft) }
    catch { error = 'Не удалось сохранить изменения в браузере. Не закрывайте страницу; повторите сохранение.' }
    setErrors((current) => ({ ...current, [key]: error }))
  }
  function update(key: string, change: ProposalDraft | ((draft: ProposalDraft) => ProposalDraft)) {
    if (!key) return
    const draft = typeof change === 'function' ? change(latest.current[key] ?? empty) : change
    latest.current = { ...latest.current, [key]: draft }
    setDrafts(latest.current)
    // Save during the input event, before a reload can discard a deferred effect.
    save(key, draft)
  }
  return {
    drafts, update, errors, loadError: initial.error,
    unsaved: Object.values(errors).some(Boolean),
    retry: (key: string) => save(key, latest.current[key] ?? empty),
  }
}
