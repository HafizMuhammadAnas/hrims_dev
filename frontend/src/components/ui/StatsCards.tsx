import type { ReactNode } from 'react'

export type StatCardItem = {
  label: string
  value: ReactNode
  detail?: ReactNode
  /** Optional leading icon (rendered in a tinted rounded square, titleTop variant). */
  icon?: ReactNode
  /** Hex color used for the icon glyph and its tinted background. */
  iconTone?: string
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
              {item.icon ? (
                <span
                  className="stat-card__icon"
                  style={
                    item.iconTone
                      ? { color: item.iconTone, background: `${item.iconTone}1f` }
                      : undefined
                  }
                  aria-hidden
                >
                  {item.icon}
                </span>
              ) : null}
              <div className="stat-card__body">
                <div className="stat-card-label">{item.label}</div>
                <div className="stat-card-value">{item.value}</div>
                <div className={`stat-card-detail${item.detail ? '' : ' stat-card-detail--empty'}`}>
                  {item.detail ?? '\u00a0'}
                </div>
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
