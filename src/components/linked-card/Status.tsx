import { Clock, Pause, Play, X, Check, BadgeQuestionMark } from 'lucide-react'

const STATUS_CONFIG: Record<NonNullable<MalListStatus['status']>, { icon: typeof Check; label: string; className: string }> = {
  completed: { icon: Check, label: 'Completado', className: 'text-wins' },
  dropped: { icon: X, label: 'Abandonado', className: 'text-fire' },
  on_hold: { icon: Pause, label: 'En espera', className: 'text-warn' },
  plan_to_watch: { icon: Clock, label: 'Planeado', className: 'text-warn' },
  watching: { icon: Play, label: 'Viendo', className: 'text-info' }
}

interface StatusProps {
  status: MalListStatus['status'] | null
  className?: string
}

export default function Status({ status, className }: StatusProps) {
  if (status == null) {
    return (
      <span className='text-subs text-xs flex gap-1'>
        <BadgeQuestionMark size={14} />
        No listado
      </span>
    )
  }

  const { icon: Icon, label, className: klassName } = STATUS_CONFIG[status]
  return (
    <span className={`${className} ${klassName} text-xs flex gap-1`}>
      <Icon size={14} />
      {label}
    </span>
  )
}
