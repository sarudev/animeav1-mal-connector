import { SITE } from '@/utils/site-contract'
import { pushToast } from '@/utils/toast-store'
import { page } from './state'
import { reconcileSiteToMal } from './site-sync'

function handleMenuItemClick(event: MouseEvent) {
  if (!(event.target instanceof Element)) return
  const item = event.target.closest(SITE.selectors.dropdownItem)
  const action = SITE.dropdownActions[item?.textContent?.trim().toLowerCase() ?? '']
  if (action === undefined) return
  if (action === 'delete') {
    pushToast('Eliminar de lista no se replica en MAL; solo se elimina de AnimeAV1', 'error')
    return
  }
  if (page.slug) void reconcileSiteToMal(page.slug, action)
}

// Dropdown de estado del sitio. "Eliminar de lista" nunca se replica en MAL (para eso está el botón de opciones).
export function initSiteDropdown(ctx: { onInvalidated: (cb: () => void) => void }) {
  document.addEventListener('click', handleMenuItemClick, true)
  ctx.onInvalidated(() => document.removeEventListener('click', handleMenuItemClick, true))
}
