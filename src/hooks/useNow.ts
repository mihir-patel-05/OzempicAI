import { useEffect, useState } from 'react'

/**
 * The current time in milliseconds, re-rendering every `intervalMs`. Ticks
 * land just after each whole interval so a seconds display never skips or
 * stutters, and it catches up at once when the page comes back into view
 * (browsers slow timers down in background tabs).
 */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = () => {
      const current = Date.now()
      setNow(current)
      timer = setTimeout(tick, intervalMs - (current % intervalMs) + 10)
    }
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      clearTimeout(timer)
      tick()
    }
    tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs, enabled])

  return now
}
