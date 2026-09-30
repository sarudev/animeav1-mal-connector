// Service worker: enruta los mensajes de content scripts / popup / options
// y aplica la lógica de sincronización con MyAnimeList.
import type { MalListStatus } from '@/utils/mal'
import { browser } from 'wxt/browser'
import type {
  AUTO_LINK_ANIME,
  AUTO_LINK_ANIME_RESPONSE,
  GET_DETAILS,
  GET_DETAILS_RESPONSE,
  GET_LINK,
  GET_LINK_RESPONSE,
  LINK_ANIME,
  LINK_ANIME_RESPONSE,
  UNLINK_ANIME,
  UNLINK_ANIME_RESPONSE,
  SEARCH_ANIME,
  SEARCH_ANIME_RESPONSE,
  GET_TAB_CONTEXT,
  GET_TAB_CONTEXT_RESPONSE,
  UPDATE_SCORE,
  UPDATE_SCORE_RESPONSE,
  TOGGLE_WATCHED,
  TOGGLE_WATCHED_RESPONSE,
  TEST_MAL_CONNECTION,
  TEST_MAL_CONNECTION_RESPONSE,
  SAVE_MAL_AUTH,
  SAVE_MAL_AUTH_RESPONSE,
  GET_MAL_AUTH,
  GET_MAL_AUTH_RESPONSE,
  GET_LINKED_ANIME,
  GET_LINKED_ANIME_RESPONSE,
  PAGE_CONTEXT,
  PAGE_CONTEXT_RESPONSE,
  Message,
  Response
} from '@/utils/types'

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
 * - Al desmarcar un capítulo como visto:
 *   - Si el anime ya está "completed", no se toca nada.
 *   - En caso contrario, se decrementa num_watched_episodes a (episodio - 1)
 *     y se asegura que el estado sea "watching" (con start_date si falta).
 */
function computeListUpdate(cur: MalListStatus, totalEpisodes: number, episode: number, watched: boolean): Record<string, string | number> | null {
  const update: Record<string, string | number> = {}

  if (watched) {
    if (cur.status !== 'watching') {
      update.status = 'watching'
      if (!cur.start_date) update.start_date = todayISO()
    }

    update.num_watched_episodes = episode

    if (totalEpisodes && totalEpisodes > 0 && episode >= totalEpisodes) {
      update.status = 'completed'
      update.finish_date = todayISO()
      if (!cur.start_date && !update.start_date) update.start_date = todayISO()
    }
  } else {
    if (cur.status === 'completed') {
      return null
    }

    update.num_watched_episodes = Math.max(0, episode - 1)

    if (cur.status !== 'watching') {
      update.status = 'watching'
      if (!cur.start_date) update.start_date = todayISO()
    }
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
  const update = computeListUpdate(details.my_list_status!, details.num_episodes, episode, watched)

  if (!update) {
    return { ok: true, data: { skipped: true } }
  }

  const result = await updateListStatus(id, update)
  return { ok: true, data: { status: result } }
}

async function setBadgeForTab(tabId: number | undefined | null, linked: boolean) {
  if (tabId == null) return
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
    return { ok: true, data: { autoLinked: false, reason: 'existing', id, results: null } }
  }

  const results = await searchAnime(name)
  const anime = results.find(a => a.title.toLowerCase() === name.toLowerCase()) ?? results[0]
  if (!anime) {
    await setBadgeForTab(tabId, false)
    return { ok: true, data: { autoLinked: false, reason: 'no_results', results, id: null } }
  }

  await setId(slug, anime.id)
  await setBadgeForTab(tabId, true)
  return { ok: true, data: { autoLinked: true, id: anime.id, results: null } }
}

export async function sendMessage(message: PAGE_CONTEXT): Promise<PAGE_CONTEXT_RESPONSE>
export async function sendMessage(message: AUTO_LINK_ANIME): Promise<AUTO_LINK_ANIME_RESPONSE>
export async function sendMessage(message: GET_TAB_CONTEXT): Promise<GET_TAB_CONTEXT_RESPONSE>
export async function sendMessage(message: GET_LINK): Promise<GET_LINK_RESPONSE>
export async function sendMessage(message: LINK_ANIME): Promise<LINK_ANIME_RESPONSE>
export async function sendMessage(message: UNLINK_ANIME): Promise<UNLINK_ANIME_RESPONSE>
export async function sendMessage(message: SEARCH_ANIME): Promise<SEARCH_ANIME_RESPONSE>
export async function sendMessage(message: GET_DETAILS): Promise<GET_DETAILS_RESPONSE>
export async function sendMessage(message: UPDATE_SCORE): Promise<UPDATE_SCORE_RESPONSE>
export async function sendMessage(message: TOGGLE_WATCHED): Promise<TOGGLE_WATCHED_RESPONSE>
export async function sendMessage(message: TEST_MAL_CONNECTION): Promise<TEST_MAL_CONNECTION_RESPONSE>
export async function sendMessage(message: SAVE_MAL_AUTH): Promise<SAVE_MAL_AUTH_RESPONSE>
export async function sendMessage(message: GET_MAL_AUTH): Promise<GET_MAL_AUTH_RESPONSE>
export async function sendMessage(message: GET_LINKED_ANIME): Promise<GET_LINKED_ANIME_RESPONSE>
export async function sendMessage(message: Message): Promise<Response<unknown>> {
  return browser.runtime.sendMessage(message)
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
    ;(async () => {
      const { type } = message
      try {
        switch (type) {
          case 'PAGE_CONTEXT': {
            const { slug, name } = message
            const tabId = sender.tab?.id
            if (tabId == null) {
              sendResponse({ ok: false, error: 'missing_context' } satisfies PAGE_CONTEXT_RESPONSE)
              return
            }
            await setTabContext(tabId, { slug, name })
            const link = await getId(slug)
            await setBadgeForTab(tabId, Boolean(link))
            sendResponse({ ok: true, data: undefined } satisfies PAGE_CONTEXT_RESPONSE)
            break
          }

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

          case 'GET_TAB_CONTEXT': {
            const { tabId } = message
            const context = await getTabContext(tabId)
            const id = context ? await getId(context.slug) : null
            sendResponse({ ok: true, data: { context, id } } satisfies GET_TAB_CONTEXT_RESPONSE)
            break
          }

          case 'GET_LINK': {
            const { slug } = message
            const id = await getId(slug)
            sendResponse({ ok: true, data: { id } } satisfies GET_LINK_RESPONSE)
            break
          }

          case 'LINK_ANIME': {
            const { slug, malId, tabId: msgTabId } = message
            let { title, pictureUrl } = message
            if (!title || !pictureUrl) {
              try {
                const details = await getAnimeDetails(malId)
                title = title || details.title
                pictureUrl = pictureUrl || details.main_picture?.medium || null
              } catch {
                if (!title) {
                  sendResponse({ ok: false, error: 'not_found' } satisfies LINK_ANIME_RESPONSE)
                  return
                }
              }
            }

            await setId(slug, malId)

            const tabId = sender.tab?.id ?? msgTabId
            await setBadgeForTab(tabId, true)

            sendResponse({ ok: true, data: { title, pictureUrl } } satisfies LINK_ANIME_RESPONSE)
            break
          }

          case 'UNLINK_ANIME': {
            const { slug, tabId: msgTabId } = message
            await removeId(slug)
            const tabId = sender.tab?.id ?? msgTabId
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
            const { slug } = message
            const id = await getId(slug)
            if (id == null) {
              sendResponse({ ok: false, error: 'not_linked' } satisfies GET_DETAILS_RESPONSE)
              return
            }
            const details = await getAnimeDetails(id)
            sendResponse({ ok: true, data: { details } } satisfies GET_DETAILS_RESPONSE)
            break
          }

          case 'UPDATE_SCORE': {
            const { id, score } = message

            const details = await getAnimeDetails(id)
            if (details == null || details.my_list_status?.status === null || details.my_list_status?.status === 'plan_to_watch') {
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

          case 'TEST_MAL_CONNECTION': {
            const user = await getCurrentUser()
            sendResponse({ ok: true, data: { user } } satisfies TEST_MAL_CONNECTION_RESPONSE)
            break
          }

          case 'SAVE_MAL_AUTH': {
            const { clientId, clientSecret, refreshToken } = message
            await setMalAuth({ clientId, clientSecret, refreshToken })
            sendResponse({ ok: true, data: undefined } satisfies SAVE_MAL_AUTH_RESPONSE)
            break
          }

          case 'GET_MAL_AUTH': {
            const auth = await getMalAuth()
            sendResponse({ ok: true, data: { auth } } satisfies GET_MAL_AUTH_RESPONSE)
            break
          }

          case 'GET_LINKED_ANIME': {
            const { slug } = message
            const id = await getId(slug)
            sendResponse({ ok: true, data: { id } } satisfies GET_LINKED_ANIME_RESPONSE)
            break
          }

          default:
            sendResponse({ ok: false, error: 'unknown_message_type' })
        }
      } catch (err) {
        sendResponse({ ok: false, error: (err as Error).message })
      }
    })()

    return true
  })

  browser.tabs.onRemoved.addListener(tabId => {
    removeTabContext(tabId)
  })
})
