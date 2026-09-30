import { useId, useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react'
import '../styles/tailwind.css'

export interface SliderProps {
  value: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  onChange?: (value: number) => void
  onCommit?: (value: number) => void
  className?: string
  id?: string
}

const TRACK_GRADIENT = 'linear-gradient(to right, #F87171, #F18371, #EA9570, #E3A870, #DCBA6F, #D8C36F, #C8C671, #A9CC75, #89D278, #6AD87C, #4ADE80)'

const INPUT_BASE =
  'relative z-10 w-full h-1.5 appearance-none rounded-lg outline-none cursor-pointer select-none touch-none [-webkit-user-drag:none] bg-transparent ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 ' +
  '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-lead ' +
  '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-main ' +
  '[&::-webkit-slider-thumb]:cursor-pointer ' +
  '[&::-moz-range-track]:bg-transparent [&::-moz-range-progress]:bg-transparent ' +
  '[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full ' +
  '[&::-moz-range-thumb]:bg-lead [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-main ' +
  '[&::-moz-range-thumb]:cursor-pointer'

export function Slider({ value, min = 0, max = 10, step = 1, disabled = false, onChange, onCommit, className = '', id }: SliderProps) {
  const autoId = useId()
  const [internal, setInternal] = useState(value)
  const [active, setActive] = useState(false)
  const [hover, setHover] = useState(false)
  const isDragging = useRef(false)

  useEffect(() => {
    if (!isDragging.current) setInternal(value)
  }, [value])

  const trackOpacity = active ? 1 : hover ? 0.75 : 0.5

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const next = Number(e.target.value)
      setInternal(next)
      onChange?.(next)
    },
    [onChange]
  )

  const commit = useCallback(() => {
    isDragging.current = false
    setActive(false)
    onCommit?.(internal)
  }, [internal, onCommit])

  return (
    <div className={`relative w-full h-4 flex items-center ${className}`}>
      <div
        aria-hidden
        className='absolute inset-x-0 h-1.5 rounded-lg pointer-events-none transition-opacity duration-150'
        style={{ background: TRACK_GRADIENT, opacity: trackOpacity }}
      />
      <input
        id={id ?? autoId}
        type='range'
        min={min}
        max={max}
        step={step}
        value={internal}
        disabled={disabled}
        draggable={false}
        onChange={handleChange}
        onPointerDown={() => {
          isDragging.current = true
          setActive(true)
        }}
        onPointerUp={commit}
        onPointerLeave={() => active && commit()}
        onPointerEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={INPUT_BASE}
      />
    </div>
  )
}

export default Slider
