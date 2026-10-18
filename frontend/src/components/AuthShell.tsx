import type { ReactNode } from 'react'

type AuthShellProps = {
  cardTitle: string
  cardSubtitle?: string
  children: ReactNode
}

export function AuthShell({ cardTitle, cardSubtitle, children }: AuthShellProps) {
  return (
    <div className="login-page login-page--hero">
      <div className="login-hero-scrim" aria-hidden />
      <div className="login-hero-content">
        <div className="login-hero-brand">
          <img
            src="/brand/mohr-blue-logo.png"
            alt="Ministry of Human Rights"
            className="login-hero-logo"
          />
          <h1 className="login-hero-title">HRIMS</h1>
          <p className="login-hero-tagline">Human Rights Information Management System</p>
        </div>

        <div className="login-card">
          <h2 className="login-card-title">{cardTitle}</h2>
          {cardSubtitle ? <p className="login-sub">{cardSubtitle}</p> : null}
          {children}
        </div>

        <p className="login-hero-footer">Need access? Contact your department administrator</p>
      </div>
    </div>
  )
}
