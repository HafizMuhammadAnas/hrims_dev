import { GripVertical } from 'lucide-react'

type Props = {
  label?: string
  disabled?: boolean
  className?: string
}

export function DragHandle({ label = 'Drag to reorder', disabled, className }: Props) {
  return (
    <span
      className={`drag-handle${className ? ` ${className}` : ''}${disabled ? ' drag-handle--disabled' : ''}`}
      aria-label={label}
      title={label}
    >
      <GripVertical size={16} aria-hidden />
    </span>
  )
}
