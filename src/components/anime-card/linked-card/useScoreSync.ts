import { useEffect } from 'react'
import useDebouncedEffect from '@/hooks/useDebouncedEffect'
import { sendMessage } from '@/entrypoints/background'
import { syncSiteScore } from '@/utils/site-score'
import { logger } from '@/utils/logger'
import { useAnimeStore } from '../useAnimeStore'

export function useScoreSync() {
  const { score, loading } = useAnimeStore()

  useEffect(() => {
    const { score, setLastConfirmedScore } = useAnimeStore.getState()
    setLastConfirmedScore(loading ? 0 : score)
  }, [loading])

  useDebouncedEffect(score, 1000, async newScore => {
    const { loading, id, slug, status, lastConfirmedScore, setScore, setLastConfirmedScore } = useAnimeStore.getState()

    if (loading || id == null) return
    if (lastConfirmedScore === 0) return
    if (newScore === lastConfirmedScore) return
    if (status == null || status === 'plan_to_watch') return

    const res = await sendMessage({ type: 'UPDATE_SCORE', id, score: newScore, slug })
    if (res?.ok) {
      setLastConfirmedScore(newScore)
      pushToast('Puntuación actualizada')
      syncSiteScore(slug, newScore).catch(e => {
        logger.error('no se pudo reflejar la puntuación en AnimeAV1', e)
        pushToast('No se pudo reflejar la puntuación en AnimeAV1', 'error')
      })
    } else {
      setScore(lastConfirmedScore)
      pushToast(`Error al actualizar la puntuación: ${res?.error || res}`, 'error')
    }
  })
}
