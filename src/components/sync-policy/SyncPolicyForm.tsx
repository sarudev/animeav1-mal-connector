import { ChevronLeft, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import Button from '@/components/Button'
import Input from '@/components/Input'
import { FOCUS_STYLE } from '@/components/useModalKeys'
import { logger } from '@/utils/logger'
import {
  MAX_POLICY_DAYS,
  clampDays,
  clearAnimePolicy,
  getAnimePolicy,
  getSyncPolicy,
  remainingDays,
  setAnimePolicy,
  setSyncPolicy,
  activeSide,
  type SyncPolicy
} from '@/utils/sync-policy'
import { pushToast } from '@/utils/toast-store'
import '@/styles/tailwind.css'

type OptionKey = 'ask' | 'always-mal' | 'always-site' | 'timed-mal' | 'timed-site' | 'use-global'

const OPTIONS: { key: OptionKey; label: string; hint: string }[] = [
  { key: 'ask', label: 'Preguntar siempre', hint: 'Predeterminado: se muestra el modal cuando las listas no coinciden.' },
  { key: 'always-mal', label: 'Usar siempre MAL', hint: 'Las diferencias se resuelven solas a favor de MAL.' },
  { key: 'always-site', label: 'Usar siempre AnimeAV1', hint: 'Las diferencias se resuelven solas a favor de AnimeAV1.' },
  { key: 'timed-mal', label: 'Usar MAL durante…', hint: 'Igual que "siempre MAL", pero solo durante unos días.' },
  { key: 'timed-site', label: 'Usar AnimeAV1 durante…', hint: 'Igual que "siempre AnimeAV1", pero solo durante unos días.' },
  { key: 'use-global', label: 'Usar la preferencia global', hint: 'Este anime deja de tener una preferencia propia.' }
]

function toOptionKey(policy: SyncPolicy): OptionKey {
  if (policy.mode === 'always') return policy.side === 'mal' ? 'always-mal' : 'always-site'
  if (policy.mode === 'timed') return policy.side === 'mal' ? 'timed-mal' : 'timed-site'
  return 'ask'
}

function buildPolicy(key: OptionKey, days: number): SyncPolicy {
  switch (key) {
    case 'always-mal':
      return { mode: 'always', side: 'mal' }
    case 'always-site':
      return { mode: 'always', side: 'site' }
    case 'timed-mal':
      return { mode: 'timed', side: 'mal', days, since: Date.now() }
    case 'timed-site':
      return { mode: 'timed', side: 'site', days, since: Date.now() }
    default:
      return { mode: 'ask' }
  }
}

function describe(policy: SyncPolicy, scope: string): string {
  const side = activeSide(policy)
  if (!side) return `${scope}: se te pregunta cuando hay diferencias.`
  const name = side === 'mal' ? 'MAL' : 'AnimeAV1'
  if (policy.mode === 'always') return `${scope}: las diferencias se resuelven a favor de ${name}.`
  const left = remainingDays(policy)
  return `${scope}: las diferencias se resuelven a favor de ${name}; ${left === 1 ? 'queda 1 día' : `quedan ${left} días`}.`
}

interface Props {
  onBack: () => void
  // Anime al que se podría aplicar una preferencia propia; sin él solo existe la global.
  malId?: number | null
}

export default function SyncPolicyForm({ onBack, malId = null }: Props) {
  const [saved, setSaved] = useState<SyncPolicy | null>(null)
  // Preferencia propia de este anime (null si usa la global) y si ya terminó de cargar.
  const [own, setOwn] = useState<SyncPolicy | null>(null)
  const [selected, setSelected] = useState<OptionKey | null>(null)
  const [onlyThis, setOnlyThis] = useState(false)
  const [days, setDays] = useState('7')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([getSyncPolicy(), malId != null ? getAnimePolicy(malId) : Promise.resolve(null)])
      .then(([global, animePolicy]) => {
        if (cancelled) return
        const shown = animePolicy ?? global
        setSaved(global)
        setOwn(animePolicy)
        setSelected(toOptionKey(shown))
        if (shown.mode === 'timed') setDays(String(shown.days))
      })
      .catch(e => {
        logger.warn('no se pudo leer la preferencia de sincronización', e)
        if (cancelled) return
        setSaved({ mode: 'ask' })
        setSelected('ask')
      })
    return () => {
      cancelled = true
    }
  }, [malId])

  const loading = selected == null
  const timed = selected?.startsWith('timed') ?? false
  const parsedDays = Number(days)
  const daysInvalid = timed && (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > MAX_POLICY_DAYS)
  const options = OPTIONS.filter(o => o.key !== 'use-global' || own != null)

  async function save() {
    if (daysInvalid || !selected) return
    setSaving(true)
    try {
      if (selected === 'use-global') {
        if (malId != null) await clearAnimePolicy(malId)
      } else {
        const policy = buildPolicy(selected, clampDays(parsedDays))
        if (malId != null && (own != null || onlyThis)) await setAnimePolicy(malId, policy)
        else await setSyncPolicy(policy)
      }
      pushToast('Preferencia de sincronización guardada')
      onBack()
    } catch (e) {
      logger.error('no se pudo guardar la preferencia de sincronización', e)
      pushToast('No se pudo guardar la preferencia', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-between gap-2'>
        <Button label='Volver' icon={<ChevronLeft size={18} />} onClick={onBack} className='self-start text-sm' type='border' />
        <Button
          label='Guardar'
          icon={<Save size={18} />}
          iconPosition='right'
          onClick={save}
          disabled={loading || saving || daysInvalid}
          className='self-start text-sm'
          type='fill'
        />
      </div>

      <div>
        <h3 className='text-lead font-bold'>Cuando MAL y AnimeAV1 no coinciden</h3>
        <p className='text-subs text-sm'>
          {saved ? (own ? describe(own, 'Para este anime') : describe(saved, 'Preferencia global')) : 'Cargando…'}
        </p>
      </div>

      <div role='radiogroup' aria-label='Cómo resolver las diferencias' aria-busy={loading} className='flex flex-col gap-2'>
        {options.map(option => {
          const checked = selected === option.key
          return (
            <div key={option.key} className='flex flex-col gap-2'>
              <button
                type='button'
                role='radio'
                aria-checked={checked}
                disabled={loading}
                onClick={() => setSelected(option.key)}
                className={`flex flex-col rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  checked ? 'border-main bg-main/10' : 'border-line bg-mute'
                } ${loading ? '' : 'cursor-pointer hover:bg-edge'} ${FOCUS_STYLE}`}
              >
                <span className='text-lead text-sm font-bold'>{option.label}</span>
                <span className='text-subs text-xs'>{option.hint}</span>
              </button>

              {checked && option.key.startsWith('timed') && (
                <Input
                  type='number'
                  inputMode='numeric'
                  min={1}
                  max={MAX_POLICY_DAYS}
                  label='Cantidad de días'
                  value={days}
                  onChange={e => setDays(e.target.value)}
                  error={daysInvalid ? `Ingresa un número entero entre 1 y ${MAX_POLICY_DAYS}.` : undefined}
                  hint='Se cuenta desde que guardas la preferencia; al terminar vuelve a preguntar.'
                />
              )}
            </div>
          )
        })}
      </div>

      {malId != null && own == null && (
        <label className={`flex items-start gap-2 text-sm ${loading ? 'opacity-50' : 'cursor-pointer'}`}>
          <input
            type='checkbox'
            checked={onlyThis}
            disabled={loading}
            onChange={e => setOnlyThis(e.target.checked)}
            className={`mt-0.5 ${FOCUS_STYLE}`}
          />
          <span className='flex flex-col'>
            <span className='text-lead font-bold'>Solo para este anime</span>
            <span className='text-subs text-xs'>Guarda la elección solo aquí y deja la global como está.</span>
          </span>
        </label>
      )}
    </div>
  )
}
