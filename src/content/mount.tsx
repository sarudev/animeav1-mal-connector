import { createRoot, type Root } from 'react-dom/client'
import { createShadowRootUi, type ContentScriptContext } from '#imports'
import AnimeCard from '@/components/anime-card/AnimeCard'
import AnimeStrip from '@/components/anime-strip/AnimeStrip'
import SyncModal from '@/components/sync-modal/SyncModal'
import DeleteEntryModal from '@/components/delete-modal/DeleteEntryModal'
import ToastHolder from '@/components/ToastHolder'
import { SITE } from '@/utils/site-contract'
import { watchTheme } from '@/utils/theme-sync'
import type { PageKind } from './state'

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

// Esperar a que Svelte hidrate evita que reemplace nuestro nodo al montarse.
function whenHydrated(): Promise<void> {
  return new Promise(resolve => {
    if (document.getElementById(SITE.hydrationMarkerId)) return resolve()
    const done = () => {
      obs.disconnect()
      clearTimeout(timer)
      resolve()
    }
    const obs = new MutationObserver(() => {
      if (document.getElementById(SITE.hydrationMarkerId)) done()
    })
    obs.observe(document.documentElement, { childList: true, subtree: true })
    const timer = setTimeout(done, 10000)
  })
}

// Crea las UIs en Shadow Root: toasts y modal de diferencias siempre montados; las tarjetas según la página.
export async function createUis(ctx: ContentScriptContext) {
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
        root.render(
          <>
            <SyncModal />
            <DeleteEntryModal />
          </>
        )
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
      anchor: SITE.selectors.episodeAnchor,
      append: 'first',
      isolateEvents: true,
      mode: 'closed',
      onMount: (container, _, shadowHost) => mountReact(container, shadowHost, 'episode'),
      onRemove: unmountReact
    }),
    createShadowRootUi(ctx, {
      name: 'mal-anime-card',
      position: 'inline',
      anchor: SITE.selectors.animeAnchor,
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
  const hydrated = whenHydrated()
  let cardActive = false
  let activeKind: PageKind | null = null

  function unmountCard() {
    if (!cardActive || !activeKind) return
    const kind = activeKind
    cardActive = false
    activeKind = null
    cardUis[kind].remove()
  }

  async function mountCard(kind: PageKind) {
    if (cardActive && activeKind === kind) return
    if (cardActive) unmountCard()
    cardActive = true
    activeKind = kind
    await hydrated
    if (!cardActive || activeKind !== kind) return
    cardUis[kind].autoMount()
  }

  return { mountCard, unmountCard }
}
