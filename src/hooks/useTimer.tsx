import { useCallback, useEffect, useRef } from 'react'

export function useTimer(active: boolean, callback: () => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pause = useCallback(() => {
    clearTimeout(timer.current ?? undefined)
  }, [])

  const start = useCallback(() => {
    clearTimeout(timer.current ?? undefined)
    timer.current = setTimeout(callback, delay)
  }, [callback, delay])

  useEffect(() => {
    if (!active) {
      pause()
      return
    }
    start()
    return pause
  }, [active, start, pause])

  return { pause, start }
}
