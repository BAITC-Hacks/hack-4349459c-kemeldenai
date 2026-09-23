import { useEffect, useState } from 'react'
import { api } from './api'
import type { ApplicationsSnapshot, ProposalDecision } from './types'

const labels: Record<ProposalDecision, string> = {
  pending: 'На рассмотрении', selected: 'Команда выбрана', rejected: 'Отклонено',
}
const guidance: Record<ProposalDecision, string> = {
  pending: 'Предложение отправлено. Ожидайте решения представителя бизнеса.',
  selected: 'Согласуйте работу с представителем бизнеса. Баллы появятся после подтверждения выполненного этапа.',
  rejected: 'Бизнес отклонил предложение. Вы можете продолжить поиск задач в каталоге.',
}
const date = (value: string) => new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

function prototypeLink(value: string) {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null
  } catch { return null }
}

export function MyApplications({ teamId, onOpenTask, onRefreshTeam }: {
  teamId: string
  onOpenTask: (id: string) => void
  onRefreshTeam: () => void
}) {
  const [snapshot, setSnapshot] = useState<ApplicationsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [filter, setFilter] = useState<ProposalDecision | ''>('')
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api.applications(teamId).then((next) => { if (active) setSnapshot(next) })
      .catch((failure) => { if (active) setError(failure instanceof Error ? failure.message : 'Не удалось загрузить отклики.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [teamId, revision])
  const applications = snapshot?.applications ?? []
  const visible = applications.filter((item) => !filter || item.proposal.decision === filter)
  function refresh() { setRevision((value) => value + 1); onRefreshTeam() }
  return <section className="applications" aria-labelledby="applications-title" aria-busy={loading}>
    <div className="catalog__toolbar"><div><h2 id="applications-title">Мои отклики</h2><p>История предложений вашей демо-команды. Нажмите «Обновить», чтобы проверить решения бизнеса.</p></div><button type="button" className="button button--outline" onClick={refresh} disabled={loading}>{loading ? 'Обновляем…' : 'Обновить отклики'}</button></div>
    {error && <p className="error-message" role="alert">{error} {snapshot && 'Показаны ранее загруженные данные.'}<button type="button" className="button button--text" onClick={refresh} disabled={loading}>Повторить</button></p>}
    {loading && !snapshot && <p role="status">Загружаем ваши отклики…</p>}
    {snapshot && <>
      <div className="application-stats"><span>Отправлено <strong>{applications.length}</strong></span><span>На рассмотрении <strong>{applications.filter((item) => item.proposal.decision === 'pending').length}</strong></span><span>Выбрано <strong>{applications.filter((item) => item.proposal.decision === 'selected').length}</strong></span><span>Баллы команды <strong>{snapshot.team.progressPoints}</strong></span></div>
      <label className="field application-filter"><span className="field__label">Статус отклика</span><select value={filter} onChange={(event) => setFilter(event.target.value as ProposalDecision | '')}><option value="">Все статусы</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {!applications.length && <p className="state-message">Вы ещё не отправляли предложения. Найдите задачу в каталоге и предложите решение — статус появится здесь.</p>}
      {applications.length > 0 && !visible.length && <p className="state-message">Откликов с этим статусом пока нет.</p>}
      <div className="proposal-list">{visible.map(({ proposal, taskTitle, taskAvailable, milestones }) => <article className="proposal-card" key={proposal.id}>
        <div className="proposal-card__head"><div><p className="eyebrow">Отправлено {date(proposal.createdAt)}</p><h3>{taskTitle || 'Задача без названия'}</h3></div><span className={`decision decision--${proposal.decision}`}>{labels[proposal.decision]}</span></div>
        <p>{proposal.decision === 'selected' && milestones.length ? 'Выполненный этап подтверждён. Дальнейшие шаги согласуйте с представителем бизнеса.' : guidance[proposal.decision]}</p>
        <p className="application-idea">{proposal.idea}</p>
        <details><summary>Моё предложение</summary><dl className="application-details"><dt>План работы</dt><dd>{proposal.plan}</dd><dt>Срок</dt><dd>{proposal.timeline}</dd><dt>Прототип</dt><dd>{prototypeLink(proposal.prototypeUrl) ? <a href={prototypeLink(proposal.prototypeUrl)!} target="_blank" rel="noopener noreferrer">Открыть прототип ↗</a> : 'Ссылка не указана'}</dd></dl></details>
        {milestones.length ? milestones.map((milestone) => <div className="milestone-panel milestone-panel__done" key={milestone.id}><strong>Этап подтверждён бизнесом · +{milestone.pointsAwarded} баллов</strong><p>{milestone.description}</p><small>{date(milestone.confirmedAt)}</small></div>) : <p className="muted">Подтверждённых этапов пока нет.</p>}
        {taskAvailable ? <button className="button button--outline" type="button" onClick={() => onOpenTask(proposal.taskId)}>Открыть задачу</button> : <p className="muted">Задача больше не доступна в каталоге. Ваш отклик сохранён.</p>}
      </article>)}</div>
    </>}
  </section>
}
