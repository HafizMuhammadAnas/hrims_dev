import {
  Activity,
  Apple,
  BarChart3,
  Briefcase,
  CircleCheck,
  ClipboardList,
  Droplets,
  FileText,
  GraduationCap,
  HeartPulse,
  House,
  Scale,
  ShieldCheck,
  Vote,
  type LucideIcon,
} from 'lucide-react'

type KeywordIcon = { keywords: string[]; icon: LucideIcon }

const INDICATOR_KEYWORD_ICONS: KeywordIcon[] = [
  { keywords: ['health', 'medical', 'hospital'], icon: HeartPulse },
  { keywords: ['education', 'school', 'literacy'], icon: GraduationCap },
  { keywords: ['work', 'employment', 'labour', 'labor'], icon: Briefcase },
  { keywords: ['housing', 'shelter', 'home'], icon: House },
  { keywords: ['food', 'nutrition', 'hunger'], icon: Apple },
  { keywords: ['water', 'sanitation'], icon: Droplets },
  { keywords: ['justice', 'fair trial', 'legal'], icon: Scale },
  { keywords: ['vote', 'election', 'political'], icon: Vote },
  { keywords: ['protection', 'security', 'safety'], icon: ShieldCheck },
]

const UPR_KEYWORD_ICONS: KeywordIcon[] = [
  { keywords: ['accept'], icon: CircleCheck },
  { keywords: ['note'], icon: FileText },
  { keywords: ['implement', 'progress'], icon: Activity },
  { keywords: ['recommendation', 'total'], icon: ClipboardList },
]

function matchKeyword(entries: KeywordIcon[], title: string): LucideIcon | null {
  const haystack = title.toLowerCase()
  for (const entry of entries) {
    if (entry.keywords.some((keyword) => haystack.includes(keyword))) {
      return entry.icon
    }
  }
  return null
}

/**
 * Vector icon for Knowledge Hub stat cards, used when no custom icon is stored.
 */
export function knowledgeStatCardIcon(
  section: 'indicators' | 'upr',
  title: string | null | undefined,
): LucideIcon {
  const safeTitle = title ?? ''
  if (section === 'upr') {
    return matchKeyword(UPR_KEYWORD_ICONS, safeTitle) ?? ClipboardList
  }
  return matchKeyword(INDICATOR_KEYWORD_ICONS, safeTitle) ?? BarChart3
}
