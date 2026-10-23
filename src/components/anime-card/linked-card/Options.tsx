import { KeyRound, Link } from 'lucide-react'
import { useAnimeStore } from '../useAnimeStore'
import { useScoreSync } from './useScoreSync'
import Score from './Score'
import Button from '@/components/Button'
import Divider from '@/components/Divider'
import { useWidthBetween } from '@/hooks/useWidthBetween'

const WATCHING_STATUSES: MalListStatus['status'][] = ['watching', 'completed', 'dropped', 'on_hold']

interface OptionsProps {
  design: 'strip' | 'card'
}

export default function Options({ design }: OptionsProps) {
  const { score, setScore, status, showOptions, setShowOptions, setView, openAuth } = useAnimeStore()
  const isNarrow = useWidthBetween({ max: 768 })
  const isMid = useWidthBetween({ min: 555, max: 1024 })

  useScoreSync()
  const { pause: pauseOptionsTimer, start: startOptionsTimer } = useTimer(showOptions, () => setShowOptions(false), 2 * 60 * 1000)

  const showScore = status != null && WATCHING_STATUSES.includes(status)
  const isStrip = design === 'strip'
  const horizontal = isStrip && !isNarrow
  const buttonsInRow = isStrip || isMid

  return (
    <div className='flex flex-col gap-4'>
      <Divider direction='horizontal' />
      <div className={`flex gap-4 ${horizontal ? 'flex-row' : 'flex-col'}`} onMouseEnter={pauseOptionsTimer} onMouseLeave={startOptionsTimer}>
        {showScore && <Score score={score} setScore={setScore} horizontal={horizontal} />}
        {showScore && <Divider direction={horizontal ? 'vertical' : 'horizontal'} />}
        <div className={`flex gap-4 ${buttonsInRow ? 'flex-row' : 'flex-col'}`}>
          <Button
            className={`text-sm gap-1 px-2 relative ${horizontal ? 'shrink-0' : 'grow'}`}
            icon={<Link size={20} />}
            iconPosition='right'
            label='Cambiar vinculo'
            type='border'
            onClick={() => setView('link-form')}
          />
          <Button
            className={`text-sm gap-1 px-2 relative ${horizontal ? 'shrink-0' : 'grow'}`}
            icon={<KeyRound size={20} />}
            iconPosition='right'
            label='Credenciales de MAL'
            type='border'
            onClick={openAuth}
          />
        </div>
      </div>
    </div>
  )
}
