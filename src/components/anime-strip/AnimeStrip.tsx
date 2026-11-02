import { Settings, Star } from 'lucide-react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge from '@/components/Badge'
import LazyImage from '@/components/LazyImage'
import Skeleton from '@/components/skeleton/Skeleton'
import { COLORS, useAnimeStore } from '../anime-card/useAnimeStore'
import Options from '../anime-card/linked-card/Options'
import LinkForm from '../anime-card/link-form/LinkForm'
import AuthForm from '../anime-card/auth-form/AuthForm'
import SyncPolicyView from '../anime-card/SyncPolicyView'
import '@/styles/tailwind.css'
import Status from '../anime-card/linked-card/Status'

interface Props {
  container: HTMLElement
}

export default function AnimeStrip({ container }: Props) {
  const view = useAnimeStore(s => s.view)
  const showOptions = useAnimeStore(s => s.showOptions)

  return (
    <Card className='flex flex-col gap-4'>
      {view === 'linked' && (
        <>
          <Summary />
          {showOptions && <Options design='strip' />}
        </>
      )}
      {view === 'link-form' && (
        <div className='mx-auto w-full max-w-md'>
          <LinkForm container={container} />
        </div>
      )}
      {view === 'auth-form' && (
        <div className='mx-auto w-full max-w-md'>
          <AuthForm />
        </div>
      )}
      {view === 'sync-policy' && (
        <div className='mx-auto w-full max-w-md'>
          <SyncPolicyView />
        </div>
      )}
    </Card>
  )
}

function Summary() {
  const { score, status, id, title, picture, watchedEpisodes, totalEpisodes, loading, setShowOptions } = useAnimeStore()

  const showStats = status !== null && status !== 'plan_to_watch'
  const complete = totalEpisodes > 0 && watchedEpisodes === totalEpisodes
  const percent = totalEpisodes > 0 ? Math.min(100, (watchedEpisodes / totalEpisodes) * 100) : 0
  const showProgress = showStats || loading

  return (
    <div className='flex items-center gap-3'>
      <div className='relative h-16 shrink-0 aspect-225/317'>
        <LazyImage className='absolute inset-0 rounded-lg w-full h-full' src={picture} alt='' />
      </div>

      <div className='flex min-w-0 flex-1 flex-col justify-center gap-2'>
        <div className='flex items-center gap-2'>
          <div className='relative min-w-0'>
            {loading && <Skeleton />}
            <span className='shrink-0 rounded bg-line px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-subs'>MAL ID {id}</span>
          </div>
          <Status status={status} />

          <span className='relative min-w-0 flex-1'>
            {loading && <Skeleton />}
            <a
              href={`https://myanimelist.net/anime/${id}`}
              className='block truncate text-main hover:underline'
              style={{ opacity: loading ? 0 : 1 }}
              target='_blank'
              rel='noopener noreferrer'
            >
              {title || 'Sin título'}
            </a>
          </span>

          <span className='shrink-0'>
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

        {showProgress && (
          <div className='flex items-center gap-3' style={{ opacity: loading ? 0 : 1 }}>
            <div className='h-1.5 flex-1 overflow-hidden rounded-full bg-line'>
              <div className={`h-full rounded-full ${complete ? 'bg-wins' : 'bg-main'}`} style={{ width: `${percent}%` }} />
            </div>

            <span className={`text-sm font-bold ${complete ? 'text-main' : 'text-subs'}`}>
              {watchedEpisodes}
              <span className='text-xs font-normal'>/{totalEpisodes === 0 ? '?' : totalEpisodes}</span>
            </span>

            <span className='flex items-center gap-1 text-sm font-bold'>
              <span style={{ color: COLORS[score] }}>{score === 0 ? '?' : score}</span>
              <Star size={12} fill='currentColor' className='text-warn' />
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
