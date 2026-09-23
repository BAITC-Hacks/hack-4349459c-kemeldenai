export const CARD_FIELDS = [
  'title',
  'industry',
  'topic',
  'description',
  'context',
  'need',
  'users',
  'dataMaterials',
  'constraints',
  'expectedResult',
  'successCriteria',
  'contact',
  'interaction',
] as const

export type CardField = (typeof CARD_FIELDS)[number]

export type EditableCard = Record<CardField, string>

export type Readiness = 'draft' | 'workable' | 'ready' | 'priority'
export type TaskStatus = 'draft' | 'published'

export interface ScorePart {
  key: string
  label: string
  earned: number
  maximum: number
}

export interface TaskCard extends EditableCard {
  id: string
  status: TaskStatus
  confirmedAt: string | null
  score: number | null
  readiness: Readiness
  breakdown: ScorePart[]
  missing: string[]
  createdAt: string
  updatedAt: string
}

export interface ClarifyingQuestion {
  field: string
  question: string
}

export interface AnalysisResult {
  questions: ClarifyingQuestion[]
  source: 'ai' | 'fallback'
}

export interface Team {
  id: string
  name: string
  interests: string[]
  skills: string[]
  technologies: string[]
  progressPoints: number
}

export interface Recommendation {
  taskId: string
  relevance: number
  reasons: string[]
}

export type ProposalDecision = 'pending' | 'selected' | 'rejected'

export interface Proposal {
  id: string
  taskId: string
  teamId: string
  idea: string
  plan: string
  timeline: string
  prototypeUrl: string
  decision: ProposalDecision
  createdAt: string
}

export interface ProposalInput {
  teamId: string
  idea: string
  plan: string
  timeline: string
  prototypeUrl: string
}

export interface Milestone {
  id: string
  proposalId: string
  description: string
  pointsAwarded: number
  confirmedAt: string
}

export const EMPTY_CARD: EditableCard = {
  title: '',
  industry: '',
  topic: '',
  description: '',
  context: '',
  need: '',
  users: '',
  dataMaterials: '',
  constraints: '',
  expectedResult: '',
  successCriteria: '',
  contact: '',
  interaction: '',
}

export function editableFromTask(task: TaskCard): EditableCard {
  return Object.fromEntries(CARD_FIELDS.map((field) => [field, task[field]])) as EditableCard
}
