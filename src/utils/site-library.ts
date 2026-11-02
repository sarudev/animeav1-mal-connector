import { SITE } from './site-contract'

export interface SiteListEntry {
  status: number
  episode: number
  startDate: string
  endDate: string
  notes: string
  private: boolean
  // 1-5, o null si no hay puntuación. Viene de media.userRating, no de userLibrary.
  rating: number | null
}

export interface SiteLibrary {
  mediaId: number
  entry: SiteListEntry | null
}

// Resuelve el formato plano de SvelteKit (devalue): los valores de objetos/arrays son índices al array raíz.
function resolveDevalue(flat: unknown[]): unknown {
  const cache = new Map<number, unknown>()

  function at(index: number): unknown {
    if (index === -1) return undefined
    if (cache.has(index)) return cache.get(index)

    const raw = flat[index]
    if (Array.isArray(raw)) {
      const arr: unknown[] = []
      cache.set(index, arr)
      for (const i of raw) arr.push(at(i as number))
      return arr
    }
    if (raw && typeof raw === 'object') {
      const obj: Record<string, unknown> = {}
      cache.set(index, obj)
      for (const [k, i] of Object.entries(raw)) obj[k] = at(i as number)
      return obj
    }
    cache.set(index, raw)
    return raw
  }

  return at(0)
}

interface DataNode {
  type: string
  data?: unknown[]
}

const CACHE_TTL_MS = 3000
const cache = new Map<string, { at: number; promise: Promise<SiteLibrary | null> }>()

// Lecturas cercanas del mismo slug comparten un fetch. Quien vaya a decidir una escritura debe pedir `fresh`.
export function fetchSiteLibrary(slug: string, { fresh = false } = {}): Promise<SiteLibrary | null> {
  const hit = cache.get(slug)
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise

  const promise = requestSiteLibrary(slug)
  cache.set(slug, { at: Date.now(), promise })
  // Un fallo no debe quedar cacheado.
  promise.catch(() => {
    if (cache.get(slug)?.promise === promise) cache.delete(slug)
  })
  return promise
}

async function requestSiteLibrary(slug: string): Promise<SiteLibrary | null> {
  const res = await fetch(SITE.libraryDataUrl(slug), { credentials: 'include', cache: 'no-store' })
  if (!res.ok) return null

  const json = (await res.json()) as { nodes: (DataNode | null)[] }
  for (const node of json.nodes) {
    if (node?.type !== 'data' || !node.data) continue
    const root = resolveDevalue(node.data) as
      | { media?: { id: number; userLibrary?: Omit<SiteListEntry, 'rating'> | null; userRating?: number | null } }
      | undefined
    if (root?.media) {
      const { userLibrary, userRating } = root.media
      const entry = userLibrary ? { ...userLibrary, private: !!userLibrary.private, rating: userRating ?? null } : null
      return { mediaId: root.media.id, entry }
    }
  }
  return null
}

// Elimina la entrada del usuario (status -1, igual que "Eliminar de lista" del dropdown del sitio).
export async function deleteSiteEntry(mediaId: number): Promise<void> {
  cache.clear()
  const res = await fetch(SITE.libraryApiPath, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mediaId, status: -1 }),
    credentials: 'include'
  })
  cache.clear()
  if (!res.ok) throw new Error(`site_delete_failed:${res.status}`)
}

// Envía el mismo form action que usa el modal del sitio (mediaId confirmado con la request real).
export async function saveSiteListEntry(mediaId: number, fields: Record<string, string>): Promise<void> {
  const body = new FormData()
  body.set('mediaId', String(mediaId))
  for (const [k, v] of Object.entries(fields)) body.set(k, v)

  cache.clear()
  const res = await fetch(SITE.libraryActionUrl, {
    method: 'POST',
    body,
    credentials: 'include',
    headers: SITE.actionHeaders
  })
  cache.clear()
  const result = (await res.json().catch(() => null)) as { type?: string } | null
  if (!res.ok || result?.type !== 'success') {
    throw new Error(`site_save_failed:${result?.type ?? res.status}`)
  }
}
