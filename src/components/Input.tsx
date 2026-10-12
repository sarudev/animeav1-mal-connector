import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import '../styles/tailwind.css'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  trailing?: ReactNode
  loading?: boolean
  loadingText?: string
  error?: string
  hint?: ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', autoComplete = 'off', id, label, trailing, loading = false, loadingText = 'Buscando...', error, hint, ...props },
  ref
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className='w-full'>
      {label && (
        <label htmlFor={inputId} className='block pb-1 text-sm font-medium text-subs'>
          {label}
        </label>
      )}

      <div className='relative w-full'>
        <input
          ref={ref}
          id={inputId}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          className={`${className} text-subs min-h-10 w-full px-3 rounded-lg border ${error ? 'border-fire' : 'border-line/40'} bg-soft caret-subs placeholder:text-subs lg:text-sm focus:border-edge focus:bg-mute disabled:opacity-50 disabled:cursor-not-allowed`}
          {...props}
        />
        {trailing && <div className='absolute inset-y-0 right-1 flex items-center'>{trailing}</div>}
      </div>

      {loading && <p className='pt-1 text-xs text-subs'>{loadingText}</p>}
      {error && <p className='pt-1 text-xs text-fire'>{error}</p>}
      {!error && hint && <p className='pt-1 text-xs text-subs'>{hint}</p>}
    </div>
  )
})

export default Input
