import type { Response } from '@/utils/types'
import { create } from 'zustand'

type View = 'linked' | 'link-form' | 'auth-form'

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
  view: View
  authForced: boolean
  reconnectNonce: number
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
  setView: (view: View) => void
  openAuth: () => void
  setAuthRequired: () => void
  setCredentialsCleared: () => void
  notifyReconnected: () => void
  setLoading: (loading: boolean) => void
  reset: () => void
  patch: (partial: Partial<AnimeStoreVars>) => void
  setDetails: (d: MalAnime) => void
  setListStatus: (s: MalListStatus) => void
  setUnlinked: () => void
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
  authForced: false,
  reconnectNonce: 0,
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
  openAuth: () => set({ view: 'auth-form', authForced: false }),
  setAuthRequired: () => set({ view: 'auth-form', authForced: true, loading: false }),
  notifyReconnected: () => set(s => ({ view: 'linked', authForced: false, loading: true, reconnectNonce: s.reconnectNonce + 1 })),
  setLoading: loading => set({ loading }),
  setCredentialsCleared: () =>
    set(state => ({
      ...INITIAL,
      slug: state.slug,
      view: 'auth-form',
      authForced: true,
      loading: false
    })),
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
    }),
  setListStatus: s =>
    set({
      status: s.status,
      score: s.score,
      lastConfirmedScore: s.score,
      watchedEpisodes: s.num_episodes_watched
    }),
  setUnlinked: () =>
    set(state => ({
      ...INITIAL,
      slug: state.slug,
      title: state.title,
      loading: false,
      view: 'link-form'
    }))
}))

export const COLORS = ['#F87171', '#F18371', '#EA9570', '#E3A870', '#DCBA6F', '#D8C36F', '#C8C671', '#A9CC75', '#89D278', '#6AD87C', '#4ADE80']

export function routeMalError(res: Response<unknown> | undefined): boolean {
  if (!isMalAuthError(res)) return false
  useAnimeStore.getState().setAuthRequired()
  return true
}
