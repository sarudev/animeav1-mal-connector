import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react'
import Skeleton from './skeleton/Skeleton'

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onLoad' | 'onError'> {
  src: string | null | undefined
  wrapperClassName?: string
}

export default function LazyImage({ src, alt = '', className = '', wrapperClassName = '', ...rest }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    const img = imgRef.current
    setLoaded(!!img && img.complete && img.naturalWidth > 0)
  }, [src])

  if (!src || failed) {
    return <div className={`relative w-full h-full rounded bg-current opacity-10 ${wrapperClassName}`} />
  }

  return (
    <div className={`relative w-full h-full overflow-hidden ${wrapperClassName}`}>
      {!loaded && (
        <div className='absolute inset-0'>
          <Skeleton />
        </div>
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        {...rest}
      />
    </div>
  )
}
