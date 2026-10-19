import type { MalAuth } from './storage'

export interface AUTO_LINK_ANIME {
  type: 'AUTO_LINK_ANIME'
  slug: string
  name: string
}

export interface GET_LINK {
  type: 'GET_LINK'
  slug: string
}

export interface LINK_ANIME {
  type: 'LINK_ANIME'
  slug: string
  malId: number
  title: string | null
  pictureUrl: string | null
  tabId?: number
}

export interface UNLINK_ANIME {
  type: 'UNLINK_ANIME'
  slug: string
  tabId?: number
}

export interface SEARCH_ANIME {
  type: 'SEARCH_ANIME'
  query: string
}

export interface GET_DETAILS {
  type: 'GET_DETAILS'
  id: number
}

export interface UPDATE_SCORE {
  type: 'UPDATE_SCORE'
  slug: string
  score: number
  id: number
}

export interface TOGGLE_WATCHED {
  type: 'TOGGLE_WATCHED'
  slug: string
  episode: number | null
  watched: boolean
}

export interface CLEAR_BADGE {
  type: 'CLEAR_BADGE'
}

export interface GET_MAL_STATUS {
  type: 'GET_MAL_STATUS'
}

export interface GET_MAL_AUTH {
  type: 'GET_MAL_AUTH'
}

export interface CONNECT_MAL {
  type: 'CONNECT_MAL'
  clientId: string
}

export interface CLEAR_MAL_AUTH {
  type: 'CLEAR_MAL_AUTH'
}

export interface GET_REDIRECT_URL {
  type: 'GET_REDIRECT_URL'
}

export type Message =
  | AUTO_LINK_ANIME
  | GET_LINK
  | LINK_ANIME
  | UNLINK_ANIME
  | SEARCH_ANIME
  | GET_DETAILS
  | UPDATE_SCORE
  | TOGGLE_WATCHED
  | CLEAR_BADGE
  | GET_MAL_STATUS
  | GET_MAL_AUTH
  | CONNECT_MAL
  | CLEAR_MAL_AUTH
  | GET_REDIRECT_URL

export type Response<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

export type AUTO_LINK_ANIME_RESPONSE = Response<{ autoLinked: true; id: number } | { autoLinked: false; id: number | null; reason: string }>
export type GET_LINK_RESPONSE = Response<{ id: number | null }>
export type LINK_ANIME_RESPONSE = Response<{ title: string | null; pictureUrl: string | null }>
export type UNLINK_ANIME_RESPONSE = Response
export type SEARCH_ANIME_RESPONSE = Response<{ results: MalAnime[] }>
export type GET_DETAILS_RESPONSE = Response<{ details: MalAnime }>
export type UPDATE_SCORE_RESPONSE = Response<{ status: MalListStatus }>
export type TOGGLE_WATCHED_RESPONSE = Response<{ skipped?: boolean; status?: MalListStatus }>
export type CLEAR_BADGE_RESPONSE = Response
export type GET_MAL_STATUS_RESPONSE = Response<{ configured: boolean }>
export type GET_MAL_AUTH_RESPONSE = Response<{ auth: { clientId: string } | null }>
export type CONNECT_MAL_RESPONSE = Response<{ user: MalUser | null }>
export type CLEAR_MAL_AUTH_RESPONSE = Response
export type GET_REDIRECT_URL_RESPONSE = Response<{ url: string }>

const MAL_AUTH_ERRORS = ['mal_not_configured', 'mal_auth_failed']
export function isMalAuthError(res: Response<unknown> | undefined): boolean {
  return !!res && !res.ok && MAL_AUTH_ERRORS.includes(res.error)
}
