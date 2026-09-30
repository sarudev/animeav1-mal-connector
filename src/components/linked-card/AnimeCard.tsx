import { BadgeQuestionMark, Check, ChevronLeft, Clock, Pause, Play, Settings, Star, X } from 'lucide-react'
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { browser } from 'wxt/browser'
import Tooltip from '../tooltip/Tooltip'
import Button from '../Button'
import Card from '../Card'
import { useRef } from 'react'
import useDebouncedEffect from '@/hooks/useDebouncedEffect'
import type { MalAnime, MalListStatus } from '@/utils/mal'
import '@/styles/tailwind.css'
import LinkedCard from './LinkedCard'
import { useAnimeStore } from './state'
import { sendMessage } from '@/entrypoints/background'

export interface Props {
  container: HTMLElement
}

export default function AnimeCard({ container }: Props) {
  const { score, setScore, status, view, setView, slug, title, id, setId, setTitle } = useAnimeStore()

  const lastConfirmedScore = useRef<number | null>(score)
  const [searchInput, setSearchInput] = useState('')
  const [searchResults, setSearchResults] = useState<MalAnime[]>([])
  const [selectedResult, setSelectedResult] = useState<MalAnime | null>(null)
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
      const newLinks = (changes.animeLinks.newValue as Record<string, number>) || {}
      const newLink = newLinks[slug] || null
      setView(newLink ? 'linked' : 'link-form')
    }
    browser.storage.onChanged.addListener(onChanged)

    return () => browser.storage.onChanged.removeListener(onChanged)
  }, [slug])

  useEffect(() => {
    // if (view !== 'link-form' || !title) return
    // if (autoSearchedFor.current === slug) return
    // autoSearchedFor.current = slug
    // setSearchInput(title)
    // // Ya tenemos resultados del intento de auto-vínculo hecho al cargar la página.
    // if (!initialResultsConsumed.current) {
    //   initialResultsConsumed.current = true
    //   applyResults(initialResults, title)
    //   return
    // }
    // ;(async () => {
    //   const results = await performSearch(animeData.title)
    //   if (results) applyResults(results, animeData.title)
    // })()
  }, [view, slug, title])

  useDebouncedEffect(score, 1000, async () => {
    if (score === lastConfirmedScore.current) return
    if (status == null || status === 'plan_to_watch') return

    const res = await sendMessage({ type: 'UPDATE_SCORE', id: id!, score, slug })
    if (res?.ok) {
      lastConfirmedScore.current = score
      pushToast('Puntuación actualizada')
    } else {
      setScore(lastConfirmedScore.current!)
      pushToast(`Error al actualizar la puntuación: ${res?.error || res}`, 'error')
    }
  })

  async function performSearch(query: string): Promise<MalAnime[] | null> {
    if (query.length < 3) {
      setNoResultsQuery(null)
      setError(query.length === 0 ? 'Ingresa un término de búsqueda.' : 'El término de búsqueda debe tener al menos 3 caracteres.')
      return null
    }
    setError('')
    setNoResultsQuery(null)
    setSearchLoading(true)
    try {
      const res = await sendMessage({ type: 'SEARCH_ANIME', query })
      if (!res?.ok) {
        setError(res?.error || 'Error al buscar en MAL')
        return null
      }
      const { results } = res.data
      if (results.length === 0) setNoResultsQuery(query)
      setSearchResults(results)
      return results as MalAnime[]
    } finally {
      setSearchLoading(false)
    }
  }

  async function handleSearch() {
    setSelectedResult(null)
    await performSearch(searchInput.trim())
  }

  function applyResults(results: MalAnime[], name: string) {
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

  async function handleConfirm() {
    setError('')
    const trimmed = manualId.trim()
    const id = trimmed ? parseInt(trimmed, 10) : selectedResult?.id
    if (!id) return setError('Selecciona un resultado o ingresa un ID manualmente.')

    const title = trimmed ? null : (selectedResult?.title ?? null)
    const pictureUrl = trimmed ? null : selectedResult?.main_picture?.medium || null

    setConfirmLoading(true)
    try {
      const res = await sendMessage({ type: 'LINK_ANIME', slug, malId: id, title, pictureUrl })
      if (!res?.ok) {
        return setError(res?.error === 'not_found' ? 'Anime no encontrado.' : res?.error || 'No se pudo vincular.')
      }
      const { title: returnedTitle } = res.data
      setId(id)
      setTitle(returnedTitle!)
      setView('linked')
    } finally {
      setConfirmLoading(false)
    }
  }

  const confirmManualDisabled = !manualId.trim() && !selectedResult
  const confirmNameDisabled = searchInput.trim().length < 3 || confirmLoading || searchLoading

  return (
    <div className='relative rounded mb-2 flex flex-col gap-2'>
      <Card className='flex flex-col gap-4'>
        {view === 'linked' && <LinkedCard />}

        {view === 'link-form' && (
          <>
            <div className='card'>
              <Button label='Volver' icon={<ChevronLeft size={18} />} onClick={() => setView('linked')} className='self-start text-sm' />

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
                        <span className='result-info'>
                          <Tooltip label={anime.title} container={container}>
                            <a
                              className='result-link'
                              href={`https://myanimelist.net/anime/${anime.id}`}
                              target='_blank'
                              rel='noopener noreferrer'
                              onClick={e => e.stopPropagation()}
                            >
                              {anime.title}
                            </a>
                          </Tooltip>
                          <p className='result-meta'>
                            {anime.num_episodes ? `${anime.num_episodes} eps` : 'Eps ?'} · ID {anime.id}
                          </p>
                        </span>
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
          </>
        )}
      </Card>

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
  )
}
