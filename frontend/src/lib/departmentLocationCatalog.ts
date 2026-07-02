import type { DistrictRow } from '../api/districts'
import type { RegionRow } from '../api/regions'

/** Limit region/district matrix columns to the department task's assigned region(s). */
export function scopeLocationCatalogToRegions(
  regions: RegionRow[],
  districts: DistrictRow[],
  regionIds: number[],
): { regions: RegionRow[]; districts: DistrictRow[] } {
  const allowed = [...new Set(regionIds.filter((id) => id > 0))]
  if (allowed.length === 0) {
    return { regions, districts }
  }
  const idSet = new Set(allowed)
  return {
    regions: regions.filter((r) => idSet.has(r.id)),
    districts: districts.filter((d) => idSet.has(d.region_id)),
  }
}
