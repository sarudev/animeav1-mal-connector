import { create } from 'zustand'

interface AnimeStoreVars {
  slug: string
  id: number | null
  title: string
  status: MalListStatus['status'] | null
  score: number
  lastConfirmedScore: number
  watchedEpisodes: number
  totalEpisodes: number
  picture: string
  showOptions: boolean
  view: 'linked' | 'link-form'
  loading: boolean
}

interface AnimeStore extends AnimeStoreVars {
  setSlug: (slug: string) => void
  setId: (id: number | null) => void
  setTitle: (title: string) => void
  setStatus: (status: MalListStatus['status'] | null) => void
  setScore: (score: number) => void
  setLastConfirmedScore: (lastConfirmedScore: number) => void
  setWatchedEpisodes: (watchedEpisodes: number) => void
  setTotalEpisodes: (totalEpisodes: number) => void
  setPicture: (picture: string) => void
  setShowOptions: (cb: ((prev: boolean) => boolean) | boolean) => void
  setView: (view: 'linked' | 'link-form') => void
  setLoading: (loading: boolean) => void
  reset: () => void
  patch: (partial: Partial<AnimeStoreVars>) => void
  setDetails: (d: MalAnime) => void
}

const INITIAL: AnimeStoreVars = {
  slug: '',
  id: null,
  title: '',
  status: null,
  score: 0,
  lastConfirmedScore: 0,
  watchedEpisodes: 0,
  totalEpisodes: 0,
  picture: '',
  showOptions: false,
  view: 'linked',
  loading: true
}

export const useAnimeStore = create<AnimeStore>(set => ({
  ...INITIAL,
  setSlug: slug => set({ slug }),
  setId: id => set({ id }),
  setTitle: title => set({ title }),
  setStatus: status => set({ status }),
  setScore: score => set({ score }),
  setLastConfirmedScore: lastConfirmedScore => set({ lastConfirmedScore }),
  setWatchedEpisodes: watchedEpisodes => set({ watchedEpisodes }),
  setTotalEpisodes: totalEpisodes => set({ totalEpisodes }),
  setPicture: picture => set({ picture }),
  setShowOptions: cb => set(state => ({ showOptions: typeof cb === 'function' ? cb(state.showOptions) : cb })),
  setView: view => set({ view }),
  setLoading: loading => set({ loading }),
  reset: () => set({ ...INITIAL }),
  patch: partial => set(partial),
  setDetails: d =>
    set({
      title: d.title,
      status: d.my_list_status?.status ?? null,
      score: d.my_list_status?.score ?? 0,
      lastConfirmedScore: d.my_list_status?.score ?? 0,
      watchedEpisodes: d.my_list_status?.num_episodes_watched ?? 0,
      totalEpisodes: d.num_episodes ?? 0,
      picture: d.main_picture?.medium ?? ''
    })
}))

export const COLORS = ['#F87171', '#F18371', '#EA9570', '#E3A870', '#DCBA6F', '#D8C36F', '#C8C671', '#A9CC75', '#89D278', '#6AD87C', '#4ADE80']
