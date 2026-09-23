import { RankBadge } from './TeamRank'
import { useEffect, useState } from 'react'
import type { Team } from './types'

interface Props {
  teams: Team[]
  teamsLoading: boolean
  teamsError: string
  onRetryTeams: () => void
  onBusiness: () => void
  onStudent: (teamId: string) => void
}

export function DemoEntry({ teams, teamsLoading, teamsError, onRetryTeams, onBusiness, onStudent }: Props) {
  const [teamId, setTeamId] = useState('')

  useEffect(() => {
    setTeamId((current) => teams.some((team) => team.id === current)
      ? current
      : teams.find((team) => team.name === 'Data Nomads')?.id ?? teams[0]?.id ?? '')
  }, [teams])

  const team = teams.find((item) => item.id === teamId)

  return (
    <div className="app-shell">
      <header className="topbar topbar--entry">
        <div className="brand" aria-label="AI Sana">
          <span className="brand__mark">S<span>.</span></span>
          <span className="brand__name">AI Sana <small>Практические задачи</small></span>
        </div>
        <span className="demo-badge">ДЕМО-ВХОД</span>
      </header>
      <main className="entry-main">
        <div className="entry-intro">
          <p className="eyebrow">AI SANA / ПРАКТИЧЕСКИЕ ЗАДАЧИ</p>
          <h1>Выберите, как войти в демо</h1>
          <p>Бизнес публикует задачу и выбирает команды. Студенческая команда находит задачу и предлагает решение. Переключиться между участниками можно в любой момент.</p>
        </div>
        <div className="persona-grid">
          <section className="persona-card persona-card--business" aria-labelledby="business-entry-title">
            <span className="persona-card__number">01 / БИЗНЕС</span>
            <div className="persona-card__icon" aria-hidden="true">↗</div>
            <h2 id="business-entry-title">Опубликовать задачу</h2>
            <p>Уточните потребность, проверьте рейтинг готовности и вручную решите, с кем работать.</p>
            <div className="persona-card__identity">
              <span>Демо-профиль</span>
              <strong>Представитель бизнеса</strong>
              <small>Демо-компания</small>
            </div>
            <button className="button button--dark" type="button" onClick={onBusiness}>Войти как бизнес <span aria-hidden="true">→</span></button>
          </section>

          <section className="persona-card persona-card--student" aria-labelledby="student-entry-title">
            <span className="persona-card__number">02 / СТУДЕНТЫ</span>
            <div className="persona-card__icon" aria-hidden="true">✦</div>
            <h2 id="student-entry-title">Предложить решение</h2>
            <p>Выберите свою демо-команду, изучите открытый каталог и отправьте предложение бизнесу.</p>
            <label className="field">
              <span className="field__label">Команда</span>
              <select value={teamId} onChange={(event) => setTeamId(event.target.value)} disabled={teamsLoading || !!teamsError || !teams.length}>
                {teamsLoading && <option value="">Загружаем команды…</option>}
                {!teamsLoading && !teams.length && <option value="">Команды пока недоступны</option>}
                {teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            {team && <div className="persona-card__team"><span>Навыки команды</span><strong>{team.skills.join(' · ')}</strong><RankBadge points={team.progressPoints} /><small>{team.progressPoints} баллов прогресса</small></div>}
            {teamsError && <div className="entry-error"><p role="alert">{teamsError}</p><button type="button" onClick={onRetryTeams}>Повторить загрузку</button></div>}
            <button className="button button--accent" type="button" disabled={!team} onClick={() => onStudent(teamId)}>Войти как команда <span aria-hidden="true">→</span></button>
          </section>
        </div>
        <p className="entry-footnote">Это демонстрационные профили без паролей и регистрации.</p>
      </main>
      <footer className="footer"><span>AI Sana / HackAlem</span><span>Задачи открыты. Решение — за людьми.</span></footer>
    </div>
  )
}
