import { ChevronRight } from 'lucide-react'
import Input from '../Input'

interface Props {
  value: string
  onChange: (value: string) => void
  loading?: boolean
  error?: string
  className?: string
}

export default function ManualIdEntry({ value, onChange, loading, error, className = '' }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (error) setOpen(true)
  }, [error])

  return (
    <details className={`group ${className}`} open={open} onToggle={e => setOpen(e.currentTarget.open)}>
      <summary className='flex w-fit cursor-pointer select-none list-none items-center gap-1 rounded-md py-1 text-xs font-bold text-subs transition-colors hover:text-lead [&::-webkit-details-marker]:hidden'>
        <ChevronRight size={14} className='transition-transform group-open:rotate-90' />
        ¿Ya tenés el ID de MAL?
      </summary>

      <div className='pt-2'>
        <div className='pt-2'>
          <Input
            type='number'
            inputMode='numeric'
            min={1}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder='Ej: 21'
            loading={loading}
            loadingText='Buscando anime...'
            error={error}
            className='[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
          />
        </div>
      </div>
    </details>
  )
}
