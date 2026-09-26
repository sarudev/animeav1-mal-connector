// Service worker: enruta los mensajes de content scripts / popup / options
// y aplica la lógica de sincronización con MyAnimeList.
import { getLink, setLink, removeLink, getMalAuth, setMalAuth } from './storage.js'
import { searchAnime, getAnimeDetails, updateListStatus, getCurrentUser } from './mal.js'

// Contexto (slug/nombre detectados) por pestaña, solo en memoria.
const tabContexts = new Map()

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

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
function computeListUpdate(currentStatus, totalEpisodes, episode, watched) {
  const cur = currentStatus || {}
  const update = {}

  if (watched) {
    if (cur.status !== 'watching') {
      update.status = 'watching'
      if (!cur.start_date) update.start_date = todayISO()
    }

    update.num_watched_episodes = episode

    if (totalEpisodes > 0 && episode >= totalEpisodes) {
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

async function handleToggleWatched({ slug, episode, watched }) {
  const link = await getLink(slug)
  if (!link) {
    return { ok: false, error: 'not_linked' }
  }
  if (episode == null) {
    return { ok: false, error: 'no_episode_detected' }
  }

  const details = await getAnimeDetails(link.malId)
  const update = computeListUpdate(details.my_list_status, details.num_episodes, episode, watched)

  if (!update) {
    return { ok: true, skipped: true }
  }

  const result = await updateListStatus(link.malId, update)
  return { ok: true, status: result }
}

async function setBadgeForTab(tabId, linked) {
  if (tabId == null) return
  await chrome.action.setBadgeText({ tabId, text: linked ? 'OK' : '?' })

  await chrome.action.setBadgeBackgroundColor({
    tabId,
    color: linked ? '#2e7d32' : '#c62828'
  })
}

async function autoLinkAnime(slug, name, tabId) {
  const existingLink = await getLink(slug)
  if (existingLink) {
    await setBadgeForTab(tabId, true)
    return { ok: true, autoLinked: false, link: existingLink }
  }

  const results = await searchAnime(name)
  const anime = results[0]
  if (!anime) {
    await setBadgeForTab(tabId, false)
    return { ok: true, autoLinked: false, reason: 'no_results' }
  }

  const link = {
    malId: anime.id,
    title: anime.title,
    pictureUrl: anime.main_picture?.medium || null
  }
  await setLink(slug, link)
  await setBadgeForTab(tabId, true)
  return { ok: true, autoLinked: true, link }
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  ;(async () => {
    try {
      switch (message.type) {
        case 'PAGE_CONTEXT': {
          const tabId = sender.tab?.id
          if (tabId == null) {
            sendResponse({ ok: false })
            return
          }
          tabContexts.set(tabId, { slug: message.slug, name: message.name })
          const link = await getLink(message.slug)
          await setBadgeForTab(tabId, Boolean(link))
          sendResponse({ ok: true })
          break
        }

        case 'AUTO_LINK_ANIME': {
          const tabId = sender.tab?.id
          if (tabId == null || !message.slug || !message.name) {
            sendResponse({ ok: false, error: 'missing_context' })
            return
          }
          const result = await autoLinkAnime(message.slug, message.name, tabId)
          sendResponse(result)
          break
        }
        case 'GET_TAB_CONTEXT': {
          const context = tabContexts.get(message.tabId) || null
          const link = context ? await getLink(context.slug) : null
          sendResponse({ ok: true, context, link })
          break
        }

        case 'GET_LINK': {
          const link = await getLink(message.slug)
          sendResponse({ ok: true, link })
          break
        }

        case 'LINK_ANIME': {
          let title = message.title
          let pictureUrl = message.pictureUrl || null
          if (!title || !pictureUrl) {
            try {
              const details = await getAnimeDetails(message.malId)
              title = title || details.title
              pictureUrl = pictureUrl || details.main_picture?.medium || null
            } catch {
              title = title || null
            }
          }
          await setLink(message.slug, { malId: message.malId, title, pictureUrl })

          const tabId = sender.tab?.id ?? message.tabId
          await setBadgeForTab(tabId, true)

          sendResponse({ ok: true, title, pictureUrl })
          break
        }

        case 'UNLINK_ANIME': {
          await removeLink(message.slug)
          const tabId = sender.tab?.id ?? message.tabId
          await setBadgeForTab(tabId, false)
          sendResponse({ ok: true })
          break
        }

        case 'SEARCH_ANIME': {
          const results = await searchAnime(message.query)
          sendResponse({ ok: true, results })
          break
        }

        case 'TOGGLE_WATCHED': {
          const result = await handleToggleWatched(message)
          sendResponse(result)
          break
        }

        case 'TEST_MAL_CONNECTION': {
          const user = await getCurrentUser()
          sendResponse({ ok: true, user })
          break
        }

        case 'SAVE_MAL_AUTH': {
          await setMalAuth({
            clientId: message.clientId,
            clientSecret: message.clientSecret,
            refreshToken: message.refreshToken
          })
          sendResponse({ ok: true })
          break
        }

        case 'GET_MAL_AUTH': {
          const auth = await getMalAuth()
          sendResponse({
            ok: true,
            auth: auth
              ? {
                  clientId: auth.clientId,
                  clientSecret: auth.clientSecret,
                  refreshToken: auth.refreshToken
                }
              : null
          })
          break
        }

        case 'GET_LINKED_ANIME': {
          const link = await getLink(message.slug)
          sendResponse({ ok: true, link })
          break
        }

        default:
          sendResponse({ ok: false, error: 'unknown_message_type' })
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message })
    }
  })()

  return true // Mantiene el canal abierto para la respuesta asíncrona.
})

chrome.tabs.onRemoved.addListener(tabId => {
  tabContexts.delete(tabId)
})
