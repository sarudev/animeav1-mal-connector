// Cliente de la API de MyAnimeList (OAuth2 + endpoints de anime y lista de usuario).
import type { AnimeResult } from '@/entrypoints/content'
import { getMalAuth, setMalAuth, type MalAuth } from '@/utils/storage'

const TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token'
const API_BASE = 'https://api.myanimelist.net/v2'

export interface MalUser {
  id: number
  name: string
}

export interface MalListStatus {
  status?: 'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch'
  num_watched_episodes?: number
  start_date?: string
  finish_date?: string
}

export interface MalAnime {
  id: number
  title: string
  main_picture?: { medium?: string; large?: string }
  num_episodes?: number
  my_list_status?: MalListStatus
}

async function refreshAccessToken(auth: MalAuth): Promise<MalAuth> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: auth.refreshToken,
    client_id: auth.clientId,
    client_secret: auth.clientSecret
  })

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`No se pudo refrescar el token de MAL (${res.status}): ${text}`)
  }

  const data = await res.json()
  // MAL rota el refresh_token en cada renovación: hay que persistir el nuevo.
  const updated: MalAuth = {
    ...auth,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || auth.refreshToken,
    accessTokenExpiry: Date.now() + (data.expires_in || 0) * 1000 - 60000
  }
  await setMalAuth(updated)
  return updated
}

export async function getAccessToken(): Promise<string> {
  let auth = await getMalAuth()
  if (!auth || !auth.clientId || !auth.clientSecret || !auth.refreshToken) {
    throw new Error('Faltan credenciales de MyAnimeList. Configúralas en las opciones de la extensión.')
  }

  if (!auth.accessToken || !auth.accessTokenExpiry || Date.now() >= auth.accessTokenExpiry) {
    auth = await refreshAccessToken(auth)
  }

  return auth.accessToken!
}

async function malFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Error de la API de MAL (${res.status}): ${text}`)
  }

  if (res.status === 204) return null as T
  return res.json()
}

export async function getCurrentUser(): Promise<MalUser> {
  return malFetch<MalUser>('/users/@me?fields=name')
}

const ANIME_URL_REGEX = /^https:\/\/myanimelist\.net\/anime\/(\d+)\//

async function searchAnimeViaRedirect(query: string): Promise<AnimeResult | null> {
  const url = `https://myanimelist.net/anime.php?q=${encodeURIComponent(query)}`
  const res = await fetch(url, { redirect: 'follow' })

  if (!res.redirected) return null // se quedó en la página de resultados: no hubo match único

  const match = ANIME_URL_REGEX.exec(res.url)
  if (!match || match[1] == null) return null

  const id = parseInt(match[1], 10)
  const details = await getAnimeDetails(id) // ya la tenés implementada, usa la API oficial por ID
  return {
    id,
    title: details.title,
    num_episodes: details.num_episodes,
    main_picture: details.main_picture
  }
}

export async function searchAnime(query: string): Promise<AnimeResult[]> {
  const apiResults = await searchAnimeViaApi(query) // tu implementación actual contra /v2/anime
  if (apiResults.length > 0) return apiResults

  try {
    const viaRedirect = await searchAnimeViaRedirect(query)
    return viaRedirect ? [viaRedirect] : []
  } catch {
    return []
  }
}

async function searchAnimeViaApi(query: string): Promise<MalAnime[]> {
  const params = new URLSearchParams({
    q: query.slice(0, 64),
    limit: '10',
    fields: 'id,title,alternative_titles,main_picture,num_episodes,media_type,status'
  })
  const data = await malFetch<{ data: { node: MalAnime }[] }>(`/anime?${params.toString()}`)
  return (data.data || []).map(item => item.node)
}

export async function getAnimeDetails(id: number): Promise<MalAnime> {
  const params = new URLSearchParams({
    fields: 'id,title,main_picture,num_episodes,my_list_status'
  })
  return malFetch<MalAnime>(`/anime/${id}?${params.toString()}`)
}

export async function updateListStatus(id: number, fields: Record<string, string | number>): Promise<MalListStatus> {
  const body = new URLSearchParams(fields as Record<string, string>)
  return malFetch<MalListStatus>(`/anime/${id}/my_list_status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
}
