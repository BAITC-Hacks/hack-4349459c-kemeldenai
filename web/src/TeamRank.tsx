import type { Team } from './types'
import { TEAM_RANKS, teamRank } from './teamRanks'

export function RankBadge({ points }: { points: number }) {
  const { current } = teamRank(points)
  return <span className={`rank-badge rank-badge--${current.id}`}><span aria-hidden="true">◆</span> Ранг: {current.label}</span>
}

export function TeamRank({ team, compact = false }: { team: Team | undefined; compact?: boolean }) {
  if (!team) return <p className="muted">Данные о ранге команды недоступны.</p>
  const rank = teamRank(team.progressPoints)
  return <div className={`team-rank ${compact ? 'team-rank--compact' : ''}`}>
    <div className="team-rank__heading"><RankBadge points={rank.points} /><span>{rank.points} баллов за подтверждённую работу</span></div>
    {!compact && <>
      <p>{rank.next ? `До ранга «${rank.next.label}» осталось ${rank.remaining} баллов.` : 'Высший ранг достигнут. Продолжайте накапливать подтверждённый опыт.'}</p>
      <progress value={rank.progress} max={100} aria-label={rank.next ? `Прогресс до ранга ${rank.next.label}` : 'Высший ранг достигнут'} />
    </>}
    <details><summary>Как считается ранг</summary><p>За один завершённый этап, подтверждённый бизнесом, команда получает 10 баллов. Отправка и выбор предложения не дают баллов. Ранг отражает подтверждённый прогресс, а не оценку качества решения.</p><ol className="rank-ladder">{TEAM_RANKS.map((item) => <li key={item.id} aria-current={item.id === rank.current.id ? 'step' : undefined}><strong>{item.label}</strong><span>от {item.minimum} баллов</span></li>)}</ol></details>
  </div>
}
