import { ChevronLeft, ExternalLink, Link, RotateCcw, Unlink } from 'lucide-react'
import { useEffect, useState } from 'react'
import Tooltip from '../tooltip/Tooltip'
import Button from '../Button'
import Card from '../Card'
import { useRef } from 'react'
import useDebouncedEffect from '@/hooks/useDebouncedEffect'
import type { MalAnime } from '@/utils/mal'
import LinkedCard from './LinkedCard'
import { useAnimeStore } from './useAnimeStore'
import { sendMessage } from '@/entrypoints/background'
import '@/styles/tailwind.css'
import { LinkFormActions } from './LinkFormActions'
import Input from '../Input'
import SearchResultsModal from './SearchResultsModal'
import AnimeResultItem from './AnimeResultItem'
import ManualIdEntry from './ManualIdEntry'

export interface Props {
  container: HTMLElement
}

export default function AnimeCard({ container }: Props) {
  const { view, setView, slug, title, id, setId, setTitle, picture, setPicture, totalEpisodes, setDetails } = useAnimeStore()

  const [searchInput, setSearchInput] = useState('')
  const [searchResults, setSearchResults] = useState<MalAnime[]>([])
  const [selectedResult, setSelectedResult] = useState<MalAnime | null>(null)
  const [manualId, setManualId] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [error, setError] = useState('')
  const [noResultsQuery, setNoResultsQuery] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [manualLoading, setManualLoading] = useState(false)
  const [manualError, setManualError] = useState('')
  const manualRequestId = useRef(0)

  const autoSearchedFor = useRef<string | null>(null)
  const autoSelectNext = useRef(false)
  const searchRequestId = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastSearched = useRef<string | null>(null)
  const selectedRef = useRef(selectedResult)
  selectedRef.current = selectedResult

  useEffect(() => {
    if (view !== 'link-form' || id != null || !title) return
    if (autoSearchedFor.current === slug) return
    autoSearchedFor.current = slug
    autoSelectNext.current = true
    setSearchInput(title)
  }, [view, id, slug, title])

  // Al entrar al formulario con un anime ya vinculado, mostrarlo como seleccionado.
  useEffect(() => {
    if (view !== 'link-form' || id == null || !title) return

    setSelectedResult({
      id,
      title,
      main_picture: picture ? { medium: picture } : undefined,
      num_episodes: totalEpisodes
    } as MalAnime)
    setManualId(`${id}`)
    setSearchInput(title)
  }, [view, id, picture, totalEpisodes])

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

  async function loadAnimeDetails(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
    const res = await sendMessage({ type: 'GET_DETAILS', id })
    if (!res?.ok || !res.data.details) {
      return { ok: false, error: res?.ok === false ? (res.error ?? 'details_failed') : 'details_failed' }
    }

    setDetails(res.data.details)
    return { ok: true }
  }

  async function handleConfirm() {
    setError('')
    const trimmed = manualId.trim()
    const targetId = trimmed ? parseInt(trimmed, 10) : selectedResult?.id
    if (!targetId) return setError('Selecciona un resultado o ingresa un ID manualmente.')

    const match = selectedResult?.id === targetId ? selectedResult : null
    const matchTitle = match?.title ?? null
    const matchPicture = match?.main_picture?.medium ?? null

    setConfirmLoading(true)
    setView('linked')
    try {
      const res = await sendMessage({ type: 'LINK_ANIME', slug, malId: targetId, title: matchTitle, pictureUrl: matchPicture })
      if (!res?.ok) {
        return setError(res?.error === 'not_found' ? 'Anime no encontrado.' : res?.error || 'No se pudo vincular.')
      }

      const store = useAnimeStore.getState()
      store.setLoading(true)
      setId(targetId)

      const details = await loadAnimeDetails(targetId)
      store.setLoading(false)

      if (!details.ok) {
        // El vínculo ya se guardó; mostramos lo mínimo que tenemos como respaldo.
        setTitle(res.data.title ?? matchTitle ?? '')
        setPicture(res.data.pictureUrl ?? matchPicture ?? '')
        pushToast('Vinculado, pero no se pudieron cargar tus datos de MAL', 'error')
      }
    } finally {
      setConfirmLoading(false)
    }
  }

  async function runSearch(rawQuery: string, autoSelect = false) {
    const query = rawQuery.trim()

    if (query.length < 3) {
      setNoResultsQuery(null)
      setError(query.length === 0 ? 'Ingresa un término de búsqueda.' : 'El término de búsqueda debe tener al menos 3 caracteres.')
      return
    }

    lastSearched.current = query
    setError('')
    setNoResultsQuery(null)
    setSearchLoading(true)
    const requestId = ++searchRequestId.current

    try {
      const res = await sendMessage({ type: 'SEARCH_ANIME', query })
      if (requestId !== searchRequestId.current) return

      if (!res?.ok) {
        lastSearched.current = null
        setError(res?.error || 'Error al buscar en MAL')
        return
      }

      const { results } = res.data
      if (autoSelect) {
        applyResults(results, query)
      } else {
        setSearchResults(results)
        if (results.length === 0) setNoResultsQuery(query)
      }
    } finally {
      if (requestId === searchRequestId.current) setSearchLoading(false)
    }
  }

  useDebouncedEffect(searchInput, 300, async () => {
    if (view !== 'link-form') return

    const shouldAutoSelect = autoSelectNext.current
    autoSelectNext.current = false

    // Ya se buscó este texto directamente (por ejemplo, tras desvincular).
    if (searchInput.trim() === lastSearched.current) return

    await runSearch(searchInput, shouldAutoSelect)
  })

  function parseId(value: string): number | null {
    const n = Number(value.trim())
    return Number.isInteger(n) && n > 0 ? n : null
  }

  function handleUnlinked(name: string | null) {
    const query = (name ?? '').trim()
    setSearchInput(query)
    setModalOpen(true)
    inputRef.current?.focus()
    if (query) runSearch(query, true)
  }

  function resetSearch() {
    if (!title) return
    autoSelectNext.current = true // vuelve a preseleccionar el mejor match
    setSearchInput(title)
    setModalOpen(true)
    inputRef.current?.focus()
  }

  function handleManualChange(value: string) {
    setManualId(value)
    setManualError('')
    setSelectedResult(null) // el preview viejo ya no corresponde al ID tipeado
    manualRequestId.current++ // invalida cualquier request en vuelo
    setManualLoading(parseId(value) != null)
  }

  useDebouncedEffect(manualId, 500, async () => {
    if (view !== 'link-form') return

    const parsed = parseId(manualId)
    // ID vacío/inválido, o ya tenemos ese anime (por ejemplo, vino de la lista de resultados).
    if (parsed == null || selectedRef.current?.id === parsed) {
      setManualLoading(false)
      return
    }

    const requestId = ++manualRequestId.current
    setManualLoading(true)

    try {
      const res = await sendMessage({ type: 'GET_DETAILS', id: parsed })
      if (requestId !== manualRequestId.current) return // llegó una más nueva

      if (!res?.ok || !res.data.details) {
        setManualError('No se encontró ningún anime con ese ID.')
        return
      }
      setSelectedResult({ ...res.data.details, id: parsed } as MalAnime)
    } catch {
      if (requestId === manualRequestId.current) setManualError('No se pudo consultar MAL.')
    } finally {
      if (requestId === manualRequestId.current) setManualLoading(false)
    }
  })

  const trimmedManual = manualId.trim()
  const targetId = trimmedManual ? parseInt(trimmedManual, 10) : selectedResult?.id
  const confirmManualDisabled = !targetId || targetId === id

  return (
    <div className='relative rounded mb-2 flex flex-col gap-2'>
      <Card className='flex flex-col gap-4'>
        {view === 'linked' && <LinkedCard />}

        {view === 'link-form' && (
          <>
            <div className='flex flex-col gap-2'>
              <LinkFormActions
                onUnlinked={handleUnlinked}
                setSearchResults={setSearchResults}
                setSelectedResult={setSelectedResult}
                setManualId={setManualId}
                setNoResultsQuery={setNoResultsQuery}
                setError={setError}
              />

              <Input
                ref={inputRef}
                name='name'
                value={searchInput}
                onChange={e => {
                  setSearchInput(e.target.value)
                  setModalOpen(true)
                }}
                onFocus={() => setModalOpen(true)}
                placeholder='Buscar anime...'
                loading={searchLoading}
                loadingText='Buscando...'
                error={error}
                hint={
                  noResultsQuery && (
                    <>
                      No se encontraron resultados.{' '}
                      <a
                        className='whitespace-nowrap text-main hover:underline'
                        href={`https://myanimelist.net/anime.php?q=${encodeURIComponent(noResultsQuery)}`}
                        target='_blank'
                        rel='noopener noreferrer'
                      >
                        Ir a MAL →
                      </a>
                    </>
                  )
                }
                trailing={
                  searchInput.trim() !== title ? (
                    <Tooltip label='Restaurar nombre' container={container}>
                      <Button icon={<RotateCcw size={16} />} onClick={resetSearch} />
                    </Tooltip>
                  ) : null
                }
              />

              <SearchResultsModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                anchorRef={inputRef}
                container={container}
                results={searchResults}
                selectedId={selectedResult?.id ?? null}
                onSelect={anime => {
                  setSelectedResult(anime)
                  setManualId(`${anime.id}`)
                  setModalOpen(false)
                }}
              />

              {selectedResult && <AnimeResultItem anime={selectedResult} container={container} />}

              <ManualIdEntry value={manualId} onChange={handleManualChange} loading={manualLoading} error={manualError} />

              <Button
                className='text-sm gap-1 px-2 relative'
                icon={<Link size={20} />}
                iconPosition='right'
                label='Vincular'
                type='border'
                disabled={confirmManualDisabled || confirmLoading}
                onClick={handleConfirm}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
