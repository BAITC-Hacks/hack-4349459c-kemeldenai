export type DemoPersona =
  | { version: 1; role: 'business' }
  | { version: 1; role: 'student'; teamId: string }

const STORAGE_KEY = 'hackalem.demoPersona'

export function readDemoPersona(): DemoPersona | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return null
    const record = value as Record<string, unknown>
    if (record.version !== 1) return null
    if (record.role === 'business') return { version: 1, role: 'business' }
    if (record.role === 'student' && typeof record.teamId === 'string' && record.teamId) {
      return { version: 1, role: 'student', teamId: record.teamId }
    }
    return null
  } catch {
    return null
  }
}

export function saveDemoPersona(persona: DemoPersona) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persona))
}

export function clearDemoPersona() {
  localStorage.removeItem(STORAGE_KEY)
}
