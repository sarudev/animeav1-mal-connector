import { createRoot, type Root } from 'react-dom/client'
import { browser } from 'wxt/browser'
import AnimeCard from '@/components/anime-card/AnimeCard'
import { watchTheme } from '@/utils/theme-sync'
import ToastHolder from '@/components/ToastHolder'
import { pushToast } from '@/utils/toast-store'
import { sendMessage } from './background'
import '@/styles/tailwind.css'
import { routeMalError, useAnimeStore } from '@/components/anime-card/useAnimeStore'

export default defineContentScript({
  matches: ['https://animeav1.com/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',

  async main(ctx) {
    const MEDIA_PATH_REGEX = /^\/media\/([^/]+)(?:\/([^/]+))?/
    const NAME_SELECTORS = ['main article header a[href^="/media/"]', 'main article header a', 'main header a[href^="/media/"]']
    const WATCH_BUTTON_SELECTOR = 'button:has(span.ic-eye), button:has(span.ic-eye-off)'

    let currentSlug: string | null = null
    let currentEpisode: number | null = null
    let lastKnownWatched: boolean | null = null
    let observedButton: Element | null = null

    function parseLocation() {
      const match = MEDIA_PATH_REGEX.exec(window.location.pathname)
      if (!match) return null

      const slug = match[1]!
      const episodeSegment = match[2]
      if (!/^\d+$/.test(episodeSegment || '')) return null
      const episode = parseInt(episodeSegment!, 10)

      return { slug, episode }
    }

    function getAnimeName(): string | null {
      for (const selector of NAME_SELECTORS) {
        const el = document.querySelector(selector)
        const name = el?.textContent?.trim()
        if (name) return name
      }
      return null
    }

    function getWatchButton(): Element | null {
      return document.querySelector(WATCH_BUTTON_SELECTOR)
    }

    function getWatchedStateFromButton(button: Element): boolean | null {
      const span = button.querySelector('span')
      if (!span) return null
      if (span.classList.contains('ic-eye-off')) return true
      if (span.classList.contains('ic-eye')) return false
      return null
    }

    function sendMessageSafe(message: Message) {
      try {
        browser.runtime.sendMessage(message)
      } catch {}
    }

    // --- UIs (React, en Shadow Root) ----------------------------------------

    let reactRoot: Root | null = null
    let stopWatchingTheme: (() => void) | null = null

    const [toastUi, cardUi] = await Promise.all([
      createShadowRootUi(ctx, {
        name: 'mal-toast-holder',
        position: 'overlay',
        onMount: container => {
          createRoot(container).render(<ToastHolder />)
        }
      }),
      createShadowRootUi(ctx, {
        name: 'mal-linked-view',
        position: 'inline',
        anchor: 'body > div > div > div:nth-child(2)',
        append: 'first',
        isolateEvents: true,
        mode: 'closed',
        onMount: (container, _, shadowHost) => {
          stopWatchingTheme = watchTheme(shadowHost)
          reactRoot = createRoot(container)
          reactRoot.render(<AnimeCard container={container} />)
        },
        onRemove: () => {
          stopWatchingTheme?.()
          stopWatchingTheme = null
          reactRoot?.unmount()
          reactRoot = null
        }
      })
    ])
    toastUi.mount()

    let cardActive = false

    function whenHydrated(): Promise<void> {
      return new Promise(resolve => {
        if (document.getElementById('svelte-announcer')) return resolve()
        const done = () => {
          obs.disconnect()
          clearTimeout(timer)
          resolve()
        }
        const obs = new MutationObserver(() => {
          if (document.getElementById('svelte-announcer')) done()
        })
        obs.observe(document.documentElement, { childList: true, subtree: true })
        const timer = setTimeout(done, 10000)
      })
    }

    const hydrated = whenHydrated()

    async function mountCard() {
      if (cardActive) return
      cardActive = true
      await hydrated
      if (!cardActive) return
      cardUi.autoMount()
    }

    function unmountCard() {
      if (!cardActive) return
      cardActive = false
      cardUi.remove()
    }

    // --- Detección del botón "visto" ----------------------------------------

    function maybeResolve() {
      if (currentSlug) resolveForSlug(currentSlug)
    }

    function syncButtonBaseline() {
      const button = getWatchButton()
      if (!button || button === observedButton) return
      observedButton = button
      lastKnownWatched = getWatchedStateFromButton(button)
    }

    const WATCH_POLL_INTERVAL_MS = 150
    const WATCH_POLL_MAX_ATTEMPTS = 20

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as HTMLElement
      const clickedButton = target.closest(WATCH_BUTTON_SELECTOR)
      if (!clickedButton) return

      const slug = currentSlug
      const episode = currentEpisode
      const baselineWatched = lastKnownWatched
      let attempts = 0

      const poll = () => {
        attempts += 1
        const freshButton = getWatchButton()
        const watched = freshButton ? getWatchedStateFromButton(freshButton) : null

        if (watched !== null && watched !== baselineWatched) {
          lastKnownWatched = watched
          observedButton = freshButton

          if (slug == null || episode == null) return

          console.log({ slug, episode, baselineWatched, attempts })
          void sendMessage({
            type: 'TOGGLE_WATCHED',
            slug,
            episode,
            watched
          })
            .then(response => {
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
              if (currentSlug === slug) store.setListStatus(response.data.status)

              if (!watched) {
                const reopened = prevStatus === 'completed' && response.data.status.status === 'watching'
                pushToast(`Capítulo ${episode} marcado como no visto${reopened ? '; anime vuelve a estar viendo' : ''}`)
                return
              }

              const completed = response.data.status.status === 'completed'
              pushToast(`Capítulo ${episode} marcado como visto${completed ? '. Anime completado' : ''}`)
            })
            .catch(() => {
              pushToast(`No se pudo actualizar el capítulo ${episode} en MAL`, 'error')
            })
          return
        }

        if (attempts >= WATCH_POLL_MAX_ATTEMPTS) {
          return
        }

        setTimeout(poll, WATCH_POLL_INTERVAL_MS)
      }

      setTimeout(poll, WATCH_POLL_INTERVAL_MS)
    }

    document.addEventListener('click', handleDocumentClick, true)

    // --- Resolución de datos (solo llena el store) --------------------------

    let resolvedSlug: string | null = null
    let resolvingSlug: string | null = null
    let linkCache: { slug: string; id: number | null } | null = null

    async function resolveForSlug(slug: string) {
      if (resolvedSlug === slug || resolvingSlug === slug) return
      resolvingSlug = slug
      const stale = () => currentSlug !== slug

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

    const unsubscribeReconnect = useAnimeStore.subscribe((state, prev) => {
      if (state.reconnectNonce <= prev.reconnectNonce || !currentSlug) return
      resolvedSlug = null
      resolvingSlug = null
      linkCache = null
      void resolveForSlug(currentSlug)
    })
    ctx.onInvalidated(unsubscribeReconnect)

    // -------------------------------------------------------------------------

    function handleNavigation() {
      const parsed = parseLocation()

      if (!parsed) {
        currentSlug = null
        currentEpisode = null
        observedButton = null
        resolvedSlug = null
        resolvingSlug = null
        linkCache = null
        sendMessageSafe({ type: 'CLEAR_BADGE' })
        unmountCard()
        return
      }

      const slugChanged = parsed.slug !== currentSlug

      currentSlug = parsed.slug
      currentEpisode = parsed.episode

      if (slugChanged) {
        lastKnownWatched = null
        resolvedSlug = null
        resolvingSlug = null
        linkCache = null
        observedButton = null

        const store = useAnimeStore.getState()
        store.reset()
        store.setSlug(parsed.slug)
        store.setLoading(true)
      }

      mountCard()
      maybeResolve()
      syncButtonBaseline()
    }

    let lastHref = window.location.href
    const rootObserver = new MutationObserver(() => {
      if (window.location.href !== lastHref) {
        lastHref = window.location.href
        handleNavigation()
      } else {
        maybeResolve()
        syncButtonBaseline()
      }
    })

    rootObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    })

    handleNavigation()
  }
})
