import { sendMessage } from '@/entrypoints/background'
import { routeMalError, useAnimeStore } from '@/components/anime-card/useAnimeStore'
import { normalizeCompleted, siteToSnapshot, snapshotToMalUpdate } from '@/utils/list-sync'
import { logger } from '@/utils/logger'
import { opKey, startOperation } from '@/utils/operations'
import type { MalListUpdate } from '@/utils/mal'
import { SITE } from '@/utils/site-contract'
import { fetchSiteLibrary } from '@/utils/site-library'
import { updateSiteStatusButton } from '@/utils/site-ui'
import { pushToast } from '@/utils/toast-store'
import { page, currentMalSnapshot } from './state'

let listForm: HTMLFormElement | null = null

function setFormField(form: HTMLFormElement, name: string, value: string) {
  const el = form.elements.namedItem(name)
  if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) return
  if (el.value === value) return
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

// El sitio no se entera de los cambios hechos por fetch hasta recargar: al abrir el modal lo rellenamos con datos frescos.
async function refreshListForm(form: HTMLFormElement) {
  const slug = page.slug
  if (!slug) return

  let touched = false
  const markTouched = (e: Event) => {
    if (e.isTrusted) touched = true
  }
  form.addEventListener('input', markTouched)
  form.addEventListener('change', markTouched)

  try {
    const library = await fetchSiteLibrary(slug, { fresh: true })
    const entry = library?.entry
    if (!entry || touched || !form.isConnected || page.slug !== slug) return

    setFormField(form, 'status', String(entry.status))
    setFormField(form, 'episode', String(entry.episode ?? ''))
    setFormField(form, 'startDate', entry.startDate ?? '')
    setFormField(form, 'endDate', entry.endDate ?? '')
    setFormField(form, 'notes', entry.notes ?? '')
    if (entry.rating) {
      const radio = form.querySelector<HTMLInputElement>(SITE.selectors.ratingRadio(entry.rating))
      if (radio && !radio.checked) {
        radio.checked = true
        radio.dispatchEvent(new Event('input', { bubbles: true }))
        radio.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }

    const snapshot = siteToSnapshot(entry)
    if (snapshot) updateSiteStatusButton(snapshot.status)
  } catch (e) {
    logger.warn('no se pudo refrescar el formulario de lista', e)
  }
}

// Visible: el formulario aparece en el DOM. Cerrado: desaparece. Se llama desde el observer del documento.
export function syncListModal() {
  const form = document.querySelector<HTMLFormElement>(SITE.selectors.listForm)
  if (form === listForm) return
  listForm = form
  if (form) void refreshListForm(form)
}

// Una nota vacía en el form nunca borra la de MAL, una equivalente no pisa su precisión
// y una fecha completa que solo es la versión autocompletada de la parcial de MAL tampoco la pisa.
function buildMalUpdate(data: Record<string, FormDataEntryValue>): MalListUpdate | null {
  const snapshot = siteToSnapshot(data)
  return snapshot && snapshotToMalUpdate(normalizeCompleted(snapshot, useAnimeStore.getState().totalEpisodes), { current: currentMalSnapshot(), preserveScore: true })
}

// Sirve igual en /media/slug y /media/slug/episodio. Si falla, la próxima carga detecta la diferencia.
async function pushFormToMal(form: HTMLFormElement) {
  const slug = page.slug
  const { id, slug: storeSlug } = useAnimeStore.getState()
  if (!slug || id == null || storeSlug !== slug) return

  const formData = Object.fromEntries(new FormData(form))
  const update = buildMalUpdate(formData)
  logger.debug('submit → UPDATE_LIST', {
    formRating: formData.rating ?? null,
    storeMalScore: useAnimeStore.getState().score,
    update
  })
  if (!update) return

  const isLatest = startOperation(opKey.malList(slug))
  try {
    const res = await sendMessage({ type: 'UPDATE_LIST', id, update })
    if (routeMalError(res)) {
      pushToast('Reconecta tu cuenta de MAL para sincronizar', 'error')
      return
    }
    if (!res.ok) throw new Error(res.error)
    if (page.slug === slug && isLatest()) useAnimeStore.getState().setListStatus(res.data.status)
    pushToast('Lista de MAL actualizada')
  } catch (e) {
    logger.error('no se pudo enviar el formulario a MAL', e)
    pushToast('No se pudo actualizar tu lista en MAL. Se volverá a comparar al recargar', 'error')
  }
}

export function initSiteForm(ctx: { onInvalidated: (cb: () => void) => void }) {
  const handleSubmit = (event: SubmitEvent) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement) || !form.matches(SITE.selectors.listForm)) return
    void pushFormToMal(form)
  }

  document.addEventListener('submit', handleSubmit, true)
  ctx.onInvalidated(() => document.removeEventListener('submit', handleSubmit, true))
}
