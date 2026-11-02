import { browser } from 'wxt/browser'
import { logger } from './logger'

const CONFIRMED_KEY = 'confirmedLinks'

// slug → malId con el que se confirmó. Un vínculo cambiado a otro malId deja de estar confirmado solo.
type Confirmed = Record<string, number>

async function read(): Promise<Confirmed> {
  const data = await browser.storage.local.get(CONFIRMED_KEY)
  const raw = data[CONFIRMED_KEY]
  return raw && typeof raw === 'object' ? (raw as Confirmed) : {}
}

export async function isLinkConfirmed(slug: string, malId: number): Promise<boolean> {
  return (await read())[slug] === malId
}

// Un vínculo queda confirmado cuando el usuario ya vio sus listas juntas o hizo un cambio que las afecta.
export async function confirmLink(slug: string, malId: number | null | undefined): Promise<void> {
  if (malId == null) return
  try {
    const confirmed = await read()
    if (confirmed[slug] === malId) return
    confirmed[slug] = malId
    await browser.storage.local.set({ [CONFIRMED_KEY]: confirmed })
  } catch (e) {
    logger.warn('no se pudo confirmar el vínculo', e)
  }
}
