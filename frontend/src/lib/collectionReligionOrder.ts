import type { CollectionReligionRow } from '../api/collectionReligions'

/**
 * Preferred religion column order for department entry/view matrices.
 * Muslim → Christianity → Hindu → Sikh → Ahmadiyya → Others (then any others).
 */
const RELIGION_SEQUENCE: Array<{ match: RegExp; rank: number; label: string }> = [
  { match: /^muslims?$/i, rank: 1, label: 'Muslim' },
  { match: /^christian(s|ity)?$/i, rank: 2, label: 'Christianity' },
  { match: /^hindus?$/i, rank: 3, label: 'Hindu' },
  { match: /^sikhs?$/i, rank: 4, label: 'Sikh' },
  { match: /^ahmadi(s|yya)?$/i, rank: 5, label: 'Ahmadiyya' },
  { match: /^others?$/i, rank: 6, label: 'Others' },
]

function religionSequenceEntry(name: string) {
  const trimmed = name.trim()
  for (const entry of RELIGION_SEQUENCE) {
    if (entry.match.test(trimmed)) return entry
  }
  return null
}

function religionSequenceRank(name: string): number {
  return religionSequenceEntry(name)?.rank ?? 1000
}

/** Display label for religion columns (preferred wording when matched). */
export function religionDisplayLabel(name: string): string {
  return religionSequenceEntry(name)?.label ?? name
}

/** Stable sort for religion columns on forms and read-only views. */
export function sortReligionsForDisplay<T extends { name: string; sort_order?: number; id?: number }>(
  religions: T[],
): T[] {
  return [...religions].sort((a, b) => {
    const ra = religionSequenceRank(a.name)
    const rb = religionSequenceRank(b.name)
    if (ra !== rb) return ra - rb
    const sa = a.sort_order ?? 0
    const sb = b.sort_order ?? 0
    if (sa !== sb) return sa - sb
    const byName = a.name.localeCompare(b.name)
    if (byName !== 0) return byName
    return (a.id ?? 0) - (b.id ?? 0)
  })
}

export type { CollectionReligionRow }
