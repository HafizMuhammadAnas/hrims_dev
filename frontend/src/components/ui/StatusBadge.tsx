import type { ReactNode } from 'react'

type BadgeTone = 'default' | 'pending' | 'success' | 'warning' | 'danger'

type StatusBadgeProps = {
  children: ReactNode
  tone?: BadgeTone
}

export function StatusBadge({ children, tone = 'default' }: StatusBadgeProps) {
  const toneClass = tone === 'default' ? '' : ` ${tone}`
  return <span className={`status-badge${toneClass}`}>{children}</span>
}
