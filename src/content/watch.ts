import { sendMessage } from '@/entrypoints/background'
import { routeMalError, useAnimeStore } from '@/components/anime-card/useAnimeStore'
import { logger } from '@/utils/logger'
import { opKey, startOperation } from '@/utils/operations'
import { SITE } from '@/utils/site-contract'
import { pushToast } from '@/utils/toast-store'
import { reloadNow, updateSiteStatusButton } from '@/utils/site-ui'
import { syncSiteFromMal } from './list-sync-check'
import { page, watchGuard } from './state'

const POLL_INTERVAL_MS = 150
const POLL_MAX_ATTEMPTS = 20

let lastKnownWatched: boolean | null = null
let observedButton: Element | null = null

function getWatchButton(): Element | null {
  return document.querySelector(SITE.selectors.watchButton)
}

function getWatchedStateFromButton(button: Element): boolean | null {
  const span = button.querySelector('span')
  if (!span) return null
  if (span.classList.contains(SITE.selectors.watchIconWatched)) return true
  if (span.classList.contains(SITE.selectors.watchIconUnwatched)) return false
  return null
}

export function resetWatchState() {
  lastKnownWatched = null
  observedButton = null
}

export function syncButtonBaseline() {
  const button = getWatchButton()
  if (!button || button === observedButton) return
  observedButton = button
  lastKnownWatched = getWatchedStateFromButton(button)
}

async function pushWatched(slug: string, episode: number, watched: boolean) {
  const isLatest = startOperation(opKey.malList(slug))
  watchGuard.busy += 1
  try {
    const response = await sendMessage({ type: 'TOGGLE_WATCHED', slug, episode, watched })
    if (!response.ok) {
      if (routeMalError(response)) {
        pushToast('Reconecta tu cuenta de MAL para sincronizar', 'error')
        return
      }
      pushToast(`No se pudo actualizar el capítulo ${episode} en MAL`, 'error')
      return
    }

    if (response.data.skipped || !response.data.status) return

    const store = useAnimeStore.getState()
    const prevStatus = store.status
    if (page.slug === slug && isLatest()) store.setListStatus(response.data.status)

    const newStatus = response.data.status.status
    const message = watched
      ? `Capítulo ${episode} marcado como visto${newStatus === 'completed' ? '. Anime completado' : ''}`
      : `Capítulo ${episode} marcado como no visto${prevStatus === 'completed' && newStatus === 'watching' ? '; anime vuelve a estar viendo' : ''}`

    // Marcar visto no necesita recarga (la tarjeta ya se actualiza sola); desmarcar sí, por el estado Svelte del sitio.
    const synced = await syncSiteFromMal(slug, response.data.status)
    if (synced && !watched) reloadNow(message)
    else {
      if (synced) updateSiteStatusButton(synced)
      pushToast(message)
    }
  } catch (e) {
    logger.error('TOGGLE_WATCHED falló', e)
    pushToast(`No se pudo actualizar el capítulo ${episode} en MAL`, 'error')
  } finally {
    watchGuard.busy -= 1
    watchGuard.until = Date.now() + 600
  }
}

function handleDocumentClick(event: MouseEvent) {
  if (page.episode == null) return
  if (!(event.target instanceof Element) || !event.target.closest(SITE.selectors.watchButton)) return

  watchGuard.until = Date.now() + 1000
  const slug = page.slug
  const episode = page.episode
  const baselineWatched = lastKnownWatched
  let attempts = 0

  // El sitio actualiza el icono con retraso: se espera a que cambie respecto al estado previo.
  const poll = () => {
    attempts += 1
    const freshButton = getWatchButton()
    const watched = freshButton ? getWatchedStateFromButton(freshButton) : null

    if (watched !== null && watched !== baselineWatched) {
      lastKnownWatched = watched
      observedButton = freshButton
      if (slug != null) void pushWatched(slug, episode, watched)
      return
    }

    if (attempts < POLL_MAX_ATTEMPTS) setTimeout(poll, POLL_INTERVAL_MS)
    // Sin cambio en el botón (p. ej. el sitio abrió su modal): no hay toggle que proteger.
    else watchGuard.until = 0
  }

  setTimeout(poll, POLL_INTERVAL_MS)
}

export function initWatchDetection(ctx: { onInvalidated: (cb: () => void) => void }) {
  document.addEventListener('click', handleDocumentClick, true)
  ctx.onInvalidated(() => document.removeEventListener('click', handleDocumentClick, true))
}
