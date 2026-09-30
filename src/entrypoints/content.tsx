import { createRoot, type Root } from 'react-dom/client'
import { browser } from 'wxt/browser'
import AnimeCard from '@/components/linked-card/AnimeCard'
import { watchTheme } from '@/utils/theme-sync'
import type { MalAnime } from '@/utils/mal'
import ToastHolder from '@/components/ToastHolder'
import { pushToast } from '@/utils/toast-store'
import { sendMessage } from './background'
import '@/styles/tailwind.css'
import { useAnimeStore } from '@/components/linked-card/state'

export default defineContentScript({
  matches: ['https://animeav1.com/*'],
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

      const slug = match[1]
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

    const toastUi = await createShadowRootUi(ctx, {
      name: 'mal-toast-holder',
      position: 'overlay',
      onMount: container => {
        createRoot(container).render(<ToastHolder />)
      }
    })
    toastUi.mount()

    function maybeSendNameUpdate() {
      if (!currentSlug) return
      const name = getAnimeName()
      if (currentSlug !== lastSentSlug || (name && name !== lastSentName)) {
        lastSentSlug = currentSlug
        lastSentName = name
        sendMessageSafe({ type: 'PAGE_CONTEXT', slug: currentSlug, name })
      }
      resolveAndMountForSlug(currentSlug)
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

    // --- UI inyectada (React, en Shadow Root) -------------------------------

    let reactRoot: Root | null = null
    let uiMounted = false
    let resolvedSlug: string | null = null
    let resolving = false
    let stopWatchingTheme: (() => void) | null = null

    async function mountUi(slug: string, id: number | null, results: MalAnime[] | null, data: MalAnime) {
      if (!uiMounted) {
        const ui = await createShadowRootUi(ctx, {
          name: 'mal-linked-view',
          position: 'inline',
          anchor: 'body > div > div > div:nth-child(2)',
          append: 'first',
          onMount: (container, _, shadowHost) => {
            const { setSlug, setId, setTitle, setStatus, setScore, setWatchedEpisodes, setTotalEpisodes, setPicture } = useAnimeStore.getState()

            setSlug(slug)
            setId(id)
            setTitle(data.title)
            setStatus(data.my_list_status!.status)
            setScore(data.my_list_status!.score)
            setWatchedEpisodes(data.my_list_status!.num_episodes_watched)
            setTotalEpisodes(data.num_episodes)
            setPicture(data.main_picture.medium)

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
        ui.mount()
        uiMounted = true
      } else {
        console.error(`La UI ya está montada para ${slug}`)
      }
    }

    function unmountUi() {
      reactRoot?.unmount()
      reactRoot = null
      uiMounted = false
    }

    // Punto único de decisión: no se monta nada hasta saber con certeza si el
    // anime ya está vinculado, o hasta que se agotó el intento de auto-vínculo.
    async function resolveAndMountForSlug(slug: string) {
      if (resolvedSlug === slug || resolving) return
      resolving = true
      try {
        const existing = await sendMessage({ type: 'GET_LINK', slug })
        if (!existing?.ok) {
          pushToast(`No se pudo obtener el enlace existente para ${slug}`, 'error')
          return
        }
        if (existing.data.id != null) {
          resolvedSlug = slug
          const res = await sendMessage({ type: 'GET_DETAILS', slug })
          if (!res.ok) {
            pushToast(`No se pudieron obtener los detalles de MAL para ${slug}`, 'error')
            return
          }
          await mountUi(slug, existing.data.id, null, res.data.details)
          return
        }

        const name = getAnimeName()
        if (!name) return

        resolvedSlug = slug
        const result = await sendMessage({ type: 'AUTO_LINK_ANIME', slug, name })
        const link = result.ok ? (result.data.id ?? null) : null
        const results = result.ok ? (result.data.results ?? null) : null

        if (result?.ok && result.data.autoLinked && result.data.id) {
          pushToast(`Vinculado automáticamente con MAL`)
        }

        const res = await sendMessage({ type: 'GET_DETAILS', slug })
        if (!res.ok || !res.data.details) {
          pushToast(`No se pudieron obtener los detalles de MAL para ${name}`, 'error')
          return
        }
        await mountUi(slug, link, results, res.data.details)
      } finally {
        resolving = false
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

        unmountUi()
        return
      }

      const slugChanged = parsed.slug !== currentSlug

      currentSlug = parsed.slug!
      currentEpisode = parsed.episode

      if (slugChanged) {
        lastSentName = null
        lastKnownWatched = null
        lastSentSlug = null
        resolvedSlug = null
        observedButton = null
        unmountUi() // evita ver la tarjeta del anime anterior mientras se resuelve el nuevo
      }

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
