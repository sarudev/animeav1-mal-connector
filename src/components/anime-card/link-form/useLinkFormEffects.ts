import { useEffect } from 'react'
import useDebouncedEffect from '@/hooks/useDebouncedEffect'
import { useAnimeStore } from '../useAnimeStore'
import { useLinkFormStore } from './useLinkFormStore'

export function useLinkFormEffects() {
  const { slug, title, id, picture, totalEpisodes } = useAnimeStore()
  const { searchInput, manualId, reset, autoSearchFromTitle, showLinked, runDebouncedSearch, fetchManual } = useLinkFormStore()

  useEffect(() => () => reset(), [])

  useEffect(() => {
    if (id != null || !title) return
    autoSearchFromTitle(slug, title)
  }, [id, slug, title])

  useEffect(() => {
    if (id == null || !title) return
    showLinked({ id, title, picture, totalEpisodes })
  }, [id, picture, totalEpisodes])

  useDebouncedEffect(searchInput, 300, () => runDebouncedSearch())
  useDebouncedEffect(manualId, 500, () => fetchManual())
}
