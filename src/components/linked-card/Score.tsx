import { useEffect, useState } from 'react'
import Slider from '../Slider'
import { Star } from 'lucide-react'
import { COLORS } from './useAnimeStore'

interface ScoreProps {
  score: number | null
  setScore: (score: number) => void
}

export default function Score({ score, setScore }: ScoreProps) {
  const [displayScore, setDisplayScore] = useState(score)

  useEffect(() => setDisplayScore(score), [score])

  return (
    <>
      <hr className='text-line -mx-4' />
      <div className='text-subs'>
        <div className='flex justify-between'>
          <span>Puntuacion</span>
          <span className='font-bold font-base'>
            <span style={displayScore !== null ? { color: COLORS[displayScore] } : undefined}>{displayScore ?? '?'}</span>
            <span className='text-sm'> / </span>
            <span className='font-normal text-xs'>10</span>
            <Star size={14} fill='currentColor' className='inline-block ml-1 text-warn' />
          </span>
        </div>
        <Slider value={score ?? 1} min={1} max={10} onChange={setDisplayScore} onCommit={setScore} />
      </div>
    </>
  )
}
