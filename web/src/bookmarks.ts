import { useEffect, useRef, useState } from 'react'
import { api } from './api'

export function useBookmarks(teamId: string | undefined) {
  const [state, setState] = useState({ teamId: '', ids: [] as string[], loading: true, error: '' })
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const generation = useRef(0)
  useEffect(() => {
    const request = ++generation.current
    if (!teamId) return
    setState((current) => ({ teamId, ids: current.teamId === teamId ? current.ids : [], loading: true, error: '' }))
    api.bookmarks(teamId).then((ids) => {
      if (generation.current === request) setState({ teamId, ids, loading: false, error: '' })
    }).catch(() => {
      if (generation.current === request) setState({ teamId, ids: [], loading: false, error: 'Не удалось загрузить сохранённые задачи.' })
    })
    return () => { generation.current++ }
  }, [teamId, revision])

  async function toggle(taskId: string) {
    if (!teamId || state.teamId !== teamId || state.loading || state.error || saving.current) return false
    const request = generation.current
    const saved = !state.ids.includes(taskId)
    saving.current = true
    setBusy(true)
    try {
      await api.setBookmark(teamId, taskId, saved)
      if (request === generation.current) setState((current) => ({ ...current, ids: saved ? [...current.ids, taskId] : current.ids.filter((id) => id !== taskId) }))
      return true
    } catch {
      if (request === generation.current) setState((current) => ({ ...current, error: 'Не удалось изменить закладку. Повторите загрузку и попробуйте ещё раз.' }))
      return false
    } finally { saving.current = false; setBusy(false) }
  }
  return {
    ids: state.teamId === teamId ? state.ids : [],
    loading: state.teamId !== teamId || state.loading,
    error: state.teamId === teamId ? state.error : '',
    busy, toggle, refresh: () => setRevision((value) => value + 1),
  }
}
