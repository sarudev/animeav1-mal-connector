import { useEffect, useState } from 'react'
import { sendMessage } from '@/entrypoints/background'
import {
  FIELD_KEYS,
  fieldIdentical,
  fieldMatches,
  padSnapshot,
  resolveFields,
  scoresMatch,
  snapshotToMalUpdate,
  snapshotToSiteFields,
  toSiteRating,
  type FieldChoice,
  type FieldKey,
  type ListSnapshot,
  type Side
} from '@/utils/list-sync'
import { saveSiteListEntry } from '@/utils/site-library'
import { updateSiteStatusButton } from '@/utils/site-ui'
import { pushToast } from '@/utils/toast-store'
import { routeMalError, useAnimeStore } from '@/components/anime-card/useAnimeStore'
import Button from '@/components/Button'
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
  const usable = snapshot != null && !disabled

  return (
    <div
      className={`flex flex-1 flex-col gap-1 rounded-lg border p-2 transition-colors ${
        cardSelected ? 'border-main bg-main/10' : 'border-line bg-mute'
      } ${snapshot == null ? 'opacity-60' : ''}`}
    >
      <button
        type='button'
        disabled={!usable}
        onClick={onCard}
        className='text-lead enabled:hover:bg-edge rounded px-2 py-1 text-left text-sm font-bold enabled:cursor-pointer'
      >
        {title}
      </button>

      {snapshot == null ? (
        <p className='text-subs px-2 text-sm'>No está en la lista</p>
      ) : (
        ROWS.map(row => {
          const identical = other != null && fieldIdentical(row.key, snapshot, other)
          const selected = choice[row.key] === side
          const differs = other != null && !fieldMatches(row.key, snapshot, other)
          const interactive = usable && other != null && !identical

          return (
            <button
              key={row.key}
              type='button'
              disabled={!interactive}
              onClick={() => onField(row.key)}
              className={`flex flex-col rounded border px-2 py-1 text-left text-sm ${
                selected ? 'border-main bg-main/20' : 'border-transparent'
              } ${interactive ? 'hover:bg-edge cursor-pointer' : ''}`}
            >
              <span className='text-subs text-xs'>{row.label}</span>
              <span className={differs ? 'text-warn font-bold' : 'text-lead'}>{row.format(snapshot, side)}</span>
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
  const [busy, setBusy] = useState(false)

  useEffect(() => setChoice({}), [conflict])

  if (!conflict) return null

  const { mal, site } = conflict
  const both = mal != null && site != null

  // Campos que difieren de verdad y obligan a elegir; los que solo difieren en precisión de fecha se resuelven solos.
  const missing = both ? FIELD_KEYS.filter(key => !fieldMatches(key, mal, site) && !choice[key]) : []
  const canContinue = !busy && missing.length === 0

  function selectCard(side: Side) {
    setChoice(Object.fromEntries(FIELD_KEYS.map(key => [key, side])))
  }

  function toggleField(key: FieldKey, side: Side) {
    setChoice(prev => {
      const next = { ...prev }
      if (next[key] === side) delete next[key]
      else next[key] = side
      return next
    })
  }

  function cardSelected(side: Side) {
    if (!both) return false
    const own = side === 'mal' ? mal : site
    const diffKeys = FIELD_KEYS.filter(key => !fieldIdentical(key, own, side === 'mal' ? site : mal))
    return diffKeys.length > 0 && diffKeys.every(key => choice[key] === side)
  }

  // Un campo se escribe si fue elegido explícitamente (aunque solo cambie la precisión) o si difiere de verdad.
  function needsWrite(target: ListSnapshot | null, final: ListSnapshot, comparable: (s: ListSnapshot) => ListSnapshot) {
    if (!target) return true
    const wanted = comparable(final)
    return FIELD_KEYS.some(key => {
      if (key === 'score') return !scoresMatch(wanted.score, target.score)
      return choice[key] ? wanted[key] !== target[key] : !fieldMatches(key, wanted, target)
    })
  }

  async function apply(c: SyncConflict) {
    const final = c.mal && c.site ? resolveFields(c.mal, c.site, choice) : (c.mal ?? c.site)!

    if (needsWrite(c.mal, final, s => s)) {
      const res = await sendMessage({ type: 'UPDATE_LIST', id: c.malId, update: snapshotToMalUpdate(final) })
      if (routeMalError(res)) throw new Error('mal_auth')
      if (!res.ok) throw new Error(res.error)
      if (useAnimeStore.getState().slug === c.slug) useAnimeStore.getState().setListStatus(res.data.status)
    }

    if (needsWrite(c.site, final, padSnapshot)) {
      await saveSiteListEntry(c.siteMediaId, snapshotToSiteFields(final, c.siteExtra))
      updateSiteStatusButton(final.status)
    }

    pushToast('Listas sincronizadas')
  }

  async function onContinue() {
    if (!conflict) return
    setBusy(true)
    try {
      await apply(conflict)
      close()
    } catch {
      pushToast('No se pudo sincronizar la lista', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='fixed inset-0 z-2147483647 flex items-center justify-center bg-black/60 p-4'>
      <div className='bg-mute border-line flex w-full max-w-lg flex-col gap-4 rounded-lg border p-5 shadow-xl'>
        <div>
          <h2 className='text-lead text-lg font-bold'>Tu lista no coincide</h2>
          <p className='text-subs text-sm'>
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

        <Button
          type='fill'
          label={busy ? 'Sincronizando…' : 'Continuar'}
          disabled={!canContinue}
          onClick={onContinue}
          className='self-end'
        />
      </div>
    </div>
  )
}
