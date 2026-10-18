// Service worker: enruta los mensajes de content scripts / popup / options
// y aplica la lógica de sincronización con MyAnimeList.
import type { MalListStatus } from '@/utils/mal'
import type { Response } from '@/utils/types'
import { browser } from 'wxt/browser'

/**
 * Calcula los campos a enviar a MAL según el estado actual de la lista del
 * usuario y la acción realizada en animeav1 (marcar/desmarcar un capítulo).
 *
 * Reglas:
 * - Al marcar un capítulo como visto:
 *   - Si el anime no está en "watching", se cambia a "watching" y se pone
 *     start_date (si no tenía una).
 *   - Se actualiza num_watched_episodes al número de ese capítulo.
 *   - Si MAL conoce el total de episodios y el capítulo marcado es el
 *     último, se pasa a "completed" con finish_date.
 * - Al desmarcar un capítulo como visto, no se modifica MAL, excepto cuando
 *   es el último episodio de un anime "completed"; en ese caso vuelve a
 *   "watching" y el contador retrocede al episodio anterior.
 */
function computeListUpdate(
  cur: MalListStatus | null,
  totalEpisodes: number,
  episode: number,
  watched: boolean
): Record<string, string | number> | null {
  const update: Record<string, string | number> = {}

  if (watched) {
    if (!cur || cur.status !== 'watching') {
      update.status = 'watching'
      if (!cur?.start_date) update.start_date = todayISO()
    }

    update.num_watched_episodes = episode

    if (totalEpisodes && totalEpisodes > 0 && episode >= totalEpisodes) {
      update.status = 'completed'
      update.finish_date = todayISO()
      if (!cur?.start_date && !update.start_date) update.start_date = todayISO()
    }
  } else {
    if (!cur || (cur.status === 'completed' && episode < totalEpisodes)) {
      console.log(`returned null`, { cur, totalEpisodes, episode })
      return null
    }

    update.num_watched_episodes = Math.max(0, episode - 1)
    update.status = 'watching'
    if (!cur?.start_date) update.start_date = todayISO()
  }

  return update
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

async function handleToggleWatched({
  slug,
  episode,
  watched
}: {
  slug: string
  episode: number | null
  watched: boolean
}): Promise<TOGGLE_WATCHED_RESPONSE> {
  const id = await getId(slug)
  if (!id) {
    return { ok: false, error: 'not_linked' }
  }
  if (episode == null) {
    return { ok: false, error: 'no_episode_detected' }
  }

  const details = await getAnimeDetails(id)
  const update = computeListUpdate(details.my_list_status ?? null, details.num_episodes, episode, watched)

  if (!update) {
    return { ok: true, data: { skipped: true } }
  }

  const result = await updateListStatus(id, update)
  return { ok: true, data: { status: result } }
}

async function setBadgeForTab(tabId: number | undefined | null, linked: boolean | null) {
  if (tabId == null) return
  if (linked == null) {
    await browser.action.setBadgeText({ tabId, text: '' })
    return
  }
  await browser.action.setBadgeText({ tabId, text: linked ? 'OK' : '?' })

  await browser.action.setBadgeBackgroundColor({
    tabId,
    color: linked ? '#2e7d32' : '#c62828'
  })
}

async function autoLinkAnime(slug: string, name: string, tabId: number): Promise<AUTO_LINK_ANIME_RESPONSE> {
  const id = await getId(slug)
  if (id != null) {
    await setBadgeForTab(tabId, true)
    return { ok: true, data: { autoLinked: false, reason: 'existing', id } }
  }

  const results = await searchAnime(name)
  const anime = results.find(a => a.title.toLowerCase() === name.toLowerCase())
  if (!anime) {
    await setBadgeForTab(tabId, false)
    return { ok: true, data: { autoLinked: false, reason: 'no_exact_match', id: null } }
  }

  await setId(slug, anime.id)
  await setBadgeForTab(tabId, true)
  return { ok: true, data: { autoLinked: true, id: anime.id } }
}

export async function sendMessage(message: AUTO_LINK_ANIME): Promise<AUTO_LINK_ANIME_RESPONSE>
export async function sendMessage(message: GET_LINK): Promise<GET_LINK_RESPONSE>
export async function sendMessage(message: LINK_ANIME): Promise<LINK_ANIME_RESPONSE>
export async function sendMessage(message: UNLINK_ANIME): Promise<UNLINK_ANIME_RESPONSE>
export async function sendMessage(message: SEARCH_ANIME): Promise<SEARCH_ANIME_RESPONSE>
export async function sendMessage(message: GET_DETAILS): Promise<GET_DETAILS_RESPONSE>
export async function sendMessage(message: UPDATE_SCORE): Promise<UPDATE_SCORE_RESPONSE>
export async function sendMessage(message: TOGGLE_WATCHED): Promise<TOGGLE_WATCHED_RESPONSE>
export async function sendMessage(message: GET_MAL_AUTH): Promise<GET_MAL_AUTH_RESPONSE>
export async function sendMessage(message: CLEAR_BADGE): Promise<CLEAR_BADGE_RESPONSE>
export async function sendMessage(message: GET_MAL_STATUS): Promise<GET_MAL_STATUS_RESPONSE>
export async function sendMessage(message: CONNECT_MAL): Promise<CONNECT_MAL_RESPONSE>
export async function sendMessage(message: CLEAR_MAL_AUTH): Promise<CLEAR_MAL_AUTH_RESPONSE>
export async function sendMessage(message: Message): Promise<Response<unknown>> {
  return browser.runtime.sendMessage(message)
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
    ;(async () => {
      const { type } = message
      try {
        switch (type) {
          case 'AUTO_LINK_ANIME': {
            const { slug, name } = message
            const tabId = sender.tab?.id
            if (tabId == null || !slug || !name) {
              sendResponse({ ok: false, error: 'missing_context' } satisfies AUTO_LINK_ANIME_RESPONSE)
              return
            }
            const result = await autoLinkAnime(slug, name, tabId)
            sendResponse(result satisfies AUTO_LINK_ANIME_RESPONSE)
            break
          }

          case 'GET_LINK': {
            const { slug } = message
            const id = await getId(slug)
            sendResponse({ ok: true, data: { id } } satisfies GET_LINK_RESPONSE)
            break
          }

          case 'LINK_ANIME': {
            const { slug, malId } = message
            let { title, pictureUrl } = message
            if (!title || !pictureUrl) {
              try {
                const details = await getAnimeDetails(malId)
                title = title || details.title
                pictureUrl = pictureUrl || details.main_picture?.medium || null
              } catch (err) {
                if (!title) {
                  sendResponse({ ok: false, error: 'not_found' } satisfies LINK_ANIME_RESPONSE)
                  return
                }
              }
            }

            await setId(slug, malId)

            const tabId = sender.tab?.id
            await setBadgeForTab(tabId, true)

            sendResponse({ ok: true, data: { title, pictureUrl } } satisfies LINK_ANIME_RESPONSE)
            break
          }

          case 'UNLINK_ANIME': {
            const { slug } = message
            await removeId(slug)
            const tabId = sender.tab?.id
            await setBadgeForTab(tabId, false)
            sendResponse({ ok: true, data: undefined } satisfies UNLINK_ANIME_RESPONSE)
            break
          }

          case 'SEARCH_ANIME': {
            const { query } = message
            const results = await searchAnime(query)
            sendResponse({ ok: true, data: { results } } satisfies SEARCH_ANIME_RESPONSE)
            break
          }

          case 'GET_DETAILS': {
            const { id } = message
            const details = await getAnimeDetails(id)
            sendResponse({ ok: true, data: { details } } satisfies GET_DETAILS_RESPONSE)
            break
          }

          case 'UPDATE_SCORE': {
            const { id, score } = message

            const details = await getAnimeDetails(id)
            if (details == null || details.my_list_status?.status == null || details.my_list_status?.status === 'plan_to_watch') {
              sendResponse({ ok: false, error: 'not_available' } satisfies UPDATE_SCORE_RESPONSE)
              return
            }
            const result = await updateListStatus(id, { score })
            sendResponse({ ok: true, data: { status: result } } satisfies UPDATE_SCORE_RESPONSE)
            break
          }

          case 'TOGGLE_WATCHED': {
            const { slug, episode, watched } = message
            const result = await handleToggleWatched({ slug, episode, watched })
            sendResponse(result satisfies TOGGLE_WATCHED_RESPONSE)
            break
          }

          // case 'TEST_MAL_CONNECTION': {
          //   const user = await getCurrentUser()
          //   sendResponse({ ok: true, data: { user } } satisfies TEST_MAL_CONNECTION_RESPONSE)
          //   break
          // }

          // case 'SAVE_MAL_AUTH': {
          //   const { clientId, clientSecret, refreshToken } = message
          //   await setMalAuth({ clientId, clientSecret, refreshToken })
          //   sendResponse({ ok: true, data: undefined } satisfies SAVE_MAL_AUTH_RESPONSE)
          //   break
          // }

          case 'CLEAR_BADGE': {
            await setBadgeForTab(sender.tab?.id, null)
            sendResponse({ ok: true, data: undefined } satisfies CLEAR_BADGE_RESPONSE)
            break
          }

          case 'GET_MAL_STATUS': {
            const a = await getMalAuth()
            const configured = !!(a?.clientId && a.clientSecret && a.refreshToken)
            sendResponse({ ok: true, data: { configured } } satisfies GET_MAL_STATUS_RESPONSE)
            break
          }

          case 'GET_MAL_AUTH': {
            const a = await getMalAuth()
            const auth = a ? { clientId: a.clientId, clientSecret: a.clientSecret, refreshToken: a.refreshToken } : null
            sendResponse({ ok: true, data: { auth } } satisfies GET_MAL_AUTH_RESPONSE)
            break
          }

          case 'CONNECT_MAL': {
            const { clientId, clientSecret, refreshToken } = message
            const user = await connectMal({ clientId, clientSecret, refreshToken })
            sendResponse({ ok: true, data: { user } } satisfies CONNECT_MAL_RESPONSE)
            break
          }

          case 'CLEAR_MAL_AUTH': {
            await clearMalAuth()
            sendResponse({ ok: true, data: undefined } satisfies CLEAR_MAL_AUTH_RESPONSE)
            break
          }

          default:
            sendResponse({ ok: false, error: 'unknown_message_type' })
        }
      } catch (err) {
        sendResponse({ ok: false, error: err instanceof MalAuthError ? err.code : (err as Error).message })
      }
    })()

    return true
  })
})
