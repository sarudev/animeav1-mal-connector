interface DividerProps {
  direction: 'vertical' | 'horizontal'
}

export default function Divider({ direction }: DividerProps) {
  return <div className={`${direction === 'vertical' ? 'self-stretch w-px -my-4' : 'h-px -mx-4'} bg-edge`} />
}
