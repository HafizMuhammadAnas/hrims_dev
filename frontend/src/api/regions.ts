export interface RegionRow {
  id: number
  name: string
  slug: string
}

export async function fetchRegions(): Promise<RegionRow[]> {
  const res = await fetch('/api/v1/regions', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Failed to load regions (${res.status})`)
  const json = (await res.json()) as { data: RegionRow[] }
  return json.data
}
