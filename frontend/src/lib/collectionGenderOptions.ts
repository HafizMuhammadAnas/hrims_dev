const HIDDEN_GENDER_NAMES = new Set([
  'juvenile male',
  'juvenile female',
  'male juvenile',
  'female juvenile',
])

/** Genders hidden from indicator disaggregation pickers (still manageable in admin catalog). */
export function isSelectableCollectionGender(name: string): boolean {
  return !HIDDEN_GENDER_NAMES.has(name.trim().toLowerCase())
}

export function filterSelectableCollectionGenders<T extends { name: string }>(genders: T[]): T[] {
  return genders.filter((g) => isSelectableCollectionGender(g.name))
}
