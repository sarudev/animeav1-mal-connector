import './skeleton.scss'
import '@/styles/tailwind.css'

interface Props {
  className?: string
}

export default function Skeleton({ className = '' }: Props) {
  return (
    <div className={`relative w-full h-full overflow-hidden rounded ${className}`} aria-hidden='true'>
      <div className='absolute inset-0 bg-current opacity-10' />

      <div
        className='absolute inset-0 opacity-10'
        style={{
          backgroundImage: 'linear-gradient(90deg, transparent, #FFFFFF3F, transparent)',
          animation: 'skeleton-shimmer 1.4s ease-in-out infinite'
        }}
      />
    </div>
  )
}
