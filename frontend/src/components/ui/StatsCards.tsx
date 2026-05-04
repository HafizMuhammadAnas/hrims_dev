import type { ReactNode } from 'react'

export type StatCardItem = {
  label: string
  value: ReactNode
}

type StatsCardsProps = {
  items: StatCardItem[]
  className?: string
}

export function StatsCards({ items, className }: StatsCardsProps) {
  return (
    <div className={`stats-row${className ? ` ${className}` : ''}`}>
      {items.map((item) => (
        <div className="stat-card" key={item.label}>
          <div className="stat-card-value">{item.value}</div>
          <div className="stat-card-label">{item.label}</div>
        </div>
      ))}
    </div>
  )
}
