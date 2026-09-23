import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import type { Recommendation, TaskCard, Team } from './types'

export function useRecommendations(team: Team | undefined, tasks: TaskCard[]) {
  const [revision, setRevision] = useState(0)
  const [feedbackBusy, setFeedbackBusy] = useState(false)
  const feedbackLock = useRef(false)
  const [feedbackError, setFeedbackError] = useState({ teamId: '', message: '' })
  const [state, setState] = useState<{ teamId: string; items: Recommendation[]; error: string; loading: boolean }>({ teamId: '', items: [], error: '', loading: false })
  const teamId = team?.id ?? ''
  useEffect(() => {
    if (!teamId) return
    let active = true
    setState((current) => ({ teamId, items: current.teamId === teamId ? current.items : [], error: '', loading: true }))
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
  async function dismiss(taskId: string, dismissed: boolean) {
    if (!teamId || feedbackLock.current) return
    feedbackLock.current = true
    setFeedbackBusy(true)
    setFeedbackError({ teamId, message: '' })
    try {
      await api.setDismissal(teamId, taskId, dismissed)
      setState((current) => current.teamId === teamId ? { ...current, items: current.items.map((item) => item.taskId === taskId ? { ...item, dismissed } : item) } : current)
      setRevision((value) => value + 1)
    } catch { setFeedbackError({ teamId, message: 'Не удалось изменить рекомендацию. Попробуйте ещё раз.' }) }
    finally { feedbackLock.current = false; setFeedbackBusy(false) }
  }
  return {
    dismiss, feedbackBusy, feedbackError: feedbackError.teamId === teamId ? feedbackError.message : '',
    items: state.teamId === teamId ? state.items : [],
    error: state.teamId === teamId ? state.error : '',
    loading: state.teamId !== teamId || state.loading,
    refresh: () => setRevision((value) => value + 1),
    recordClick,
  }
}

export function RecommendationFocus({ team, onSaved, onReset }: { team: Team; onSaved: (team: Team) => void; onReset: () => void }) {
  const [focus, setFocus] = useState(team.interests.join(', '))
  const [skills, setSkills] = useState(team.skills.join(', '))
  const [technologies, setTechnologies] = useState(team.technologies.join(', '))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function save() {
    setBusy(true)
    setMessage('')
    try {
      const interests = focus.split(',').map((value) => value.trim()).filter(Boolean)
      const updated = await api.saveFocus(team.id, interests, skills.split(',').map((value) => value.trim()).filter(Boolean), technologies.split(',').map((value) => value.trim()).filter(Boolean))
      setFocus(updated.interests.join(', '))
      setSkills(updated.skills.join(', '))
      setTechnologies(updated.technologies.join(', '))
      onSaved(updated)
      setMessage('Профиль команды сохранён.')
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
      <label className="field"><span className="field__label">Навыки — через запятую</span><input value={skills} maxLength={972} disabled={busy} onChange={(event) => setSkills(event.target.value)} placeholder="Аналитика, дизайн" /><span className="muted">До 12 навыков, каждый до 80 символов.</span></label>
      <label className="field"><span className="field__label">Технологии — через запятую</span><input value={technologies} maxLength={972} disabled={busy} onChange={(event) => setTechnologies(event.target.value)} placeholder="Python, React" /><span className="muted">До 12 технологий, каждая до 80 символов.</span></label>
      <button className="button button--dark" disabled={busy} type="submit">{busy ? 'Сохраняем…' : 'Сохранить профиль'}</button>
      <button className="button button--text" disabled={busy} type="button" onClick={() => void reset()}>Сбросить историю</button>
    </form>
    {message && <p role="status">{message}</p>}
  </section>
}
