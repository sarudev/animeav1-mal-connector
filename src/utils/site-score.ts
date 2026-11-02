import { siteToSnapshot, snapshotToSiteFields, toSiteRating } from './list-sync'
import { fetchSiteLibrary, saveSiteListEntry } from './site-library'

// Refleja en AnimeAV1 la nota puesta con el slider (escala MAL 1-10). No crea entradas: sin estado no hay dónde guardarla.
export async function syncSiteScore(slug: string, malScore: number): Promise<void> {
  const library = await fetchSiteLibrary(slug)
  const entry = library?.entry
  if (!library || !entry) return

  const current = entry.rating ?? 0
  if (current === toSiteRating(malScore)) return

  const snapshot = siteToSnapshot({ ...entry })
  if (!snapshot) return

  await saveSiteListEntry(library.mediaId, snapshotToSiteFields({ ...snapshot, score: malScore }, { notes: entry.notes ?? '', private: entry.private }))
}
