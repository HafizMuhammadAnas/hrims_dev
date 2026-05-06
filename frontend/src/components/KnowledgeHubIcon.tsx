function shouldRenderAsImage(raw: string): boolean {
  const s = raw.trim()
  if (!s) return false
  if (/^https?:\/\//i.test(s)) return true
  if (/^data:image\//i.test(s)) return true
  if (/^\/storage\//i.test(s)) return true
  return /^\/[^\s]+\.(png|jpe?g|gif|svg|webp)(\?[^\s]*)?$/i.test(s)
}

function resolveIconSrc(trimmed: string): string {
  if (/^https?:\/\//i.test(trimmed) || /^data:/i.test(trimmed)) return trimmed
  const base = (import.meta.env.BASE_URL as string) || '/'
  const root = base === '/' ? '' : base.replace(/\/?$/, '')
  if (trimmed.startsWith('/') && root) {
    return `${root}${trimmed}`
  }
  return trimmed
}

type Props = {
  value: string | null | undefined
  fallback: string
  variant?: 'card' | 'hero'
}

export function KnowledgeHubIcon({ value, fallback, variant = 'card' }: Props) {
  const trimmed = value?.trim() ?? ''
  const className = variant === 'hero' ? 'knowledge-hero-icon' : 'knowledge-card-icon'

  if (trimmed && shouldRenderAsImage(trimmed)) {
    return (
      <div className={className} aria-hidden>
        <img src={resolveIconSrc(trimmed)} alt="" />
      </div>
    )
  }

  const display = trimmed || fallback
  return (
    <div className={className} aria-hidden>
      {display}
    </div>
  )
}
