import type { ReactNode } from 'react'

type PageSectionProps = {
  title: string
  subtitle?: ReactNode
  /** Optional second line under the subtitle (e.g. extra context). */
  detail?: ReactNode
  /** Optional icon or badge shown before the title (e.g. report generator). */
  titleIcon?: ReactNode
  children: ReactNode
}

export function PageSection({ title, subtitle, detail, titleIcon, children }: PageSectionProps) {
  return (
    <div className="page-shell">
      <div className="page-header">
        <h2 className={titleIcon ? 'page-header-title-with-icon' : undefined}>
          {titleIcon}
          {title}
        </h2>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
        {detail ? <p className="muted page-header-detail">{detail}</p> : null}
      </div>
      {children}
    </div>
  )
}
