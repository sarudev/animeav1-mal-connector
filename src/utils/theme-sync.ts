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

export function watchTheme(targetHost: HTMLElement): () => void {
  syncThemeVars(targetHost)

  const observer = new MutationObserver(() => syncThemeVars(targetHost))
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
    subtree: true
  })

  return () => observer.disconnect()
}
