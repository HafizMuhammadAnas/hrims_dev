export type CollectionReligionRow = {
  id: number
  name: string
  sort_order: number
}

export async function fetchCollectionReligions(): Promise<CollectionReligionRow[]> {
  const res = await fetch('/api/v1/collection-religions', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Failed to load religions (${res.status})`)
  const json = (await res.json()) as { data: CollectionReligionRow[] }
  return json.data
}
