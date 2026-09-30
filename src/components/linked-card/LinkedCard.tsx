import type { Dispatch, SetStateAction } from 'react'
import Picture from './Picture'
import Info from './Info'
import Options from './Options'
import { useAnimeStore } from './state'

export default function LinkedCard() {
  const { showOptions } = useAnimeStore()

  return (
    <>
      <div className='flex gap-2'>
        <Picture />
        <Info />
      </div>
      {showOptions && <Options />}
    </>
  )
}
