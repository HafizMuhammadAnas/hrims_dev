import type { ReactNode } from 'react'

type FormControlProps = {
  label: string
  htmlFor?: string
  children: ReactNode
}

/** One column inside `.form-row.two-col` (label + control in a nested cell). */
export function FormControl({ label, htmlFor, children }: FormControlProps) {
  return (
    <div>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  )
}
