import type { ComponentType } from 'react'

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

/**
 * Emoji stored through a non-utf8mb4 connection collapses to "?" (or U+FFFD).
 * Those values carry no meaning, so they must not win over the built-in icon.
 */
function isMeaninglessGlyph(raw: string): boolean {
  const stripped = raw
    // Variation selectors / zero-width joiners left behind by a mangled emoji.
    .replace(/[\uFE0E\uFE0F\u200B-\u200D\u2060]/g, '')
    .trim()
  if (!stripped) return true
  return /^[?\uFFFD]+$/.test(stripped)
}

type IconComponent = ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>

type Props = {
  value: string | null | undefined
  /** Text/emoji shown when no icon component is supplied. */
  fallback: string
  /** Preferred vector icon when there is no usable stored icon. */
  fallbackIcon?: IconComponent
  variant?: 'card' | 'hero'
}

export function KnowledgeHubIcon({ value, fallback, fallbackIcon, variant = 'card' }: Props) {
  const trimmed = value?.trim() ?? ''
  const className =
    variant === 'hero' ? 'conv-icon-lg' : variant === 'card' ? 'card-icon' : 'knowledge-card-icon'

  if (trimmed && shouldRenderAsImage(trimmed)) {
    return (
      <div className={className} aria-hidden>
        <img src={resolveIconSrc(trimmed)} alt="" />
      </div>
    )
  }

  const usableGlyph = trimmed && !isMeaninglessGlyph(trimmed) ? trimmed : ''

  if (!usableGlyph && fallbackIcon) {
    const FallbackIcon = fallbackIcon
    return (
      <div className={className} aria-hidden>
        <FallbackIcon size={variant === 'hero' ? 56 : 26} strokeWidth={1.9} aria-hidden />
      </div>
    )
  }

  return (
    <div className={className} aria-hidden>
      {usableGlyph || fallback}
    </div>
  )
}
