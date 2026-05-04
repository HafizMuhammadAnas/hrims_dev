import type { ReactNode } from 'react'

type FormGridProps = {
  children: ReactNode
  className?: string
}

export function FormGrid({ children, className = '' }: FormGridProps) {
  return <div className={`form-grid${className ? ` ${className}` : ''}`}>{children}</div>
}
