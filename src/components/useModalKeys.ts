import { useEffect, useRef, type RefObject } from 'react'

// El modal vive en un Shadow DOM y la página sigue recibiendo el teclado: sin esto, las flechas hacen scroll
// y el foco queda fuera del diálogo. El listener va en captura sobre window para adelantarse a la página.
// `onKey` recibe el elemento enfocado dentro del diálogo y devuelve true si consumió la tecla.
export const FOCUS_STYLE = 'focus:[box-shadow:0_0_0_2px_var(--color-main)]'

export function useModalKeys(
  active: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  onKey?: (e: KeyboardEvent, focused: HTMLElement | null) => boolean | void
) {
  const handler = useRef(onKey)
  handler.current = onKey

  useEffect(() => {
    if (!active) return

    const listener = (e: KeyboardEvent) => {
      const dialog = dialogRef.current
      if (!dialog) return

      const root = dialog.getRootNode() as Document | ShadowRoot
      const current = root.activeElement
      const focused = current instanceof HTMLElement && dialog.contains(current) ? current : null
      const buttons = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled)')]
      // Escribiendo en un campo (p. ej. los días) las teclas son del campo, no atajos del diálogo.
      if (focused instanceof HTMLInputElement && e.key !== 'Tab') return

      const stop = () => {
        e.preventDefault()
        e.stopPropagation()
      }

      if (e.key === 'Tab') {
        const first = buttons[0]
        const last = buttons[buttons.length - 1]
        if (!focused) {
          stop()
          ;(e.shiftKey ? last : first)?.focus()
        } else if (e.shiftKey && focused === first) {
          stop()
          last?.focus()
        } else if (!e.shiftKey && focused === last) {
          stop()
          first?.focus()
        }
        return
      }

      const isArrow = e.key.startsWith('Arrow')
      if (!focused && (isArrow || e.key === 'Enter' || e.key === ' ')) {
        stop()
        buttons[0]?.focus()
        return
      }
      if (isArrow) stop()

      if (handler.current?.(e, focused)) stop()
    }

    window.addEventListener('keydown', listener, true)
    return () => window.removeEventListener('keydown', listener, true)
  }, [active, dialogRef])
}
