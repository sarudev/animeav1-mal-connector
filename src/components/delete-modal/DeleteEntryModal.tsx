import { useEffect, useId, useRef, useState } from 'react'
import { sendMessage } from '@/entrypoints/background'
import { logger } from '@/utils/logger'
import { deleteSiteEntry, fetchSiteLibrary } from '@/utils/site-library'
import { reloadNow } from '@/utils/site-ui'
import { pushToast } from '@/utils/toast-store'
import { routeMalError, useAnimeStore } from '@/components/anime-card/useAnimeStore'
import Button from '@/components/Button'
import { useModalKeys } from '@/components/useModalKeys'
import { useDeleteStore, type DeleteTarget } from './useDeleteStore'

export default function DeleteEntryModal() {
  const target = useDeleteStore(s => s.target)
  const close = useDeleteStore(s => s.close)
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()

  // El foco inicial va en "Cancelar" (la opción segura) y se devuelve al cerrar.
  useEffect(() => {
    if (!target) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    cancelRef.current?.querySelector<HTMLElement>('button')?.focus()
    return () => previous?.focus()
  }, [target])

  useModalKeys(target != null, dialogRef, e => {
    if (e.key === 'Escape' && !busy) {
      close()
      return true
    }
  })

  async function remove(t: DeleteTarget) {
    setBusy(true)
    try {
      const res = await sendMessage({ type: 'DELETE_LIST', id: t.malId })
      if (routeMalError(res)) return
      if (!res.ok) throw new Error(res.error)

      const library = await fetchSiteLibrary(t.slug, { fresh: true })
      if (library?.entry) await deleteSiteEntry(library.mediaId)

      if (useAnimeStore.getState().slug === t.slug) useAnimeStore.getState().setListCleared()
      close()
      reloadNow('Anime eliminado de MAL y AnimeAV1')
    } catch (e) {
      logger.error('no se pudo eliminar el anime de las listas', e)
      pushToast('No se pudo eliminar el anime. Revisa ambas listas', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!target) return null

  return (
    <div className='fixed inset-0 z-2147483647 flex items-center justify-center bg-black/60 p-4'>
      <div
        ref={dialogRef}
        role='alertdialog'
        aria-modal='true'
        aria-labelledby={titleId}
        aria-describedby={descId}
        className='bg-mute border-line flex w-full max-w-md flex-col gap-4 rounded-lg border p-5 shadow-xl'
      >
        <div className='flex flex-col gap-2'>
          <h2 id={titleId} className='text-lead text-lg font-bold'>
            ¿Eliminar de tus listas?
          </h2>
          <p id={descId} className='text-subs text-sm'>
            <span className='text-lead font-bold'>{target.title}</span> se eliminará de tu lista de MAL y de AnimeAV1. Esta acción no se puede
            deshacer.
          </p>
        </div>
        <div className='flex justify-end gap-3'>
          <div ref={cancelRef}>
            <Button type='border' label='Cancelar' disabled={busy} onClick={close} />
          </div>
          <Button type='risk' label={busy ? 'Eliminando…' : 'Eliminar'} disabled={busy} onClick={() => void remove(target)} />
        </div>
      </div>
    </div>
  )
}
