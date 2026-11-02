import { sendMessage } from '@/entrypoints/background'
import { routeMalError, useAnimeStore } from '@/components/anime-card/useAnimeStore'
import type { SyncConflict } from '@/components/sync-modal/useSyncStore'
import {
  needsWrite,
  normalizeCompleted,
  padSnapshot,
  resolveFields,
  snapshotToMalUpdate,
  snapshotToSiteFields,
  type FieldChoice,
  type Side
} from '@/utils/list-sync'
import { opKey, startOperation } from '@/utils/operations'
import { deleteSiteEntry, saveSiteListEntry } from '@/utils/site-library'
import { reloadNow } from '@/utils/site-ui'
import { pushToast } from '@/utils/toast-store'

interface ApplyOptions {
  // Campo a campo elegido por el usuario (o todos a favor de un lado).
  choice: FieldChoice
  // Lado cuya lista vacía se eligió: el anime se elimina del otro sitio.
  emptyPick?: Side | null
  message?: string
}

// Aplica la resolución de una discrepancia en ambos sitios. Lanza si algo falla.
export async function applySync(c: SyncConflict, { choice, emptyPick = null, message = 'Listas sincronizadas' }: ApplyOptions) {
  if (emptyPick === 'mal') {
    await deleteSiteEntry(c.siteMediaId)
    reloadNow('Anime eliminado de AnimeAV1')
    return
  }
  if (emptyPick === 'site') {
    const res = await sendMessage({ type: 'DELETE_LIST', id: c.malId })
    if (routeMalError(res)) throw new Error('mal_auth')
    if (!res.ok) throw new Error(res.error)
    if (useAnimeStore.getState().slug === c.slug) useAnimeStore.getState().setListCleared()
    pushToast('Anime eliminado de MAL')
    return
  }

  const final = normalizeCompleted(
    c.mal && c.site ? resolveFields(c.mal, c.site, choice) : (c.mal ?? c.site)!,
    useAnimeStore.getState().totalEpisodes
  )

  if (needsWrite(c.mal, final, choice)) {
    const isLatest = startOperation(opKey.malList(c.slug))
    const update = snapshotToMalUpdate(final, { current: c.mal })
    const res = await sendMessage({ type: 'UPDATE_LIST', id: c.malId, update })
    if (routeMalError(res)) throw new Error('mal_auth')
    if (!res.ok) throw new Error(res.error)
    if (useAnimeStore.getState().slug === c.slug && isLatest()) useAnimeStore.getState().setListStatus(res.data.status)
  }

  if (needsWrite(c.site, padSnapshot(final), choice)) {
    await saveSiteListEntry(c.siteMediaId, snapshotToSiteFields(final, c.siteExtra, c.site))
    reloadNow(message)
    return
  }

  pushToast(message)
}
