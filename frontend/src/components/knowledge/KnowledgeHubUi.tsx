import { ArrowLeft, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { KnowledgeHubIcon } from '../KnowledgeHubIcon'
import { formatKnowledgeHubTitle } from '../../lib/displayTitleCase'

export function KnowledgeHubPage({ children }: { children: ReactNode }) {
  return (
    <div className="page-shell">
      <div className="knowledge-hub">{children}</div>
    </div>
  )
}

export function KnowledgeHubListSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
      </div>
      {children}
    </section>
  )
}

export function KnowledgeHubCardsGrid({ children }: { children: ReactNode }) {
  return <div className="cards-grid">{children}</div>
}

export function KnowledgeHubCard({
  icon,
  fallback,
  fallbackIcon,
  title,
  description,
  stat1Value,
  stat1Label,
  stat2Value,
  stat2Label,
  onClick,
}: {
  icon?: string | null
  fallback: string
  fallbackIcon?: LucideIcon
  title: string
  description?: string | null
  stat1Value?: string | null
  stat1Label?: string | null
  stat2Value?: string | null
  stat2Label?: string | null
  onClick?: () => void
}) {
  const hasStats =
    Boolean(stat1Value?.trim() || stat1Label?.trim()) ||
    Boolean(stat2Value?.trim() || stat2Label?.trim())

  const displayTitle = formatKnowledgeHubTitle(title)

  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`card${onClick ? '' : ' card-static'}`}
      onClick={onClick}
    >
      <KnowledgeHubIcon
        value={icon}
        fallback={fallback}
        fallbackIcon={fallbackIcon}
        variant="card"
      />
      <h3 className="card-title">{displayTitle}</h3>
      <p className="card-desc">{description?.trim() || '—'}</p>
      {hasStats ? (
        <div className="card-stats">
          <div className="stat">
            <div className="stat-value">{stat1Value?.trim() || '—'}</div>
            <div className="stat-label">{stat1Label?.trim() || ''}</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stat2Value?.trim() || '—'}</div>
            <div className="stat-label">{stat2Label?.trim() || ''}</div>
          </div>
        </div>
      ) : null}
    </Tag>
  )
}

export function KnowledgeHubDetailHeader({
  title,
  subtitle,
  icon,
  fallback,
  fallbackIcon,
  metaLines,
  onBack,
}: {
  title: string
  subtitle?: string | null
  icon?: string | null
  fallback: string
  fallbackIcon?: LucideIcon
  metaLines?: string[]
  onBack: () => void
}) {
  return (
    <div className="conv-hero">
      <button type="button" onClick={onBack} className="knowledge-hub-back-btn">
        <ArrowLeft size={16} aria-hidden />
        Back to List
      </button>
      <div className="conv-header">
        <KnowledgeHubIcon
          value={icon}
          fallback={fallback}
          fallbackIcon={fallbackIcon}
          variant="hero"
        />
        <div className="conv-title-section">
          <h1 className="conv-title">{formatKnowledgeHubTitle(title)}</h1>
          {subtitle?.trim() ? <p className="conv-subtitle">{subtitle.trim()}</p> : null}
          {metaLines && metaLines.length > 0 ? (
            <div className="conv-meta">
              {metaLines.map((line) => (
                <span key={line} className="conv-meta__chip">
                  {line}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function KnowledgeHubTabs({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: string[]
  activeTab: string
  onTabChange: (tab: string) => void
}) {
  return (
    <div className="tabs-nav">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          className={`tab-btn${activeTab === tab ? ' active' : ''}`}
          onClick={() => onTabChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

export function KnowledgeHubPanel({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="overview-section">
      <h2 className="section-title">{title}</h2>
      {children}
    </div>
  )
}

export function KnowledgeHubProse({ children }: { children: ReactNode }) {
  return (
    <p className="overview-text" style={{ whiteSpace: 'pre-wrap' }}>
      {children}
    </p>
  )
}

export function KnowledgeHubMutedProse({ children }: { children: ReactNode }) {
  return (
    <p className="overview-text text-lt" style={{ marginBottom: 0 }}>
      {children}
    </p>
  )
}

export function KnowledgeHubArticleGrid({
  items,
}: {
  items: Array<{ key: string | number; num: string; title: string; desc: string }>
}) {
  if (items.length === 0) return null
  return (
    <div className="articles-grid">
      {items.map((item) => (
        <div key={item.key} className="article-card">
          <div className="article-num">{item.num}</div>
          <div className="article-title">{item.title}</div>
          <div className="article-desc">{item.desc}</div>
        </div>
      ))}
    </div>
  )
}

export function KnowledgeHubRecList({
  items,
}: {
  items: Array<{ key: string | number; title: string; details: string; priority?: string }>
}) {
  return (
    <div className="rec-container">
      {items.map((item) => (
        <div key={item.key} className="rec-card">
          <div className="rec-header">
            <h3 className="rec-title">{item.title}</h3>
            {item.priority ? <span className="priority-badge priority-high">{item.priority}</span> : null}
          </div>
          <p className="rec-details">{item.details}</p>
        </div>
      ))}
    </div>
  )
}

export function KnowledgeHubTargetList({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <ul className="knowledge-hub-target-list">
      {items.map((item, idx) => (
        <li key={idx}>{item}</li>
      ))}
    </ul>
  )
}

export function KnowledgeHubStateMessage({
  error,
  loading,
  empty,
}: {
  error?: string | null
  loading?: boolean
  empty?: boolean
}) {
  if (loading) return <p className="muted">Loading…</p>
  if (error) return <p className="login-error">{error}</p>
  if (empty) return <p className="muted">No published content is available yet.</p>
  return null
}
