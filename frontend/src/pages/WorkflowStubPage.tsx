import { Link } from 'react-router-dom'

export type WorkflowLink = { to: string; label: string }

type Props = {
  title: string
  intro: string
  bullets?: string[]
  links?: WorkflowLink[]
}

export function WorkflowStubPage({ title, intro, bullets = [], links = [] }: Props) {
  return (
    <div className="workflow-stub">
      <h2>{title}</h2>
      <p className="muted">{intro}</p>
      {bullets.length > 0 && (
        <ul className="workflow-stub-list">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {links.length > 0 && (
        <div className="workflow-stub-links">
          <div className="nav-section-title" style={{ marginTop: 20 }}>
            Related in HRIMS
          </div>
          <ul>
            {links.map((l) => (
              <li key={l.to}>
                <Link to={l.to}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
