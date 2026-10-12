// useScoreSync.ts
import { useEffect } from 'react'
import useDebouncedEffect from '@/hooks/useDebouncedEffect'
import { sendMessage } from '@/entrypoints/background'
import { useAnimeStore } from '../useAnimeStore'

export function useScoreSync() {
  const { score, loading } = useAnimeStore()

  // Al terminar de cargar, el score actual pasa a ser el último confirmado.
  useEffect(() => {
    const { score, setLastConfirmedScore } = useAnimeStore.getState()
    setLastConfirmedScore(loading ? 0 : score)
  }, [loading])

  // Envía el score a MAL 1s después del último cambio.
  useDebouncedEffect(score, 1000, async newScore => {
    // getState() para leer valores frescos y no los capturados en el render.
    const { loading, id, slug, status, lastConfirmedScore, setScore, setLastConfirmedScore } = useAnimeStore.getState()

    if (loading || id == null) return
    if (lastConfirmedScore === 0) return
    if (newScore === lastConfirmedScore) return
    if (status == null || status === 'plan_to_watch') return

    const res = await sendMessage({ type: 'UPDATE_SCORE', id, score: newScore, slug })
    if (res?.ok) {
      setLastConfirmedScore(newScore)
      pushToast('Puntuación actualizada')
    } else {
      setScore(lastConfirmedScore)
      pushToast(`Error al actualizar la puntuación: ${res?.error || res}`, 'error')
    }
  })
}
