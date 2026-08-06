import {
  Accessibility,
  Baby,
  Globe,
  HeartHandshake,
  Scale,
  ScrollText,
  ShieldAlert,
  ShieldOff,
  Users,
  Venus,
  type LucideIcon,
} from 'lucide-react'

/**
 * Vector icon per core convention, keyed by code.
 * Used when a convention has no custom icon (or a corrupted one) stored.
 */
const CONVENTION_ICON_BY_CODE: Record<string, LucideIcon> = {
  ICERD: Users,
  ICCPR: Scale,
  ICESCR: HeartHandshake,
  CEDAW: Venus,
  CAT: ShieldAlert,
  CRC: Baby,
  CRPD: Accessibility,
  CMW: Globe,
  CED: ShieldOff,
}

function normalizeConventionCode(code: string | null | undefined): string {
  return (code ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .trim()
}

export function knowledgeConventionIcon(code: string | null | undefined): LucideIcon {
  const normalized = normalizeConventionCode(code)
  if (!normalized) return ScrollText

  const exact = CONVENTION_ICON_BY_CODE[normalized]
  if (exact) return exact

  // Optional protocols and variants (e.g. OPCAT, CRCOP) reuse the parent convention icon.
  let best: LucideIcon | null = null
  let bestLength = 0
  for (const [key, icon] of Object.entries(CONVENTION_ICON_BY_CODE)) {
    if (normalized.includes(key) && key.length > bestLength) {
      best = icon
      bestLength = key.length
    }
  }

  return best ?? ScrollText
}
