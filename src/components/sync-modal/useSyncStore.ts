import { create } from 'zustand'
import type { ListSnapshot, SiteExtra } from '@/utils/list-sync'

export interface SyncConflict {
  slug: string
  malId: number
  siteMediaId: number
  siteExtra: SiteExtra
  mal: ListSnapshot | null
  site: ListSnapshot | null
}

interface SyncStore {
  conflict: SyncConflict | null
  open: (conflict: SyncConflict) => void
  close: () => void
}

export const useSyncStore = create<SyncStore>(set => ({
  conflict: null,
  open: conflict => set({ conflict }),
  close: () => set({ conflict: null })
}))
