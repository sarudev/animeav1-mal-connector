// Options.tsx
import { KeyRound, Link } from 'lucide-react'
import { useAnimeStore } from '../useAnimeStore'
import { useScoreSync } from './useScoreSync'
import Score from './Score'
import Button from '@/components/Button'

const WATCHING_STATUSES: MalListStatus['status'][] = ['watching', 'completed', 'dropped', 'on_hold']

export default function Options() {
  const { score, setScore, status, showOptions, setShowOptions, setView, openAuth } = useAnimeStore()

  useScoreSync()
  const { pause: pauseOptionsTimer, start: startOptionsTimer } = useTimer(showOptions, () => setShowOptions(false), 2 * 60 * 1000)

  return (
    <div className='contents' onMouseEnter={pauseOptionsTimer} onMouseLeave={startOptionsTimer}>
      {status != null && WATCHING_STATUSES.includes(status) && <Score score={score} setScore={setScore} />}
      <hr className='text-line -mx-4' />
      <Button
        className='text-sm gap-1 px-2 relative'
        icon={<Link size={20} />}
        iconPosition='right'
        label='Cambiar vinculo'
        type='border'
        onClick={() => setView('link-form')}
      />
      <Button
        className='text-sm gap-1 px-2 relative'
        icon={<KeyRound size={20} />}
        iconPosition='right'
        label='Credenciales de MAL'
        type='border'
        onClick={openAuth}
      />
    </div>
  )
}
