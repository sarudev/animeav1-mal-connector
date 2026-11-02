import { sendMessage } from '@/entrypoints/background'
import { routeMalError, useAnimeStore } from '@/components/anime-card/useAnimeStore'
import { pushToast } from '@/utils/toast-store'
import { checkListSync } from './list-sync-check'
import { getAnimeName, page } from './state'

let resolvedSlug: string | null = null
let resolvingSlug: string | null = null
let linkCache: { slug: string; id: number | null } | null = null

export function resetResolution() {
  resolvedSlug = null
  resolvingSlug = null
  linkCache = null
}

export function maybeResolve() {
  if (page.slug) void resolveForSlug(page.slug)
}

// Solo llena el store: la UI reacciona a él.
async function resolveForSlug(slug: string) {
  if (resolvedSlug === slug || resolvingSlug === slug) return
  resolvingSlug = slug
  const stale = () => page.slug !== slug

  try {
    const store = useAnimeStore.getState()

    const status = await sendMessage({ type: 'GET_MAL_STATUS' })
    if (stale()) return
    if (status.ok && !status.data.configured) {
      resolvedSlug = slug
      store.setAuthRequired()
      return
    }

    let id: number | null
    if (linkCache?.slug === slug) {
      id = linkCache.id
    } else {
      const existing = await sendMessage({ type: 'GET_LINK', slug })
      if (stale()) return
      if (!existing?.ok) {
        pushToast(`No se pudo obtener el enlace existente para ${slug}`, 'error')
        store.setLoading(false)
        return
      }
      id = existing.data.id
      linkCache = { slug, id }
    }

    if (id == null) {
      const name = getAnimeName()
      if (!name) return

      store.setTitle(name)
      resolvedSlug = slug
      const result = await sendMessage({ type: 'AUTO_LINK_ANIME', slug, name })
      if (routeMalError(result)) return
      if (stale()) return

      id = result.ok ? result.data.id : null
      if (result.ok && result.data.autoLinked && id) {
        pushToast('Vinculado automáticamente con MAL')
      } else if (!result.ok || !result.data.autoLinked) {
        pushToast('No se pudo vincular automáticamente con MAL', 'error')
      }

      if (id == null) {
        store.setId(null)
        store.setView('link-form')
        store.setLoading(false)
        return
      }
    }

    resolvedSlug = slug
    store.setId(id)

    const res = await sendMessage({ type: 'GET_DETAILS', id })
    if (routeMalError(res)) return
    if (stale()) return
    if (!res.ok || !res.data.details) {
      pushToast(`No se pudieron obtener los detalles de MAL para ${slug}`, 'error')
      store.setLoading(false)
      return
    }

    store.setDetails(res.data.details)
    store.setLoading(false)
  } finally {
    if (resolvingSlug === slug) resolvingSlug = null
  }
}

export function initResolution(ctx: { onInvalidated: (cb: () => void) => void }) {
  // Reconexión de la cuenta: se vuelve a resolver desde cero.
  const unsubscribeReconnect = useAnimeStore.subscribe((state, prev) => {
    if (state.reconnectNonce <= prev.reconnectNonce || !page.slug) return
    resetResolution()
    maybeResolve()
  })

  // Cada vez que llegan detalles (auto-vinculación, vinculación manual, reconexión) se compara contra el sitio.
  const unsubscribeDetails = useAnimeStore.subscribe((state, prev) => {
    if (state.detailsNonce <= prev.detailsNonce) return
    if (!page.slug || state.slug !== page.slug || state.id == null) return
    void checkListSync(page.slug, state.id, state.listStatus)
  })

  ctx.onInvalidated(() => {
    unsubscribeReconnect()
    unsubscribeDetails()
  })
}
