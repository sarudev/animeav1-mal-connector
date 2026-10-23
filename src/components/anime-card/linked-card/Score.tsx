import { useEffect, useState } from 'react'
import Slider from '../../Slider'
import { Star } from 'lucide-react'
import { COLORS } from '../useAnimeStore'
import { useWidthBetween } from '@/hooks/useWidthBetween'

interface ScoreProps {
  score: number
  setScore: (score: number) => void
  horizontal: boolean
}

export default function Score({ score, setScore, horizontal }: ScoreProps) {
  const [displayScore, setDisplayScore] = useState(score)
  const useColStyle = useWidthBetween({ max: 768 })

  useEffect(() => setDisplayScore(score), [score])

  return (
    <>
      <Badge show={score === 0} className={`${horizontal ? 'grow-2' : 'w-full'}`}>
        <div className='text-subs'>
          <div className='flex justify-between'>
            <span>Puntuacion</span>
            <span className='font-bold font-base'>
              <span style={{ color: COLORS[displayScore] }}>{displayScore == 0 ? '?' : displayScore}</span>
              <span className='text-sm'> / </span>
              <span className='font-normal text-xs'>10</span>
              <Star size={14} fill='currentColor' className='inline-block ml-1 text-warn' />
            </span>
          </div>
          <Slider value={score} min={1} max={10} onChange={setDisplayScore} onCommit={setScore} />
        </div>
      </Badge>
    </>
  )
}
