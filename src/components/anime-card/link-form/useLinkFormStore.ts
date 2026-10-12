import { create } from 'zustand'
import { sendMessage } from '@/entrypoints/background'
import type { MalAnime } from '@/utils/mal'
import { useAnimeStore } from '../useAnimeStore'

let searchRequestId = 0
let manualRequestId = 0
let lastSearched: string | null = null
let autoSelectNext = false
let autoSearchedFor: string | null = null

function parseId(value: string): number | null {
  const n = Number(value.trim())
  return Number.isInteger(n) && n > 0 ? n : null
}

interface LinkedSnapshot {
  id: number
  title: string
  picture?: string | null
  totalEpisodes?: number | null
}

interface LinkFormStateVars {
  searchInput: string
  searchResults: MalAnime[]
  selectedResult: MalAnime | null
  manualId: string
  noResultsQuery: string | null
  error: string
  manualError: string
  searchLoading: boolean
  manualLoading: boolean
  confirmLoading: boolean
}

interface LinkFormState extends LinkFormStateVars {
  // Entradas del usuario
  setSearchInput: (value: string) => void
  setError: (error: string) => void
  select: (anime: MalAnime) => void
  changeManualId: (value: string) => void

  // Inicialización / sincronización
  autoSearchFromTitle: (slug: string, title: string) => void
  showLinked: (anime: LinkedSnapshot) => void
  restoreTitle: (title: string) => void
  startFromName: (name: string | null) => void

  // Operaciones async
  runSearch: (query: string, autoSelect?: boolean) => Promise<void>
  runDebouncedSearch: () => Promise<void>
  fetchManual: () => Promise<void>
  confirm: () => Promise<void>

  // Limpieza
  clearResults: () => void
  reset: () => void
}

const initial: LinkFormStateVars = {
  searchInput: '',
  searchResults: [],
  selectedResult: null,
  manualId: '',
  noResultsQuery: null,
  error: '',
  manualError: '',
  searchLoading: false,
  manualLoading: false,
  confirmLoading: false
}

export const useLinkFormStore = create<LinkFormState>((set, get) => {
  function applyResults(results: MalAnime[], name: string) {
    if (results.length === 0) {
      set({ searchResults: results, noResultsQuery: name })
      return
    }
    const exact = results.find(r => r.title.toLowerCase() === name.toLowerCase())
    const best = exact ?? results[0]!
    set({ searchResults: results, noResultsQuery: null, selectedResult: best, manualId: `${best.id}` })
  }

  async function loadAnimeDetails(animeId: number): Promise<boolean> {
    const res = await sendMessage({ type: 'GET_DETAILS', id: animeId })
    if (!res?.ok || !res.data.details) return false
    useAnimeStore.getState().setDetails(res.data.details)
    return true
  }

  return {
    ...initial,
    setSearchInput: searchInput => set({ searchInput }),
    setError: error => set({ error }),
    select: anime => set({ selectedResult: anime, manualId: `${anime.id}` }),
    changeManualId: manualId => {
      manualRequestId++
      set({
        manualId,
        manualError: '',
        selectedResult: null,
        manualLoading: parseId(manualId) != null
      })
    },
    autoSearchFromTitle: (slug, title) => {
      if (autoSearchedFor === slug) return
      autoSearchedFor = slug
      autoSelectNext = true
      set({ searchInput: title })
    },
    showLinked: ({ id, title, picture, totalEpisodes }) => {
      set({
        selectedResult: {
          id,
          title,
          main_picture: picture ? { medium: picture } : undefined,
          num_episodes: totalEpisodes
        } as MalAnime,
        manualId: `${id}`,
        searchInput: title
      })
    },
    restoreTitle: title => {
      if (!title) return
      autoSelectNext = true
      set({ searchInput: title })
    },
    startFromName: name => {
      const query = (name ?? '').trim()
      set({ searchInput: query })
      if (query) void get().runSearch(query, true)
    },
    runSearch: async (rawQuery, autoSelect = false) => {
      const query = rawQuery.trim()

      if (query.length < 3) {
        set({
          noResultsQuery: null,
          error: query.length === 0 ? 'Ingresa un término de búsqueda.' : 'El término de búsqueda debe tener al menos 3 caracteres.'
        })
        return
      }

      lastSearched = query
      set({ error: '', noResultsQuery: null, searchLoading: true })
      const requestId = ++searchRequestId

      try {
        const res = await sendMessage({ type: 'SEARCH_ANIME', query })
        if (requestId !== searchRequestId) return

        if (!res?.ok) {
          lastSearched = null
          set({ error: res?.error || 'Error al buscar en MAL' })
          return
        }

        const { results } = res.data
        if (autoSelect) {
          applyResults(results, query)
        } else {
          set({ searchResults: results, noResultsQuery: results.length === 0 ? query : null })
        }
      } finally {
        if (requestId === searchRequestId) set({ searchLoading: false })
      }
    },
    runDebouncedSearch: async () => {
      const { searchInput, runSearch } = get()

      const shouldAutoSelect = autoSelectNext
      autoSelectNext = false

      // Ya se buscó este texto directamente (por ejemplo, tras desvincular).
      if (searchInput.trim() === lastSearched) return

      await runSearch(searchInput, shouldAutoSelect)
    },
    fetchManual: async () => {
      const parsed = parseId(get().manualId)

      // ID vacío/inválido, o ya tenemos ese anime (por ejemplo, vino de la lista de resultados).
      if (parsed == null || get().selectedResult?.id === parsed) {
        set({ manualLoading: false })
        return
      }

      const requestId = ++manualRequestId
      set({ manualLoading: true })

      try {
        const res = await sendMessage({ type: 'GET_DETAILS', id: parsed })
        if (requestId !== manualRequestId) return // llegó una más nueva

        if (!res?.ok || !res.data.details) {
          set({ manualError: 'No se encontró ningún anime con ese ID.' })
          return
        }
        set({ selectedResult: { ...res.data.details, id: parsed } as MalAnime })
      } catch {
        if (requestId === manualRequestId) set({ manualError: 'No se pudo consultar MAL.' })
      } finally {
        if (requestId === manualRequestId) set({ manualLoading: false })
      }
    },
    confirm: async () => {
      const { manualId, selectedResult } = get()
      set({ error: '' })

      const trimmed = manualId.trim()
      const targetId = trimmed ? parseInt(trimmed, 10) : selectedResult?.id
      if (!targetId) {
        set({ error: 'Selecciona un resultado o ingresa un ID manualmente.' })
        return
      }

      const match = selectedResult?.id === targetId ? selectedResult : null
      const matchTitle = match?.title ?? null
      const matchPicture = match?.main_picture?.medium ?? null

      const animeStore = useAnimeStore.getState()
      set({ confirmLoading: true })

      try {
        const res = await sendMessage({
          type: 'LINK_ANIME',
          slug: animeStore.slug,
          malId: targetId,
          title: matchTitle,
          pictureUrl: matchPicture
        })

        if (!res?.ok) {
          set({ error: res?.error === 'not_found' ? 'Anime no encontrado.' : res?.error || 'No se pudo vincular.' })
          return
        }

        // Recién ahora cambiamos de vista: si falló, el error sigue visible en el form.
        animeStore.setLoading(true)
        animeStore.setId(targetId)
        animeStore.setView('linked') // desmonta LinkForm -> reset()

        const ok = await loadAnimeDetails(targetId)
        animeStore.setLoading(false)

        if (!ok) {
          // El vínculo ya se guardó; mostramos lo mínimo que tenemos como respaldo.
          animeStore.setTitle(res.data.title ?? matchTitle ?? '')
          animeStore.setPicture(res.data.pictureUrl ?? matchPicture ?? '')
          pushToast('Vinculado, pero no se pudieron cargar tus datos de MAL', 'error')
        }
      } finally {
        set({ confirmLoading: false })
      }
    },
    clearResults: () => set({ searchResults: [], selectedResult: null, manualId: '', noResultsQuery: null, error: '' }),
    reset: () => {
      searchRequestId++
      manualRequestId++
      lastSearched = null
      autoSelectNext = false
      autoSearchedFor = null
      set(initial)
    }
  }
})
