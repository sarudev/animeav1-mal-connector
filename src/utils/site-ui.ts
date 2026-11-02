import type { MalStatus } from '@/utils/list-sync'

const STATUS_UI: Record<MalStatus, { label: string; icon: string }> = {
  watching: { label: 'Viendo', icon: 'ic-eye' },
  plan_to_watch: { label: 'Por Ver', icon: 'ic-bookmark-add' },
  completed: { label: 'Completado', icon: 'ic-check-circle-broken' },
  on_hold: { label: 'Pausado', icon: 'ic-clock' },
  dropped: { label: 'Descartado', icon: 'ic-minus-circle' }
}

// Botón que muestra el estado y abre el modal; su hermano (con aria-haspopup) es el dropdown.
const STATUS_BUTTON_SELECTOR = 'button[aria-label="Lista"]:not([aria-haspopup])'

// Los cambios hechos por fetch no llegan al estado de Svelte hasta recargar, así que se refleja a mano en el DOM.
export function updateSiteStatusButton(status: MalStatus) {
  const button = document.querySelector(STATUS_BUTTON_SELECTOR)
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
