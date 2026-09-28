/**
 * Elemento del sitio del que se leen los valores actuales del theme.
 * Ajustá el selector si .dark/.light vive en otro nodo (ej: un
 * wrapper interno como #app en vez de <html>).
 */
function getThemeSource(): Element {
  return document.querySelector('.dark, .light') ?? document.documentElement
}

function getThemeVars(styles: CSSStyleDeclaration): string[] {
  return Array.from(styles).filter(prop => prop.startsWith('--') && !prop.startsWith('--tw'))
}

function syncThemeVars(targetHost: HTMLElement) {
  const styles = getComputedStyle(getThemeSource())
  for (const v of getThemeVars(styles)) {
    const value = styles.getPropertyValue(v)
    if (value) targetHost.style.setProperty(v, value)
  }
}

/**
 * Sincroniza las variables una vez, y las vuelve a sincronizar cada vez
 * que el sitio togglee entre .dark/.light (vía MutationObserver sobre
 * cambios de clase). Devuelve una función de cleanup para desconectar
 * el observer cuando se desmonte la UI.
 */
export function watchTheme(targetHost: HTMLElement): () => void {
  syncThemeVars(targetHost)

  const observer = new MutationObserver(() => syncThemeVars(targetHost))
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
    // subtree: true solo si .dark/.light puede estar en un wrapper
    // interno en vez de en <html>. Si siempre está en <html>, podés
    // sacar esta línea para que el observer sea más liviano.
    subtree: true
  })

  return () => observer.disconnect()
}
