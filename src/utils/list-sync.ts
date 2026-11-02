export type MalStatus = MalListStatus['status']

// Representación común de la entrada de lista, tanto para MAL como para AnimeAV1.
// `score` va siempre en escala MAL (0-10); la nota de AnimeAV1 (1-5) se guarda multiplicada por 2.
export interface ListSnapshot {
  status: MalStatus
  episodes: number
  startDate: string
  endDate: string
  score: number
}

// AnimeAV1 solo tiene 5 niveles: una nota de MAL equivale a la de AnimeAV1 si redondean al mismo nivel.
export function toSiteRating(score: number): number {
  return score > 0 ? Math.ceil(score / 2) : 0
}

export function scoresMatch(a: number, b: number): boolean {
  return toSiteRating(a) === toSiteRating(b)
}

const SITE_TO_MAL: Record<string, MalStatus> = {
  '0': 'watching',
  '1': 'plan_to_watch',
  '2': 'completed',
  '3': 'on_hold',
  '4': 'dropped'
}

const MAL_TO_SITE: Record<MalStatus, string> = {
  watching: '0',
  plan_to_watch: '1',
  completed: '2',
  on_hold: '3',
  dropped: '4'
}

export function siteToSnapshot(data: Record<string, unknown> | null | undefined): ListSnapshot | null {
  if (!data) return null
  const status = SITE_TO_MAL[String(data.status)]
  if (!status) return null
  const rating = Number(data.rating)
  return {
    status,
    episodes: Math.max(0, Number.parseInt(String(data.episode), 10) || 0),
    startDate: String(data.startDate ?? ''),
    endDate: String(data.endDate ?? ''),
    score: Number.isFinite(rating) && rating > 0 ? rating * 2 : 0
  }
}

export function malToSnapshot(s: MalListStatus | null | undefined): ListSnapshot | null {
  if (!s?.status) return null
  return {
    status: s.status,
    episodes: s.num_episodes_watched ?? 0,
    startDate: s.start_date ?? '',
    endDate: s.finish_date ?? '',
    score: s.score ?? 0
  }
}

// MAL admite fechas parciales (AAAA o AAAA-MM); AnimeAV1 siempre guarda AAAA-MM-DD.
function isPartialDate(d: string): boolean {
  return /^\d{4}(-\d{2})?$/.test(d)
}

function padDate(d: string): string {
  if (/^\d{4}$/.test(d)) return `${d}-01-01`
  if (/^\d{4}-\d{2}$/.test(d)) return `${d}-01`
  return d
}

// Una fecha parcial coincide con cualquier fecha completa que empiece igual (lo que AnimeAV1 autocompleta).
export function datesMatch(a: string, b: string): boolean {
  if (a === b) return true
  if (isPartialDate(a) && !isPartialDate(b)) return b.startsWith(a)
  if (isPartialDate(b) && !isPartialDate(a)) return a.startsWith(b)
  return false
}

export function snapshotsDiffer(a: ListSnapshot | null, b: ListSnapshot | null): boolean {
  if (!a || !b) return a !== b
  return (
    a.status !== b.status ||
    a.episodes !== b.episodes ||
    !datesMatch(a.startDate, b.startDate) ||
    !datesMatch(a.endDate, b.endDate) ||
    !scoresMatch(a.score, b.score)
  )
}

// Con clearEmptyDates se comporta como un PUT: una fecha vacía borra la que tenga MAL.
// Si se pasa currentMalScore (cambio originado en AnimeAV1), la nota solo se envía cuando
// AnimeAV1 tiene una y no es equivalente a la de MAL: así no se pierde precisión ni se borra la nota.
export function snapshotToMalUpdate(s: ListSnapshot, clearEmptyDates = true, currentMalScore?: number): MalListUpdate {
  const update: MalListUpdate = { status: s.status, num_watched_episodes: s.episodes }
  if (s.startDate || clearEmptyDates) update.start_date = s.startDate
  if (s.endDate || clearEmptyDates) update.finish_date = s.endDate
  if (currentMalScore === undefined) update.score = s.score
  else if (s.score > 0 && !scoresMatch(s.score, currentMalScore)) update.score = s.score
  return update
}

export type Side = 'mal' | 'site'
export type FieldKey = keyof ListSnapshot
export const FIELD_KEYS: FieldKey[] = ['status', 'episodes', 'startDate', 'endDate', 'score']
export type FieldChoice = Partial<Record<FieldKey, Side>>

// Un campo "idéntico" no se puede elegir: no hay nada que decidir. La nota equivalente cuenta como idéntica.
export function fieldIdentical(key: FieldKey, a: ListSnapshot, b: ListSnapshot): boolean {
  if (key === 'score') return scoresMatch(a.score, b.score)
  return a[key] === b[key]
}

// Igual salvo por la precisión (fechas parciales, o nota que redondea al mismo nivel).
export function fieldMatches(key: FieldKey, a: ListSnapshot, b: ListSnapshot): boolean {
  if (key === 'startDate' || key === 'endDate') return datesMatch(a[key], b[key])
  return fieldIdentical(key, a, b)
}

// Campos sin elección explícita: si solo difieren en precisión, gana la fecha más completa.
function autoSide(key: FieldKey, mal: ListSnapshot, site: ListSnapshot): Side {
  if ((key === 'startDate' || key === 'endDate') && mal[key].length > site[key].length) return 'mal'
  return 'site'
}

export function resolveFields(mal: ListSnapshot, site: ListSnapshot, choice: FieldChoice): ListSnapshot {
  const out: Record<string, string | number> = {}
  for (const key of FIELD_KEYS) {
    // Con notas equivalentes se conserva siempre la de MAL, que es la más precisa.
    const side = key === 'score' && scoresMatch(mal.score, site.score) ? 'mal' : (choice[key] ?? autoSide(key, mal, site))
    out[key] = (side === 'mal' ? mal : site)[key]
  }
  return out as unknown as ListSnapshot
}

export function padSnapshot(s: ListSnapshot): ListSnapshot {
  return { ...s, startDate: padDate(s.startDate), endDate: padDate(s.endDate) }
}

export interface SiteExtra {
  notes: string
  private: boolean
}

// `private` se reenvía porque el form completo lo incluye; sin él, un guardado podría resetearlo.
// Una casilla desmarcada no viaja en un form, así que solo se envía cuando es true.
export function snapshotToSiteFields(s: ListSnapshot, extra: SiteExtra): Record<string, string> {
  const fields: Record<string, string> = {
    status: MAL_TO_SITE[s.status],
    episode: String(s.episodes),
    startDate: padDate(s.startDate),
    endDate: padDate(s.endDate),
    notes: extra.notes
  }
  const rating = toSiteRating(s.score)
  if (rating > 0) fields.rating = String(rating)
  if (extra.private) fields.private = 'true'
  return fields
}
