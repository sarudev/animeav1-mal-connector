import { sendMessage } from '@/entrypoints/background'
import { routeMalError, useAnimeStore } from '@/components/anime-card/useAnimeStore'
import { reopenIfIncomplete, siteToSnapshot, snapshotsDiffer, snapshotToMalUpdate, snapshotToSiteFields } from '@/utils/list-sync'
import { logger } from '@/utils/logger'
import { confirmLink } from '@/utils/link-confirm'
import { opKey, startOperation } from '@/utils/operations'
import { SITE } from '@/utils/site-contract'
import { fetchSiteLibrary, saveSiteListEntry } from '@/utils/site-library'
import { updateSiteStatusButton } from '@/utils/site-ui'
import { pushToast } from '@/utils/toast-store'
import { currentMalSnapshot, page, sleep, watchGuardActive } from './state'

const running = new Set<string>()

// Copia a MAL lo que el sitio tenga ahora en su lista, si difiere de lo que MAL ya tiene.
// Sirve para cualquier cambio hecho desde la UI del sitio (dropdown, modal "marcar hasta el anterior", etc.).
// `expectStatus` espera a que el servidor refleje un estado concreto (cuando conocemos el cambio por el click).
export async function reconcileSiteToMal(slug: string, expectStatus?: number) {
  // Si es un toggle de visto, la extensión ya se encarga: se espera a que termine y entonces se compara
  // (si el sitio abrió su propio modal, no hay toggle y la espera acaba pronto).
  for (let i = 0; i < 40 && watchGuardActive(); i++) await sleep(100)
  if (watchGuardActive()) return

  const { id, slug: storeSlug } = useAnimeStore.getState()
  if (!slug || id == null || storeSlug !== slug || running.has(slug)) return

  running.add(slug)
  const isLatestClick = startOperation(opKey.dropdown(slug))
  try {
    let library = await fetchSiteLibrary(slug, { fresh: true })
    for (let attempt = 0; expectStatus !== undefined && library?.entry?.status !== expectStatus && attempt < 10; attempt++) {
      await sleep(400)
      if (page.slug !== slug || !isLatestClick()) return
      library = await fetchSiteLibrary(slug, { fresh: true })
    }
    if (expectStatus !== undefined && library?.entry?.status !== expectStatus) throw new Error('site_not_settled')

    // Sin entrada no hay nada que copiar: eliminar nunca se replica en MAL.
    const original = siteToSnapshot(library?.entry)
    if (!library?.entry || !original) return

    // El sitio deja "completado" un anime al que se le marcó hasta un episodio anterior: debe pasar a "viendo" en ambos.
    const site = expectStatus === undefined ? reopenIfIncomplete(original, useAnimeStore.getState().totalEpisodes) : original
    const reopened = site.status !== original.status

    const current = currentMalSnapshot()
    if (!reopened && current && !snapshotsDiffer(current, site)) return

    const isLatest = startOperation(opKey.malList(slug))
    const update = snapshotToMalUpdate(site, { clearEmptyDates: false, current, preserveScore: true })
    // Al reabrir, MAL y AV1 se escriben en paralelo para reducir la espera.
    const [res] = await Promise.all([
      sendMessage({ type: 'UPDATE_LIST', id, update }),
      reopened
        ? saveSiteListEntry(
            library.mediaId,
            snapshotToSiteFields(site, { notes: library.entry.notes ?? '', private: library.entry.private }, original)
          )
        : null
    ])
    if (routeMalError(res)) return
    if (!res.ok) throw new Error(res.error)
    void confirmLink(slug, id)
    if (page.slug === slug && isLatest()) useAnimeStore.getState().setListStatus(res.data.status)

    if (reopened) {
      updateSiteStatusButton(site.status)
      pushToast('Lista de MAL actualizada; el anime vuelve a estar viendo')
      return
    }
    pushToast('Lista de MAL actualizada')
  } catch (e) {
    logger.error('no se pudo copiar la lista del sitio a MAL', e)
    pushToast('No se pudo actualizar tu lista en MAL. Se volverá a comparar al recargar', 'error')
  } finally {
    running.delete(slug)
  }
}

let timer: ReturnType<typeof setTimeout> | undefined

// El sitio hace POST a /api/user/library para cambios de lista que no pasan por el form (dropdown, "marcar hasta el
// episodio anterior"…). Su request no es observable directamente, pero el navegador registra cada fetch terminado.
export function initSiteRequestWatcher(ctx: { onInvalidated: (cb: () => void) => void }) {
  if (typeof PerformanceObserver === 'undefined') return

  let observer: PerformanceObserver | null = null
  try {
    observer = new PerformanceObserver(list => {
      const hit = list.getEntries().some(entry => {
        try {
          return new URL(entry.name).pathname === SITE.libraryApiPath
        } catch {
          return false
        }
      })
      if (!hit || !page.slug) return

      const slug = page.slug
      clearTimeout(timer)
      timer = setTimeout(() => void reconcileSiteToMal(slug), 100)
    })
    observer.observe({ type: 'resource', buffered: false })
  } catch (e) {
    logger.warn('no se pudo observar las requests del sitio', e)
    return
  }

  ctx.onInvalidated(() => {
    observer?.disconnect()
    clearTimeout(timer)
  })
}
