import { browser } from 'wxt/browser'
import type { Side } from './list-sync'

const POLICY_KEY = 'syncPolicy'
const ANIME_POLICIES_KEY = 'animeSyncPolicies'
const DAY_MS = 24 * 60 * 60 * 1000

export const MAX_POLICY_DAYS = 365

// 'ask' muestra siempre el modal; 'always' resuelve a favor de un lado sin preguntar;
// 'timed' lo hace solo durante `days` días desde `since` y luego vuelve a preguntar.
export type SyncPolicy = { mode: 'ask' } | { mode: 'always'; side: Side } | { mode: 'timed'; side: Side; days: number; since: number }

export const DEFAULT_POLICY: SyncPolicy = { mode: 'ask' }

function isSide(value: unknown): value is Side {
  return value === 'mal' || value === 'site'
}

export function clampDays(days: number): number {
  if (!Number.isFinite(days)) return 1
  return Math.min(MAX_POLICY_DAYS, Math.max(1, Math.round(days)))
}

// El storage puede traer datos viejos o corruptos: lo que no se reconoce equivale a "preguntar".
function parsePolicy(raw: unknown): SyncPolicy {
  if (!raw || typeof raw !== 'object') return DEFAULT_POLICY
  const p = raw as Record<string, unknown>
  if (p.mode === 'always' && isSide(p.side)) return { mode: 'always', side: p.side }
  if (p.mode === 'timed' && isSide(p.side) && typeof p.days === 'number' && typeof p.since === 'number') {
    return { mode: 'timed', side: p.side, days: clampDays(p.days), since: p.since }
  }
  return DEFAULT_POLICY
}

export async function getSyncPolicy(): Promise<SyncPolicy> {
  const data = await browser.storage.local.get(POLICY_KEY)
  return parsePolicy(data[POLICY_KEY])
}

export async function setSyncPolicy(policy: SyncPolicy): Promise<void> {
  await browser.storage.local.set({ [POLICY_KEY]: policy })
}

type AnimePolicies = Record<string, SyncPolicy>

// Una entrada propia sigue vigente salvo que sea temporal y ya haya vencido.
function isExpired(policy: SyncPolicy, now = Date.now()): boolean {
  return policy.mode === 'timed' && remainingMs(policy, now) === 0
}

// Lee las preferencias por anime (clave: malId) y, si encuentra entradas vencidas o inválidas, las borra del storage.
async function loadAnimePolicies(): Promise<AnimePolicies> {
  const data = await browser.storage.local.get(ANIME_POLICIES_KEY)
  const raw = data[ANIME_POLICIES_KEY]
  if (!raw || typeof raw !== 'object') return {}

  const clean: AnimePolicies = {}
  let dirty = false
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const policy = parsePolicy(value)
    const valid = value != null && typeof value === 'object' && (value as { mode?: unknown }).mode === policy.mode
    if (valid && !isExpired(policy)) clean[id] = policy
    else dirty = true
  }
  if (dirty) await browser.storage.local.set({ [ANIME_POLICIES_KEY]: clean })
  return clean
}

export async function getAnimePolicy(malId: number): Promise<SyncPolicy | null> {
  return (await loadAnimePolicies())[String(malId)] ?? null
}

export async function setAnimePolicy(malId: number, policy: SyncPolicy): Promise<void> {
  const policies = await loadAnimePolicies()
  policies[String(malId)] = policy
  await browser.storage.local.set({ [ANIME_POLICIES_KEY]: policies })
}

export async function clearAnimePolicy(malId: number): Promise<void> {
  const policies = await loadAnimePolicies()
  delete policies[String(malId)]
  await browser.storage.local.set({ [ANIME_POLICIES_KEY]: policies })
}

// Lado que se impone para un anime: su preferencia propia (si la hay y está vigente) manda sobre la global.
export async function getEffectiveSide(malId: number): Promise<Side | null> {
  const own = await getAnimePolicy(malId)
  return activeSide(own ?? (await getSyncPolicy()))
}

// Milisegundos que le quedan a una política temporal (0 si ya venció o no es temporal).
export function remainingMs(policy: SyncPolicy, now = Date.now()): number {
  if (policy.mode !== 'timed') return 0
  return Math.max(0, policy.since + policy.days * DAY_MS - now)
}

// Lado que se impone automáticamente ahora mismo, o null si hay que preguntar.
export function activeSide(policy: SyncPolicy, now = Date.now()): Side | null {
  if (policy.mode === 'always') return policy.side
  if (policy.mode === 'timed' && remainingMs(policy, now) > 0) return policy.side
  return null
}

export function remainingDays(policy: SyncPolicy, now = Date.now()): number {
  return Math.ceil(remainingMs(policy, now) / DAY_MS)
}
