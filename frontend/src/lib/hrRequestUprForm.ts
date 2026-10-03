/** UPR catalog shapes returned by `/hr-request-form/upr-catalog`. */

export type HrRequestUprCycle = {
  id: number
  name: string
  sort_order: number
  is_active: boolean
}

export type HrRequestUprType = {
  id: number
  name: string
  sort_order: number
  is_active: boolean
}

export type HrRequestUprCategory = {
  id: number
  name: string
  upr_cycle_id: number | null
  upr_type_id: number | null
  sort_order: number
  is_active: boolean
}

export type HrRequestUprRecommendation = {
  id: number
  name: string
  upr_cycle_id: number
  upr_category_id: number
  sort_order: number
  is_active: boolean
}

export type HrRequestUprIndicator = {
  id: number
  indicator_text: string
  has_quantitative: boolean
  has_qualitative: boolean
  sort_order: number
  is_active: boolean
}

export type HrRequestUprEntry = {
  id: number
  upr_type_id: number
  upr_cycle_id: number
  upr_category_id: number
  indicators: HrRequestUprIndicator[]
}

export type HrRequestUprCatalog = {
  cycles: HrRequestUprCycle[]
  types: HrRequestUprType[]
  categories: HrRequestUprCategory[]
  recommendations: HrRequestUprRecommendation[]
  entries: HrRequestUprEntry[]
}

export type HrRequestUprSelection = {
  cycle_id: number
  type_id: number
  category_id: number
  recommendation_ids: number[]
  indicator_ids: number[]
}

const TYPE_PRIORITY = ['accepted', 'noted', 'others', 'supported']

export function emptyUprCatalog(): HrRequestUprCatalog {
  return { cycles: [], types: [], categories: [], recommendations: [], entries: [] }
}

export function uprTypeLabel(name: string): string {
  const t = name.trim()
  if (!t) return 'Type'
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function sortUprTypesForRadios(types: HrRequestUprType[]): HrRequestUprType[] {
  return [...types].sort((a, b) => {
    const ai = TYPE_PRIORITY.indexOf(a.name.trim().toLowerCase())
    const bi = TYPE_PRIORITY.indexOf(b.name.trim().toLowerCase())
    const aRank = ai === -1 ? 100 : ai
    const bRank = bi === -1 ? 100 : bi
    if (aRank !== bRank) return aRank - bRank
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.name.localeCompare(b.name)
  })
}

export function filterUprCategories(
  catalog: HrRequestUprCatalog,
  cycleId: number | '',
  typeId: number | '',
): HrRequestUprCategory[] {
  if (cycleId === '' || typeId === '') return []
  return catalog.categories
    .filter((c) => c.upr_cycle_id === cycleId && c.upr_type_id === typeId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

export function filterUprRecommendations(
  catalog: HrRequestUprCatalog,
  cycleId: number | '',
  categoryId: number | '',
): HrRequestUprRecommendation[] {
  if (cycleId === '' || categoryId === '') return []
  return catalog.recommendations
    .filter((r) => r.upr_cycle_id === cycleId && r.upr_category_id === categoryId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

export function filterUprIndicators(
  catalog: HrRequestUprCatalog,
  cycleId: number | '',
  typeId: number | '',
  categoryId: number | '',
): HrRequestUprIndicator[] {
  if (cycleId === '' || typeId === '' || categoryId === '') return []
  const map = new Map<number, HrRequestUprIndicator>()
  for (const entry of catalog.entries) {
    if (
      entry.upr_cycle_id !== cycleId ||
      entry.upr_type_id !== typeId ||
      entry.upr_category_id !== categoryId
    ) {
      continue
    }
    for (const ind of entry.indicators) {
      if (!map.has(ind.id)) map.set(ind.id, ind)
    }
  }
  return [...map.values()].sort(
    (a, b) => a.sort_order - b.sort_order || a.indicator_text.localeCompare(b.indicator_text),
  )
}

export function parseUprSelection(raw: unknown): HrRequestUprSelection | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const cycleId = Number(o.cycle_id)
  const typeId = Number(o.type_id)
  const categoryId = Number(o.category_id)
  if (!Number.isFinite(cycleId) || cycleId <= 0) return null
  if (!Number.isFinite(typeId) || typeId <= 0) return null
  if (!Number.isFinite(categoryId) || categoryId <= 0) return null
  const recommendationIds = Array.isArray(o.recommendation_ids)
    ? o.recommendation_ids.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : []
  const indicatorIds = Array.isArray(o.indicator_ids)
    ? o.indicator_ids.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : []
  return {
    cycle_id: cycleId,
    type_id: typeId,
    category_id: categoryId,
    recommendation_ids: recommendationIds,
    indicator_ids: indicatorIds,
  }
}
