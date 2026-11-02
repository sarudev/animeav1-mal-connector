import { siteToSnapshot, snapshotToSiteFields, toSiteRating } from './list-sync'
import { fetchSiteLibrary, saveSiteListEntry } from './site-library'
import { opKey, startOperation } from './operations'

// Refleja en AnimeAV1 la nota puesta con el slider (escala MAL 1-10). No crea entradas: sin estado no hay dónde guardarla.
export async function syncSiteScore(slug: string, malScore: number): Promise<void> {
  // Si el usuario mueve el slider otra vez mientras se lee la biblioteca, esta nota ya es vieja.
  const isLatest = startOperation(opKey.siteScore(slug))
  const library = await fetchSiteLibrary(slug, { fresh: true })
  if (!isLatest()) return
  const entry = library?.entry
  if (!library || !entry) return

  const current = entry.rating ?? 0
  if (current === toSiteRating(malScore)) return

  const snapshot = siteToSnapshot(entry)
  if (!snapshot) return

  await saveSiteListEntry(
    library.mediaId,
    snapshotToSiteFields({ ...snapshot, score: malScore }, { notes: entry.notes ?? '', private: entry.private }, snapshot)
  )
}
