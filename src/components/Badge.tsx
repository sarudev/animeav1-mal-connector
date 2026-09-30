import type { ReactNode } from 'react'
import '../styles/tailwind.css'

interface BadgeProps {
  children: ReactNode
  show?: boolean
  className?: string
}

export function Badge({ children, show = true, className = '' }: BadgeProps) {
  return (
    <div className={`relative w-min ${className}`}>
      {children}
      {show && (
        <span className='absolute -top-1 -right-1 flex h-3 w-3'>
          <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-fire opacity-75' />
          <span className='relative inline-flex h-3 w-3 rounded-full bg-fire' />
        </span>
      )}
    </div>
  )
}

export default Badge
