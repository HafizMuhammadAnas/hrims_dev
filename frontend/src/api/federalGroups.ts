export interface FederalGroupRow {
  id: string
  title: string
  conv: string
  date: string
  status: string
  linked_requests: string[]
}

export async function fetchFederalGroups(): Promise<FederalGroupRow[]> {
  const res = await fetch('/api/v1/federal-groups', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Failed to load federal groups (${res.status})`)
  const json = (await res.json()) as { data: FederalGroupRow[] }
  return json.data
}
