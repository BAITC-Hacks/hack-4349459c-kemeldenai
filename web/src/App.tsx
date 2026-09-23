import { useEffect, useState } from 'react'
import { api } from './api'
import { DemoEntry } from './DemoEntry'
import { clearDemoPersona, readDemoPersona, saveDemoPersona, type DemoPersona } from './demoSession'
import { MilestonePanel } from './MilestonePanel'
import {
  CARD_FIELDS,
  EMPTY_CARD,
  editableFromTask,
  type CardField,
  type ClarifyingQuestion,
  type EditableCard,
  type Milestone,
  type Proposal,
  type ProposalInput,
  type TaskCard,
  type Team,
} from './types'

type Workspace = 'business' | 'student'
type BusinessPage = 'builder' | 'responses'
type ProposalDraft = Omit<ProposalInput, 'teamId'>

const fieldLabels: Record<CardField, string> = {
  title: 'Название задачи',
  industry: 'Отрасль',
  topic: 'Тема',
  description: 'Исходное описание',
  context: 'Контекст',
  need: 'Потребность',
  users: 'Для кого решение',
  dataMaterials: 'Данные и материалы',
  constraints: 'Ограничения',
  expectedResult: 'Ожидаемый результат',
  successCriteria: 'Критерии успеха',
  contact: 'Контакт',
  interaction: 'Формат взаимодействия',
}

const fieldHints: Partial<Record<CardField, string>> = {
  title: 'Например: Сократить время обработки обращений',
  context: 'Что происходит сейчас? Как устроен процесс?',
  need: 'Какую проблему нужно решить и почему это важно?',
  users: 'Кто будет пользоваться результатом?',
  dataMaterials: 'Какие данные, примеры или источники доступны команде?',
  constraints: 'Сроки, доступы, технологии и другие границы',
  expectedResult: 'Какой конкретный результат должна представить команда?',
  successCriteria: 'По каким измеримым признакам вы примете результат?',
  contact: 'Имя и способ связи с представителем бизнеса',
  interaction: 'Как команда сможет задавать вопросы и получать обратную связь?',
}

const readinessLabels = {
  draft: 'Требует уточнения',
  workable: 'Рабочая',
  ready: 'Готовая',
  priority: 'Приоритетная',
} as const

const scoreLabels: Record<string, string> = {
  context: 'Контекст',
  need: 'Потребность',
  dataMaterials: 'Данные и материалы',
  expectedResult: 'Ожидаемый результат',
  successCriteria: 'Критерии успеха',
  constraints: 'Ограничения',
  users: 'Пользователи',
  contact: 'Контакт',
  interaction: 'Взаимодействие',
}

const decisionLabels = {
  pending: 'Ожидает решения',
  selected: 'Выбрана',
  rejected: 'Отклонена',
} as const

const EMPTY_PROPOSAL: ProposalDraft = {
  idea: '', plan: '', timeline: '', prototypeUrl: '',
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Неизвестная ошибка. Повторите попытку.'
}

function displayMissing(value: string) {
  return CARD_FIELDS.includes(value as CardField)
    ? fieldLabels[value as CardField]
    : value
}

function PrototypeLink({ url }: { url: string }) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return <a href={parsed.href} target="_blank" rel="noopener noreferrer">Открыть ссылку ↗</a>
    }
  } catch { /* Invalid or missing URL from API. */ }
  return <span>Корректная ссылка не указана</span>
}

function ScoreRing({ score, compact = false }: { score: number; compact?: boolean }) {
  return (
    <div className={`score-ring ${compact ? 'score-ring--small' : ''}`} style={{ '--score': `${score}%` } as React.CSSProperties} aria-label={`Рейтинг готовности ${score} из 100`}>
      <span className="score-ring__number">{score}</span>
      <span className="score-ring__unit">/ 100</span>
    </div>
  )
}

function ArrowIcon() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h9m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function Field({ label, value, onChange, hint, rows = 3, required = false }: {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  rows?: number
  required?: boolean
}) {
  return (
    <label className="field">
      <span className="field__label">{label}{required && <span className="field__required"> *</span>}</span>
      <textarea rows={rows} required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={hint} />
    </label>
  )
}

function TextInput({ label, value, onChange, placeholder, type = 'text', required = false }: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  required?: boolean
}) {
  return (
    <label className="field">
      <span className="field__label">{label}{required && <span className="field__required"> *</span>}</span>
      <input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  )
}

function App() {
  const [persona, setPersona] = useState<DemoPersona | null>(readDemoPersona)
  const [businessPage, setBusinessPage] = useState<BusinessPage>('builder')
  const [card, setCard] = useState<EditableCard>({ ...EMPTY_CARD })
  const [task, setTask] = useState<TaskCard | null>(null)
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([])
  const [questionSource, setQuestionSource] = useState<'ai' | 'fallback' | null>(null)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [builderBusy, setBuilderBusy] = useState(false)
  const [builderError, setBuilderError] = useState('')
  const [notice, setNotice] = useState('')

  const [tasks, setTasks] = useState<TaskCard[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [teamsLoading, setTeamsLoading] = useState(true)
  const [teamsError, setTeamsError] = useState('')
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [topicFilter, setTopicFilter] = useState('')
  const [readinessFilter, setReadinessFilter] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [proposalForm, setProposalForm] = useState<ProposalDraft>({ ...EMPTY_PROPOSAL })
  const [proposalBusy, setProposalBusy] = useState(false)
  const [proposalError, setProposalError] = useState('')

  const [businessTaskId, setBusinessTaskId] = useState('')
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [proposalsLoading, setProposalsLoading] = useState(false)
  const [proposalsError, setProposalsError] = useState('')
  const [decidingId, setDecidingId] = useState('')

  const activeTeam = persona?.role === 'student' ? teams.find((team) => team.id === persona.teamId) : undefined
  const workspace: Workspace | null = persona?.role === 'business' ? 'business' : activeTeam ? 'student' : null
  const dirty = task !== null && CARD_FIELDS.some((field) => card[field] !== task[field])
  const businessTasks = tasks
  const topics = Array.from(new Set(tasks.map((item) => item.topic).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ru'))
  const visibleTasks = tasks.filter((item) =>
    (!topicFilter || item.topic === topicFilter) &&
    (!readinessFilter || item.readiness === readinessFilter),
  ).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const selectedTask = visibleTasks.find((item) => item.id === selectedTaskId) ?? visibleTasks[0] ?? null

  function updateCard(field: CardField, value: string) {
    setCard((current) => ({ ...current, [field]: value }))
  }

  async function refreshCatalog() {
    setCatalogLoading(true)
    setCatalogError('')
    try {
      const next = await api.tasks()
      setTasks(next)
      setSelectedTaskId((current) => current && next.some((item) => item.id === current)
        ? current
        : next[0]?.id ?? null)
      setBusinessTaskId((current) => current && next.some((item) => item.id === current)
        ? current
        : next[0]?.id ?? '')
    } catch (error) {
      setCatalogError(errorMessage(error))
    } finally {
      setCatalogLoading(false)
    }
  }

  async function refreshTeams() {
    setTeamsLoading(true)
    setTeamsError('')
    try {
      const next = await api.teams()
      setTeams(next)
      setPersona((current) => {
        if (current?.role === 'student' && !next.some((team) => team.id === current.teamId)) {
          clearDemoPersona()
          return null
        }
        return current
      })
    } catch (error) {
      setTeamsError(errorMessage(error))
    } finally {
      setTeamsLoading(false)
    }
  }

  useEffect(() => {
    void refreshCatalog()
    void refreshTeams()
    const savedId = localStorage.getItem('hackalem.currentTaskId')
    if (savedId) {
      void api.task(savedId).then((saved) => {
        setTask(saved)
        setCard(editableFromTask(saved))
      }).catch(() => localStorage.removeItem('hackalem.currentTaskId'))
    }
  }, [])

  useEffect(() => {
    if (!businessTaskId) {
      setProposals([])
      return
    }
    let active = true
    setProposalsLoading(true)
    setProposalsError('')
    void api.proposals(businessTaskId).then((next) => {
      if (active) setProposals(next)
    }).catch((error) => {
      if (active) setProposalsError(errorMessage(error))
    }).finally(() => {
      if (active) setProposalsLoading(false)
    })
    return () => { active = false }
  }, [businessTaskId])

  async function analyze() {
    setBuilderError('')
    setNotice('')
    if (card.description.trim().length < 8) {
      setBuilderError('Добавьте хотя бы одно предложение о задаче, чтобы получить уточняющие вопросы.')
      return
    }
    setBuilderBusy(true)
    try {
      const result = await api.analyze(card.description, card.industry, card)
      if (!Array.isArray(result.questions) || result.questions.length < 3) {
        throw new Error('Сервер вернул меньше трёх вопросов. Повторите попытку.')
      }
      setQuestions(result.questions)
      setQuestionSource(result.source)
      setAnswers({})
      setNotice('Вопросы готовы. Ответы можно перенести в редактируемую карточку.')
    } catch (error) {
      setBuilderError(errorMessage(error))
    } finally {
      setBuilderBusy(false)
    }
  }

  function applyAnswers() {
    setCard((current) => {
      const next = { ...current }
      questions.forEach((item, index) => {
        const answer = answers[index]?.trim()
        if (!answer) return
        if (CARD_FIELDS.includes(item.field as CardField)) {
          const field = item.field as CardField
          next[field] = next[field].trim() ? `${next[field].trim()}\n${answer}` : answer
        } else {
          next.description = `${next.description.trim()}\n${answer}`.trim()
        }
      })
      return next
    })
    setNotice('Ответы перенесены. Проверьте и подтвердите текст карточки перед публикацией.')
  }

  function keepTask(next: TaskCard) {
    setTask(next)
    setCard(editableFromTask(next))
    localStorage.setItem('hackalem.currentTaskId', next.id)
  }

  async function saveDraft() {
    setBuilderError('')
    setNotice('')
    setBuilderBusy(true)
    try {
      if (task?.status === 'published') {
        throw new Error('Опубликованную задачу обновляют через подтверждение изменений.')
      }
      const next = task ? await api.saveDraft(task.id, card) : await api.createTask(card)
      keepTask(next)
      setNotice('Черновик сохранён. Подтвердите карточку, чтобы обновить рейтинг.')
    } catch (error) {
      setBuilderError(errorMessage(error))
    } finally {
      setBuilderBusy(false)
    }
  }

  async function confirm() {
    setBuilderError('')
    setNotice('')
    if (!card.title.trim() || !card.description.trim()) {
      setBuilderError('Для подтверждения укажите название и исходное описание. Остальные пробелы покажет рейтинг.')
      return
    }
    setBuilderBusy(true)
    try {
      const id = task?.id ?? (await api.createTask(card)).id
      const next = await api.confirmTask(id, card)
      keepTask(next)
      setNotice(`Карточка подтверждена. Рейтинг готовности: ${next.score} из 100.`)
      if (next.status === 'published') await refreshCatalog()
    } catch (error) {
      setBuilderError(errorMessage(error))
    } finally {
      setBuilderBusy(false)
    }
  }

  async function publish() {
    if (!task || !task.confirmedAt || dirty) {
      setBuilderError('Сначала подтвердите текущую версию карточки.')
      return
    }
    setBuilderBusy(true)
    setBuilderError('')
    setNotice('')
    try {
      const next = await api.publishTask(task.id)
      keepTask(next)
      await refreshCatalog()
      setNotice('Задача опубликована и доступна всем командам, независимо от рейтинга.')
    } catch (error) {
      setBuilderError(errorMessage(error))
    } finally {
      setBuilderBusy(false)
    }
  }

  function newTask() {
    setTask(null)
    setCard({ ...EMPTY_CARD })
    setQuestions([])
    setAnswers({})
    setBuilderError('')
    setNotice('Новая карточка готова к заполнению.')
    localStorage.removeItem('hackalem.currentTaskId')
    setBusinessPage('builder')
  }

  function enterBusiness() {
    const next: DemoPersona = { version: 1, role: 'business' }
    saveDemoPersona(next)
    setPersona(next)
    setBusinessPage(task?.status === 'published' ? 'responses' : 'builder')
    if (task?.status === 'published') void refreshCatalog()
  }

  function enterStudent(teamId: string) {
    if (!teams.some((team) => team.id === teamId)) return
    const next: DemoPersona = { version: 1, role: 'student', teamId }
    saveDemoPersona(next)
    setPersona(next)
    setProposalForm({ ...EMPTY_PROPOSAL })
    setProposalError('')
    void refreshCatalog()
    void refreshTeams()
  }

  function changeParticipant() {
    clearDemoPersona()
    setPersona(null)
    setProposalForm({ ...EMPTY_PROPOSAL })
    setProposalError('')
    setNotice('')
  }

  function milestoneConfirmed(milestone: Milestone) {
    setNotice(`Этап подтверждён. Команде начислено ${milestone.pointsAwarded} баллов.`)
    void refreshTeams()
  }

  async function submitProposal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTask || !activeTeam) return
    setProposalError('')
    setNotice('')
    if (!proposalForm.idea.trim() || !proposalForm.plan.trim() || !proposalForm.timeline.trim() || !proposalForm.prototypeUrl.trim()) {
      setProposalError('Заполните идею, план, срок и ссылку на прототип.')
      return
    }
    try {
      const url = new URL(proposalForm.prototypeUrl.trim())
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error()
    } catch {
      setProposalError('Укажите ссылку на прототип с адресом http:// или https://.')
      return
    }
    setProposalBusy(true)
    try {
      await api.submitProposal(selectedTask.id, { ...proposalForm, teamId: activeTeam.id, prototypeUrl: proposalForm.prototypeUrl.trim() })
      setProposalForm({ ...EMPTY_PROPOSAL })
      setNotice('Предложение отправлено. Решение остаётся за представителем бизнеса.')
      if (businessTaskId === selectedTask.id) setProposals(await api.proposals(selectedTask.id))
    } catch (error) {
      setProposalError(errorMessage(error))
    } finally {
      setProposalBusy(false)
    }
  }

  async function decide(proposal: Proposal, decision: 'selected' | 'rejected') {
    setDecidingId(proposal.id)
    setProposalsError('')
    try {
      const next = await api.decideProposal(proposal.id, decision)
      setProposals((current) => current.map((item) => item.id === next.id ? next : item))
      setNotice(decision === 'selected' ? 'Команда выбрана вручную.' : 'Предложение отклонено.')
    } catch (error) {
      setProposalsError(errorMessage(error))
    } finally {
      setDecidingId('')
    }
  }

  if (!workspace) {
    return <DemoEntry teams={teams} teamsLoading={teamsLoading} teamsError={teamsError} onRetryTeams={() => void refreshTeams()} onBusiness={enterBusiness} onStudent={enterStudent} />
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="AI Sana">
          <span className="brand__mark">S<span>.</span></span>
          <span className="brand__name">AI Sana <small>Практические задачи</small></span>
        </div>
        <div className="persona-header"><span><small>{workspace === 'business' ? 'БИЗНЕС' : 'КОМАНДА'}</small><strong>{workspace === 'business' ? 'Демо-компания' : activeTeam?.name}</strong>{workspace === 'student' && <em>{activeTeam?.progressPoints ?? 0} баллов</em>}</span><button className="button button--outline" type="button" onClick={changeParticipant}>Сменить участника</button></div>
        <span className="topbar__caption">Открытый выбор команд</span>
      </header>

      <main className="main">
        <div className="page-heading">
          <div>
            <p className="eyebrow">AI SANA / {workspace === 'business' ? 'БИЗНЕС' : 'СТУДЕНТЫ'}</p>
            <h1>{workspace === 'business' ? 'Сформулируйте задачу, с которой можно работать' : 'Выберите задачу, которая вам интересна'}</h1>
            <p className="page-heading__lead">{workspace === 'business'
              ? 'Уточните детали, проверьте готовность и опубликуйте задачу для студенческих команд.'
              : 'Все опубликованные задачи открыты для отклика. Рейтинг показывает, насколько они готовы к работе.'}</p>
          </div>
          {workspace === 'business' && <button className="button button--outline page-heading__action" type="button" onClick={newTask}>+ Новая задача</button>}
        </div>

        {notice && <div className="notice" role="status"><span>{notice}</span><button type="button" aria-label="Закрыть уведомление" onClick={() => setNotice('')}>×</button></div>}
        {workspace === 'student' && activeTeam && <div className="team-banner"><div><span>Вы вошли как команда</span><strong>{activeTeam.name}</strong><small>{activeTeam.skills.join(' · ')}</small></div><div className="team-banner__points"><strong>{activeTeam.progressPoints}</strong><span>баллов прогресса</span></div></div>}

        {workspace === 'business' ? (
          <>
            <nav className="subnav" aria-label="Раздел бизнеса">
              <button type="button" aria-current={businessPage === 'builder' ? 'page' : undefined} className={businessPage === 'builder' ? 'is-active' : ''} onClick={() => setBusinessPage('builder')}>Конструктор задачи</button>
              <button type="button" aria-current={businessPage === 'responses' ? 'page' : undefined} className={businessPage === 'responses' ? 'is-active' : ''} onClick={() => { setBusinessPage('responses'); void refreshCatalog() }}>Отклики команд</button>
            </nav>
            {businessPage === 'builder' ? (
              <div className="builder-layout">
                <div className="builder-main">
                  <div className="steps" aria-label="Этапы работы">
                    <span className="steps__item is-active"><b>01</b> Описание</span>
                    <span className={`steps__item ${questions.length ? 'is-active' : ''}`}><b>02</b> Уточнение</span>
                    <span className={`steps__item ${task?.confirmedAt ? 'is-active' : ''}`}><b>03</b> Подтверждение</span>
                    <span className={`steps__item ${task?.status === 'published' ? 'is-active' : ''}`}><b>04</b> Публикация</span>
                  </div>
                  {builderError && <p className="error-message" role="alert">{builderError}</p>}

                  <section className="work-section" aria-labelledby="description-title">
                    <div className="section-heading"><span className="section-heading__number">01</span><div><h2 id="description-title">Начните с простого описания</h2><p>Расскажите о проблеме своими словами. Система поможет увидеть пробелы.</p></div></div>
                    <div className="two-columns">
                      <TextInput label="Отрасль" value={card.industry} onChange={(value) => updateCard('industry', value)} placeholder="Например, образование" />
                      <TextInput label="Тема" value={card.topic} onChange={(value) => updateCard('topic', value)} placeholder="Например, аналитика" />
                    </div>
                    <Field label="Что нужно решить?" value={card.description} onChange={(value) => updateCard('description', value)} hint="Опишите ситуацию или потребность, даже если пока не знаете всех деталей." rows={5} required />
                    <div className="section-actions"><button className="button button--dark" type="button" onClick={() => void analyze()} disabled={builderBusy}>{builderBusy ? 'Анализируем…' : 'Получить уточняющие вопросы'} <ArrowIcon /></button><span className="section-actions__hint">Не менее трёх вопросов по вашей задаче</span></div>
                  </section>

                  {questions.length > 0 && <section className="work-section work-section--questions" aria-labelledby="questions-title">
                    <div className="section-heading"><span className="section-heading__number">02</span><div><h2 id="questions-title">Что стоит уточнить</h2><p>Ответы останутся редактируемыми перед подтверждением карточки.</p></div></div>
                    <div className="question-list">
                      {questions.map((item, index) => <label className="question" key={`${item.field}-${index}`}><span className="question__number">{String(index + 1).padStart(2, '0')}</span><span className="question__body"><span className="question__title">{item.question}</span><textarea rows={2} value={answers[index] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [index]: event.target.value }))} placeholder="Ваш ответ" /></span></label>)}
                    </div>
                    <div className="section-actions"><button className="button button--outline" type="button" onClick={applyAnswers} disabled={!Object.values(answers).some((value) => value.trim())}>Перенести ответы в карточку</button><span className="section-actions__hint">{questionSource === 'fallback' ? 'Локальные вопросы: AI недоступен' : 'Вопросы подготовлены AI'}</span></div>
                  </section>}

                  <section className="work-section" aria-labelledby="card-title">
                    <div className="section-heading"><span className="section-heading__number">03</span><div><h2 id="card-title">Карточка задачи</h2><p>Проверьте каждое поле. Баллы начисляются после вашего подтверждения.</p></div></div>
                    <TextInput label="Название задачи" value={card.title} onChange={(value) => updateCard('title', value)} placeholder={fieldHints.title} required />
                    <div className="two-columns">
                      {(['context', 'need', 'users', 'dataMaterials', 'constraints', 'expectedResult', 'successCriteria', 'contact', 'interaction'] as CardField[]).map((field) => <Field key={field} label={fieldLabels[field]} value={card[field]} onChange={(value) => updateCard(field, value)} hint={fieldHints[field]} />)}
                    </div>
                    {dirty && <p className="inline-note">Есть неподтверждённые изменения. Публичный рейтинг пока не изменился.</p>}
                    <div className="card-actions">
                      {task?.status !== 'published' && <button className="button button--outline" type="button" onClick={() => void saveDraft()} disabled={builderBusy}>Сохранить черновик</button>}
                      <button className="button button--dark" type="button" onClick={() => void confirm()} disabled={builderBusy}>{builderBusy ? 'Сохраняем…' : task?.confirmedAt ? 'Подтвердить изменения' : 'Подтвердить карточку'} <ArrowIcon /></button>
                      {task?.status !== 'published' && <button className="button button--accent" type="button" onClick={() => void publish()} disabled={builderBusy || !task?.confirmedAt || dirty}>Опубликовать</button>}
                    </div>
                  </section>
                </div>

                <aside className="score-panel" aria-label="Рейтинг готовности задачи">
                  <p className="eyebrow">ГОТОВНОСТЬ ЗАДАЧИ</p>
                  <div className="score-panel__top"><ScoreRing score={task?.score ?? 0} /><div><span className="score-panel__label">{task?.confirmedAt ? readinessLabels[task.readiness] : 'Пока не подтверждена'}</span><p>{task?.status === 'published' ? 'Опубликована в каталоге' : 'Черновик задачи'}</p></div></div>
                  <div className="score-panel__divider" />
                  <h3>Как складывается рейтинг</h3>
                  {task?.breakdown?.length ? <div className="score-breakdown">{task.breakdown.map((part) => <div className="score-breakdown__row" key={part.key}><span>{scoreLabels[part.key] ?? part.label}</span><strong>{part.earned}<small>/{part.maximum}</small></strong></div>)}</div> : <p className="muted">Подтвердите карточку, чтобы увидеть баллы по каждому критерию.</p>}
                  <div className="score-panel__divider" />
                  <h3>Что улучшить</h3>
                  {task?.missing?.length ? <ul className="missing-list">{task.missing.map((item, index) => <li key={`${item}-${index}`}>{displayMissing(item)}</li>)}</ul> : <p className="muted">{task?.confirmedAt ? 'Всё необходимое указано.' : 'После подтверждения появятся рекомендации.'}</p>}
                  <p className="score-panel__footnote">Низкий рейтинг не скрывает опубликованную задачу и не запрещает отклик.</p>
                </aside>
              </div>
            ) : (
              <section className="responses-layout" aria-labelledby="responses-title">
                <div className="responses-intro"><div><p className="eyebrow">РЕШЕНИЕ ЗА БИЗНЕСОМ</p><h2 id="responses-title">Отклики команд</h2><p>Сравните предложения и выберите одну, несколько или ни одной команды.</p></div><button className="button button--outline" onClick={() => void refreshCatalog()} type="button">Обновить список</button></div>
                {catalogLoading && <p className="state-message">Загружаем опубликованные задачи…</p>}
                {catalogError && <p className="error-message" role="alert">{catalogError}</p>}
                <label className="field field--narrow"><span className="field__label">Задача</span><select value={businessTaskId} onChange={(event) => setBusinessTaskId(event.target.value)} disabled={!businessTasks.length}><option value="">Выберите задачу</option>{businessTasks.map((item) => <option key={item.id} value={item.id}>{item.title || 'Без названия'} · {item.score}/100</option>)}</select></label>
                {!catalogLoading && !businessTasks.length && !catalogError && <p className="state-message">Пока нет опубликованных задач. Опубликуйте карточку в конструкторе.</p>}
                {proposalsLoading && <p className="state-message">Загружаем отклики…</p>}
                {proposalsError && <p className="error-message" role="alert">{proposalsError}</p>}
                {!proposalsLoading && businessTaskId && !proposals.length && !proposalsError && <p className="state-message">На эту задачу ещё нет предложений.</p>}
                <div className="proposal-list">{proposals.map((item) => (
                  <article className="proposal-card" key={item.id}>
                    <div className="proposal-card__head"><div><p className="eyebrow">ПРЕДЛОЖЕНИЕ КОМАНДЫ</p><h3>{teams.find((team) => team.id === item.teamId)?.name ?? 'Команда'}</h3></div><span className={`decision decision--${item.decision}`}>{decisionLabels[item.decision]}</span></div>
                    <div className="proposal-card__content"><div><span>Идея решения</span><p>{item.idea}</p></div><div><span>План работы</span><p>{item.plan}</p></div><div><span>Срок</span><p>{item.timeline}</p></div><div><span>Прототип</span><p><PrototypeLink url={item.prototypeUrl} /></p></div></div>
                    <div className="proposal-card__actions"><button className="button button--accent" type="button" disabled={decidingId === item.id || item.decision === 'selected'} onClick={() => void decide(item, 'selected')}>Выбрать команду</button><button className="button button--outline" type="button" disabled={decidingId === item.id || item.decision === 'rejected'} onClick={() => void decide(item, 'rejected')}>Отклонить</button></div>
                    {item.decision === 'selected' && <MilestonePanel proposalId={item.id} onConfirmed={milestoneConfirmed} />}
                  </article>
                ))}</div>
              </section>
            )}
          </>
        ) : (
          <section className="catalog" aria-labelledby="catalog-title">
            <div className="catalog__toolbar"><div><p className="eyebrow">ОТКРЫТЫЙ КАТАЛОГ</p><h2 id="catalog-title">Задачи для команд <span>{visibleTasks.length}</span></h2></div><button className="button button--outline" type="button" onClick={() => void refreshCatalog()}>Обновить</button></div>
            <div className="filters"><label className="field"><span className="field__label">Тема</span><select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}><option value="">Все темы</option>{topics.map((topic) => <option value={topic} key={topic}>{topic}</option>)}</select></label><label className="field"><span className="field__label">Готовность</span><select value={readinessFilter} onChange={(event) => setReadinessFilter(event.target.value)}><option value="">Любая готовность</option><option value="draft">Требует уточнения · 0–39</option><option value="workable">Рабочая · 40–69</option><option value="ready">Готовая · 70–89</option><option value="priority">Приоритетная · 90–100</option></select></label><p>Сортировка: по рейтингу ↓</p></div>
            {catalogLoading && <p className="state-message">Загружаем каталог…</p>}
            {catalogError && <p className="error-message" role="alert">{catalogError}</p>}
            {!catalogLoading && !visibleTasks.length && !catalogError && <p className="state-message">Задач с такими параметрами пока нет. Попробуйте изменить фильтры.</p>}
            <div className="catalog__columns">
              <div className="task-list">{visibleTasks.map((item) => <button type="button" key={item.id} className={`task-tile ${selectedTask?.id === item.id ? 'is-selected' : ''}`} onClick={() => { setSelectedTaskId(item.id); setProposalError('') }} aria-pressed={selectedTask?.id === item.id}><div className="task-tile__meta"><span>{item.industry || 'Отрасль не указана'}</span><span>{item.topic || 'Без темы'}</span></div><h3>{item.title || 'Задача без названия'}</h3><p>{item.need || item.description || 'Описание появится после уточнения.'}</p><div className="task-tile__foot"><span className={`readiness readiness--${item.readiness}`}>{readinessLabels[item.readiness]}</span><strong>{item.score}<small>/100</small></strong></div></button>)}</div>
              {selectedTask && <article className="task-detail"><div className="task-detail__head"><span className="eyebrow">КАРТОЧКА ЗАДАЧИ</span><ScoreRing score={selectedTask.score ?? 0} compact /></div><h2>{selectedTask.title || 'Задача без названия'}</h2><p className="task-detail__meta">{selectedTask.industry || 'Отрасль не указана'} · {selectedTask.topic || 'Без темы'}</p><p className="task-detail__summary">{selectedTask.description}</p><div className="task-detail__facts">{(['context', 'need', 'users', 'dataMaterials', 'constraints', 'expectedResult', 'successCriteria', 'contact', 'interaction'] as CardField[]).map((field) => <div key={field}><span>{fieldLabels[field]}</span><p>{selectedTask[field]?.trim() || 'Пока не указано'}</p></div>)}</div><div className="task-detail__bottom"><span className={`readiness readiness--${selectedTask.readiness}`}>{readinessLabels[selectedTask.readiness]}</span><p>Даже при низком рейтинге команда может отправить предложение.</p></div><form className="proposal-form" onSubmit={(event) => void submitProposal(event)}><div className="section-heading"><span className="section-heading__number">↗</span><div><h3>Предложить решение</h3><p>Опишите подход. Выбор команды останется за бизнесом.</p></div></div><p className="proposal-form__team">Предложение отправляет команда <strong>{activeTeam?.name}</strong></p><Field label="Идея решения" required value={proposalForm.idea} onChange={(value) => setProposalForm((current) => ({ ...current, idea: value }))} hint="Как вы предлагаете решить задачу?" /><Field label="План работы" required value={proposalForm.plan} onChange={(value) => setProposalForm((current) => ({ ...current, plan: value }))} hint="Основные этапы работы" /><div className="two-columns"><TextInput label="Срок" required value={proposalForm.timeline} onChange={(value) => setProposalForm((current) => ({ ...current, timeline: value }))} placeholder="Например, 2 недели" /><TextInput label="Ссылка на прототип" required type="url" value={proposalForm.prototypeUrl} onChange={(value) => setProposalForm((current) => ({ ...current, prototypeUrl: value }))} placeholder="https://…" /></div>{proposalError && <p className="error-message" role="alert">{proposalError}</p>}<button className="button button--accent" disabled={proposalBusy} type="submit">{proposalBusy ? 'Отправляем…' : 'Отправить предложение'} <ArrowIcon /></button></form></article>}
            </div>
          </section>
        )}
      </main>
      <footer className="footer"><span>AI Sana / HackAlem</span><span>Задачи открыты. Решение — за людьми.</span></footer>
    </div>
  )
}

export default App
