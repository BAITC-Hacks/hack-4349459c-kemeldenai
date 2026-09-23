import { useEffect, useRef, useState } from 'react'

const SCORE_DURATION_MS = 520

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced
}

// Only confirmed score changes animate; initial loads and catalog selection are immediate.
export function useAnimatedScore(score: number | null, enabled: boolean) {
  const reduced = useReducedMotion()
  const [displayed, setDisplayed] = useState(score)
  const current = useRef(score)
  useEffect(() => {
    if (score === null || current.current === null || reduced || !enabled) {
      current.current = score
      setDisplayed(score)
      return
    }
    const from = current.current
    if (from === score) return
    let frame = 0
    let start: number | null = null
    const tick = (now: number) => {
      start ??= now
      const progress = Math.min((now - start) / SCORE_DURATION_MS, 1)
      const next = from + (score - from) * (1 - (1 - progress) ** 3)
      current.current = next
      setDisplayed(Math.round(next))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [score, reduced, enabled])
  return reduced || !enabled || score === null ? score : displayed
}
