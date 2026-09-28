import '../../styles/tailwind.css'

interface ButtonProps {
  onClick?: () => void
  className?: string
  label?: string
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  type?: ButtonType
}

type ButtonType = 'ghost' | 'fill' | 'border'

const variants: Record<ButtonType, string> = {
  ghost: 'hover:bg-line',
  fill: 'bg-line hover:bg-edge',
  border: 'bg-mute-o hover:bg-edge border border-line'
}

export default function Button({ onClick, className = '', label, icon, iconPosition = 'left', type = 'ghost' }: ButtonProps) {
  const padding = label != null ? 'pl-2 pr-3 py-0' : ''
  const aspectRatio = label == null && icon != null ? 'aspect-square' : ''

  return (
    <button
      onClick={onClick}
      className={`${className} ${padding} ${aspectRatio} ${variants[type]} flex justify-center items-center btn text-subs hover:text-lead min-h-8 rounded-full`}
    >
      {icon != null && iconPosition === 'left' && icon}
      {label}
      {icon != null && iconPosition === 'right' && icon}
    </button>
  )
}
