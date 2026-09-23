import type {
  AnalysisResult,
  EditableCard,
  Proposal,
  ProposalDecision,
  ProposalInput,
  TaskCard,
  Team,
} from './types'

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError('Не удалось связаться с сервером. Проверьте, что API запущен.', 0)
  }

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
    const detail = record.error ?? record.detail
    const message = typeof detail === 'string'
      ? detail
      : `Сервер вернул ошибку ${response.status}. Повторите попытку.`
    throw new ApiError(message, response.status)
  }
  if (payload === null) throw new ApiError('Сервер вернул пустой или некорректный ответ.', response.status)
  return payload as T
}

const json = (value: unknown) => JSON.stringify(value)

async function requestArray<T>(path: string): Promise<T[]> {
  const result = await request<unknown>(path)
  if (!Array.isArray(result)) throw new ApiError('Сервер вернул некорректный список.', 502)
  return result as T[]
}

export const api = {
  analyze(description: string, industry: string, card?: EditableCard) {
    return request<AnalysisResult>('/api/analyze', {
      method: 'POST',
      body: json({ description, industry, ...(card ? { card } : {}) }),
    })
  },
  tasks(filters?: { topic?: string; readiness?: string }) {
    const query = new URLSearchParams()
    if (filters?.topic) query.set('topic', filters.topic)
    if (filters?.readiness) query.set('readiness', filters.readiness)
    return requestArray<TaskCard>(`/api/tasks${query.size ? `?${query}` : ''}`)
  },
  task(id: string) {
    return request<TaskCard>(`/api/tasks/${encodeURIComponent(id)}`)
  },
  createTask(card: EditableCard) {
    return request<TaskCard>('/api/tasks', { method: 'POST', body: json(card) })
  },
  saveDraft(id: string, card: EditableCard) {
    return request<TaskCard>(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'PUT', body: json(card),
    })
  },
  confirmTask(id: string, card: EditableCard) {
    return request<TaskCard>(`/api/tasks/${encodeURIComponent(id)}/confirm`, {
      method: 'POST', body: json(card),
    })
  },
  publishTask(id: string) {
    return request<TaskCard>(`/api/tasks/${encodeURIComponent(id)}/publish`, { method: 'POST' })
  },
  teams() {
    return requestArray<Team>('/api/teams')
  },
  proposals(taskId: string) {
    return requestArray<Proposal>(`/api/tasks/${encodeURIComponent(taskId)}/proposals`)
  },
  submitProposal(taskId: string, proposal: ProposalInput) {
    return request<Proposal>(`/api/tasks/${encodeURIComponent(taskId)}/proposals`, {
      method: 'POST', body: json(proposal),
    })
  },
  decideProposal(id: string, decision: Exclude<ProposalDecision, 'pending'>) {
    return request<Proposal>(`/api/proposals/${encodeURIComponent(id)}`, {
      method: 'PATCH', body: json({ decision }),
    })
  },
}
