import { createRoot, type Root } from 'react-dom/client'
import { browser } from 'wxt/browser'
import AnimeCard from '@/components/anime-card/AnimeCard'
import { watchTheme } from '@/utils/theme-sync'
import ToastHolder from '@/components/ToastHolder'
import { pushToast } from '@/utils/toast-store'
import { sendMessage } from './background'
import '@/styles/tailwind.css'
import { routeMalError, useAnimeStore } from '@/components/anime-card/useAnimeStore'
import AnimeStrip from '@/components/anime-strip/AnimeStrip'
import type { MalListUpdate } from '@/utils/mal'
import { fetchSiteLibrary, saveSiteListEntry, type SiteListEntry } from '@/utils/site-library'
import { updateSiteStatusButton } from '@/utils/site-ui'
import { malToSnapshot, siteToSnapshot, snapshotsDiffer, snapshotToMalUpdate, snapshotToSiteFields } from '@/utils/list-sync'
import SyncModal from '@/components/sync-modal/SyncModal'
import { useSyncStore } from '@/components/sync-modal/useSyncStore'

export default defineContentScript({
  matches: ['https://animeav1.com/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',

  async main(ctx) {
    type PageKind = 'anime' | 'episode'

    const MEDIA_PATH_REGEX = /^\/media\/([^/]+)(?:\/([^/]+))?/
    const NAME_SELECTORS: Record<PageKind, string[]> = {
      episode: ['main article header a[href^="/media/"]', 'main article header a', 'main header a[href^="/media/"]'],
      anime: ['main article header h1']
    }
    const WATCH_BUTTON_SELECTOR = 'button:has(span.ic-eye), button:has(span.ic-eye-off)'

    const EPISODE_ANCHOR = 'body > div > div > div:nth-child(2)'
    const ANIME_ANCHOR = 'body > div > div.container > main > article'

    let currentSlug: string | null = null
    let currentEpisode: number | null = null
    let currentKind: PageKind | null = null
    let lastKnownWatched: boolean | null = null
    let observedButton: Element | null = null

    function parseLocation(): { kind: PageKind; slug: string; episode: number | null } | null {
      const match = MEDIA_PATH_REGEX.exec(window.location.pathname)
      if (!match) return null

      const slug = match[1]!
      const segment = match[2]
      if (segment == null) return { kind: 'anime', slug, episode: null }
      if (!/^\d+$/.test(segment)) return null

      return { kind: 'episode', slug, episode: parseInt(segment, 10) }
    }

    function getAnimeName(): string | null {
      if (!currentKind) return null
      for (const selector of NAME_SELECTORS[currentKind]) {
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

    function mountReact(container: HTMLElement, shadowHost: HTMLElement, kind: PageKind) {
      stopWatchingTheme = watchTheme(shadowHost)
      reactRoot = createRoot(container)
      reactRoot.render(kind === 'anime' ? <AnimeStrip container={container} /> : <AnimeCard container={container} />)
    }

    function unmountReact() {
      stopWatchingTheme?.()
      stopWatchingTheme = null
      reactRoot?.unmount()
      reactRoot = null
    }

    const [toastUi, syncModalUi, episodeCardUi, animeCardUi] = await Promise.all([
      createShadowRootUi(ctx, {
        name: 'mal-toast-holder',
        position: 'overlay',
        onMount: container => {
          createRoot(container).render(<ToastHolder />)
        }
      }),
      createShadowRootUi(ctx, {
        name: 'mal-sync-modal',
        position: 'overlay',
        isolateEvents: true,
        onMount: (container, _, shadowHost) => {
          const stop = watchTheme(shadowHost)
          const root = createRoot(container)
          root.render(<SyncModal />)
          return { root, stop }
        },
        onRemove: mounted => {
          mounted?.stop()
          mounted?.root.unmount()
        }
      }),
      createShadowRootUi(ctx, {
        name: 'mal-linked-view',
        position: 'inline',
        anchor: EPISODE_ANCHOR,
        append: 'first',
        isolateEvents: true,
        mode: 'closed',
        onMount: (container, _, shadowHost) => mountReact(container, shadowHost, 'episode'),
        onRemove: unmountReact
      }),
      createShadowRootUi(ctx, {
        name: 'mal-anime-card',
        position: 'inline',
        anchor: ANIME_ANCHOR,
        append: 'after',
        isolateEvents: true,
        mode: 'closed',
        onMount: (container, _, shadowHost) => mountReact(container, shadowHost, 'anime'),
        onRemove: unmountReact
      })
    ])
    toastUi.mount()
    syncModalUi.mount()

    const cardUis = { episode: episodeCardUi, anime: animeCardUi }

    let cardActive = false
    let activeKind: PageKind | null = null

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

    async function mountCard(kind: PageKind) {
      if (cardActive && activeKind === kind) return
      if (cardActive) unmountCard()
      cardActive = true
      activeKind = kind
      await hydrated
      if (!cardActive || activeKind !== kind) return
      cardUis[kind].autoMount()
    }

    function unmountCard() {
      if (!cardActive || !activeKind) return
      const kind = activeKind
      cardActive = false
      activeKind = null
      cardUis[kind].remove()
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
      if (currentEpisode == null) return

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

          if (slug == null) return

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
              void syncSiteDates(slug, response.data.status)
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

    const unsubscribeDetails = useAnimeStore.subscribe((state, prev) => {
      if (state.detailsNonce <= prev.detailsNonce) return
      if (!currentSlug || state.slug !== currentSlug || state.id == null) return
      void checkListSync(currentSlug, state.id, state.listStatus)
    })
    ctx.onInvalidated(unsubscribeDetails)

    // --- Comparación de la lista de MAL contra la del sitio -----------------

    async function checkListSync(slug: string, malId: number, malStatus: MalListStatus | null) {
      try {
        const library = await fetchSiteLibrary(slug)
        if (!library || currentSlug !== slug) return

        const mal = malToSnapshot(malStatus)
        const site = siteToSnapshot(library.entry as Record<string, unknown> | null)
        if (!snapshotsDiffer(mal, site)) return

        useSyncStore.getState().open({
          slug,
          malId,
          siteMediaId: library.mediaId,
          siteExtra: { notes: library.entry?.notes ?? '', private: library.entry?.private ?? false },
          mal,
          site
        })
      } catch (e) {
        console.log('[MAL] error comparando listas', e)
      }
    }

    // MAL fija las fechas al marcar capítulos; el sitio no, así que se las copiamos si están vacías.
    async function syncSiteDates(slug: string, malStatus: MalListStatus) {
      if (!malStatus.start_date && !malStatus.finish_date) return
      try {
        const library = await fetchSiteLibrary(slug)
        const site = siteToSnapshot(library?.entry as Record<string, unknown> | null)
        if (!library?.entry || !site) return

        const startDate = site.startDate || malStatus.start_date || ''
        const endDate = site.endDate || malStatus.finish_date || ''
        if (startDate === site.startDate && endDate === site.endDate) return

        await saveSiteListEntry(
          library.mediaId,
          snapshotToSiteFields({ ...site, startDate, endDate }, { notes: library.entry.notes ?? '', private: library.entry.private })
        )
      } catch {
        pushToast('No se pudieron actualizar las fechas en AnimeAV1', 'error')
      }
    }

    // --- Modal "Agregar a lista" del sitio -----------------------------------
    const LIST_FORM_SELECTOR = 'form[action*="/cuenta/listas?/library"]'
    let listForm: HTMLFormElement | null = null

    function readListForm(form: HTMLFormElement) {
      return Object.fromEntries(new FormData(form))
    }

    function syncListModal() {
      const form = document.querySelector<HTMLFormElement>(LIST_FORM_SELECTOR)
      if (form === listForm) return
      listForm = form
      if (form) void refreshListForm(form)
    }

    function setFormField(form: HTMLFormElement, name: string, value: string) {
      const el = form.elements.namedItem(name)
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) return
      if (el.value === value) return
      el.value = value
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }

    async function refreshListForm(form: HTMLFormElement) {
      const slug = currentSlug
      if (!slug) return

      let touched = false
      const markTouched = (e: Event) => {
        if (e.isTrusted) touched = true
      }
      form.addEventListener('input', markTouched)
      form.addEventListener('change', markTouched)

      try {
        const library = await fetchSiteLibrary(slug)
        const entry = library?.entry
        if (!entry || touched || !form.isConnected || currentSlug !== slug) return

        setFormField(form, 'status', String(entry.status))
        setFormField(form, 'episode', String(entry.episode ?? ''))
        setFormField(form, 'startDate', entry.startDate ?? '')
        setFormField(form, 'endDate', entry.endDate ?? '')
        setFormField(form, 'notes', entry.notes ?? '')
        if (entry.rating) {
          const radio = form.querySelector<HTMLInputElement>(`input[name="rating"][value="${entry.rating}"]`)
          if (radio && !radio.checked) {
            radio.checked = true
            radio.dispatchEvent(new Event('input', { bubbles: true }))
            radio.dispatchEvent(new Event('change', { bubbles: true }))
          }
        }
        const snapshot = siteToSnapshot(entry as unknown as Record<string, unknown>)
        if (snapshot) updateSiteStatusButton(snapshot.status)
      } catch {}
    }

    function buildMalUpdate(data: Record<string, unknown>): MalListUpdate | null {
      const snapshot = siteToSnapshot(data)
      return snapshot && snapshotToMalUpdate(snapshot, true, useAnimeStore.getState().score)
    }

    async function pushFormToMal(form: HTMLFormElement) {
      const slug = currentSlug
      const { id, slug: storeSlug } = useAnimeStore.getState()
      if (!slug || id == null || storeSlug !== slug) return

      const formData = readListForm(form)
      const update = buildMalUpdate(formData)
      console.log('[MAL] submit → UPDATE_LIST', {
        formRating: formData.rating ?? null,
        storeMalScore: useAnimeStore.getState().score,
        update
      })
      if (!update) return

      try {
        const res = await sendMessage({ type: 'UPDATE_LIST', id, update })
        if (routeMalError(res)) {
          pushToast('Reconecta tu cuenta de MAL para sincronizar', 'error')
          return
        }
        if (!res.ok) throw new Error(res.error)
        if (currentSlug === slug) useAnimeStore.getState().setListStatus(res.data.status)
        pushToast('Lista de MAL actualizada')
      } catch {
        pushToast('No se pudo actualizar tu lista en MAL. Se volverá a comparar al recargar', 'error')
      }
    }

    function handleDocumentSubmit(event: SubmitEvent) {
      const form = event.target
      if (!(form instanceof HTMLFormElement) || !form.matches(LIST_FORM_SELECTOR)) return
      void pushFormToMal(form)
    }

    document.addEventListener('submit', handleDocumentSubmit, true)
    ctx.onInvalidated(() => document.removeEventListener('submit', handleDocumentSubmit, true))

    // Dropdown de estado del sitio: POST a /api/user/library. "Eliminar de lista" nunca se replica en MAL.
    const DROPDOWN_ACTIONS: Record<string, number | 'delete'> = {
      viendo: 0,
      'por ver': 1,
      completado: 2,
      pausado: 3,
      descartado: 4,
      'eliminar de lista': 'delete'
    }
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    // El request del sitio no es observable desde aquí: se espera a que el servidor refleje el cambio y se copia a MAL.
    async function pushDropdownToMal(status: number) {
      const slug = currentSlug
      const { id, slug: storeSlug } = useAnimeStore.getState()
      if (!slug || id == null || storeSlug !== slug) return

      try {
        let entry: SiteListEntry | null = null
        for (let attempt = 0; attempt < 10 && entry?.status !== status; attempt++) {
          await sleep(400)
          if (currentSlug !== slug) return
          entry = (await fetchSiteLibrary(slug))?.entry ?? null
        }
        if (entry?.status !== status) throw new Error('site_not_settled')

        const snapshot = siteToSnapshot(entry as unknown as Record<string, unknown>)
        if (!snapshot) throw new Error('bad_entry')
        // Sin borrar fechas: solo cambió el estado, no se pidió limpiar nada.
        const res = await sendMessage({ type: 'UPDATE_LIST', id, update: snapshotToMalUpdate(snapshot, false, useAnimeStore.getState().score) })
        if (routeMalError(res)) return
        if (!res.ok) throw new Error(res.error)
        if (currentSlug === slug) useAnimeStore.getState().setListStatus(res.data.status)
        pushToast('Estado actualizado en MAL')
      } catch {
        pushToast('No se pudo actualizar tu lista en MAL. Se volverá a comparar al recargar', 'error')
      }
    }

    function handleMenuItemClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return
      const item = event.target.closest('[data-dropdown-menu-item]')
      const action = DROPDOWN_ACTIONS[item?.textContent?.trim().toLowerCase() ?? '']
      if (action === undefined) return
      if (action === 'delete') {
        pushToast('No se puede eliminar un anime de MAL; solo se elimina de AnimeAV1', 'error')
        return
      }
      void pushDropdownToMal(action)
    }

    document.addEventListener('click', handleMenuItemClick, true)
    ctx.onInvalidated(() => document.removeEventListener('click', handleMenuItemClick, true))

    // -------------------------------------------------------------------------

    function handleNavigation() {
      const parsed = parseLocation()

      if (!parsed) {
        currentSlug = null
        currentEpisode = null
        currentKind = null
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
      currentKind = parsed.kind

      if (slugChanged) {
        useSyncStore.getState().close()
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

      mountCard(parsed.kind)
      maybeResolve()
      syncButtonBaseline()
    }

    let lastHref = window.location.href
    const rootObserver = new MutationObserver(() => {
      syncListModal()

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
