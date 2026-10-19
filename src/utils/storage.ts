import { browser } from 'wxt/browser'

const AUTH_KEY = 'malAuth'
const LINKS_KEY = 'animeLinks'

export interface MalAuth {
  clientId: string
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

export async function clearMalAuth(): Promise<void> {
  await browser.storage.local.remove(AUTH_KEY)
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
