import Card from '../Card'
import LinkedCard from './linked-card/LinkedCard'
import LinkForm from './link-form/LinkForm'
import AuthForm from './auth-form/AuthForm'
import { useAnimeStore } from './useAnimeStore'
import '@/styles/tailwind.css'

export interface Props {
  container: HTMLElement
  isAnimeCard: boolean
}

export default function AnimeCard({ container, isAnimeCard }: Props) {
  const view = useAnimeStore(s => s.view)

  return (
    <div className={`relative rounded flex flex-col gap-2 ${isAnimeCard ? '' : 'mb-2'}`}>
      <Card className='flex flex-col gap-4'>
        {view === 'linked' && <LinkedCard />}
        {view === 'link-form' && <LinkForm container={container} />}
        {view === 'auth-form' && <AuthForm />}
      </Card>
    </div>
  )
}
