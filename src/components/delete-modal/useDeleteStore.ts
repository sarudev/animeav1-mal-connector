import { create } from 'zustand'

export interface DeleteTarget {
  slug: string
  malId: number
  title: string
}

interface DeleteStore {
  target: DeleteTarget | null
  open: (target: DeleteTarget) => void
  close: () => void
}

export const useDeleteStore = create<DeleteStore>(set => ({
  target: null,
  open: target => set({ target }),
  close: () => set({ target: null })
}))
