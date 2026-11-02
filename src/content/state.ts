import { SITE } from '@/utils/site-contract'
import { useAnimeStore } from '@/components/anime-card/useAnimeStore'
import { malToSnapshot } from '@/utils/list-sync'

export type PageKind = 'anime' | 'episode'

// La lista de MAL tal como la conoce la extensión ahora mismo (null si el anime no está en la lista).
export function currentMalSnapshot() {
  return malToSnapshot(useAnimeStore.getState().listStatus)
}

// Ubicación actual de la SPA; la actualiza handleNavigation en content.tsx.
export const page: { slug: string | null; episode: number | null; kind: PageKind | null } = {
  slug: null,
  episode: null,
  kind: null
}

export function parseLocation(): { kind: PageKind; slug: string; episode: number | null } | null {
  const match = SITE.mediaPath.exec(window.location.pathname)
  if (!match) return null

  const slug = match[1]!
  const segment = match[2]
  if (segment == null) return { kind: 'anime', slug, episode: null }
  if (!/^\d+$/.test(segment)) return null

  return { kind: 'episode', slug, episode: parseInt(segment, 10) }
}

export function getAnimeName(): string | null {
  if (!page.kind) return null
  for (const selector of SITE.selectors.animeName[page.kind]) {
    const name = document.querySelector(selector)?.textContent?.trim()
    if (name) return name
  }
  return null
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Al marcar/desmarcar un capítulo el sitio también hace POST a /api/user/library. Esa request no debe
// reconciliarse hacia MAL: pisaría el estado calculado por la extensión (p. ej. completed) con uno desactualizado.
export const watchGuard = { until: 0, busy: 0 }
export const watchGuardActive = () => watchGuard.busy > 0 || Date.now() < watchGuard.until
