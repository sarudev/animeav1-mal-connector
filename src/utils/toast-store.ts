export interface ToastItem {
  id: number
  message: string
  variant?: 'success' | 'error' | 'info'
  duration: number
}

type Listener = (toasts: ToastItem[]) => void

let toasts: ToastItem[] = []
let listeners: Listener[] = []
let nextId = 0

function emit() {
  listeners.forEach(l => l(toasts))
}

export function pushToast(message: string, variant: ToastItem['variant'] = 'success', duration = 10000) {
  const id = nextId++
  toasts = [...toasts, { id, message, variant, duration }]
  emit()
  setTimeout(() => removeToast(id), duration)
  return id
}

export function removeToast(id: number) {
  toasts = toasts.filter(t => t.id !== id)
  emit()
}

export function subscribeToasts(listener: Listener) {
  listeners.push(listener)
  listener(toasts)
  return () => {
    listeners = listeners.filter(l => l !== listener)
  }
}
