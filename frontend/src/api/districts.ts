export interface DistrictRow {
  id: number
  region_id: number
  region_name: string | null
  name: string
  slug: string | null
}

export async function fetchDistricts(regionId?: number): Promise<DistrictRow[]> {
  const qs = regionId ? `?region_id=${regionId}` : ''
  const res = await fetch(`/api/v1/districts${qs}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Failed to load districts (${res.status})`)
  const json = (await res.json()) as { data: DistrictRow[] }
  return json.data
}
