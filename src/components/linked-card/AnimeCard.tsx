import Card from '../Card'
import LinkedCard from './LinkedCard'
import LinkForm from './LinkForm'
import { useAnimeStore } from './useAnimeStore'
import '@/styles/tailwind.css'

export interface Props {
  container: HTMLElement
}

export default function AnimeCard({ container }: Props) {
  const view = useAnimeStore(s => s.view)

  return (
    <div className='relative rounded mb-2 flex flex-col gap-2'>
      <Card className='flex flex-col gap-4'>
        {view === 'linked' && <LinkedCard />}
        {view === 'link-form' && <LinkForm container={container} />}
      </Card>
    </div>
  )
}
