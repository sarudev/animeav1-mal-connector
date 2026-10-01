import { useAnimeStore } from './useAnimeStore'
import { Link } from 'lucide-react'
import Score from './Score'

export default function Options() {
  const { score, setScore, status, showOptions, setShowOptions, setView } = useAnimeStore()
  const { pause: pauseOptionsTimer, start: startOptionsTimer } = useTimer(showOptions, () => setShowOptions(false), 2 * 60 * 1000)

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
