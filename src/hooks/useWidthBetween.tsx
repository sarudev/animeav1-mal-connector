import { useSyncExternalStore } from 'react'

interface MaxProps {
  max: number
  min?: null
}

interface MinProps {
  min: number
  max?: null
}

interface MinMaxProps {
  min: number
  max: number
}

type WidthBetweenProps = MinProps | MaxProps | MinMaxProps

export function useWidthBetween({ max, min }: WidthBetweenProps): boolean {
  if (max != null && min == null) {
    min = 0
  } else if (min != null && max == null) {
    max = Infinity
  }
  const query = `(min-width: ${min}px) and (not (min-width: ${max}px))`

  return useSyncExternalStore(
    onChange => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}
