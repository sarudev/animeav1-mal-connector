import { useEffect, useRef, useState } from 'react'
import { browser } from 'wxt/browser'
import '@/styles/tailwind.css'
import './popup.scss'
import type { AnimeResult } from '@/utils/mal'
import { sendMessage } from '../background'
import type { LINK_ANIME } from '@/utils/types'

interface TabContext {
  slug: string
  name: string | null
}

type ConnectionStatus = {
  text: string
  status: 'status' | 'status ok' | 'status error'
}

function malAnimeUrl(id: number) {
  return `https://myanimelist.net/anime/${id}`
}

async function ensureContentScript(tabId: number) {
  try {
    const response = await browser.tabs.sendMessage(tabId, { type: 'PING' })
    if (response?.ok) return
  } catch {
    // No existe el content script todavía.
  }

  await browser.scripting.executeScript({
    target: { tabId },
    files: ['/content-scripts/content.js']
  })
}

export default function Popup() {
  const [tabId, setTabId] = useState<number | null>(null)
  const [slug, setSlug] = useState<string | null>(null)
  const [name, setName] = useState<string | null>(null)
  const [link, setLink] = useState<AnimeLink | null>(null)

  const [connection, setConnection] = useState<ConnectionStatus>({
    text: 'Comprobando conexión con MAL…',
    status: 'status'
  })

  const [hasContext, setHasContext] = useState<boolean | null>(null) // null = aún no se sabe

  const [view, setView] = useState<'linked' | 'link-form'>('linked')

  const [searchInput, setSearchInput] = useState('')
  const [searchResults, setSearchResults] = useState<AnimeResult[]>([])
  const [selectedResult, setSelectedResult] = useState<AnimeResult | null>(null)
  const [manualId, setManualId] = useState('')

  const [searchLoading, setSearchLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [linkError, setLinkError] = useState('')

  const initialized = useRef(false)

  async function checkConnection() {
    const res = await sendMessage({ type: 'TEST_MAL_CONNECTION' })
    if (res && res.ok) {
      setConnection({
        text: `✅ Conectado a MAL como ${res.data.user?.name ?? ''}`,
        status: 'status ok'
      })
    } else {
      setConnection({
        text: `⚠️ Sin conexión con MAL: ${res?.error ?? 'desconocido'}`,
        status: 'status error'
      })
    }
  }

  async function loadContext() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return
    setTabId(tab.id)

    const res = await sendMessage({ type: 'GET_TAB_CONTEXT', tabId: tab.id })

    if (!res?.ok || !res.data.context) {
      setHasContext(false)
      return
    }

    setHasContext(true)
    setSlug(res.data.context.slug)
    setName(res.data.context.name)
    setLink(res.data.id ?? null)
    setSearchInput(res.data.context.name || '')
    setView(res.data.id ? 'linked' : 'link-form')
  }

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    ;(async () => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) return

      await ensureContentScript(tab.id)

      checkConnection()
      loadContext()
    })()
  }, [])

  function handleChangeLink() {
    setLinkError('')
    setView('link-form')
  }

  async function handleSearch() {
    const query = searchInput.trim()
    if (!query) return

    setLinkError('')
    setSearchLoading(true)
    try {
      const res = await sendMessage({ type: 'SEARCH_ANIME', query })
      if (!res?.ok) {
        setLinkError(res?.error || 'Error al buscar en MAL')
        return
      }
      setSearchResults(res.data.results)
      setSelectedResult(null)
    } finally {
      setSearchLoading(false)
    }
  }

  function handleSelectResult(anime: AnimeResult) {
    setSelectedResult(anime)
    setManualId('')
  }

  function handleManualIdChange(value: string) {
    setManualId(value)
    if (value.trim()) {
      setSelectedResult(null)
    }
  }

  async function handleConfirmLink() {
    setLinkError('')
    const trimmedManualId = manualId.trim()
    const malId = trimmedManualId ? parseInt(trimmedManualId, 10) : selectedResult?.id

    if (!malId) {
      setLinkError('Selecciona un resultado o ingresa un ID manualmente.')
      return
    }

    const title = trimmedManualId ? null : (selectedResult?.title ?? null)
    const pictureUrl = trimmedManualId ? null : selectedResult?.main_picture?.medium || null

    setConfirmLoading(true)
    try {
      const res = await sendMessage({
        type: 'LINK_ANIME',
        malId,
        title,
        pictureUrl,
        tabId: tabId!,
        slug: slug!
      })
      if (!res?.ok) {
        setLinkError(res?.error || 'No se pudo vincular.')
        return
      }

      setLink({
        malId,
        title: res.data.title ?? title
      })
      setView('linked')
    } finally {
      setConfirmLoading(false)
    }
  }

  function handleOptionsClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    browser.runtime.openOptionsPage()
  }

  const confirmDisabled = !manualId.trim() && !selectedResult

  return (
    <main className='bg-red-500'>
      <h1>AnimeAv1 ↔ MyAnimeList</h1>

      <section id='connection-status' className={connection.status}>
        {connection.text}
      </section>

      <section id='page-context'>
        {hasContext === false && (
          <p id='no-context'>
            Abre un capítulo de <strong>animeav1.com</strong> para vincularlo.
          </p>
        )}
        {hasContext && (
          <div id='context-info'>
            <p>
              Detectado: <strong id='detected-name'>{name || '(nombre no detectado)'}</strong>
            </p>
            <p>
              Slug: <code id='detected-slug'>{slug}</code>
            </p>
          </div>
        )}
      </section>

      {hasContext && view === 'linked' && link && (
        <section id='linked-view'>
          <div className='anime-card'>
            {/* <img id='linked-image' className='anime-thumb' alt='' src={link.pictureUrl} /> */}
            <p>
              ✅ Vinculado a{' '}
              <a id='linked-title' href={malAnimeUrl(link.malId)} target='_blank' rel='noopener noreferrer'>
                {link.title || '(sin título)'}
              </a>{' '}
              (ID <span id='linked-id'>{link.malId}</span>)
            </p>
          </div>
          <button id='change-link-btn' type='button' onClick={handleChangeLink}>
            Cambiar vínculo
          </button>
        </section>
      )}

      {hasContext && view === 'link-form' && (
        <section id='link-view'>
          <h2>Vincular anime</h2>

          <div className='search-row'>
            <input id='search-input' type='text' placeholder='Nombre del anime' value={searchInput} onChange={e => setSearchInput(e.target.value)} />
            <button id='search-btn' type='button' disabled={searchLoading} onClick={handleSearch}>
              Buscar en MAL
            </button>
          </div>

          <ul id='search-results'>
            {searchResults.map(anime => (
              <li key={anime.id}>
                <label>
                  <input
                    type='radio'
                    name='search-result'
                    value={anime.id}
                    checked={selectedResult?.id === anime.id}
                    onChange={() => handleSelectResult(anime)}
                  />
                  <img className='result-thumb' alt='' src={anime.main_picture?.medium || ''} />
                  <a
                    className='result-link'
                    href={malAnimeUrl(anime.id)}
                    target='_blank'
                    rel='noopener noreferrer'
                    onClick={e => e.stopPropagation()}
                  >
                    {anime.title} (ID {anime.id}, {anime.num_episodes ? `${anime.num_episodes} eps` : 'eps ?'})
                  </a>
                </label>
              </li>
            ))}
          </ul>

          <div className='manual-row'>
            <label htmlFor='manual-id-input'>ID de MAL (manual)</label>
            <input
              id='manual-id-input'
              type='number'
              min={1}
              placeholder='Ej: 21'
              value={manualId}
              onChange={e => handleManualIdChange(e.target.value)}
            />
          </div>

          <button id='confirm-link-btn' type='button' disabled={confirmDisabled || confirmLoading} onClick={handleConfirmLink}>
            Vincular
          </button>

          {linkError && (
            <p id='link-error' className='error'>
              {linkError}
            </p>
          )}
        </section>
      )}

      <footer>
        <a id='options-link' href='#' onClick={handleOptionsClick}>
          Configurar credenciales de MAL
        </a>
      </footer>
    </main>
  )
}
