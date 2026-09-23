import { useEffect, useState } from 'react'
import { api } from './api'
import type { Recommendation, TaskCard, Team } from './types'

export function useRecommendations(team: Team | undefined, tasks: TaskCard[]) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{ teamId: string; items: Recommendation[]; error: string; loading: boolean }>({ teamId: '', items: [], error: '', loading: false })
  const teamId = team?.id ?? ''
  useEffect(() => {
    if (!teamId) return
    let active = true
    setState({ teamId, items: [], error: '', loading: true })
    api.recommendations(teamId).then((items) => {
      if (active) setState({ teamId, items, error: '', loading: false })
    }).catch(() => {
      if (active) setState({ teamId, items: [], error: 'Рекомендации недоступны. Задачи отсортированы по готовности.', loading: false })
    })
    return () => { active = false }
  }, [team, teamId, tasks, revision])

  function recordClick(taskId: string) {
    if (!teamId) return
    void api.recordClick(teamId, taskId).then(() => setRevision((value) => value + 1)).catch(() => {
      setState((current) => current.teamId === teamId ? { ...current, error: 'Не удалось сохранить просмотр. Открыть задачу и отправить предложение можно.' } : current)
    })
  }
  return {
    items: state.teamId === teamId ? state.items : [],
    error: state.teamId === teamId ? state.error : '',
    loading: state.teamId !== teamId || state.loading,
    refresh: () => setRevision((value) => value + 1),
    recordClick,
  }
}

export function RecommendationFocus({ team, onSaved, onReset }: { team: Team; onSaved: (team: Team) => void; onReset: () => void }) {
  const [focus, setFocus] = useState(team.interests.join(', '))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function save() {
    setBusy(true)
    setMessage('')
    try {
      const interests = focus.split(',').map((value) => value.trim()).filter(Boolean)
      const updated = await api.saveFocus(team.id, interests)
      setFocus(updated.interests.join(', '))
      onSaved(updated)
      setMessage('Фокус команды сохранён.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось сохранить фокус.') }
    finally { setBusy(false) }
  }
  async function reset() {
    setBusy(true)
    setMessage('')
    try {
      await api.clearClicks(team.id)
      onReset()
      setMessage('История просмотров команды очищена.')
    } catch { setMessage('Не удалось очистить историю. Попробуйте ещё раз.') }
    finally { setBusy(false) }
  }
  return <section className="recommendation-focus" aria-label="Настройки рекомендаций">
    <div><strong>Подбираем задачи для {team.name}</strong><p>Учитываем фокус, навыки и открытые вами карточки. История и настройки общие для выбранной демо-команды.</p></div>
    <form onSubmit={(event) => { event.preventDefault(); void save() }}>
      <label className="field"><span className="field__label">Фокус команды — через запятую</span><input value={focus} maxLength={972} disabled={busy} onChange={(event) => setFocus(event.target.value)} placeholder="Экология, аналитика, карты" /><span className="muted">До 12 направлений, каждое до 80 символов.</span></label>
      <button className="button button--dark" disabled={busy} type="submit">{busy ? 'Сохраняем…' : 'Сохранить фокус'}</button>
      <button className="button button--text" disabled={busy} type="button" onClick={() => void reset()}>Сбросить историю</button>
    </form>
    {message && <p role="status">{message}</p>}
  </section>
}
