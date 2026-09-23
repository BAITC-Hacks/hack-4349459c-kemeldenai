import { useState } from 'react'
import type { TaskCard } from './types'
import type { ProposalDraft } from './proposalDraftStorage'
import { applyAssistance, ASSISTED_FIELDS, suggestPlan, type AssistedField } from './proposalAssistance'

const labels = { idea: 'Идея решения', plan: 'План работы', timeline: 'Срок' }

export function ProposalAssistant({ task, draft, disabled, onApply }: {
  task: TaskCard
  draft: ProposalDraft
  disabled: boolean
  onApply: (draft: ProposalDraft) => void
}) {
  const [preview, setPreview] = useState<Pick<ProposalDraft, AssistedField> | null>(null)
  const [original, setOriginal] = useState('')
  const [selected, setSelected] = useState<AssistedField[]>([])
  const [error, setError] = useState('')
  const [applied, setApplied] = useState(false)
  function prepare() {
    setPreview({ idea: draft.idea, plan: draft.plan || suggestPlan(task), timeline: draft.timeline })
    setOriginal(JSON.stringify(draft))
    setSelected(ASSISTED_FIELDS.filter((field) => !draft[field].trim()))
    setError('')
    setApplied(false)
  }
  function apply() {
    if (!preview || disabled) return
    if (JSON.stringify(draft) !== original) {
      setError('Основной черновик изменился. Создайте предпросмотр заново, чтобы не потерять правки.')
      return
    }
    try {
      onApply(applyAssistance(draft, preview, selected))
      setPreview(null)
      setApplied(true)
      setError('')
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Проверьте выбранные поля.') }
  }
  return <details className="proposal-assistant">
    <summary>Помочь составить отклик</summary>
    <p>Начните с плана по требованиям карточки, добавьте свой подход и реальный срок. Это редактируемый шаблон — проверьте каждый шаг перед отправкой.</p>
    <div className="assistant-brief"><strong>На что ответить в предложении</strong><p><b>Потребность:</b> {task.need.trim() || 'Нужно уточнить у заказчика.'}</p><p><b>Ожидаемый результат:</b> {task.expectedResult.trim() || 'Нужно согласовать с заказчиком.'}</p><p><b>Проверка успеха:</b> {task.successCriteria.trim() || 'Критерии пока не указаны.'}</p></div>
    <button type="button" className="button button--outline" disabled={disabled} onClick={prepare}>{preview ? 'Создать предпросмотр заново' : 'Подготовить черновик'}</button>
    {preview && <fieldset disabled={disabled} className="assistant-preview"><legend>Проверьте и отредактируйте</legend><p>Предпросмотр ещё не сохранён. Выберите поля для переноса. Уже заполненные поля не выбраны автоматически.</p>
      {ASSISTED_FIELDS.map((field) => <div key={field}><label className="assistant-select"><input type="checkbox" checked={selected.includes(field)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, field] : current.filter((item) => item !== field))} />Перенести: {labels[field]}{draft[field].trim() && ' — заменит текущий текст'}</label><label className="field"><span className="field__label">{labels[field]} в предпросмотре</span><textarea rows={field === 'plan' ? 8 : 3} maxLength={field === 'timeline' ? 300 : 12000} value={preview[field]} onChange={(event) => setPreview({ ...preview, [field]: event.target.value })} placeholder={field === 'idea' ? 'Как именно ваша команда предлагает решить задачу?' : field === 'timeline' ? 'Укажите срок, который команда действительно может выдержать.' : ''} /></label></div>)}
      <p>Ссылку на настоящий прототип добавьте в основной форме.</p>
      <button type="button" className="button button--dark" disabled={!selected.length} onClick={apply}>Перенести выбранные поля</button> <button type="button" className="button button--text" onClick={() => { setPreview(null); setError('') }}>Отменить предпросмотр</button>
    </fieldset>}
    {error && <p className="error-message" role="alert">{error}</p>}
    {applied && <p role="status">Поля перенесены в черновик. Проверьте форму ниже перед отправкой.</p>}
  </details>
}
