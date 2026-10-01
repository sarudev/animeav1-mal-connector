import { createRoot, type Root } from 'react-dom/client'
import { browser } from 'wxt/browser'
import AnimeCard from '@/components/linked-card/AnimeCard'
import { watchTheme } from '@/utils/theme-sync'
import ToastHolder from '@/components/ToastHolder'
import { pushToast } from '@/utils/toast-store'
import { sendMessage } from './background'
import '@/styles/tailwind.css'
import { useAnimeStore } from '@/components/linked-card/useAnimeStore'

export default defineContentScript({
  matches: ['https://animeav1.com/*'],
  // Con autoMount() el DOM no tiene que estar listo. Si querés arrancar todavía
  // antes, probá 'document_start' (verificá que nada asuma DOM ya renderizado).
  runAt: 'document_idle',
  cssInjectionMode: 'ui',

  async main(ctx) {
    ;(window as any).__malConnectorContentLoaded = true

    const MEDIA_PATH_REGEX = /^\/media\/([^/]+)(?:\/([^/]+))?/
    // No depender de la jerarquía de divs de AnimeAV1: cambia con frecuencia.
    const NAME_SELECTORS = ['main article header a[href^="/media/"]', 'main article header a', 'main header a[href^="/media/"]']
    const WATCH_BUTTON_SELECTOR = 'button:has(span.ic-eye), button:has(span.ic-eye-off)'

    let currentSlug: string | null = null
    let currentEpisode: number | null = null
    let lastSentName: string | null = null
    let lastSentSlug: string | null = null
    let lastKnownWatched: boolean | null = null
    let observedButton: Element | null = null

    function parseLocation() {
      const match = MEDIA_PATH_REGEX.exec(window.location.pathname)
      if (!match) return null

      const slug = match[1]!
      const episodeSegment = match[2]
      // La extensión solo actúa en un episodio, no en /media/{name}.
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
      } catch {
        // El contexto de la extensión puede invalidarse (recarga/actualización);
        // no hay nada útil que hacer aquí.
      }
    }

    // --- UIs (React, en Shadow Root) ----------------------------------------
    // Se crean una sola vez y en paralelo, al inicio. El montaje de la tarjeta
    // no depende de la red: autoMount() espera al anchor y monta apenas aparece.

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

    function maybeSendNameUpdate() {
      if (!currentSlug) return
      const name = getAnimeName()
      if (currentSlug !== lastSentSlug || (name && name !== lastSentName)) {
        lastSentSlug = currentSlug
        lastSentName = name
        sendMessageSafe({ type: 'PAGE_CONTEXT', slug: currentSlug, name })
      }
      resolveForSlug(currentSlug)
    }

    // Registra el estado actual del botón como línea base, sin depender de
    // MutationObserver (SvelteKit suele reemplazar los nodos del ícono en vez
    // de mutar su atributo class, lo que hace que un observer atado a la
    // referencia vieja deje de funcionar tras el primer re-render).
    function syncButtonBaseline() {
      const button = getWatchButton()
      if (!button || button === observedButton) return
      observedButton = button
      lastKnownWatched = getWatchedStateFromButton(button)
    }

    // Detecta el toggle reaccionando al clic (delegado y en fase de captura,
    // para no depender de que el listener de Svelte no detenga la
    // propagación). El cambio de clase puede tardar (animeav1 espera la
    // respuesta del servidor antes de actualizar el ícono), así que se hace
    // polling en vez de un único setTimeout fijo.
    const WATCH_POLL_INTERVAL_MS = 150
    const WATCH_POLL_MAX_ATTEMPTS = 20 // ~3s en total

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

          sendMessageSafe({
            type: 'TOGGLE_WATCHED',
            slug,
            episode,
            watched
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
    // Cache del resultado de GET_LINK por slug, para no repetir la llamada cada
    // vez que el observer reintenta mientras todavía no aparece el nombre.
    let linkCache: { slug: string; id: number | null } | null = null

    async function resolveForSlug(slug: string) {
      if (resolvedSlug === slug || resolvingSlug === slug) return
      resolvingSlug = slug
      const stale = () => currentSlug !== slug

      try {
        const store = useAnimeStore.getState()

        // 1) Enlace existente
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

        // 2) Si no hay enlace, intentar auto-vincular
        if (id == null) {
          const name = getAnimeName()
          if (!name) return // el observer reintentará cuando aparezca el nombre

          store.setTitle(name)
          resolvedSlug = slug
          const result = await sendMessage({ type: 'AUTO_LINK_ANIME', slug, name })
          if (stale()) return

          id = result.ok ? result.data.id : null
          if (result.ok && result.data.autoLinked && id) {
            pushToast('Vinculado automáticamente con MAL')
          }

          if (id == null) {
            // Sin coincidencia: pasamos al formulario de vinculación.
            store.setId(null)
            store.setView('link-form')
            store.setLoading(false)
            return
          }
        }

        resolvedSlug = slug
        store.setId(id)

        // 3) Detalles de MAL
        const res = await sendMessage({ type: 'GET_DETAILS', id })
        if (stale()) return
        if (!res.ok || !res.data.details) {
          pushToast(`No se pudieron obtener los detalles de MAL para ${slug}`, 'error')
          store.setLoading(false)
          return
        }

        const data = res.data.details
        store.setTitle(data.title)
        store.setStatus(data.my_list_status?.status ?? null)
        store.setScore(data.my_list_status?.score ?? 0)
        store.setWatchedEpisodes(data.my_list_status?.num_episodes_watched ?? 0)
        store.setTotalEpisodes(data.num_episodes)
        store.setPicture(data.main_picture.medium)
        store.setLoading(false)
      } finally {
        if (resolvingSlug === slug) resolvingSlug = null
      }
    }

    // -------------------------------------------------------------------------

    function handleNavigation() {
      const parsed = parseLocation()

      if (!parsed) {
        currentSlug = null
        currentEpisode = null
        lastSentName = null
        observedButton = null
        lastSentSlug = null
        resolvedSlug = null
        resolvingSlug = null
        linkCache = null
        unmountCard()
        return
      }

      const slugChanged = parsed.slug !== currentSlug

      currentSlug = parsed.slug
      currentEpisode = parsed.episode

      if (slugChanged) {
        lastSentName = null
        lastKnownWatched = null
        lastSentSlug = null
        resolvedSlug = null
        resolvingSlug = null
        linkCache = null
        observedButton = null

        // Store limpio ANTES de montar, así no se ve el anime anterior.
        const store = useAnimeStore.getState()
        store.reset()
        store.setSlug(parsed.slug)
        store.setLoading(true)
      }

      mountCard() // no espera a nada más
      maybeSendNameUpdate()
      syncButtonBaseline()
    }

    // AnimeAv1 es una SPA: la URL puede cambiar sin recargar la página.
    let lastHref = window.location.href
    const rootObserver = new MutationObserver(() => {
      if (window.location.href !== lastHref) {
        lastHref = window.location.href
        handleNavigation()
      } else {
        maybeSendNameUpdate()
        syncButtonBaseline()
      }
    })

    rootObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    })

    handleNavigation()

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'PING') {
        sendResponse({ ok: true })
        return
      }
    })

    // Nota: ya no hace falta escuchar browser.storage.onChanged acá para
    // refrescar la tarjeta — LinkedCard se suscribe a los cambios de
    // storage.local por su cuenta (ver LinkedCard.tsx). Si el link cambia
    // desde el popup mientras esta pestaña está abierta, el componente se
    // actualiza solo.
  }
})
