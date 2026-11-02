import { browser } from 'wxt/browser'
import '@/styles/tailwind.css'
import { useAnimeStore } from '@/components/anime-card/useAnimeStore'
import { useSyncStore } from '@/components/sync-modal/useSyncStore'
import { createUis } from '@/content/mount'
import { maybeResolve, initResolution, resetResolution } from '@/content/resolve'
import { initSiteDropdown } from '@/content/site-dropdown'
import { initSiteForm, syncListModal } from '@/content/site-form'
import { initSiteRequestWatcher } from '@/content/site-sync'
import { page, parseLocation } from '@/content/state'
import { initWatchDetection, resetWatchState, syncButtonBaseline } from '@/content/watch'
import { logger } from '@/utils/logger'
import { showPendingToast } from '@/utils/site-ui'
import type { Message } from '@/utils/types'

export default defineContentScript({
  matches: ['https://animeav1.com/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',

  async main(ctx) {
    function sendMessageSafe(message: Message) {
      try {
        browser.runtime.sendMessage(message).catch(e => logger.warn('no se pudo enviar el mensaje', e))
      } catch (e) {
        logger.warn('no se pudo enviar el mensaje', e)
      }
    }

    const { mountCard, unmountCard } = await createUis(ctx)
    showPendingToast()

    initWatchDetection(ctx)
    initResolution(ctx)
    initSiteForm(ctx)
    initSiteDropdown(ctx)
    initSiteRequestWatcher(ctx)

    function handleNavigation() {
      const parsed = parseLocation()

      if (!parsed) {
        page.slug = null
        page.episode = null
        page.kind = null
        resetWatchState()
        resetResolution()
        sendMessageSafe({ type: 'CLEAR_BADGE' })
        unmountCard()
        return
      }

      const slugChanged = parsed.slug !== page.slug

      page.slug = parsed.slug
      page.episode = parsed.episode
      page.kind = parsed.kind

      if (slugChanged) {
        useSyncStore.getState().close()
        resetWatchState()
        resetResolution()

        const store = useAnimeStore.getState()
        store.reset()
        store.setSlug(parsed.slug)
        store.setLoading(true)
      }

      void mountCard(parsed.kind)
      maybeResolve()
      syncButtonBaseline()
    }

    // La web es una SPA: los cambios de ruta y de DOM se detectan observando el documento.
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
    ctx.onInvalidated(() => rootObserver.disconnect())

    handleNavigation()
  }
})
