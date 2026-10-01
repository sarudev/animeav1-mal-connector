import { Settings } from 'lucide-react'
import Status from './Status'
import { useAnimeStore } from './useAnimeStore'

export default function Info() {
  const { score, status, id, title, setShowOptions } = useAnimeStore()
  const showStats = status !== null && status !== 'plan_to_watch'

  return (
    <div className='flex flex-col justify-between w-full'>
      <div className='flex flex-col gap-1'>
        <Status status={status} />
        <a href={`https://myanimelist.net/anime/${id}`} className='text-main hover:underline line-clamp-2' target='_blank' rel='noopener noreferrer'>
          {title}
        </a>
      </div>
      <Badge className='w-min self-end' show={score === 0 && showStats}>
        <Button
          className='text-sm gap-1 px-2 relative'
          icon={<Settings size={20} />}
          iconPosition='right'
          label='Opciones'
          type='border'
          onClick={() => setShowOptions(p => !p)}
        />
      </Badge>
    </div>
  )
}
