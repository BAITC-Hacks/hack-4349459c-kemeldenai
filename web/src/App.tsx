import { useEffect, useId, useRef, useState } from 'react'
import { transferClarificationAnswers } from './clarificationAnswers'
import { reconcileTaskSuggestions, removeSuggestionEdit } from './taskSuggestions'
import { restoreTask } from './taskRestore'
import { catalogTopics, matchesTopic } from './catalogTopics'
import { api } from './api'
import { TeamRank, RankBadge } from './TeamRank'
import { useBookmarks } from './bookmarks'
import { MyApplications } from './MyApplications'
import { TaskSummary } from './TaskSummary'
import { ProposalAssistant } from './ProposalAssistant'
import { useProposalDrafts } from './useProposalDrafts'
import { useAnimatedScore, useReducedMotion } from './motion'
import { RecommendationFocus, useRecommendations } from './Recommendations'
import { DemoEntry } from './DemoEntry'
import { clearDemoPersona, readDemoPersona, saveDemoPersona, type DemoPersona } from './demoSession'
import { MilestonePanel } from './MilestonePanel'
import { CompletionDialog, SuccessMark } from './CompletionDialog'
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
  type SuggestedField,
  type TaskCard,
  type Team,
} from './types'

type Workspace = 'business' | 'student'
type BusinessPage = 'builder' | 'responses'
type BuilderStep = 'description' | 'questions' | 'review' | 'publish'
type BuilderAction = 'analyze' | 'save' | 'confirm' | 'publish'
const builderSteps: { key: BuilderStep; label: string }[] = [
  { key: 'description', label: 'Описание' },
  { key: 'questions', label: 'Уточнение' },
  { key: 'review', label: 'Карточка' },
  { key: 'publish', label: 'Публикация' },
]
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

function ScoreRing({ score, compact = false }: { score: number | null; compact?: boolean }) {
  const displayed = useAnimatedScore(score, !compact)
  return (
    <div className={`score-ring ${compact ? 'score-ring--small' : ''}`} style={{ '--score': `${displayed ?? 0}%` } as React.CSSProperties} aria-label={score === null ? 'Готовность ещё не оценена' : `Рейтинг готовности ${score} из 100`}>
      <span aria-hidden="true" className="score-ring__number">{displayed ?? '—'}</span>
      <span aria-hidden="true" className="score-ring__unit">{score === null ? 'нет оценки' : '/ 100'}</span>
    </div>
  )
}

function BusyLabel({ busy, idle, pending }: { busy: boolean; idle: string; pending: string }) {
  return <span className="button-label"><span aria-hidden={busy} className={busy ? 'button-label__hidden' : ''}>{idle}</span><span aria-hidden={!busy} className={!busy ? 'button-label__hidden' : ''}><span className="spinner" aria-hidden="true" />{pending}</span></span>
}

function LoadingCards({ label, count = 3 }: { label: string; count?: number }) {
  return <div className="loading-cards" role="status"><span className="sr-only">{label}</span>{Array.from({ length: count }, (_, index) => <div key={index} className="skeleton-card" aria-hidden="true"><span className="skeleton skeleton--short" /><span className="skeleton skeleton--title" /><span className="skeleton" /><span className="skeleton skeleton--medium" /></div>)}</div>
}

function ArrowIcon() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h9m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function Field({ label, value, onChange, hint, rows = 3, required = false, id, error, disabled = false }: {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  rows?: number
  id?: string
  error?: string
  disabled?: boolean
  required?: boolean
}) {
  const helpId = useId()
  return (
    <label className="field">
      <span className="field__label">{label}{required && <span className="field__required"> *</span>}</span>
      <textarea id={id} rows={rows} value={value} disabled={disabled} required={required} aria-required={required} aria-invalid={!!error} aria-describedby={error ? helpId : undefined} onChange={(event) => onChange(event.target.value)} placeholder={hint} />
      {(required || error) && <span id={helpId} className="field__error field__error-slot" aria-hidden={!error}>{error || '\u00a0'}</span>}
    </label>
  )
}

function TextInput({ label, value, onChange, placeholder, type = 'text', required = false, id, error, disabled = false }: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  id?: string
  error?: string
  disabled?: boolean
  required?: boolean
}) {
  const helpId = useId()
  return (
    <label className="field">
      <span className="field__label">{label}{required && <span className="field__required"> *</span>}</span>
      <input id={id} type={type} value={value} disabled={disabled} required={required} aria-required={required} aria-invalid={!!error} aria-describedby={error ? helpId : undefined} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      {(required || error) && <span id={helpId} className="field__error field__error-slot" aria-hidden={!error}>{error || '\u00a0'}</span>}
    </label>
  )
}

function App() {
  const reducedMotion = useReducedMotion()
  const catalogScroll = useRef(0)
  const [savedFeedback, setSavedFeedback] = useState(false)
  const [savedAt, setSavedAt] = useState('')
  const [publicationComplete, setPublicationComplete] = useState(false)
  const [persona, setPersona] = useState<DemoPersona | null>(readDemoPersona)
  const [businessPage, setBusinessPage] = useState<BusinessPage>('builder')
  const [card, setCard] = useState<EditableCard>({ ...EMPTY_CARD })
  const [task, setTask] = useState<TaskCard | null>(null)
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([])
  const [questionSource, setQuestionSource] = useState<'ai' | 'mixed' | 'fallback' | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestedField[]>([])
  const [suggestionEdits, setSuggestionEdits] = useState<Record<string, string>>({})
  const [suggestionNotice, setSuggestionNotice] = useState('')
  const [clarificationReviewed, setClarificationReviewed] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [builderAction, setBuilderAction] = useState<BuilderAction | null>(null)
  const builderBusy = builderAction !== null
  const [step, setStep] = useState<BuilderStep>('description')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CardField, string>>>({})
  const [proposalFieldErrors, setProposalFieldErrors] = useState<Partial<Record<keyof ProposalDraft, string>>>({})
  const [focusField, setFocusField] = useState<CardField | null>(null)
  const [showNewTaskPrompt, setShowNewTaskPrompt] = useState(false)
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const previousStep = useRef(step)
  const [search, setSearch] = useState('')
  const [showTeamProgress, setShowTeamProgress] = useState(false)
  const [studentPage, setStudentPage] = useState<'catalog' | 'applications'>('catalog')
  const [savedOnly, setSavedOnly] = useState(false)
  const [catalogSort, setCatalogSort] = useState('priority')
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const proposalDraftStorage = useProposalDrafts()
  const proposalDrafts = proposalDraftStorage.drafts
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
  const [proposalBusy, setProposalBusy] = useState(false)
  const [proposalError, setProposalError] = useState('')
  const [proposalSuccessKey, setProposalSuccessKey] = useState<string | null>(null)

  const [businessTaskId, setBusinessTaskId] = useState('')
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [proposalsTaskId, setProposalsTaskId] = useState('')
  const [proposalsRefresh, setProposalsRefresh] = useState(0)
  const catalogRequest = useRef(0)
  const [proposalsLoading, setProposalsLoading] = useState(false)
  const [proposalsError, setProposalsError] = useState('')
  const [decidingId, setDecidingId] = useState('')

  const activeTeam = persona?.role === 'student' ? teams.find((team) => team.id === persona.teamId) : undefined
  const bookmarks = useBookmarks(activeTeam?.id)
  const recommendations = useRecommendations(activeTeam, tasks)
  const recommendationMap = new Map(recommendations.items.map((item) => [item.taskId, item]))
  const workspace: Workspace | null = persona?.role === 'business' ? 'business' : activeTeam ? 'student' : null
  const dirty = CARD_FIELDS.some((field) => card[field] !== (task?.[field] ?? ''))
  const [restorePending, setRestorePending] = useState(() => !!localStorage.getItem('hackalem.currentTaskId'))
  const [restoreFailure, setRestoreFailure] = useState<{ id: string; message: string } | null>(null)
  const restoreRequest = useRef(0)
  const fieldsDisabled = builderBusy || restorePending || !!restoreFailure
  const currentStepIndex = builderSteps.findIndex((item) => item.key === step)
  const publishReady = !!task?.confirmedAt && !dirty
  const hasUnappliedAnswers = Object.values(answers).some((value) => value.trim())
  const hasUnsavedProposalDraft = proposalDraftStorage.unsaved
  const visibleProposals = proposalsTaskId === businessTaskId ? proposals : []
  const businessTasks = tasks
  const topics = catalogTopics(tasks)
  const visibleTasks = tasks.filter((item) =>
    (!savedOnly || bookmarks.ids.includes(item.id)) &&
    (savedOnly || catalogSort !== 'recommended' || !recommendationMap.get(item.id)?.dismissed) &&
    (!search.trim() || [item.title, item.description, item.industry, item.topic, item.need].join(' ').toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru'))) &&
    matchesTopic(item.topic, topicFilter) &&
    (!readinessFilter || item.readiness === readinessFilter),
  ).sort((a, b) => (catalogSort === 'recommended' ? (recommendationMap.get(b.id)?.relevance ?? 0) - (recommendationMap.get(a.id)?.relevance ?? 0) : 0) || (b.score ?? 0) - (a.score ?? 0))
  const selectedTask = visibleTasks.find((item) => item.id === selectedTaskId) ?? visibleTasks[0] ?? null

  const proposalDraftKey = selectedTask && activeTeam ? `${activeTeam.id}:${selectedTask.id}` : ''
  const proposalForm = proposalDrafts[proposalDraftKey] ?? EMPTY_PROPOSAL
  function setProposalForm(update: ProposalDraft | ((current: ProposalDraft) => ProposalDraft)) {
    if (!proposalDraftKey) return
    proposalDraftStorage.update(proposalDraftKey, update)
  }

  function updateProposal(field: keyof ProposalDraft, value: string) {
    setProposalForm((current) => ({ ...current, [field]: value }))
    setProposalFieldErrors((current) => ({ ...current, [field]: undefined }))
    setProposalSuccessKey(null)
  }

  function openTask(id: string) {
    recommendations.recordClick(id)
    const mobile = window.matchMedia('(max-width: 820px)').matches
    if (mobile) catalogScroll.current = window.scrollY
    setSelectedTaskId(id)
    setProposalError('')
    setProposalFieldErrors({})
    setMobileDetailOpen(true)
    requestAnimationFrame(() => {
      const heading = document.getElementById('task-detail-title')
      heading?.focus({ preventScroll: true })
      if (mobile) document.getElementById('task-detail')?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
  }

  function returnToCatalog() {
    setMobileDetailOpen(false)
    requestAnimationFrame(() => {
      document.getElementById(`task-tile-${selectedTask?.id}`)?.focus({ preventScroll: true })
      window.scrollTo({ top: catalogScroll.current, behavior: 'instant' })
    })
  }

  useEffect(() => {
    if (dirty) setSavedFeedback(false)
  }, [dirty])

  function goToField(field: CardField) {
    setStep(['description', 'industry', 'topic'].includes(field) ? 'description' : 'review')
    setFocusField(field)
  }

  useEffect(() => {
    if (focusField) {
      const element = document.getElementById(`card-${focusField}`)
      element?.focus({ preventScroll: true })
      element?.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'instant' : 'smooth' })
      setFocusField(null)
    } else if (previousStep.current !== step) {
      stepHeading.current?.focus({ preventScroll: true })
      const headingTop = stepHeading.current?.getBoundingClientRect().top
      if (headingTop !== undefined && (headingTop < 0 || headingTop > window.innerHeight * .65)) {
        stepHeading.current?.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'instant' : 'smooth' })
      }
    }
    previousStep.current = step
  }, [step, focusField, reducedMotion])

  useEffect(() => {
    if (!dirty && !hasUnsavedProposalDraft && !hasUnappliedAnswers) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty, hasUnsavedProposalDraft, hasUnappliedAnswers])

  function updateCard(field: CardField, value: string) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setCard((current) => ({ ...current, [field]: value }))
  }

  async function refreshCatalog() {
    const requestId = ++catalogRequest.current
    setCatalogLoading(true)
    setCatalogError('')
    try {
      const next = await api.tasks()
      if (requestId !== catalogRequest.current) return
      setTasks(next)
      setProposalsRefresh((current) => current + 1)
      setSelectedTaskId((current) => current && next.some((item) => item.id === current)
        ? current
        : next[0]?.id ?? null)
      setBusinessTaskId((current) => current && next.some((item) => item.id === current)
        ? current
        : next[0]?.id ?? '')
    } catch (error) {
      if (requestId === catalogRequest.current) setCatalogError(errorMessage(error))
    } finally {
      if (requestId === catalogRequest.current) setCatalogLoading(false)
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

  async function restoreDraft(id: string) {
    const request = ++restoreRequest.current
    setRestorePending(true)
    setRestoreFailure(null)
    const result = await restoreTask(id, api.task)
    if (request !== restoreRequest.current) return
    if (result.kind === 'restored') {
      setTask(result.task)
      setCard(editableFromTask(result.task))
      setStep(result.task.confirmedAt ? 'publish' : 'review')
    } else if (result.kind === 'missing') {
      localStorage.removeItem('hackalem.currentTaskId')
      setNotice('Сохранённая карточка больше не доступна. Можно создать новую задачу.')
    } else {
      setRestoreFailure({ id: result.id, message: result.message })
    }
    setRestorePending(false)
  }

  useEffect(() => {
    void refreshCatalog()
    void refreshTeams()
    const savedId = localStorage.getItem('hackalem.currentTaskId')
    if (savedId) void restoreDraft(savedId)
    return () => { restoreRequest.current++ }
  }, [])

  useEffect(() => {
    if (!businessTaskId || workspace !== 'business' || businessPage !== 'responses') {
      setProposalsLoading(false)
      return
    }
    let active = true
    setProposalsLoading(true)
    setProposalsError('')
    void api.proposals(businessTaskId).then((next) => {
      if (active) { setProposals(next); setProposalsTaskId(businessTaskId) }
    }).catch((error) => {
      if (active) setProposalsError(errorMessage(error))
    }).finally(() => {
      if (active) setProposalsLoading(false)
    })
    return () => { active = false }
  }, [businessTaskId, proposalsRefresh, workspace, businessPage])

  async function analyze() {
    setBuilderError('')
    setNotice('')
    if (card.description.trim().length < 8) {
      setFieldErrors({ description: 'Опишите задачу: минимум 8 символов.' })
      goToField('description')
      return
    }
    setBuilderAction('analyze')
    try {
      const result = await api.analyze(card.description, card.industry, card)
      if (!Array.isArray(result.questions) || result.questions.length < 3) {
        throw new Error('Сервер вернул меньше трёх вопросов. Повторите попытку.')
      }
      setStep('questions')
      setQuestions((current) => {
        const answered = current.filter((item) => answers[item.field]?.trim())
        return [...answered, ...result.questions.filter((item) => !answered.some((old) => old.field === item.field))].slice(0, 5)
      })
      const incoming = Array.isArray(result.suggestedFields) ? result.suggestedFields : []
      const refreshedSuggestions = reconcileTaskSuggestions(suggestions, incoming, suggestionEdits)
      setSuggestions(refreshedSuggestions.suggestions)
      setSuggestionEdits(refreshedSuggestions.edits)
      setSuggestionNotice('')
      setClarificationReviewed(false)
      setQuestionSource(result.source)
      setNotice('Вопросы готовы. Ответы и предложения можно проверить перед подтверждением карточки.')
    } catch (error) {
      setBuilderError(errorMessage(error))
    } finally {
      setBuilderAction(null)
    }
  }

  function applyAnswers() {
    setCard((current) => transferClarificationAnswers(current, questions, answers))
    setAnswers({})
    setClarificationReviewed(true)
    setStep('review')
    setNotice('Ответы перенесены. Проверьте карточку перед подтверждением.')
  }

  function acceptSuggestion(suggestion: SuggestedField) {
    const value = (suggestionEdits[suggestion.field] ?? suggestion.value).trim()
    if (!value) {
      setSuggestionNotice('Введите текст предложения или отклоните его.')
      return
    }
    if (card[suggestion.field].trim()) {
      setSuggestionNotice(`Поле «${fieldLabels[suggestion.field]}» уже заполнено. Проверьте его вручную.`)
      return
    }
    setCard((current) => ({ ...current, [suggestion.field]: value }))
    dismissSuggestion(suggestion.field)
    setSuggestionNotice(`Предложение добавлено в поле «${fieldLabels[suggestion.field]}». Проверьте его перед подтверждением.`)
  }

  function dismissSuggestion(field: CardField) {
    setSuggestions((current) => current.filter((item) => item.field !== field))
    setSuggestionEdits((current) => removeSuggestionEdit(current, field))
  }

  function keepTask(next: TaskCard) {
    setSavedAt(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))
    setTask(next)
    setCard(editableFromTask(next))
    localStorage.setItem('hackalem.currentTaskId', next.id)
  }

  async function saveDraft() {
    setBuilderError('')
    setNotice('')
    setBuilderAction('save')
    try {
      if (task?.status === 'published') {
        throw new Error('Опубликованную задачу обновляют через подтверждение изменений.')
      }
      const next = task ? await api.saveDraft(task.id, card) : await api.createTask(card)
      keepTask(next)
      if (step === 'publish') setStep('review')
      setSavedFeedback(true)
    } catch (error) {
      setBuilderError(errorMessage(error))
    } finally {
      setBuilderAction(null)
    }
  }

  async function confirm() {
    setBuilderError('')
    setNotice('')
    if (!card.title.trim() || !card.description.trim()) {
      setFieldErrors({ ...(!card.title.trim() ? { title: 'Укажите название задачи.' } : {}), ...(!card.description.trim() ? { description: 'Опишите задачу.' } : {}) })
      goToField(!card.description.trim() ? 'description' : 'title')
      return
    }
    setSavedFeedback(false)
    setBuilderAction('confirm')
    try {
      let id = task?.id
      if (!id) {
        const draft = await api.createTask(card)
        keepTask(draft)
        id = draft.id
      }
      const next = await api.confirmTask(id, card)
      keepTask(next)
      setStep('publish')
      if (next.status === 'published') setNotice('Изменения сохранены. Команды видят обновлённую карточку.')
      if (next.status === 'published') await refreshCatalog()
    } catch (error) {
      setBuilderError(errorMessage(error))
    } finally {
      setBuilderAction(null)
    }
  }

  async function publish() {
    if (!task || !task.confirmedAt || dirty) {
      setBuilderError('Сначала подтвердите текущую версию карточки.')
      return
    }
    setBuilderAction('publish')
    setBuilderError('')
    setNotice('')
    try {
      const next = await api.publishTask(task.id)
      keepTask(next)
      setBusinessTaskId(next.id)
      setPublicationComplete(true)
      void refreshCatalog()
    } catch (error) {
      setBuilderError(errorMessage(error))
    } finally {
      setBuilderAction(null)
    }
  }

  function closePublication() {
    setPublicationComplete(false)
    requestAnimationFrame(() => document.getElementById('publish-title')?.focus())
  }

  function newTask() {
    restoreRequest.current++
    setRestorePending(false)
    setRestoreFailure(null)
    setShowNewTaskPrompt(false)
    setPublicationComplete(false)
    setSavedFeedback(false)
    setSavedAt('')
    setFieldErrors({})
    setStep('description')
    setQuestionSource(null)
    setTask(null)
    setCard({ ...EMPTY_CARD })
    setQuestions([])
    setSuggestions([])
    setSuggestionEdits({})
    setSuggestionNotice('')
    setClarificationReviewed(false)
    setAnswers({})
    setBuilderError('')
    setNotice('Новая карточка готова к заполнению.')
    localStorage.removeItem('hackalem.currentTaskId')
    setBusinessPage('builder')
    requestAnimationFrame(() => document.getElementById('description-title')?.focus())
  }

  function enterBusiness() {
    const next: DemoPersona = { version: 1, role: 'business' }
    saveDemoPersona(next)
    setPersona(next)
    setBusinessPage(task?.status === 'published' ? 'responses' : 'builder')
    if (task?.status === 'published') { setBusinessTaskId(task.id); void refreshCatalog() }
  }

  function enterStudent(teamId: string) {
    if (!teams.some((team) => team.id === teamId)) return
    const next: DemoPersona = { version: 1, role: 'student', teamId }
    saveDemoPersona(next)
    setPersona(next)
    setStudentPage('catalog')
    setProposalFieldErrors({})
    setProposalSuccessKey(null)
    setProposalError('')
    void refreshCatalog()
    void refreshTeams()
  }

  function changeParticipant() {
    clearDemoPersona()
    setPersona(null)
    setProposalFieldErrors({})
    setProposalSuccessKey(null)
    setProposalError('')
    setNotice('')
  }

  function milestoneConfirmed(milestone: Milestone) {
    setNotice(`Этап подтверждён. Команде начислено ${milestone.pointsAwarded} баллов.`)
    void refreshTeams()
  }

  async function submitProposal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTask || !activeTeam || proposalBusy) return
    setProposalError('')
    setNotice('')
    if (!proposalForm.idea.trim() || !proposalForm.plan.trim() || !proposalForm.timeline.trim() || !proposalForm.prototypeUrl.trim()) {
      const errors = Object.fromEntries((['idea', 'plan', 'timeline', 'prototypeUrl'] as const).filter((field) => !proposalForm[field].trim()).map((field) => [field, 'Заполните это поле.']))
      setProposalFieldErrors(errors)
      document.getElementById(`proposal-${Object.keys(errors)[0]}`)?.focus()
      return
    }
    try {
      const url = new URL(proposalForm.prototypeUrl.trim())
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error()
    } catch {
      setProposalFieldErrors({ prototypeUrl: 'Укажите адрес http:// или https://.' })
      document.getElementById('proposal-prototypeUrl')?.focus()
      return
    }
    setProposalBusy(true)
    try {
      await api.submitProposal(selectedTask.id, { ...proposalForm, teamId: activeTeam.id, prototypeUrl: proposalForm.prototypeUrl.trim() })
      setProposalForm({ ...EMPTY_PROPOSAL })
      setProposalFieldErrors({})
      setProposalSuccessKey(proposalDraftKey)
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
    <div className={`app-shell ${workspace === 'student' ? 'student-workspace' : ''}`}>
      <header className="topbar">
        <div className="brand" aria-label="AI Sana">
          <span className="brand__mark">S<span>.</span></span>
          <span className="brand__name">AI Sana <small>Практические задачи</small></span>
        </div>
        <div className="persona-header"><span><small>{workspace === 'business' ? 'БИЗНЕС' : 'КОМАНДА'}</small><strong>{workspace === 'business' ? 'Демо-компания' : activeTeam?.name}</strong>{workspace === 'student' && <button type="button" className="team-progress-trigger" aria-label="Ранг и прогресс команды" onClick={() => setShowTeamProgress(true)}><RankBadge points={activeTeam?.progressPoints ?? 0} /></button>}</span><button className="button button--outline" type="button" disabled={builderBusy || proposalBusy} onClick={changeParticipant}>Сменить участника</button></div>
        <span className="topbar__caption">Открытый выбор команд</span>
      </header>

      <main className="main">
        <div className="page-heading">
          <div>
            <p className="eyebrow">AI SANA / {workspace === 'business' ? 'БИЗНЕС' : 'СТУДЕНТЫ'}</p>
            <h1 id="workspace-title">{workspace === 'business' ? businessPage === 'responses' ? 'Отклики команд' : 'Создать задачу' : studentPage === 'applications' ? 'Мои отклики' : savedOnly ? 'Сохранённые задачи' : 'Каталог задач'}</h1>
            {workspace === 'business' && <p className="page-heading__lead">{workspace === 'business'
              ? businessPage === 'responses' ? 'Сравните подходы и выберите команды для совместной работы.' : 'Уточните детали, проверьте готовность и опубликуйте задачу для студенческих команд.'
              : studentPage === 'applications' ? 'Решения бизнеса и подтверждённый прогресс вашей команды.' : 'Все опубликованные задачи открыты для отклика. Рейтинг показывает, насколько они готовы к работе.'}</p>}
          </div>
          {workspace === 'business' && <button className="button button--outline page-heading__action" type="button" disabled={builderBusy || restorePending} onClick={() => (dirty || hasUnappliedAnswers || restoreFailure) ? setShowNewTaskPrompt(true) : newTask()}>+ Новая задача</button>}
        </div>

        <CompletionDialog open={showNewTaskPrompt} title="Начать новую задачу?" description={restoreFailure ? 'Сохранённую карточку сейчас не удалось загрузить. Если начать новую задачу, автоматическое восстановление предыдущей карточки прекратится.' : hasUnappliedAnswers ? 'Введённые ответы ещё не перенесены в карточку. Если начать заново, они и несохранённые изменения будут потеряны.' : 'В карточке есть несохранённые изменения. Вернитесь к ней, чтобы закончить работу, или начните заново.'} onClose={() => setShowNewTaskPrompt(false)}>
          <div className="dialog-actions">
            <button className="button button--dark" type="button" onClick={() => setShowNewTaskPrompt(false)}>Продолжить редактирование</button>
            <button className="button button--text button--danger" type="button" onClick={newTask}>{restoreFailure ? 'Начать новую задачу' : 'Начать без сохранения'}</button>
          </div>
        </CompletionDialog>
        <CompletionDialog open={publicationComplete} success title="Задача опубликована" description="Всё готово. Теперь команды могут найти вашу задачу и предложить решение." onClose={closePublication}>
          <div className="publication-receipt"><span>ДОСТУПНА ВСЕМ КОМАНДАМ</span><strong>{task?.title}</strong><small>Готовность: {task?.score ?? 0} / 100 · Любая команда может откликнуться</small></div>
          <p className="dialog-next">Следующий шаг — сравнить отклики и выбрать команду. Они появятся в разделе «Отклики команд».</p>
          <div className="dialog-actions">
            <button className="button button--dark" type="button" onClick={() => { setPublicationComplete(false); setBusinessTaskId(task?.id ?? ''); setBusinessPage('responses'); requestAnimationFrame(() => document.getElementById('responses-title')?.focus()) }}>Перейти к откликам <ArrowIcon /></button>
            <button className="button button--outline" type="button" onClick={closePublication}>Посмотреть карточку</button>
          </div>
        </CompletionDialog>
        {notice && <div className="notice" role="status"><span>{notice}</span><button type="button" aria-label="Закрыть уведомление" onClick={() => setNotice('')}>×</button></div>}
        {activeTeam && <CompletionDialog neutral open={showTeamProgress} title={`Прогресс команды ${activeTeam.name}`} description="Баллы за завершённые этапы, подтверждённые бизнесом." onClose={() => setShowTeamProgress(false)}><TeamRank team={activeTeam} /></CompletionDialog>}
        {workspace === 'student' && <nav className="subnav student-navigation" aria-label="Раздел команды">
          <button type="button" aria-current={studentPage === 'catalog' && !savedOnly ? 'page' : undefined} className={studentPage === 'catalog' && !savedOnly ? 'is-active' : ''} onClick={() => { setStudentPage('catalog'); setSavedOnly(false); setMobileDetailOpen(false) }}>Каталог</button>
          <button type="button" aria-current={studentPage === 'catalog' && savedOnly ? 'page' : undefined} className={studentPage === 'catalog' && savedOnly ? 'is-active' : ''} onClick={() => { setStudentPage('catalog'); setSavedOnly(true); setMobileDetailOpen(false) }}>Сохранённые ({bookmarks.ids.length})</button>
          <button type="button" aria-current={studentPage === 'applications' ? 'page' : undefined} className={studentPage === 'applications' ? 'is-active' : ''} onClick={() => { setStudentPage('applications'); void refreshTeams() }}>Мои отклики</button>
        </nav>}
        {workspace === 'business' ? (
          <>
            <nav className="subnav" aria-label="Раздел бизнеса">
              <button type="button" aria-current={businessPage === 'builder' ? 'page' : undefined} className={businessPage === 'builder' ? 'is-active' : ''} onClick={() => setBusinessPage('builder')}>Конструктор задачи</button>
              <button type="button" aria-current={businessPage === 'responses' ? 'page' : undefined} className={businessPage === 'responses' ? 'is-active' : ''} onClick={() => { setBusinessPage('responses'); void refreshCatalog(); void refreshTeams() }}>Отклики команд</button>
            </nav>
            {businessPage === 'builder' ? (
              <div className="builder-layout">
                <div className="builder-main">
                  <nav className="steps" aria-label="Этапы работы" style={{ '--step-index': currentStepIndex, '--step-column': currentStepIndex % 2, '--step-row': Math.floor(currentStepIndex / 2) } as React.CSSProperties}>
                    {builderSteps.map((item, index) => <button type="button" key={item.key} className={`steps__item ${step === item.key ? 'is-active' : ''}`} aria-current={step === item.key ? 'step' : undefined} disabled={fieldsDisabled || (item.key === 'questions' && !questions.length) || (item.key === 'publish' && !task?.confirmedAt)} onClick={() => setStep(item.key)}><b aria-hidden="true">{(item.key === 'description' && card.description.trim().length >= 8) || (item.key === 'questions' && clarificationReviewed && !hasUnappliedAnswers) || (item.key === 'review' && publishReady) || (item.key === 'publish' && task?.status === 'published') ? '✓' : String(index + 1).padStart(2, '0')}</b>{item.label}</button>)}
                  </nav>

                  {step === 'description' && <section className="work-section step-panel" aria-labelledby="description-title">
                    <fieldset disabled={fieldsDisabled}>
                    <div className="section-heading"><span className="section-heading__number">01</span><div><h2 ref={stepHeading} tabIndex={-1} id="description-title">Начните с простого описания</h2><p>Расскажите о проблеме своими словами. Система поможет увидеть пробелы.</p></div></div>
                    <div className="two-columns">
                      <TextInput id="card-industry" label="Отрасль" value={card.industry} onChange={(value) => updateCard('industry', value)} placeholder="Например, образование" />
                      <TextInput id="card-topic" label="Тема" value={card.topic} onChange={(value) => updateCard('topic', value)} placeholder="Например, аналитика" />
                    </div>
                    <Field id="card-description" error={fieldErrors.description} label="Что нужно решить?" value={card.description} onChange={(value) => updateCard('description', value)} hint="Опишите ситуацию или потребность, даже если пока не знаете всех деталей." rows={5} required />
                    <p className="muted">После описания вы получите не менее трёх уточняющих вопросов. Или заполните карточку самостоятельно.</p>
                    </fieldset>
                  </section>}

                  {step === 'questions' && questions.length > 0 && <section className="work-section work-section--questions step-panel" aria-labelledby="questions-title">
                    <div className="section-heading"><span className="section-heading__number">02</span><div><h2 ref={stepHeading} tabIndex={-1} id="questions-title">Что стоит уточнить</h2><p>Ответы останутся редактируемыми перед подтверждением карточки.</p></div></div>
                    <div className="question-list">
                      {questions.map((item, index) => <label className="question" key={item.field}><span className="question__number">{String(index + 1).padStart(2, '0')}</span><span className="question__body"><span className="question__title">{item.question}</span><textarea disabled={fieldsDisabled} rows={2} value={answers[item.field] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [item.field]: event.target.value }))} placeholder="Ваш ответ" /></span></label>)}
                    </div>
                    <p className="muted question-source">{questionSource === 'fallback' ? 'AI сейчас недоступен. Мы подготовили стандартные вопросы — вы можете продолжить.' : questionSource === 'mixed' ? 'AI подготовил часть анализа; недостающие вопросы добавлены автоматически. Проверьте ответы перед переносом.' : 'Вопросы подготовлены AI. Проверьте ответы перед переносом в карточку.'}</p>
                    <button className="button button--text" type="button" disabled={fieldsDisabled} onClick={() => void analyze()}>Обновить вопросы, сохранив ответы</button>
                  </section>}

                  {step === 'review' && <section className="work-section step-panel" aria-labelledby="review-title">
                    <fieldset disabled={fieldsDisabled}>
                    <div className="section-heading"><span className="section-heading__number">03</span><div><h2 ref={stepHeading} tabIndex={-1} id="review-title">Карточка задачи</h2><p>Проверьте каждое поле. Баллы начисляются после вашего подтверждения.</p></div></div>
                    {suggestions.length > 0 && <div className="suggestion-list" aria-label="Предложения для карточки"><h3>Предложения из вашего описания</h3><p className="muted">Проверьте источник и при необходимости измените текст. Пустое поле заполнится только после вашего выбора.</p>{suggestions.map((suggestion) => <div className="suggestion-card" key={suggestion.field}><strong>{fieldLabels[suggestion.field]}</strong><p className="suggestion-evidence">Источник: «{suggestion.evidence}»</p><textarea aria-label={`Предложение для поля ${fieldLabels[suggestion.field]}`} rows={2} value={suggestionEdits[suggestion.field] ?? suggestion.value} onChange={(event) => setSuggestionEdits((current) => ({ ...current, [suggestion.field]: event.target.value }))} /><div className="suggestion-actions"><button type="button" className="button button--outline" onClick={() => acceptSuggestion(suggestion)}>Добавить в карточку</button><button type="button" className="button button--text" onClick={() => dismissSuggestion(suggestion.field)}>Отклонить</button></div></div>)}</div>}
                    {suggestionNotice && <p className="inline-note" role="status">{suggestionNotice}</p>}
                    <TextInput id="card-title" error={fieldErrors.title} label="Название задачи" value={card.title} onChange={(value) => updateCard('title', value)} placeholder={fieldHints.title} required />
                    <div className="two-columns">
                      {(['context', 'need', 'users', 'dataMaterials', 'constraints', 'expectedResult', 'successCriteria', 'contact', 'interaction'] as CardField[]).map((field) => <Field key={field} id={`card-${field}`} label={fieldLabels[field]} value={card[field]} onChange={(value) => updateCard(field, value)} hint={fieldHints[field]} />)}
                    </div>
                    {dirty && task?.confirmedAt && <p className="inline-note">Есть неподтверждённые изменения. Публичный рейтинг пока не изменился.</p>}
                    </fieldset>
                  </section>}

                  {step === 'publish' && <section className="work-section publish-preview step-panel" aria-labelledby="publish-title">
                    <div className="section-heading"><span className="section-heading__number">04</span><div><h2 ref={stepHeading} tabIndex={-1} id="publish-title">{task?.status === 'published' ? 'Задача опубликована' : 'Проверьте перед публикацией'}</h2><p>{task?.status === 'published' ? 'Эту версию видят студенческие команды.' : 'Так вашу задачу увидят студенческие команды.'}</p></div></div>
                    {!dirty && <div className="completion-banner"><SuccessMark /><div><strong>{task?.status === 'published' ? 'Задача уже в каталоге' : 'Карточка подтверждена и сохранена'}</strong><p>{task?.status === 'published' ? 'Команды могут откликаться. Выберите подходящее предложение в разделе откликов.' : 'Остался один шаг: опубликуйте задачу, чтобы команды смогли её увидеть.'}</p></div><span className="completion-banner__badge">{task?.status === 'published' ? 'В эфире' : 'Можно публиковать'}</span></div>}
                    {dirty && <p className="inline-note">Показана последняя подтверждённая версия. Подтвердите изменения в карточке перед публикацией.</p>}
                    <p className="task-detail__meta">{task?.industry || 'Отрасль не указана'} · {task?.topic || 'Без темы'}</p>
                    <h3>{task?.title}</h3><p className="task-detail__summary">{task?.description}</p>
                    <div className="task-detail__facts">{(['context', 'need', 'users', 'dataMaterials', 'constraints', 'expectedResult', 'successCriteria', 'contact', 'interaction'] as CardField[]).map((field) => <div key={field}><span>{fieldLabels[field]}</span><p>{task?.[field]?.trim() || 'Пока не указано'}</p></div>)}</div>
                    <p className="muted publish-note">Можно публиковать с любым рейтингом. Чем больше конкретики, тем проще командам предложить решение.</p>
                  </section>}

                  <div className={`builder-actionbar ${savedFeedback ? 'builder-actionbar--saved' : ''}`} aria-label="Действия с карточкой">
                    {restoreFailure && <div className="error-message" role="alert"><span>Не удалось восстановить сохранённую карточку. {restoreFailure.message} Ссылка на неё сохранена; повторите загрузку перед редактированием.</span><button className="button button--outline" type="button" onClick={() => void restoreDraft(restoreFailure.id)}>Повторить загрузку карточки</button></div>}
                    {builderError && <p className="error-message" role="alert">{builderError}</p>}
                    <div className="builder-actionbar__status" role="status"><strong>{savedFeedback && <span className="save-check" aria-hidden="true">✓</span>}{restorePending ? 'Загружаем карточку…' : restoreFailure ? 'Карточку нужно восстановить' : builderAction === 'save' ? 'Сохраняем черновик…' : hasUnappliedAnswers ? 'Ответы ещё не перенесены в карточку' : dirty ? 'Есть несохранённые изменения' : task ? task.status === 'published' ? 'Опубликовано' : savedAt ? `Сохранено в ${savedAt}` : 'Сохранено' : 'Новая карточка'}</strong><span>Шаг {currentStepIndex + 1} из 4{step === 'publish' && dirty ? ' · Сначала подтвердите изменения' : ''}</span></div>
                    <div className="builder-actionbar__buttons">
                      {task?.status !== 'published' && <button className="button button--outline" type="button" onClick={() => void saveDraft()} disabled={fieldsDisabled || (!dirty && !!task)}><BusyLabel busy={builderAction === 'save'} idle={savedFeedback && !dirty ? 'Черновик сохранён' : 'Сохранить черновик'} pending="Сохраняем…" /></button>}
                      {step === 'description' && <><button className="button button--text" type="button" disabled={fieldsDisabled} onClick={() => setStep('review')}>Заполнить самостоятельно</button><button className="button button--dark" type="button" disabled={fieldsDisabled} onClick={() => void analyze()}><BusyLabel busy={builderAction === 'analyze'} idle="Получить вопросы" pending="Готовим вопросы…" /> <ArrowIcon /></button></>}
                      {step === 'questions' && <button className="button button--dark" type="button" disabled={fieldsDisabled} onClick={applyAnswers}>{Object.values(answers).some((value) => value.trim()) ? 'Перенести ответы и продолжить' : 'Продолжить без ответов'} <ArrowIcon /></button>}
                      {step === 'review' && <button className="button button--dark" type="button" onClick={() => void confirm()} disabled={fieldsDisabled}><BusyLabel busy={builderAction === 'confirm'} idle={task?.confirmedAt ? 'Подтвердить изменения' : 'Подтвердить карточку'} pending="Подтверждаем…" /> <ArrowIcon /></button>}
                      {step === 'publish' && <><button className="button button--outline" type="button" disabled={fieldsDisabled} onClick={() => setStep('review')}>Редактировать карточку</button>{task?.status !== 'published' ? <button className="button button--accent" type="button" onClick={() => void publish()} aria-describedby="publish-help" disabled={fieldsDisabled || !publishReady}><BusyLabel busy={builderAction === 'publish'} idle="Опубликовать" pending="Публикуем…" /> <ArrowIcon /></button> : <button className="button button--dark" type="button" onClick={() => { changeParticipant(); setSavedOnly(false); setCatalogSort('priority'); setSelectedTaskId(task.id); setSearch(''); setTopicFilter(''); setReadinessFilter(''); setMobileDetailOpen(true); void refreshCatalog() }}>Открыть как команда <ArrowIcon /></button>}</>}
                    </div>
                    {savedFeedback && <p className="save-receipt" role="status">{hasUnappliedAnswers ? 'Карточка сохранена. Ответы на вопросы нужно отдельно перенести в карточку и сохранить.' : 'Черновик сохранён. Команды увидят задачу только после публикации.'}</p>}
                    {step === 'publish' && task?.status !== 'published' && <p id="publish-help" className="builder-actionbar__help">{publishReady ? 'После публикации задачу увидят все команды.' : 'Сначала подтвердите текущую версию карточки.'}</p>}
                  </div>
                </div>

                <aside className="score-panel" aria-label="Рейтинг готовности задачи">
                  <p className="eyebrow">ГОТОВНОСТЬ ЗАДАЧИ</p>
                  <div className="score-panel__top"><ScoreRing score={task?.confirmedAt ? task.score : null} /><div><span className="score-panel__label">{task?.confirmedAt ? readinessLabels[task.readiness] : 'Ещё не оценена'}</span><p>{task?.status === 'published' ? 'Опубликована в каталоге' : 'Черновик задачи'}</p></div></div>
                  <div className="score-panel__divider" />
                  {dirty && task?.confirmedAt && <p className="inline-note">Оценка подтверждённой версии. Обновится после подтверждения изменений.</p>}
                  <h3>Как складывается рейтинг</h3>
                  {task?.breakdown?.length ? <div className="score-breakdown">{task.breakdown.map((part) => <div className="score-breakdown__row" key={part.key}><span>{scoreLabels[part.key] ?? part.label}</span><strong>{part.earned}<small>/{part.maximum}</small></strong></div>)}</div> : <p className="muted">Подтвердите карточку, чтобы увидеть баллы по каждому критерию.</p>}
                  <div className="score-panel__divider" />
                  <h3>Что улучшить</h3>
                  {task?.missing?.length ? <ul className="missing-list">{task.missing.map((item, index) => <li key={`${item}-${index}`}>{CARD_FIELDS.includes(item as CardField) ? <button type="button" disabled={fieldsDisabled} onClick={() => goToField(item as CardField)}>{displayMissing(item)} <span aria-hidden="true">↗</span></button> : displayMissing(item)}</li>)}</ul> : <p className="muted">{task?.confirmedAt ? 'Всё необходимое указано.' : 'После подтверждения появятся рекомендации.'}</p>}
                  <p className="score-panel__footnote">Низкий рейтинг не скрывает опубликованную задачу и не запрещает отклик.</p>
                </aside>
              </div>
            ) : (
              <section className="responses-layout" aria-labelledby="responses-title">
                <div className="responses-intro"><div><p className="eyebrow">РЕШЕНИЕ ЗА БИЗНЕСОМ</p><h2 id="responses-title" tabIndex={-1}>Отклики команд</h2><p>Сравните предложения и выберите одну, несколько или ни одной команды.</p></div><button className="button button--outline" disabled={catalogLoading} onClick={() => { void refreshCatalog(); void refreshTeams() }} type="button"><BusyLabel busy={catalogLoading || proposalsLoading} idle="Обновить список" pending="Обновляем…" /></button></div>
                {catalogLoading && !tasks.length && <LoadingCards label="Загружаем опубликованные задачи…" count={1} />}
                {catalogError && <div className="error-message" role="alert"><span>{catalogError}</span><button className="button button--outline" type="button" disabled={catalogLoading} onClick={() => void refreshCatalog()}>Попробовать снова</button></div>}
                <label className="field field--narrow"><span className="field__label">Задача</span><select value={businessTaskId} onChange={(event) => setBusinessTaskId(event.target.value)} disabled={!businessTasks.length}><option value="">Выберите задачу</option>{businessTasks.map((item) => <option key={item.id} value={item.id}>{item.title || 'Без названия'} · {item.score}/100</option>)}</select></label>
                {!catalogLoading && !businessTasks.length && !catalogError && <p className="state-message">Пока нет опубликованных задач. Опубликуйте карточку в конструкторе.</p>}
                {proposalsLoading && !visibleProposals.length && <LoadingCards label="Загружаем отклики…" count={2} />}
                {proposalsError && <div className="error-message" role="alert"><span>{proposalsError}</span><button className="button button--outline" type="button" onClick={() => setProposalsRefresh((current) => current + 1)}>Попробовать снова</button></div>}
                {!proposalsLoading && businessTaskId && !visibleProposals.length && !proposalsError && <p className="state-message">На эту задачу ещё нет предложений.</p>}
                {teamsError && <p className="error-message" role="alert">Ранги команд могут быть неактуальны. {teamsError} <button type="button" className="button button--text" onClick={() => void refreshTeams()}>Обновить ранги</button></p>}
                <div className="proposal-list" aria-busy={proposalsLoading}>{visibleProposals.map((item) => <article className="proposal-card" key={item.id}><div className="proposal-card__head"><div><p className="eyebrow">ПРЕДЛОЖЕНИЕ КОМАНДЫ</p><h3>{teams.find((team) => team.id === item.teamId)?.name ?? 'Команда'}</h3></div><span className={`decision decision--${item.decision}`}>{decisionLabels[item.decision]}</span></div><TeamRank team={teams.find((team) => team.id === item.teamId)} compact /><div className="proposal-card__content"><div><span>Идея решения</span><p>{item.idea}</p></div><div><span>План работы</span><p>{item.plan}</p></div><div><span>Срок</span><p>{item.timeline}</p></div><div><span>Прототип</span><p><PrototypeLink url={item.prototypeUrl} /></p></div></div><div className="proposal-card__actions"><button className="button button--accent" type="button" disabled={decidingId === item.id || item.decision === 'selected'} onClick={() => void decide(item, 'selected')}>Выбрать команду</button><button className="button button--outline" type="button" disabled={decidingId === item.id || item.decision === 'rejected'} onClick={() => void decide(item, 'rejected')}>Отклонить</button></div>{item.decision === 'selected' && <MilestonePanel proposalId={item.id} onConfirmed={milestoneConfirmed} />}</article>)}</div>
              </section>
            )}
          </>
        ) : studentPage === 'applications' && activeTeam ? (
          <MyApplications key={activeTeam.id} teamId={activeTeam.id} onRefreshTeam={() => void refreshTeams()} onOpenTask={(id) => { setStudentPage('catalog'); setSavedOnly(false); setCatalogSort('priority'); setSearch(''); setTopicFilter(''); setReadinessFilter(''); openTask(id); void refreshCatalog() }} />
        ) : (
          <section className={`catalog ${mobileDetailOpen && selectedTask ? 'catalog--detail-open' : ''}`} aria-labelledby="workspace-title">
            <div className="catalog__toolbar catalog__toolbar--compact"><span className="muted">Найдено задач: {visibleTasks.length}</span><div className="catalog-settings">
              <button className="button button--text" type="button" disabled={catalogLoading} onClick={() => { void refreshCatalog(); bookmarks.refresh() }}><BusyLabel busy={catalogLoading} idle="Обновить" pending="Обновляем…" /></button>
            </div></div>
            {bookmarks.error && <p role="alert">{bookmarks.error} <button className="button button--text" onClick={bookmarks.refresh}>Повторить загрузку</button></p>}
            {savedOnly && bookmarks.loading && <p role="status">Загружаем сохранённые задачи…</p>}
            {savedOnly && !bookmarks.loading && !bookmarks.error && !bookmarks.ids.length && <p className="state-message">Пока нет сохранённых задач. Нажмите «Сохранить задачу» на карточке — она появится здесь. Список общий для вашей демо-команды.</p>}
            <div className="catalog-search-row"><TextInput label="Поиск задач" value={search} onChange={(value) => { setSearch(value); setMobileDetailOpen(false) }} placeholder="Название или ключевое слово" /><label className="field"><span className="field__label">Сортировка</span><select value={catalogSort} onChange={(event) => setCatalogSort(event.target.value)}><option value="priority">По готовности задачи</option><option value="recommended">Рекомендуемые команде</option></select></label></div>
            <div className="catalog-options">
              <details className="catalog-disclosure"><summary>Фильтры{(topicFilter || readinessFilter) ? ' · применены' : ''}</summary><div className="filters"><label className="field"><span className="field__label">Тема</span><select value={topicFilter} onChange={(event) => { setTopicFilter(event.target.value); setMobileDetailOpen(false) }}><option value="">Все темы</option>{topics.map((topic) => <option value={topic} key={topic}>{topic}</option>)}</select></label><label className="field"><span className="field__label">Готовность задачи</span><select value={readinessFilter} onChange={(event) => { setReadinessFilter(event.target.value); setMobileDetailOpen(false) }}><option value="">Любая готовность</option><option value="draft">Требует уточнения · 0–39</option><option value="workable">Рабочая · 40–69</option><option value="ready">Готовая · 70–89</option><option value="priority">Приоритетная · 90–100</option></select></label></div></details>
              {activeTeam && <details className="catalog-disclosure"><summary>Настройки рекомендаций</summary><RecommendationFocus key={activeTeam.id} team={activeTeam} onSaved={(updated) => setTeams((current) => current.map((item) => item.id === updated.id ? updated : item))} onReset={recommendations.refresh} /></details>}
              {(search || topicFilter || readinessFilter) && <button className="button button--text" type="button" onClick={() => { setSearch(''); setTopicFilter(''); setReadinessFilter(''); setMobileDetailOpen(false) }}>Сбросить фильтры</button>}
            </div>
            {recommendations.feedbackError && <p className="error-message" role="alert">{recommendations.feedbackError}</p>}
            {recommendations.items.some((item) => item.dismissed) && <details className="dismissed-tasks"><summary>Неинтересные задачи ({recommendations.items.filter((item) => item.dismissed).length})</summary><p>Скрыты только из рекомендаций. Они доступны в сохранённых и при сортировке по приоритету.</p>{recommendations.items.filter((item) => item.dismissed).map((item) => <div key={item.taskId}><span>{tasks.find((task) => task.id === item.taskId)?.title || 'Задача'}</span><button type="button" className="button button--text" disabled={recommendations.feedbackBusy} onClick={() => void recommendations.dismiss(item.taskId, false)}>Вернуть в рекомендации</button></div>)}</details>}
            {catalogSort === 'recommended' && recommendations.loading && <p role="status">Подбираем рекомендации…</p>}
            {recommendations.error && <p role="status">{recommendations.error} <button className="button button--text" onClick={recommendations.refresh}>Повторить</button></p>}
            {catalogLoading && !tasks.length && <LoadingCards label="Загружаем каталог…" />}
            {catalogError && <div className="error-message" role="alert"><span>{catalogError}</span><button className="button button--outline" type="button" disabled={catalogLoading} onClick={() => void refreshCatalog()}>Попробовать снова</button></div>}
            {!catalogLoading && !visibleTasks.length && !catalogError && (!savedOnly || (!bookmarks.loading && !bookmarks.error && bookmarks.ids.length > 0)) && <p className="state-message">{search || topicFilter || readinessFilter || savedOnly ? 'Ничего не найдено. Измените запрос или сбросьте фильтры.' : recommendations.items.some((item) => item.dismissed) ? 'Все подходящие задачи отмечены как неинтересные. Верните их из списка выше или выберите сортировку по приоритету.' : 'Опубликованных задач пока нет. Загляните позже.'}</p>}
            <div className="catalog__columns" aria-busy={catalogLoading}>
              <div className="task-list">{visibleTasks.map((item) => <div className="task-tile-group" key={item.id}><button type="button" id={`task-tile-${item.id}`} key={item.id} className={`task-tile ${selectedTask?.id === item.id ? 'is-selected' : ''}`} onClick={() => openTask(item.id)} aria-pressed={selectedTask?.id === item.id}><div className="task-tile__meta"><span>{item.industry || 'Отрасль не указана'}</span><span>{item.topic || 'Без темы'}</span></div><h3>{item.title || 'Задача без названия'}</h3><p>{item.need || item.description || 'Описание появится после уточнения.'}</p><TaskSummary task={item} />{catalogSort === 'recommended' && recommendationMap.get(item.id)?.reasons.slice(0, 1).map((reason) => <span className="recommendation-reason" key={reason}>{reason}</span>)}<div className="task-tile__foot"><span className={`readiness readiness--${item.readiness}`}>{readinessLabels[item.readiness]}</span><strong aria-label={`Готовность задачи ${item.score} из 100`}>{item.score}<small>/100</small></strong></div></button><button type="button" className="button button--text bookmark-button" aria-pressed={bookmarks.ids.includes(item.id)} aria-label={`${bookmarks.ids.includes(item.id) ? 'Убрать из сохранённых' : 'Сохранить задачу'}: ${item.title}`} disabled={bookmarks.loading || bookmarks.busy || !!bookmarks.error} onClick={() => void bookmarks.toggle(item.id).then((changed) => { if (changed) recommendations.refresh() })}>{bookmarks.ids.includes(item.id) ? '★ Сохранено · убрать' : '☆ Сохранить задачу'}</button><details className="task-more"><summary aria-label={`Другие действия: ${item.title}`}>Ещё ⋯</summary><button type="button" className="button button--text" disabled={recommendations.feedbackBusy || recommendations.loading} onClick={() => void recommendations.dismiss(item.id, !recommendationMap.get(item.id)?.dismissed)}>{recommendationMap.get(item.id)?.dismissed ? 'Вернуть в рекомендации' : 'Не интересно'}</button></details></div>)}</div>
              {selectedTask && <article id="task-detail" key={selectedTask.id} className="task-detail"><button className="button button--outline mobile-back" type="button" onClick={returnToCatalog}>← К списку задач</button><div className="task-detail__head"><span className="eyebrow">КАРТОЧКА ЗАДАЧИ</span><ScoreRing score={selectedTask.score ?? 0} compact /></div><h2 id="task-detail-title" tabIndex={-1}>{selectedTask.title || 'Задача без названия'}</h2><p className="task-detail__meta">{selectedTask.industry || 'Отрасль не указана'} · {selectedTask.topic || 'Без темы'}</p><p className="task-detail__summary">{selectedTask.description}</p><div className="task-detail__facts">{(['context', 'need', 'users', 'dataMaterials', 'constraints', 'expectedResult', 'successCriteria', 'contact', 'interaction'] as CardField[]).map((field) => <div key={field}><span>{fieldLabels[field]}</span><p>{selectedTask[field]?.trim() || 'Пока не указано'}</p></div>)}</div><div className="task-detail__bottom"><span className={`readiness readiness--${selectedTask.readiness}`}>{readinessLabels[selectedTask.readiness]}</span><p>Даже при низком рейтинге команда может отправить предложение.</p></div><form className="proposal-form" noValidate onSubmit={(event) => void submitProposal(event)}><div className="section-heading"><span className="section-heading__number">↗</span><div><h3>Предложить решение</h3><p>Опишите подход. Выбор команды останется за бизнесом.</p></div></div><p className="proposal-form__team">Предложение отправляет команда <strong>{activeTeam?.name}</strong></p><p className="proposal-draft-status" role="status">{proposalDraftStorage.errors[proposalDraftKey] || (Object.values(proposalForm).some(Boolean) ? 'Черновик сохранён в этом браузере для этой команды и задачи.' : 'Черновик сохраняется автоматически в этом браузере. На другом устройстве он недоступен.')}{proposalDraftStorage.errors[proposalDraftKey] && <button type="button" className="button button--text" onClick={() => proposalDraftStorage.retry(proposalDraftKey)}>Повторить сохранение</button>}</p>{proposalDraftStorage.loadError && <p className="error-message" role="alert">{proposalDraftStorage.loadError}</p>}<ProposalAssistant key={proposalDraftKey} task={selectedTask} draft={proposalForm} disabled={proposalBusy} onApply={(next) => { setProposalForm(next); setProposalFieldErrors({}); setProposalError(''); setProposalSuccessKey(null) }} /><Field id="proposal-idea" error={proposalFieldErrors.idea} disabled={proposalBusy} label="Идея решения" required value={proposalForm.idea} onChange={(value) => updateProposal('idea', value)} hint="Как вы предлагаете решить задачу?" /><Field id="proposal-plan" error={proposalFieldErrors.plan} disabled={proposalBusy} label="План работы" required value={proposalForm.plan} onChange={(value) => updateProposal('plan', value)} hint="Основные этапы работы" /><div className="two-columns"><TextInput id="proposal-timeline" error={proposalFieldErrors.timeline} disabled={proposalBusy} label="Срок" required value={proposalForm.timeline} onChange={(value) => updateProposal('timeline', value)} placeholder="Например, 2 недели" /><TextInput id="proposal-prototypeUrl" error={proposalFieldErrors.prototypeUrl} required disabled={proposalBusy} label="Ссылка на прототип" type="url" value={proposalForm.prototypeUrl} onChange={(value) => updateProposal('prototypeUrl', value)} placeholder="https://…" /></div>{proposalSuccessKey === proposalDraftKey && <p className="notice proposal-success" role="status"><span className="save-check" aria-hidden="true">✓</span>Предложение отправлено. Решение остаётся за представителем бизнеса. <button type="button" className="button button--text" onClick={() => setStudentPage('applications')}>Перейти в мои отклики</button></p>}{proposalError && <p className="error-message" role="alert">{proposalError}</p>}<button className="button button--accent" disabled={proposalBusy} type="submit"><BusyLabel busy={proposalBusy} idle="Отправить предложение" pending="Отправляем…" /> <ArrowIcon /></button></form></article>}
            </div>
          </section>
        )}
      </main>
      <footer className="footer"><span>AI Sana / HackAlem</span><span>Задачи открыты. Решение — за людьми.</span></footer>
    </div>
  )
}

export default App
