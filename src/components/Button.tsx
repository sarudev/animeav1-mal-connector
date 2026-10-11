import '../styles/tailwind.css'

interface ButtonProps {
  onClick?: () => void
  className?: string
  label?: string
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  type?: ButtonType
  overwritePadding?: boolean
  disabled?: boolean
}

type ButtonType = 'ghost' | 'fill' | 'border' | 'risk'

const variants: Record<ButtonType, string> = {
  ghost: 'text-subs enabled:hover:text-lead enabled:hover:bg-line',
  fill: 'text-subs enabled:hover:text-lead bg-line enabled:hover:bg-edge',
  border: 'text-subs enabled:hover:text-lead bg-mute-o enabled:hover:bg-edge border border-line',
  risk: 'text-white bg-fire enabled:hover:bg-fire/80'
}

export default function Button({
  onClick,
  className = '',
  label,
  icon,
  iconPosition = 'left',
  type = 'ghost',
  overwritePadding = false,
  disabled = false
}: ButtonProps) {
  const padding = overwritePadding ? '' : label != null ? 'px-3 py-0' : ''
  const aspectRatio = label == null && icon != null ? 'aspect-square' : ''

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${className} ${padding} ${aspectRatio} ${variants[type]} gap-1 flex justify-center items-center btn min-h-8 rounded-full disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {icon != null && iconPosition === 'left' && icon}
      {label}
      {icon != null && iconPosition === 'right' && icon}
    </button>
  )
}
