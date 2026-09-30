import type { MalAuth } from './storage'

export interface TabContext {
  slug: string
  name: string | null
}

export interface PAGE_CONTEXT {
  type: 'PAGE_CONTEXT'
  slug: string
  name: string | null
}

export interface AUTO_LINK_ANIME {
  type: 'AUTO_LINK_ANIME'
  slug: string
  name: string
}

export interface GET_TAB_CONTEXT {
  type: 'GET_TAB_CONTEXT'
  tabId: number
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

export interface TEST_MAL_CONNECTION {
  type: 'TEST_MAL_CONNECTION'
}

export interface SAVE_MAL_AUTH {
  type: 'SAVE_MAL_AUTH'
  clientId: string
  clientSecret: string
  refreshToken: string
}

export interface GET_MAL_AUTH {
  type: 'GET_MAL_AUTH'
}

export interface GET_LINKED_ANIME {
  type: 'GET_LINKED_ANIME'
  slug: string
}

export type Message =
  | PAGE_CONTEXT
  | AUTO_LINK_ANIME
  | GET_TAB_CONTEXT
  | GET_LINK
  | LINK_ANIME
  | UNLINK_ANIME
  | SEARCH_ANIME
  | GET_DETAILS
  | UPDATE_SCORE
  | TOGGLE_WATCHED
  | TEST_MAL_CONNECTION
  | SAVE_MAL_AUTH
  | GET_MAL_AUTH
  | GET_LINKED_ANIME

export type Response<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

export type PAGE_CONTEXT_RESPONSE = Response
export type AUTO_LINK_ANIME_RESPONSE = Response<
  { autoLinked: true; id: number; results: null } | { autoLinked: false; id: number | null; results: MalAnime[] | null; reason: string }
>
export type GET_TAB_CONTEXT_RESPONSE = Response<{ context: TabContext | null; id: number | null }>
export type GET_LINK_RESPONSE = Response<{ id: number | null }>
export type LINK_ANIME_RESPONSE = Response<{ title: string | null; pictureUrl: string | null }>
export type UNLINK_ANIME_RESPONSE = Response
export type SEARCH_ANIME_RESPONSE = Response<{ results: MalAnime[] }>
export type GET_DETAILS_RESPONSE = Response<{ details: MalAnime }>
export type UPDATE_SCORE_RESPONSE = Response<{ status: MalListStatus }>
export type TOGGLE_WATCHED_RESPONSE = Response<{ skipped?: boolean; status?: MalListStatus }>
export type TEST_MAL_CONNECTION_RESPONSE = Response<{ user: MalUser }>
export type SAVE_MAL_AUTH_RESPONSE = Response
export type GET_MAL_AUTH_RESPONSE = Response<{ auth: MalAuth | null }>
export type GET_LINKED_ANIME_RESPONSE = Response<{ id: number | null }>
