import type { CSSProperties, ReactNode } from 'react'

type TableToolbarProps = {
  children: ReactNode
  compact?: boolean
  className?: string
  style?: CSSProperties
}

export function TableToolbar({ children, compact = false, className = '', style }: TableToolbarProps) {
  return (
    <div
      className={`page-toolbar${compact ? ' compact' : ''}${className ? ` ${className}` : ''}`.trim()}
      style={style}
    >
      {children}
    </div>
  )
}
