import { Settings } from 'lucide-react'
import Status from './Status'
import { useAnimeStore } from './useAnimeStore'
import Skeleton from '../skeleton/Skeleton'

export default function Info() {
  const { score, status, id, title, loading, setShowOptions } = useAnimeStore()
  const showStats = status !== null && status !== 'plan_to_watch'

  return (
    <div className='flex flex-col justify-between w-full'>
      <div className='flex flex-col gap-1'>
        <Status status={status} />
        <span className='w-full'>
          {loading && <Skeleton />}
          <a
            href={`https://myanimelist.net/anime/${id}`}
            className='text-main hover:underline line-clamp-2'
            style={{ opacity: loading ? 0 : 1 }}
            target='_blank'
            rel='noopener noreferrer'
          >
            {title || 'Sin título'}
          </a>
        </span>
      </div>
      <span className='w-min self-end'>
        {loading && <Skeleton />}
        <span style={{ opacity: loading ? 0 : 1 }}>
          <Badge show={score === 0 && showStats}>
            <Button
              className='text-sm gap-1 px-2 relative'
              icon={<Settings size={20} />}
              iconPosition='right'
              label='Opciones'
              type='border'
              onClick={() => setShowOptions(p => !p)}
            />
          </Badge>
        </span>
      </span>
    </div>
  )
}
