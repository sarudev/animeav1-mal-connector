import { Link, RotateCcw } from 'lucide-react'
import { useRef, useState } from 'react'
import Tooltip from '../../tooltip/Tooltip'
import Button from '../../Button'
import Input from '../../Input'
import { useAnimeStore } from '../useAnimeStore'
import { useLinkFormStore } from './useLinkFormStore'
import { useLinkFormEffects } from './useLinkFormEffects'
import { LinkFormActions } from './LinkFormActions'
import SearchResultsModal from './SearchResultsModal'
import AnimeResultItem from './AnimeResultItem'
import ManualIdEntry from './ManualIdEntry'
import '@/styles/tailwind.css'

interface LinkFormProps {
  container: HTMLElement
}

export default function LinkForm({ container }: LinkFormProps) {
  useLinkFormEffects()

  // Estado local: solo cosas de UI/DOM
  const [modalOpen, setModalOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Datos del anime (store de dominio)
  const { title, id } = useAnimeStore()

  // Estado del formulario
  const { searchInput, searchResults, selectedResult, manualId, noResultsQuery, error, manualError, searchLoading, manualLoading, confirmLoading } =
    useLinkFormStore()

  // Acciones (referencias estables, no provocan renders)
  const { setSearchInput, select, changeManualId, restoreTitle, startFromName, confirm } = useLinkFormStore()

  const trimmedManual = manualId.trim()
  const targetId = trimmedManual ? parseInt(trimmedManual, 10) : selectedResult?.id
  const confirmDisabled = !targetId || targetId === id || confirmLoading

  function focusAndOpen() {
    setModalOpen(true)
    inputRef.current?.focus()
  }

  function handleUnlinked(name: string | null) {
    startFromName(name)
    focusAndOpen()
  }

  function handleRestore() {
    restoreTitle(title)
    focusAndOpen()
  }

  return (
    <div className='flex flex-col gap-2'>
      <LinkFormActions onUnlinked={handleUnlinked} />

      <Input
        label='Nombre del anime'
        ref={inputRef}
        name='name'
        value={searchInput}
        onChange={e => {
          setSearchInput(e.target.value)
          setModalOpen(true)
        }}
        onFocus={() => setModalOpen(true)}
        placeholder='Buscar anime...'
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
              <Button icon={<RotateCcw size={16} />} onClick={handleRestore} />
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
          select(anime)
          setModalOpen(false)
        }}
      />

      {selectedResult && <AnimeResultItem className='border border-line' anime={selectedResult} container={container} />}

      <ManualIdEntry value={manualId} onChange={changeManualId} loading={manualLoading} error={manualError} />

      <Button
        className='text-sm gap-1 px-2 relative'
        icon={<Link size={20} />}
        iconPosition='right'
        label='Vincular'
        type='border'
        disabled={confirmDisabled}
        onClick={confirm}
      />
    </div>
  )
}
