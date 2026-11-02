import { malToSnapshot, siteToSnapshot, snapshotsDiffer, snapshotToSiteFields, type MalStatus } from '@/utils/list-sync'
import { logger } from '@/utils/logger'
import { opKey, startOperation } from '@/utils/operations'
import type { MalListStatus } from '@/utils/mal'
import { fetchSiteLibrary, saveSiteListEntry } from '@/utils/site-library'
import { pushToast } from '@/utils/toast-store'
import { useSyncStore } from '@/components/sync-modal/useSyncStore'
import { page } from './state'

// Compara la lista de MAL contra la del sitio y abre el modal de diferencias si no coinciden.
export async function checkListSync(slug: string, malId: number, malStatus: MalListStatus | null) {
  const isLatest = startOperation(opKey.compare(slug))
  try {
    const library = await fetchSiteLibrary(slug)
    if (!library || page.slug !== slug || !isLatest()) return

    const mal = malToSnapshot(malStatus)
    const site = siteToSnapshot(library.entry)
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
    logger.warn('error comparando listas', e)
  }
}

// Tras marcar un capítulo, MAL puede cambiar estado y fechas (viendo, completado, fecha de inicio/fin).
// El sitio no lo hace por su cuenta, así que se copian para que las listas no queden desincronizadas.
export async function syncSiteFromMal(slug: string, malStatus: MalListStatus): Promise<MalStatus | null> {
  const mal = malToSnapshot(malStatus)
  if (!mal) return null
  try {
    const library = await fetchSiteLibrary(slug, { fresh: true })
    const site = siteToSnapshot(library?.entry)
    if (!library?.entry || !site) return null

    const next = {
      ...site,
      status: mal.status,
      startDate: site.startDate || mal.startDate,
      endDate: site.endDate || mal.endDate
    }
    if (next.status === site.status && next.startDate === site.startDate && next.endDate === site.endDate) return null

    await saveSiteListEntry(
      library.mediaId,
      snapshotToSiteFields(next, { notes: library.entry.notes ?? '', private: library.entry.private }, site)
    )
    return next.status
  } catch (e) {
    logger.warn('no se pudo copiar el estado de MAL al sitio', e)
    pushToast('No se pudo actualizar el estado en AnimeAV1', 'error')
    return null
  }
}
