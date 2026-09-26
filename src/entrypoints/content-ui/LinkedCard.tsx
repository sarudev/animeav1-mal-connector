import { useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import type { AnimeLink } from '@/utils/storage'

interface AnimeResult {
  id: number
  title: string
  num_episodes?: number
  main_picture?: { medium?: string }
}

interface Props {
  slug: string
  initialName: string | null
  initialLink: AnimeLink | null
  initialResults?: AnimeResult[] | null
}

export default function LinkedCard({ slug, initialName, initialLink, initialResults = null }: Props) {
  const [link, setLink] = useState<AnimeLink | null>(initialLink)
  const [view, setView] = useState<'linked' | 'link-form'>(initialLink ? 'linked' : 'link-form')
  const [searchInput, setSearchInput] = useState('')
  const [searchResults, setSearchResults] = useState<AnimeResult[]>([])
  const [selectedResult, setSelectedResult] = useState<AnimeResult | null>(null)
  const [manualId, setManualId] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [error, setError] = useState('')
  const [noResultsQuery, setNoResultsQuery] = useState<string | null>(null)

  const autoSearchedFor = useRef<string | null>(null)
  const initialResultsConsumed = useRef(false)

  useEffect(() => {
    const onChanged: Parameters<typeof browser.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area !== 'local' || !changes.animeLinks) return
      const newLinks = (changes.animeLinks.newValue as Record<string, AnimeLink>) || {}
      const newLink = newLinks[slug] || null
      setLink(newLink)
      setView(newLink ? 'linked' : 'link-form')
    }
    browser.storage.onChanged.addListener(onChanged)
    return () => browser.storage.onChanged.removeListener(onChanged)
  }, [slug])

  async function performSearch(query: string): Promise<AnimeResult[] | null> {
    if (query.length < 3) {
      setNoResultsQuery(null)
      setError(query.length === 0 ? 'Ingresa un término de búsqueda.' : 'El término de búsqueda debe tener al menos 3 caracteres.')
      return null
    }
    setError('')
    setNoResultsQuery(null)
    setSearchLoading(true)
    try {
      const res = await browser.runtime.sendMessage({ type: 'SEARCH_ANIME', query })
      if (!res?.ok) {
        setError(res?.error || 'Error al buscar en MAL')
        return null
      }
      if (res.results.length === 0) setNoResultsQuery(query)
      setSearchResults(res.results)
      return res.results as AnimeResult[]
    } finally {
      setSearchLoading(false)
    }
  }

  async function handleSearch() {
    setSelectedResult(null)
    await performSearch(searchInput.trim())
  }

  function applyResults(results: AnimeResult[], name: string) {
    setSearchResults(results)
    if (results.length === 0) {
      setNoResultsQuery(name)
      return
    }
    setNoResultsQuery(null)
    const exact = results.find(r => r.title.toLowerCase() === name.toLowerCase())
    const best = exact ?? results[0]!
    setSelectedResult(best)
    setManualId(`${best.id}`)
  }

  useEffect(() => {
    if (view !== 'link-form' || !initialName) return
    if (autoSearchedFor.current === slug) return
    autoSearchedFor.current = slug

    setSearchInput(initialName)

    // Ya tenemos resultados del intento de auto-vínculo hecho al cargar la página.
    if (!initialResultsConsumed.current && initialResults != null) {
      initialResultsConsumed.current = true
      applyResults(initialResults, initialName)
      return
    }

    ;(async () => {
      const results = await performSearch(initialName)
      if (results) applyResults(results, initialName)
    })()
  }, [view, slug, initialName, initialResults])

  async function handleConfirm() {
    setError('')
    const trimmed = manualId.trim()
    const malId = trimmed ? parseInt(trimmed, 10) : selectedResult?.id
    if (!malId) return setError('Selecciona un resultado o ingresa un ID manualmente.')

    const title = trimmed ? null : (selectedResult?.title ?? null)
    const pictureUrl = trimmed ? null : selectedResult?.main_picture?.medium || null

    setConfirmLoading(true)
    try {
      const res = await browser.runtime.sendMessage({ type: 'LINK_ANIME', slug, malId, title, pictureUrl })
      if (!res?.ok) {
        return setError(res?.error === 'not_found' ? 'Anime no encontrado.' : res?.error || 'No se pudo vincular.')
      }
      setLink({ malId, title: res.title ?? title, pictureUrl: res.pictureUrl ?? pictureUrl })
      setView('linked')
    } finally {
      setConfirmLoading(false)
    }
  }

  const confirmManualDisabled = !manualId.trim() && !selectedResult
  const confirmNameDisabled = searchInput.trim().length < 3 || confirmLoading || searchLoading

  return (
    <div id='mal-linked-view'>
      {view === 'linked' && link && (
        <div className='card anime-card'>
          <div className='anime-data'>
            {link.pictureUrl && <img className='anime-thumb' src={link.pictureUrl} alt='' />}
            <div className='anime-info'>
              <div>
                <p>
                  ✅ Vinculado (ID <span>{link.malId}</span>)
                </p>
                <a href={`https://myanimelist.net/anime/${link.malId}`} target='_blank' rel='noopener noreferrer'>
                  {link.title || '(sin título)'}
                </a>
              </div>
              <button
                type='button'
                onClick={() => {
                  autoSearchedFor.current = null
                  setView('link-form')
                }}
              >
                Cambiar vínculo
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'link-form' && (
        <div className='search'>
          <div className='card'>
            <p className='back' onClick={() => setView('linked')}>
              {'<'} Volver
            </p>

            <div className='form'>
              <input name='name' value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder='Buscar por nombre...' />
              <button type='button' disabled={confirmNameDisabled} onClick={handleSearch}>
                {searchLoading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <ul>
                {searchResults.map(anime => (
                  <li key={anime.id}>
                    <label>
                      <input
                        type='radio'
                        name='mal-search-result'
                        checked={selectedResult?.id === anime.id}
                        onChange={() => {
                          setSelectedResult(anime)
                          setManualId(`${anime.id}`)
                        }}
                      />
                      <img className='result-thumb' alt='' src={anime.main_picture?.medium || ''} />
                      <p className='result-info'>
                        <a title={anime.title} className='result-link' href={`https://myanimelist.net/anime/${anime.id}`} target='_blank' rel='noopener noreferrer' onClick={e => e.stopPropagation()}>
                          {anime.title}
                        </a>
                        <p className='result-meta'>
                          {anime.num_episodes ? `${anime.num_episodes} eps` : 'Eps ?'} · ID {anime.id}
                        </p>
                      </p>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <details className='manual-entry'>
              <summary>¿Ya tenés el ID de MAL?</summary>
              <input
                type='number'
                min={1}
                value={manualId}
                onChange={e => {
                  setManualId(e.target.value)
                  setSelectedResult(null)
                }}
                placeholder='Ej: 21'
              />
            </details>

            <button type='button' className='confirm' disabled={confirmManualDisabled || confirmLoading} onClick={handleConfirm}>
              Vincular
            </button>
          </div>

          {noResultsQuery && (
            <p className='error'>
              No se encontraron resultados.{' '}
              <a href={`https://myanimelist.net/anime.php?q=${encodeURIComponent(noResultsQuery)}`} target='_blank' rel='noopener noreferrer'>
                Ir a MAL →
              </a>
            </p>
          )}
          {error && <p className='error'>{error}</p>}
        </div>
      )}
    </div>
  )
}
