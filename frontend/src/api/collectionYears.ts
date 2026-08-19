export type CollectionYearRow = {
  id: number
  label: string
  sort_order: number
}

export async function fetchCollectionYears(): Promise<CollectionYearRow[]> {
  const res = await fetch('/api/v1/collection-years', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Failed to load collection years (${res.status})`)
  const json = (await res.json()) as { data: CollectionYearRow[] }
  return Array.isArray(json.data) ? json.data : []
}
