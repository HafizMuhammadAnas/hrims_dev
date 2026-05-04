import type { ReactNode } from 'react'

type TableCardProps = {
  children: ReactNode
  padded?: boolean
  className?: string
}

export function TableCard({ children, padded = false, className }: TableCardProps) {
  return (
    <div className={`table-card section-card${padded ? ' table-card-padded' : ''}${className ? ` ${className}` : ''}`}>
      <div className="table-card-scroll">{children}</div>
    </div>
  )
}
