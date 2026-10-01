import { Star } from 'lucide-react'
import { COLORS, useAnimeStore } from './useAnimeStore'
import LazyImage from '../LazyImage'

export default function Picture() {
  const { score, watchedEpisodes, totalEpisodes, picture, status, id, loading } = useAnimeStore()
  const showStats = status !== null && status !== 'plan_to_watch'

  return (
    <div className='h-32 aspect-225/317 relative'>
      <LazyImage className='absolute inset-0 rounded-lg w-full h-full' src={picture!} alt='' />
      {!loading && (
        <>
          <div className='absolute rounded-lg inset-x-0 top-0 h-30 bg-linear-to-b from-black/70 from-0% to-40% to-transparent' />
          <div className='absolute rounded-lg inset-x-0 bottom-0 h-30 bg-linear-to-t from-black/70 from-0% to-70% to-transparent' />
          <div className='absolute rounded-lg w-full h-full top-0 flex flex-col p-1 px-1.5 justify-between font-bold text-subs '>
            <span className='w-max text-xs'>ID {id}</span>
            <div className='flex justify-between items-end'>
              {watchedEpisodes != null && showStats && (
                <div className={watchedEpisodes === totalEpisodes ? 'text-main' : ''}>
                  <span>{watchedEpisodes}</span>
                  <span className='font-normal text-sm'>/</span>
                  <span className='font-normal text-xs'>{totalEpisodes ?? '?'}</span>
                </div>
              )}
              {showStats && (
                <div
                  className='text-subs flex gap-1 items-c
                enter text-base'
                >
                  <span style={score !== null ? { color: COLORS[score] } : undefined}>{score ?? '?'}</span>
                  <Star size={12} fill='currentColor' className='text-warn' />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
