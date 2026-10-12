import { ExternalLink } from 'lucide-react'
import Tooltip from '../../tooltip/Tooltip'
import type { MalAnime } from '@/utils/mal'

interface Props {
  anime: MalAnime
  container: HTMLElement
  // Si no se pasa onSelect, se renderiza como preview (sin radio ni hover).
  selected?: boolean
  onSelect?: (anime: MalAnime) => void
  className?: string
}

export default function AnimeResultItem({ anime, container, selected = false, onSelect, className = '' }: Props) {
  const content = (
    <>
      <figure className='w-14 shrink-0 rounded-lg bg-black'>
        <img alt='' src={anime.main_picture?.medium || ''} className='aspect-square w-full rounded-lg object-cover' />
      </figure>

      <header className='grid flex-1 min-w-0 items-start gap-1 overflow-hidden'>
        <h3 className='line-clamp-2 text-sm font-bold text-lead'>{anime.title}</h3>
        <div className='flex justify-between'>
          <span className='text-xs font-bold text-subs'>
            {anime.num_episodes ? `${anime.num_episodes} eps` : 'Eps ?'} · ID {anime.id}
          </span>

          <Tooltip label='Ver en MAL' container={container}>
            <a
              href={`https://myanimelist.net/anime/${anime.id}`}
              target='_blank'
              rel='noopener noreferrer'
              onClick={e => e.stopPropagation()}
              className='relative shrink-0 rounded-full text-subs hover:bg-line hover:text-lead'
            >
              <ExternalLink size={16} />
              <span className='sr-only'>Ver {anime.title} en MAL</span>
            </a>
          </Tooltip>
        </div>
      </header>
    </>
  )

  const base = 'relative flex h-20 items-center gap-2 rounded-lg p-2 text-body'

  if (onSelect == null) {
    return <div className={`${base} bg-soft ${className}`}>{content}</div>
  }

  return (
    <label className={`${base} cursor-pointer hover:bg-soft hover:text-soft ${selected ? 'bg-soft' : ''} ${className}`}>
      <input type='radio' name='mal-search-result' className='sr-only' checked={selected} onChange={() => {}} onClick={() => onSelect(anime)} />
      {content}
    </label>
  )
}
