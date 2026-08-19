import type { ReactNode } from 'react'

type Props = {
  title: string
  children: ReactNode
  /** When false, the section starts collapsed. Default open. */
  defaultOpen?: boolean
  className?: string
}

/** Collapsible department response form block with banner-style section heading. */
export function DeptResponseFormSection({
  title,
  children,
  defaultOpen = true,
  className,
}: Props) {
  return (
    <details
      className={`dept-response-form-section${className ? ` ${className}` : ''}`}
      open={defaultOpen}
    >
      <summary className="dept-response-form-section__summary">{title}</summary>
      <div className="dept-response-form-section__body">{children}</div>
    </details>
  )
}
