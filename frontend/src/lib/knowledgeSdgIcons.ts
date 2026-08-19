import {
  Briefcase,
  Building2,
  Droplets,
  Earth,
  Factory,
  Fish,
  GraduationCap,
  HandCoins,
  Handshake,
  HeartPulse,
  Landmark,
  Link2,
  Recycle,
  Target,
  Trees,
  VenusAndMars,
  Wheat,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/** Vector icon per SDG goal number, used when no custom icon is stored. */
const SDG_ICON_BY_GOAL: Record<number, LucideIcon> = {
  1: HandCoins,
  2: Wheat,
  3: HeartPulse,
  4: GraduationCap,
  5: VenusAndMars,
  6: Droplets,
  7: Zap,
  8: Briefcase,
  9: Factory,
  10: Handshake,
  11: Building2,
  12: Recycle,
  13: Earth,
  14: Fish,
  15: Trees,
  16: Landmark,
  17: Link2,
}

export function knowledgeSdgIcon(
  goalNumber: number | null | undefined,
  code?: string | null,
): LucideIcon {
  if (typeof goalNumber === 'number' && SDG_ICON_BY_GOAL[goalNumber]) {
    return SDG_ICON_BY_GOAL[goalNumber]
  }

  const fromCode = Number.parseInt((code ?? '').replace(/[^0-9]/g, ''), 10)
  if (Number.isFinite(fromCode) && SDG_ICON_BY_GOAL[fromCode]) {
    return SDG_ICON_BY_GOAL[fromCode]
  }

  return Target
}
