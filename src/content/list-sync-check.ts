import {
  FIELD_KEYS,
  malToSnapshot,
  siteToSnapshot,
  snapshotsDiffer,
  snapshotToSiteFields,
  type MalStatus
} from '@/utils/list-sync'
import { logger } from '@/utils/logger'
import { opKey, startOperation } from '@/utils/operations'
import type { MalListStatus } from '@/utils/mal'
import { fetchSiteLibrary, saveSiteListEntry } from '@/utils/site-library'
import { confirmLink, isLinkConfirmed } from '@/utils/link-confirm'
import { getEffectiveSide } from '@/utils/sync-policy'
import { pushToast } from '@/utils/toast-store'
import { useSyncStore, type SyncConflict } from '@/components/sync-modal/useSyncStore'
import { applySync } from './sync-apply'
import { page } from './state'

// Compara la lista de MAL contra la del sitio y abre el modal de diferencias si no coinciden.
export async function checkListSync(slug: string, malId: number, malStatus: MalListStatus | null) {
  const isLatest = startOperation(opKey.compare(slug))
  try {
    const library = await fetchSiteLibrary(slug)
    if (!library || page.slug !== slug || !isLatest()) return

    const mal = malToSnapshot(malStatus)
    const site = siteToSnapshot(library.entry)
    if (!snapshotsDiffer(mal, site)) {
      // Confirmar exige ambos listados y sin diferencias (se toleran las de precisión de fechas y nota).
      if (mal && site) void confirmLink(slug, malId)
      return
    }

    const conflict: SyncConflict = {
      slug,
      malId,
      siteMediaId: library.mediaId,
      siteExtra: { notes: library.entry?.notes ?? '', private: library.entry?.private ?? false },
      mal,
      site
    }

    // Con una preferencia activa se resuelve sin preguntar, pero solo a favor de un lado que tenga el anime
    // (nunca se elimina nada de forma automática) y solo si el vínculo ya fue confirmado por el usuario.
    const side = (await isLinkConfirmed(slug, malId)) ? await getEffectiveSide(malId) : null
    const chosen = side === 'mal' ? mal : side === 'site' ? site : null
    if (side && chosen) {
      if (page.slug !== slug || !isLatest()) return
      try {
        await applySync(conflict, {
          choice: Object.fromEntries(FIELD_KEYS.map(key => [key, side])),
          message: `Listas sincronizadas a favor de ${side === 'mal' ? 'MAL' : 'AnimeAV1'}`
        })
        return
      } catch (e) {
        logger.error('falló la sincronización automática', e)
        pushToast('No se pudo sincronizar automáticamente; elige qué datos conservar', 'error')
      }
    }

    useSyncStore.getState().open(conflict)
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
