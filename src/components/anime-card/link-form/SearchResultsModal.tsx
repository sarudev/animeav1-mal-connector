import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink } from 'lucide-react'
import Tooltip from '../../tooltip/Tooltip'
import type { MalAnime } from '@/utils/mal'
import AnimeResultItem from './AnimeResultItem'

interface Props {
  open: boolean
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
  container: HTMLElement
  results: MalAnime[]
  selectedId: number | null
  onSelect: (anime: MalAnime) => void
}

export default function SearchResultsModal({ open, onClose, anchorRef, container, results, selectedId, onSelect }: Props) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  // Posición debajo del input; se recalcula al hacer scroll o redimensionar.
  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (rect) setPos({ top: rect.bottom + 8, left: rect.left, width: rect.width })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, anchorRef])

  // Cerrar con Escape o al hacer click fuera.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: PointerEvent) => {
      // composedPath() porque en un Shadow Root e.target se re-targetea al host.
      const path = e.composedPath()
      if (modalRef.current && path.includes(modalRef.current)) return
      if (anchorRef.current && path.includes(anchorRef.current)) return
      onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose, anchorRef])

  if (!open || !pos || results.length === 0) return null

  return createPortal(
    <div
      ref={modalRef}
      style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: `calc(100vh - ${pos.top}px - 16px)` }}
      className='fixed z-1 flex flex-col overflow-hidden rounded-lg border border-line bg-mute p-2 shadow-xl animate-zoom'
    >
      <ul className='max-h-52 lg:max-h-70 min-h-0 overflow-auto scrollbar-thin [scrollbar-color:var(--color-line)_transparent]'>
        {results.map(anime => (
          <li key={anime.id}>
            <AnimeResultItem anime={anime} container={container} selected={selectedId === anime.id} onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </div>,
    container
  )
}
