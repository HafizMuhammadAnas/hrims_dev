import { ApiError, parseApiErrorResponse } from './apiError'

async function throwIfNotOk(res: Response): Promise<void> {
  if (!res.ok) throw new ApiError(await parseApiErrorResponse(res))
}

export type KnowledgeConventionListItem = {
  id: number
  code: string
  name: string
  knowledge_icon: string | null
  knowledge_adopted: string | null
  knowledge_ratified: string | null
  knowledge_articles: string | null
  knowledge_implementation: string | null
  description: string | null
  sort_order: number
}

export type KnowledgeConventionComponent = {
  id: number
  type: string
  code: string
  title: string
  body: string | null
  sort_order: number
}

export type KnowledgeConventionDetail = KnowledgeConventionListItem & {
  components: KnowledgeConventionComponent[]
}

export type KnowledgeSdgGoal = {
  id: number
  code: string
  title: string
  goal_number: number | null
  knowledge_icon: string | null
  summary: string | null
  body: string | null
  stat_1_value: string | null
  stat_1_label: string | null
  stat_2_value: string | null
  stat_2_label: string | null
  sort_order: number
}

export type KnowledgeStatCard = {
  id: number
  section: string
  icon: string
  title: string
  summary: string | null
  stat_1_value: string | null
  stat_1_label: string | null
  stat_2_value: string | null
  stat_2_label: string | null
  body: string | null
  sort_order: number
}

export async function fetchKnowledgeConventions(): Promise<KnowledgeConventionListItem[]> {
  const res = await fetch('/api/v1/knowledge/conventions', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  return ((await res.json()) as { data: KnowledgeConventionListItem[] }).data
}

export async function fetchKnowledgeConvention(id: number): Promise<KnowledgeConventionDetail> {
  const res = await fetch(`/api/v1/knowledge/conventions/${id}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  return ((await res.json()) as { data: KnowledgeConventionDetail }).data
}

export async function fetchKnowledgeSdgGoals(): Promise<KnowledgeSdgGoal[]> {
  const res = await fetch('/api/v1/knowledge/sdg-goals', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  return ((await res.json()) as { data: KnowledgeSdgGoal[] }).data
}

export async function fetchKnowledgeIndicators(): Promise<KnowledgeStatCard[]> {
  const res = await fetch('/api/v1/knowledge/indicators', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  return ((await res.json()) as { data: KnowledgeStatCard[] }).data
}

export async function fetchKnowledgeUprHighlights(): Promise<KnowledgeStatCard[]> {
  const res = await fetch('/api/v1/knowledge/upr-highlights', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  return ((await res.json()) as { data: KnowledgeStatCard[] }).data
}
