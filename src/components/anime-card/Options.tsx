import { useAnimeStore } from './useAnimeStore'
import { Link } from 'lucide-react'
import Score from './Score'
import { sendMessage } from '@/entrypoints/background'

export default function Options() {
  const { score, setScore, status, showOptions, setShowOptions, setView, id, slug, loading, lastConfirmedScore, setLastConfirmedScore } =
    useAnimeStore()
  const { pause: pauseOptionsTimer, start: startOptionsTimer } = useTimer(showOptions, () => setShowOptions(false), 2 * 60 * 1000)

  useEffect(() => {
    setLastConfirmedScore(loading ? 0 : score)
  }, [loading])

  useDebouncedEffect(score, 1000, async score => {
    if (loading || id == null) return
    if (lastConfirmedScore == 0) return
    if (score === lastConfirmedScore) return
    if (status == null || status === 'plan_to_watch') return

    const res = await sendMessage({ type: 'UPDATE_SCORE', id, score, slug })
    if (res?.ok) {
      setLastConfirmedScore(score)
      pushToast('Puntuación actualizada')
    } else {
      setScore(lastConfirmedScore!)
      pushToast(`Error al actualizar la puntuación: ${res?.error || res}`, 'error')
    }
  })

  return (
    <div className='contents' onMouseEnter={pauseOptionsTimer} onMouseLeave={startOptionsTimer}>
      {status === 'watching' && <Score score={score} setScore={setScore} />}
      <hr className='text-line -mx-4' />
      <Button
        className='text-sm gap-1 px-2 relative'
        icon={<Link size={20} />}
        iconPosition='right'
        label='Cambiar vinculo'
        type='border'
        onClick={() => setView('link-form')}
      />
    </div>
  )
}
