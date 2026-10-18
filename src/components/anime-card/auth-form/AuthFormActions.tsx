import { ChevronLeft, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { sendMessage } from '@/entrypoints/background'
import Button from '@/components/Button'
import { useAnimeStore } from '../useAnimeStore'

interface AuthFormActionsProps {
  onCleared: () => void
}

export function AuthFormActions({ onCleared }: AuthFormActionsProps) {
  const setView = useAnimeStore(s => s.setView)
  const [clearing, setClearing] = useState(false)

  async function clear() {
    setClearing(true)
    try {
      const res = await sendMessage({ type: 'CLEAR_MAL_AUTH' })
      if (!res?.ok) {
        pushToast(res?.error || 'No se pudieron borrar las credenciales', 'error')
        return
      }

      useAnimeStore.getState().setCredentialsCleared()
      pushToast('Credenciales borradas')
      onCleared()
    } catch {
      pushToast('No se pudieron borrar las credenciales', 'error')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className='w-full relative'>
      <Button label='Volver' icon={<ChevronLeft size={18} />} onClick={() => setView('linked')} className='self-start text-sm' type='border' />
      <Button
        label='Borrar'
        icon={<Trash2 size={18} />}
        iconPosition='right'
        onClick={clear}
        disabled={clearing}
        className='self-start text-sm absolute right-0 top-0'
        type='risk'
      />
    </div>
  )
}
