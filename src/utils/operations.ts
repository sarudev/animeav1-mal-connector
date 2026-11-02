const counters = new Map<string, number>()

// Marca el inicio de una operación asíncrona identificada por `key` y devuelve una función que dice
// si sigue siendo la más reciente. Si empezó otra con la misma clave mientras esperabas un await,
// devuelve false y el resultado de esta operación debe descartarse.
export function startOperation(key: string): () => boolean {
  const id = (counters.get(key) ?? 0) + 1
  counters.set(key, id)
  return () => counters.get(key) === id
}

export const opKey = {
  // Escrituras a la lista de MAL cuya respuesta actualiza el estado de la extensión.
  malList: (slug: string) => `mal-list:${slug}`,
  compare: (slug: string) => `compare:${slug}`,
  dropdown: (slug: string) => `dropdown:${slug}`,
  siteScore: (slug: string) => `site-score:${slug}`
}
