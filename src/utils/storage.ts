// Almacenamiento local: credenciales de MAL y vínculos animeav1(slug) -> MAL(id).
// Se usa browser.storage.local (no sync) para que las credenciales nunca salgan del dispositivo.
import { browser } from 'wxt/browser'
import type { TabContext } from './types'

const AUTH_KEY = 'malAuth'
const LINKS_KEY = 'animeLinks'

export interface MalAuth {
  clientId: string
  clientSecret: string
  refreshToken: string
  accessToken?: string
  accessTokenExpiry?: number
}

type AnimeLinks = Record<string, number>

export async function getMalAuth(): Promise<MalAuth | null> {
  const data = await browser.storage.local.get(AUTH_KEY)
  return (data[AUTH_KEY] as MalAuth) || null
}

export async function setMalAuth(auth: MalAuth): Promise<void> {
  await browser.storage.local.set({ [AUTH_KEY]: auth })
}

export async function getAnimeLinks(): Promise<AnimeLinks> {
  const data = await browser.storage.local.get(LINKS_KEY)
  return (data[LINKS_KEY] as AnimeLinks) || {}
}

export async function getId(slug: string): Promise<number | null> {
  const links = await getAnimeLinks()
  return links[slug] || null
}

export async function setId(slug: string, link: number): Promise<void> {
  const links = await getAnimeLinks()
  links[slug] = link
  await browser.storage.local.set({ [LINKS_KEY]: links })
}

export async function removeId(slug: string): Promise<void> {
  const links = await getAnimeLinks()
  delete links[slug]
  await browser.storage.local.set({ [LINKS_KEY]: links })
}

// Contexto (slug/nombre detectados) por pestaña.
// Se guarda en storage.session (no en un Map en memoria) porque el service
// worker de MV3 se apaga tras ~30s de inactividad, y un Map en memoria se
// perdería en cada reinicio. storage.session sobrevive a esos reinicios y
// solo se borra al cerrar el navegador.
function tabContextKey(tabId: number) {
  return `tabContext:${tabId}`
}

export async function getTabContext(tabId: number): Promise<TabContext | null> {
  const data = await browser.storage.session.get(tabContextKey(tabId))
  return (data[tabContextKey(tabId)] as TabContext) || null
}

export async function setTabContext(tabId: number, context: TabContext): Promise<void> {
  await browser.storage.session.set({ [tabContextKey(tabId)]: context })
}

export async function removeTabContext(tabId: number): Promise<void> {
  await browser.storage.session.remove(tabContextKey(tabId))
}
