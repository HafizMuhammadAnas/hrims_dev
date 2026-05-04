import type { ReactNode } from 'react'

type FormFieldProps = {
  label: string
  htmlFor?: string
  /** Short helper shown under the label (before the control). */
  hint?: string
  children: ReactNode
}

/** Full-width field: label + control inside a single `.form-row`. */
export function FormField({ label, htmlFor, hint, children }: FormFieldProps) {
  return (
    <div className="form-row">
      <label htmlFor={htmlFor}>{label}</label>
      {hint ? (
        <p className="muted" style={{ fontSize: 12, margin: '0 0 6px', lineHeight: 1.35 }}>
          {hint}
        </p>
      ) : null}
      {children}
    </div>
  )
}
