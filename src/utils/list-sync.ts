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

export interface SiteSource {
  status?: unknown
  episode?: unknown
  startDate?: unknown
  endDate?: unknown
  rating?: unknown
}

export function siteToSnapshot(data: SiteSource | null | undefined): ListSnapshot | null {
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
// Una fecha vacía frente a una con valor sí es una diferencia.
export function datesMatch(a: string, b: string): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (isPartialDate(a) && !isPartialDate(b)) return b.startsWith(a)
  if (isPartialDate(b) && !isPartialDate(a)) return a.startsWith(b)
  return false
}

// `full` es exactamente lo que AnimeAV1 autocompleta a partir de la fecha parcial de MAL (2017-03 → 2017-03-01).
function isPaddedOf(full: string, partial: string | undefined): boolean {
  return !!partial && isPartialDate(partial) && padDate(partial) === full
}

// Un anime completado tiene todos los episodios vistos (AnimeAV1 ignora el número en ese caso).
export function normalizeCompleted(s: ListSnapshot, total: number): ListSnapshot {
  return s.status === 'completed' && total > 0 ? { ...s, episodes: total } : s
}

// Si el sitio deja un anime "completado" con episodios sin ver (p. ej. al marcar hasta el anterior), pasa a "viendo".
export function reopenIfIncomplete(s: ListSnapshot, total: number): ListSnapshot {
  return s.status === 'completed' && total > 0 && s.episodes < total ? { ...s, status: 'watching' } : s
}

export function snapshotsDiffer(a: ListSnapshot | null, b: ListSnapshot | null): boolean {
  if (!a || !b) return a !== b
  return FIELD_KEYS.some(key => !fieldMatches(key, a, b))
}

interface MalUpdateOptions {
  // Una fecha vacía borra la que tenga MAL (comportamiento de PUT).
  clearEmptyDates?: boolean
  // Estado actual de MAL: evita pisar una fecha parcial con su versión autocompletada por AnimeAV1.
  current?: ListSnapshot | null
  // Cambio originado en AnimeAV1: la nota solo se envía si AnimeAV1 tiene una y no equivale a la de MAL,
  // así no se pierde precisión ni se borra la nota.
  preserveScore?: boolean
}

export function snapshotToMalUpdate(s: ListSnapshot, { clearEmptyDates = true, current = null, preserveScore = false }: MalUpdateOptions = {}): MalListUpdate {
  const update: MalListUpdate = { status: s.status, num_watched_episodes: s.episodes }
  const sendDate = (wanted: string, existing: string | undefined) => (wanted ? !isPaddedOf(wanted, existing) : clearEmptyDates)
  if (sendDate(s.startDate, current?.startDate)) update.start_date = s.startDate
  if (sendDate(s.endDate, current?.endDate)) update.finish_date = s.endDate
  if (!preserveScore) update.score = s.score
  else if (s.score > 0 && !scoresMatch(s.score, current?.score ?? 0)) update.score = s.score
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
  const from = (key: FieldKey): ListSnapshot => {
    // Con notas equivalentes se conserva siempre la de MAL, que es la más precisa.
    const side = key === 'score' && scoresMatch(mal.score, site.score) ? 'mal' : (choice[key] ?? autoSide(key, mal, site))
    return side === 'mal' ? mal : site
  }
  return {
    status: from('status').status,
    episodes: from('episodes').episodes,
    startDate: from('startDate').startDate,
    endDate: from('endDate').endDate,
    score: from('score').score
  }
}

// ¿Hay que escribir en `target`? Un campo elegido explícitamente se escribe aunque solo cambie la precisión;
// los demás solo si difieren de verdad. `wanted` debe estar en el mismo formato que `target` (ver padSnapshot).
export function needsWrite(target: ListSnapshot | null, wanted: ListSnapshot, explicit: FieldChoice): boolean {
  if (!target) return true
  return FIELD_KEYS.some(key => {
    if (key === 'score') return !scoresMatch(wanted.score, target.score)
    if ((key === 'startDate' || key === 'endDate') && isPaddedOf(wanted[key], target[key])) return false
    return explicit[key] ? wanted[key] !== target[key] : !fieldMatches(key, wanted, target)
  })
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
// Una fecha vacía se envía como cadena vacía solo si el sitio tiene una que borrar; si no hay nada, el campo se omite.
export function snapshotToSiteFields(s: ListSnapshot, extra: SiteExtra, current: ListSnapshot | null = null): Record<string, string> {
  const fields: Record<string, string> = {
    status: MAL_TO_SITE[s.status],
    episode: String(s.episodes),
    notes: extra.notes
  }
  const startDate = padDate(s.startDate)
  const endDate = padDate(s.endDate)
  if (startDate || current?.startDate) fields.startDate = startDate
  if (endDate || current?.endDate) fields.endDate = endDate
  const rating = toSiteRating(s.score)
  if (rating > 0) fields.rating = String(rating)
  if (extra.private) fields.private = 'true'
  return fields
}
