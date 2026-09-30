export interface ToastProps {
  message: string
  variant?: 'success' | 'error' | 'info'
  duration: number
}

const VARIANT_BG: Record<NonNullable<ToastProps['variant']>, string> = {
  success: 'bg-wins',
  error: 'bg-fire',
  info: 'bg-info'
}

export default function Toast({ message, variant = 'success', duration }: ToastProps) {
  return (
    <div
      role='status'
      className={`relative overflow-hidden max-w-90 rounded-lg ${VARIANT_BG[variant]} px-4.5 py-3.5 text-sm font-medium text-white shadow-[0_4px_18px_rgba(0,0,0,0.28)]`}
    >
      {message}
      <div className='absolute bottom-0 left-0 h-1 bg-info/70' style={{ animation: `mal-toast-progress ${duration}ms linear forwards` }} />
    </div>
  )
}
