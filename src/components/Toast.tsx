import { X } from 'lucide-react'

export interface ToastProps {
  message: string
  variant?: 'success' | 'error' | 'info'
  duration: number
  onClose?: () => void
}

const VARIANT_BG: Record<NonNullable<ToastProps['variant']>, string> = {
  success: 'bg-wins',
  error: 'bg-fire',
  info: 'bg-info'
}

export default function Toast({ message, variant = 'success', duration, onClose }: ToastProps) {
  return (
    <div
      role='status'
      className={`relative flex items-start gap-2 overflow-hidden max-w-90 rounded-lg ${VARIANT_BG[variant]} py-3.5 pr-2.5 pl-4.5 text-sm font-medium text-white shadow-[0_4px_18px_rgba(0,0,0,0.28)]`}
    >
      <span className='flex-1'>{message}</span>
      {onClose && (
        <button
          type='button'
          aria-label='Cerrar notificación'
          onClick={onClose}
          className='-mt-0.5 shrink-0 cursor-pointer rounded p-0.5 opacity-80 hover:bg-black/20 hover:opacity-100 focus-visible:[box-shadow:0_0_0_2px_white]'
        >
          <X size={16} />
        </button>
      )}
      <div className='absolute bottom-0 left-0 h-1 bg-info/70' style={{ animation: `mal-toast-progress ${duration}ms linear forwards` }} />
    </div>
  )
}
