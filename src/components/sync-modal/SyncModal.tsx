import { useEffect, useId, useRef, useState } from 'react'
import { sendMessage } from '@/entrypoints/background'
import {
  FIELD_KEYS,
  fieldIdentical,
  fieldMatches,
  needsWrite,
  normalizeCompleted,
  padSnapshot,
  resolveFields,
  snapshotToMalUpdate,
  snapshotToSiteFields,
  toSiteRating,
  type FieldChoice,
  type FieldKey,
  type ListSnapshot,
  type Side
} from '@/utils/list-sync'
import { logger } from '@/utils/logger'
import { opKey, startOperation } from '@/utils/operations'
import { deleteSiteEntry, saveSiteListEntry } from '@/utils/site-library'
import { reloadNow } from '@/utils/site-ui'
import { pushToast } from '@/utils/toast-store'
import { routeMalError, useAnimeStore } from '@/components/anime-card/useAnimeStore'
import Button from '@/components/Button'
import { FOCUS_STYLE, useModalKeys } from '@/components/useModalKeys'
import { useSyncStore, type SyncConflict } from './useSyncStore'

const STATUS_LABEL: Record<ListSnapshot['status'], string> = {
  watching: 'Viendo',
  plan_to_watch: 'Por ver',
  completed: 'Completado',
  on_hold: 'Pausado',
  dropped: 'Descartado'
}

const ROWS: { key: FieldKey; label: string; format: (s: ListSnapshot, side: Side) => string }[] = [
  { key: 'status', label: 'Estado', format: s => STATUS_LABEL[s.status] },
  { key: 'episodes', label: 'Episodios vistos', format: s => String(s.episodes) },
  { key: 'startDate', label: 'Inicio', format: s => s.startDate || '—' },
  { key: 'endDate', label: 'Fin', format: s => s.endDate || '—' },
  {
    key: 'score',
    label: 'Puntuación',
    format: (s, side) => (s.score > 0 ? (side === 'mal' ? `${s.score}/10` : `${toSiteRating(s.score)}/5`) : '—')
  }
]

const FOCUS_RING = FOCUS_STYLE

// Navegación con flechas: cada botón lleva su columna (data-col) y fila (data-row).
function arrowTarget(dialog: HTMLElement, from: HTMLElement, key: string): HTMLElement | null {
  const col = Number(from.dataset.col)
  const row = Number(from.dataset.row)
  const all = [...dialog.querySelectorAll<HTMLElement>('button[data-col]:not(:disabled)')]
  const inCol = (c: number) => all.filter(b => Number(b.dataset.col) === c)
  const rowOf = (b: HTMLElement) => Number(b.dataset.row)

  if (key === 'ArrowDown') return inCol(col).find(b => rowOf(b) > row) ?? null
  if (key === 'ArrowUp') return inCol(col).reverse().find(b => rowOf(b) < row) ?? null

  const other = inCol(col === 0 ? 1 : 0)
  if ((key === 'ArrowLeft' && col === 0) || (key === 'ArrowRight' && col === 1)) return null
  return other.sort((a, b) => Math.abs(rowOf(a) - row) - Math.abs(rowOf(b) - row))[0] ?? null
}

interface ColumnProps {
  title: string
  side: Side
  snapshot: ListSnapshot | null
  other: ListSnapshot | null
  choice: FieldChoice
  cardSelected: boolean
  disabled: boolean
  onCard: () => void
  onField: (key: FieldKey) => void
}

function Column({ title, side, snapshot, other, choice, cardSelected, disabled, onCard, onField }: ColumnProps) {
  const usable = !disabled && (snapshot != null || other != null)
  const col = side === 'mal' ? 0 : 1

  return (
    <div
      role='group'
      aria-label={title}
      className={`flex flex-1 flex-col gap-1 rounded-lg border p-2 transition-colors ${
        cardSelected ? 'border-main bg-main/10' : 'border-line bg-mute'
      } ${snapshot == null && !cardSelected ? 'opacity-60' : ''}`}
    >
      <button
        type='button'
        data-col={col}
        data-row={0}
        disabled={!usable}
        aria-pressed={cardSelected}
        aria-label={snapshot == null ? `Dejar la lista de ${title} vacía` : `Usar toda la lista de ${title}`}
        onClick={onCard}
        className={`text-lead enabled:hover:bg-edge rounded px-2 py-1 text-left text-sm font-bold enabled:cursor-pointer ${FOCUS_RING}`}
      >
        {title}
      </button>

      {snapshot == null ? (
        <p className={`px-2 text-sm ${cardSelected ? 'text-fire font-bold' : 'text-subs'}`}>
          {cardSelected ? 'Se quedará sin este anime' : 'No está en la lista'}
        </p>
      ) : (
        ROWS.map((row, i) => {
          const identical = other != null && fieldIdentical(row.key, snapshot, other)
          const selected = choice[row.key] === side
          const differs = other != null && !fieldMatches(row.key, snapshot, other)
          const interactive = usable && other != null && !identical
          const value = row.format(snapshot, side)

          return (
            <button
              key={row.key}
              type='button'
              data-col={col}
              data-row={i + 1}
              disabled={!interactive}
              aria-pressed={selected}
              aria-label={`${row.label} en ${title}: ${value}${differs ? ' (difiere)' : ''}`}
              onClick={() => onField(row.key)}
              className={`flex flex-col rounded border px-2 py-1 text-left text-sm ${
                selected ? 'border-main bg-main/20' : 'border-transparent'
              } ${interactive ? 'hover:bg-edge cursor-pointer' : ''} ${FOCUS_RING}`}
            >
              <span className='text-subs text-xs'>{row.label}</span>
              <span className={differs ? 'text-warn font-bold' : 'text-lead'}>{value}</span>
            </button>
          )
        })
      )}
    </div>
  )
}

export default function SyncModal() {
  const conflict = useSyncStore(s => s.conflict)
  const close = useSyncStore(s => s.close)
  const [choice, setChoice] = useState<FieldChoice>({})
  // Lado cuya lista elegiste aun estando vacía: el anime se eliminará del otro lado.
  const [emptyPick, setEmptyPick] = useState<Side | null>(null)
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    setChoice({})
    setEmptyPick(null)
  }, [conflict])

  // Foco al abrir (primer control habilitado) y devolución al elemento previo al cerrar.
  useEffect(() => {
    if (!conflict) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus()
    return () => previous?.focus()
  }, [conflict])

  useModalKeys(conflict != null, dialogRef, onKey)

  const mal = conflict?.mal ?? null
  const site = conflict?.site ?? null
  const both = mal != null && site != null

  // Campos que difieren de verdad y obligan a elegir; los que solo difieren en precisión de fecha se resuelven solos.
  const missing = both ? FIELD_KEYS.filter(key => !fieldMatches(key, mal, site) && !choice[key]) : []
  const canContinue = !busy && missing.length === 0

  function onKey(e: KeyboardEvent, focused: HTMLElement | null) {
    const dialog = dialogRef.current
    if (!dialog) return false

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (canContinue) void onContinue()
      return true
    }

    if (!busy && (e.key === '1' || e.key === '2')) {
      selectCard(e.key === '1' ? 'mal' : 'site')
      return true
    }

    if (e.key.startsWith('Arrow') && focused?.dataset.col != null) {
      arrowTarget(dialog, focused, e.key)?.focus()
    }
    return false
  }

  function selectCard(side: Side) {
    const own = side === 'mal' ? mal : site
    const other = side === 'mal' ? site : mal
    if (own == null) {
      // Elegir una lista vacía solo tiene sentido si el otro lado tiene el anime (se eliminará).
      if (other == null) return
      setChoice({})
      setEmptyPick(prev => (prev === side ? null : side))
      return
    }
    setEmptyPick(null)
    setChoice(Object.fromEntries(FIELD_KEYS.map(key => [key, side])))
  }

  function toggleField(key: FieldKey, side: Side) {
    setEmptyPick(null)
    setChoice(prev => {
      const next = { ...prev }
      if (next[key] === side) delete next[key]
      else next[key] = side
      return next
    })
  }

  function cardSelected(side: Side) {
    if (emptyPick === side) return true
    if (!both || emptyPick) return false
    const own = side === 'mal' ? mal : site
    const diffKeys = FIELD_KEYS.filter(key => !fieldIdentical(key, own, side === 'mal' ? site : mal))
    return diffKeys.length > 0 && diffKeys.every(key => choice[key] === side)
  }

  async function apply(c: SyncConflict) {
    if (emptyPick === 'mal') {
      await deleteSiteEntry(c.siteMediaId)
      reloadNow('Anime eliminado de AnimeAV1')
      return
    }
    if (emptyPick === 'site') {
      const res = await sendMessage({ type: 'DELETE_LIST', id: c.malId })
      if (routeMalError(res)) throw new Error('mal_auth')
      if (!res.ok) throw new Error(res.error)
      if (useAnimeStore.getState().slug === c.slug) useAnimeStore.getState().setListCleared()
      pushToast('Anime eliminado de MAL')
      return
    }

    const final = normalizeCompleted(
      c.mal && c.site ? resolveFields(c.mal, c.site, choice) : (c.mal ?? c.site)!,
      useAnimeStore.getState().totalEpisodes
    )

    if (needsWrite(c.mal, final, choice)) {
      const isLatest = startOperation(opKey.malList(c.slug))
      const update = snapshotToMalUpdate(final, { current: c.mal })
      const res = await sendMessage({ type: 'UPDATE_LIST', id: c.malId, update })
      if (routeMalError(res)) throw new Error('mal_auth')
      if (!res.ok) throw new Error(res.error)
      if (useAnimeStore.getState().slug === c.slug && isLatest()) useAnimeStore.getState().setListStatus(res.data.status)
    }

    if (needsWrite(c.site, padSnapshot(final), choice)) {
      await saveSiteListEntry(c.siteMediaId, snapshotToSiteFields(final, c.siteExtra, c.site))
      reloadNow('Listas sincronizadas')
      return
    }

    pushToast('Listas sincronizadas')
  }

  async function onContinue() {
    if (!conflict) return
    setBusy(true)
    try {
      await apply(conflict)
      close()
    } catch (e) {
      logger.error('no se pudo sincronizar la lista', e)
      pushToast('No se pudo sincronizar la lista', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!conflict) return null

  const deleteTarget = emptyPick === 'mal' ? 'AnimeAV1' : emptyPick === 'site' ? 'MAL' : null
  const pickedLabel = emptyPick === 'mal' ? 'MAL' : 'AnimeAV1'

  return (
    <div className='fixed inset-0 z-2147483647 flex items-center justify-center bg-black/60 p-4'>
      <div
        ref={dialogRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        aria-describedby={descId}
        className='bg-mute border-line flex w-full max-w-lg flex-col gap-4 rounded-lg border p-5 shadow-xl'
      >
        <div>
          <h2 id={titleId} className='text-lead text-lg font-bold'>
            Tu lista no coincide
          </h2>
          <p id={descId} className='text-subs text-sm'>
            Elige una lista completa (la otra se reemplaza por entero) o escoge campo por campo. Los datos elegidos se aplican a ambos lados.
          </p>
        </div>

        <div className='flex gap-3'>
          <Column
            title='MAL'
            side='mal'
            snapshot={mal}
            other={site}
            choice={choice}
            cardSelected={cardSelected('mal')}
            disabled={busy}
            onCard={() => selectCard('mal')}
            onField={key => toggleField(key, 'mal')}
          />
          <Column
            title='AnimeAV1'
            side='site'
            snapshot={site}
            other={mal}
            choice={choice}
            cardSelected={cardSelected('site')}
            disabled={busy}
            onCard={() => selectCard('site')}
            onField={key => toggleField(key, 'site')}
          />
        </div>

        {deleteTarget && (
          <p role='alert' className='border-fire text-fire rounded border p-2 text-sm'>
            Elegiste la lista de {pickedLabel}, que no tiene este anime: se eliminará de {deleteTarget}. No se puede deshacer.
          </p>
        )}

        <div className='flex items-center justify-between gap-3'>
          <p className='text-subs text-xs'>
            Teclado: flechas para moverte, Enter para elegir, 1 = MAL completo, 2 = AnimeAV1 completo, Ctrl+Enter = continuar.
          </p>
          <Button
            type={deleteTarget ? 'risk' : 'fill'}
            label={busy ? 'Sincronizando…' : deleteTarget ? 'Eliminar y continuar' : 'Continuar'}
            disabled={!canContinue}
            onClick={onContinue}
            className='shrink-0'
          />
        </div>
      </div>
    </div>
  )
}
