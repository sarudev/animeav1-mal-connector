import '../../styles/tailwind.css'

export default function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className='border-line bg-mute before:via-edge dark:border-soft relative flex flex-col rounded-lg border before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent dark:before:opacity-50'>
      <div className='border-line dark:border-soft flex gap-3 border-b p-4 last:border-b-0 relative'>{children}</div>
    </div>
  )
}
