import type { ReactNode } from 'react'

type FormRowProps = {
  children: ReactNode
  twoCol?: boolean
  className?: string
}

export function FormRow({ children, twoCol = false, className = '' }: FormRowProps) {
  return (
    <div className={`form-row${twoCol ? ' two-col' : ''}${className ? ` ${className}` : ''}`}>{children}</div>
  )
}
