import { SITE } from './site-contract'
import { pushToast } from './toast-store'
import type { MalStatus } from '@/utils/list-sync'

const STATUS_UI: Record<MalStatus, { label: string; icon: string }> = {
  watching: { label: 'Viendo', icon: 'ic-eye' },
  plan_to_watch: { label: 'Por Ver', icon: 'ic-bookmark-add' },
  completed: { label: 'Completado', icon: 'ic-check-circle-broken' },
  on_hold: { label: 'Pausado', icon: 'ic-clock' },
  dropped: { label: 'Descartado', icon: 'ic-minus-circle' }
}

const PENDING_TOAST_KEY = 'mal-connector:pending-toast'

// El estado de Svelte (botón de visto, selector de episodios, estado) solo se refresca recargando.
// El aviso se guarda y se muestra tras la recarga.
export function reloadNow(message?: string) {
  try {
    if (message) sessionStorage.setItem(PENDING_TOAST_KEY, message)
  } catch {
    // sin sessionStorage solo se pierde el aviso
  }
  setTimeout(() => location.reload(), 150)
}

export function showPendingToast() {
  try {
    const message = sessionStorage.getItem(PENDING_TOAST_KEY)
    if (!message) return
    sessionStorage.removeItem(PENDING_TOAST_KEY)
    pushToast(message)
  } catch {
    // ignorar
  }
}

// Los cambios hechos por fetch no llegan al estado de Svelte hasta recargar, así que se refleja a mano en el DOM.
export function updateSiteStatusButton(status: MalStatus) {
  const button = document.querySelector(SITE.selectors.statusButton)
  if (!button) return
  const ui = STATUS_UI[status]

  const icon = button.querySelector<HTMLElement>('span[class*="ic-"]')
  if (icon) {
    for (const cls of [...icon.classList]) if (cls.startsWith('ic-')) icon.classList.remove(cls)
    icon.classList.add(ui.icon)
  }

  const label = button.querySelector<HTMLElement>('span.text-sm')
  if (!label) return
  const textNode = [...label.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.nodeValue?.trim())
  if (textNode) textNode.nodeValue = ui.label
  else label.textContent = ui.label
}
