// LinkFormActions.tsx
import { ChevronLeft, Unlink } from 'lucide-react'
import { useState } from 'react'
import { sendMessage } from '@/entrypoints/background'
import Button from '@/components/Button'
import { useAnimeStore } from '../useAnimeStore'
import { useLinkFormStore } from './useLinkFormStore'

interface LinkFormActionsProps {
  onUnlinked: (title: string | null) => void
}

export function LinkFormActions({ onUnlinked }: LinkFormActionsProps) {
  const id = useAnimeStore(s => s.id)
  const setView = useAnimeStore(s => s.setView)
  const setError = useLinkFormStore(s => s.setError)
  const clearResults = useLinkFormStore(s => s.clearResults)
  const [unlinkLoading, setUnlinkLoading] = useState(false)

  async function unlink() {
    if (id == null) return
    setError('')
    setUnlinkLoading(true)
    try {
      const { slug, title } = useAnimeStore.getState()

      const res = await sendMessage({ type: 'UNLINK_ANIME', slug })
      if (!res?.ok) {
        setError(res?.error || 'No se pudo desvincular.')
        return
      }

      useAnimeStore.getState().setUnlinked()
      clearResults()

      pushToast('Anime desvinculado')
      onUnlinked(title)
    } finally {
      setUnlinkLoading(false)
    }
  }

  if (id == null) return null

  return (
    <div className='w-full relative'>
      <Button label='Volver' icon={<ChevronLeft size={18} />} onClick={() => setView('linked')} className='self-start text-sm' type='border' />
      <Button
        label='Desvincular'
        icon={<Unlink size={18} />}
        iconPosition='right'
        onClick={unlink}
        disabled={unlinkLoading}
        className='self-start text-sm absolute right-0 top-0'
        type='risk'
      />
    </div>
  )
}
