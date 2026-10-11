import { ChevronLeft, Unlink } from 'lucide-react'
import { useAnimeStore } from './useAnimeStore'
import { useState } from 'react'
import { sendMessage } from '@/entrypoints/background'

interface LinkFormActionsProps {
  onUnlinked: (title: string | null) => void
  setSearchResults: (results: any[]) => void
  setSelectedResult: (result: any | null) => void
  setManualId: (id: string) => void
  setNoResultsQuery: (query: string | null) => void
  setError: (error: string) => void
}

export function LinkFormActions({ setSearchResults, setSelectedResult, setManualId, setNoResultsQuery, setError, onUnlinked }: LinkFormActionsProps) {
  const { id, setView, reset, setSlug, setTitle, setLoading, slug, title, setLastConfirmedScore } = useAnimeStore()
  const [unlinkLoading, setUnlinkLoading] = useState(false)

  async function unlink() {
    if (id == null) return
    setError('')
    setUnlinkLoading(true)
    try {
      const res = await sendMessage({ type: 'UNLINK_ANIME', slug })
      if (!res?.ok) {
        setError(res?.error || 'No se pudo desvincular.')
        return
      }

      const currentTitle = title
      reset()
      setSlug(slug)
      setTitle(currentTitle)
      setLoading(false)
      setView('link-form')

      setLastConfirmedScore(0)
      setSearchResults([])
      setSelectedResult(null)
      setManualId('')
      setNoResultsQuery(null)

      pushToast('Anime desvinculado')
      onUnlinked(currentTitle)
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
