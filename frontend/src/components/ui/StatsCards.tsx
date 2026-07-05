import type { ReactNode } from 'react'

export type StatCardItem = {
  label: string
  value: ReactNode
  detail?: ReactNode
}

type StatsCardsProps = {
  items: StatCardItem[]
  className?: string
  /** Label on top, value center, optional detail at bottom (reporting dashboard). */
  variant?: 'default' | 'titleTop'
}

export function StatsCards({ items, className, variant = 'default' }: StatsCardsProps) {
  const titleTop = variant === 'titleTop'
  return (
    <div
      className={`stats-row${titleTop ? ' stats-row--title-top' : ''}${className ? ` ${className}` : ''}`.trim()}
    >
      {items.map((item) => (
        <div className="stat-card" key={item.label}>
          {titleTop ? (
            <>
              <div className="stat-card-label">{item.label}</div>
              <div className="stat-card-value">{item.value}</div>
              <div className={`stat-card-detail${item.detail ? '' : ' stat-card-detail--empty'}`}>
                {item.detail ?? '\u00a0'}
              </div>
            </>
          ) : (
            <>
              <div className="stat-card-value">{item.value}</div>
              {item.detail ? <div className="stat-card-detail">{item.detail}</div> : null}
              <div className="stat-card-label">{item.label}</div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
