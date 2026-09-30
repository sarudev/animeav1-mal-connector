import { useEffect, useState } from 'react'
import { subscribeToasts, type ToastItem } from '@/utils/toast-store'
import Toast from './Toast'

export default function ToastHolder() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  useEffect(() => subscribeToasts(setToasts), [])

  return (
    <div className='fixed top-4 right-4 z-2147483647 flex flex-col gap-2'>
      <style>{`
        @keyframes mal-toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      {toasts.map(t => (
        <Toast key={t.id} message={t.message} variant={t.variant} duration={t.duration} />
      ))}
    </div>
  )
}
