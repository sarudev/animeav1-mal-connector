import { Clock, Pause, Play, X, Check, BadgeQuestionMark } from 'lucide-react'
import { useAnimeStore } from './useAnimeStore'
import Skeleton from '../skeleton/Skeleton'

const STATUS_CONFIG: Record<NonNullable<MalListStatus['status'] | 'null'>, { icon: typeof Check; label: string; className: string }> = {
  completed: { icon: Check, label: 'Completado', className: 'text-wins' },
  dropped: { icon: X, label: 'Abandonado', className: 'text-fire' },
  on_hold: { icon: Pause, label: 'En espera', className: 'text-warn' },
  plan_to_watch: { icon: Clock, label: 'Planeado', className: 'text-warn' },
  watching: { icon: Play, label: 'Viendo', className: 'text-info' },
  null: { icon: BadgeQuestionMark, label: 'No listado', className: 'text-subs' }
}

interface StatusProps {
  status: MalListStatus['status'] | null
  className?: string
}

export default function Status({ status, className }: StatusProps) {
  const { loading } = useAnimeStore()

  const { icon: Icon, label, className: klassName } = STATUS_CONFIG[status ?? 'null']
  return (
    <span className='w-max'>
      {loading && <Skeleton />}
      <span className={`${className} ${klassName} text-xs flex gap-1`} style={{ opacity: loading ? 0 : 1 }}>
        <Icon size={14} />
        {label}
      </span>
    </span>
  )
}
