import { useState } from 'react'
import type { TaskCard } from './types'
import type { ProposalDraft } from './proposalDraftStorage'
import { suggestPlan } from './proposalAssistance'

export function ProposalAssistant({ task, draft, disabled, onApply }: {
  task: TaskCard
  draft: ProposalDraft
  disabled: boolean
  onApply: (draft: ProposalDraft) => void
}) {
  const [replacement, setReplacement] = useState<{ plan: string; original: string } | null>(null)
  const [message, setMessage] = useState('')
  function focusPlan() {
    requestAnimationFrame(() => document.getElementById('proposal-plan')?.focus())
  }
  function prepare() {
    const plan = suggestPlan(task)
    setMessage('')
    if (draft.plan.trim()) { setReplacement({ plan, original: draft.plan }); return }
    onApply({ ...draft, plan })
    setMessage('План добавлен. Отредактируйте его в поле «План работы» ниже.')
    focusPlan()
  }
  function replace() {
    if (!replacement || disabled) return
    if (draft.plan !== replacement.original) {
      setReplacement(null)
      setMessage('План изменился. Нажмите «Предложить план» заново, чтобы сохранить ваши последние правки.')
      return
    }
    onApply({ ...draft, plan: replacement.plan })
    setReplacement(null)
    setMessage('План обновлён. Проверьте его перед отправкой.')
    focusPlan()
  }
  return <details className="proposal-assistant">
    <summary>Нужна помощь с откликом?</summary>
    <p>В идее опишите свой подход. В плане — шаги и проверку результата. Укажите срок, который команда сможет выдержать.</p>
    <p><strong>Проверка успеха:</strong> {task.successCriteria.trim() || 'Согласуйте измеримые критерии с заказчиком.'}</p>
    <button type="button" className="button button--outline" disabled={disabled} onClick={prepare}>Предложить план по задаче</button>
    <p className="muted">Редактируемый шаблон появится в основной форме. Идея, срок и ссылка на прототип останутся вашими.</p>
    {replacement && <div className="assistant-replace" role="group" aria-label="Замена существующего плана"><p>У вас уже есть план. Заменить его шаблоном?</p><button type="button" className="button button--outline" disabled={disabled} onClick={replace}>Заменить план</button> <button type="button" className="button button--text" onClick={() => setReplacement(null)}>Оставить мой план</button></div>}
    {message && <p role="status">{message}</p>}
  </details>
}
