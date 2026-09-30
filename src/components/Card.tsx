import '../styles/tailwind.css'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export default function Card({ children, className = '' }: CardProps) {
  return (
    <div className='border-line bg-mute before:via-edge dark:border-soft relative flex flex-col rounded-lg border before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent dark:before:opacity-50'>
      <div className={`${className} border-line dark:border-soft p-4 relative`}>{children}</div>
    </div>
  )
}
