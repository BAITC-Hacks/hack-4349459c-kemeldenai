import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, api } from './api'
import type { Milestone } from './types'

interface Props {
  proposalId: string
  onConfirmed: (milestone: Milestone) => void
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Не удалось загрузить этап. Повторите попытку.'
}

export function MilestonePanel({ proposalId, onConfirmed }: Props) {
  const [milestone, setMilestone] = useState<Milestone | null>(null)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function reload() {
    setLoading(true)
    setLoadFailed(false)
    setError('')
    try {
      const result = await api.milestones(proposalId)
      setMilestone(result[0] ?? null)
    } catch (failure) {
      setLoadFailed(true)
      setError(message(failure))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void reload() }, [proposalId])

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || milestone) return
    const text = description.trim()
    if (!text) {
      setError('Опишите завершённый этап перед подтверждением.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const next = await api.confirmMilestone(proposalId, text)
      setMilestone(next)
      setDescription('')
      onConfirmed(next)
    } catch (failure) {
      setError(message(failure))
      if (failure instanceof ApiError && failure.status === 409) await reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="milestone-panel">
      <div className="milestone-panel__heading"><span className="eyebrow">ПОДТВЕРЖДЁННЫЙ ПРОГРЕСС</span><span className="milestone-panel__points">+10 баллов</span></div>
      {loading ? <p className="muted">Проверяем этап команды…</p> : loadFailed ? null : milestone ? (
        <div className="milestone-panel__done">
          <strong>Этап подтверждён бизнесом</strong>
          <p>{milestone.description}</p>
          <small>Команде начислено {milestone.pointsAwarded} баллов. Повторное начисление недоступно.</small>
        </div>
      ) : (
        <form onSubmit={(event) => void confirm(event)}>
          <p>Когда команда завершит этап, опишите проверенный результат и подтвердите начисление.</p>
          <label className="field"><span className="field__label">Что команда завершила? *</span><textarea rows={2} required disabled={busy} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Например, прототип проверен с заказчиком" /></label>
          <button className="button button--outline" disabled={busy || !!error && !description.trim()} type="submit">{busy ? 'Подтверждаем…' : 'Подтвердить этап и начислить 10 баллов'}</button>
        </form>
      )}
      {error && <div className="milestone-panel__error"><p className="error-message" role="alert">{error}</p><button className="button button--outline" type="button" disabled={busy || loading} onClick={() => void reload()}>Повторить</button></div>}
    </div>
  )
}
