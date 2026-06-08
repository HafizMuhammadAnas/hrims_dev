import type { ReactNode } from 'react'
import type { StatusBadgeTone } from '../../lib/statusBadgeTone'

type StatusBadgeProps = {
  children: ReactNode
  tone?: StatusBadgeTone
}

export function StatusBadge({ children, tone = 'default' }: StatusBadgeProps) {
  const toneClass = tone === 'default' ? '' : ` ${tone}`
  return <span className={`status-badge${toneClass}`}>{children}</span>
}
