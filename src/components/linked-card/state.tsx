import { create } from 'zustand'

interface AnimeStore {
  slug: string
  id: number | null
  title: string
  status: MalListStatus['status'] | null
  score: number
  watchedEpisodes: number
  totalEpisodes: number
  picture: string
  showOptions: boolean
  view: 'linked' | 'link-form'
  setSlug: (slug: string) => void
  setId: (id: number | null) => void
  setTitle: (title: string) => void
  setStatus: (status: MalListStatus['status'] | null) => void
  setScore: (score: number) => void
  setWatchedEpisodes: (watchedEpisodes: number) => void
  setTotalEpisodes: (totalEpisodes: number) => void
  setPicture: (picture: string) => void
  setShowOptions: (cb: ((prev: boolean) => boolean) | boolean) => void
  setView: (view: 'linked' | 'link-form') => void
}

export const useAnimeStore = create<AnimeStore>(set => ({
  slug: '',
  id: null,
  title: '',
  status: null,
  score: 0,
  watchedEpisodes: 0,
  totalEpisodes: 0,
  picture: '',
  showOptions: false,
  view: 'linked',
  setSlug: slug => set({ slug }),
  setId: (id: number | null) => set({ id }),
  setTitle: (title: string) => set({ title }),
  setStatus: status => set({ status }),
  setScore: score => set({ score }),
  setWatchedEpisodes: watchedEpisodes => set({ watchedEpisodes }),
  setTotalEpisodes: totalEpisodes => set({ totalEpisodes }),
  setPicture: picture => set({ picture }),
  setShowOptions: cb => set(state => ({ showOptions: typeof cb === 'function' ? cb(state.showOptions) : cb })),
  setView: (view: 'linked' | 'link-form') => set({ view })
}))

export const COLORS = ['#F87171', '#F18371', '#EA9570', '#E3A870', '#DCBA6F', '#D8C36F', '#C8C671', '#A9CC75', '#89D278', '#6AD87C', '#4ADE80']
