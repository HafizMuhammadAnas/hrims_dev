const SMALL_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'for',
  'in',
  'on',
  'at',
  'to',
  'of',
  'by',
  'as',
])

/** Seven core human-rights convention codes — always shown in full capitals. */
const CONVENTION_ACRONYMS = new Set([
  'ICERD',
  'ICCPR',
  'ICESCR',
  'CEDAW',
  'CAT',
  'CRC',
  'CRPD',
])

/** Title-case display labels from API or slug text (e.g. SDG goal names). */
export function toDisplayTitleCase(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return trimmed

  return trimmed
    .split(/\s+/)
    .map((word, index, words) => {
      const parts = word.split('-')
      const lowerParts = parts.map((part) => part.toLowerCase())
      const isSmall =
        index > 0 && index < words.length - 1 && lowerParts.length === 1 && SMALL_WORDS.has(lowerParts[0])

      if (isSmall) return lowerParts[0]

      return lowerParts
        .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
        .join('-')
    })
    .join(' ')
}

/** Knowledge Hub card/detail titles: convention acronyms stay uppercase; other labels use title case. */
export function formatKnowledgeHubTitle(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return trimmed

  const acronym = trimmed.toUpperCase()
  if (CONVENTION_ACRONYMS.has(acronym)) return acronym

  return toDisplayTitleCase(trimmed)
}
