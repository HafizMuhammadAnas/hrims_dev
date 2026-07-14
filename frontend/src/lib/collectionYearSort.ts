/** Compare year labels by numeric value (2019 before 2022), not by id/sort_order. */
export function compareCollectionYearLabels(a: string, b: string): number {
  const na = Number(String(a).trim())
  const nb = Number(String(b).trim())
  if (Number.isFinite(na) && Number.isFinite(nb) && String(na) === String(a).trim() && String(nb) === String(b).trim()) {
    return na - nb
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

/** Sort year catalog rows / year options by label value ascending. */
export function sortCollectionYearsByLabelValue<T extends { label: string }>(years: readonly T[]): T[] {
  return [...years].sort((a, b) => compareCollectionYearLabels(a.label, b.label))
}

/** Sort plain year label strings by value ascending. */
export function sortCollectionYearLabels(labels: readonly string[]): string[] {
  return [...labels].sort(compareCollectionYearLabels)
}
