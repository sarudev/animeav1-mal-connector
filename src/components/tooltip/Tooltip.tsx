import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './tooltip.scss'

export interface TooltipProps {
  label: string
  children: React.ReactNode
  className?: string
  offset?: number
  delay?: number
  container: HTMLElement
}

interface Position {
  top: number
  left: number
}

export const Tooltip: React.FC<TooltipProps> = ({ label, children, className = '', offset = 8, delay = 0, container }) => {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipId = useId()

  const updatePosition = useCallback(() => {
    const wrapper = triggerRef.current
    if (!wrapper) return

    const target = (wrapper.firstElementChild as HTMLElement | null) ?? wrapper
    const rect = target.getBoundingClientRect()

    setPosition({
      top: rect.top - offset,
      left: rect.left + rect.width / 2
    })
  }, [offset])

  const show = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      updatePosition()
      setVisible(true)
    }, delay)
  }, [delay, updatePosition])

  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setVisible(false)
  }, [])

  useEffect(() => {
    if (!visible) return
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [visible, updatePosition])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <>
      <span
        ref={triggerRef}
        className={['tooltip-trigger', className].filter(Boolean).join(' ')}
        aria-describedby={visible ? tooltipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>

      {visible &&
        position &&
        createPortal(
          <span
            id={tooltipId}
            role='tooltip'
            className='tooltip-content'
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              transform: 'translate(-50%, -100%)',
              zIndex: 9999,
              pointerEvents: 'none'
            }}
          >
            {label}
          </span>,
          container
        )}
    </>
  )
}

export default Tooltip
