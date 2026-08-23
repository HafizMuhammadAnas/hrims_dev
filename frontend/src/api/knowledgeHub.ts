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
  repositories?: import('../lib/conventionKnowledgeContent').ConventionRepositoryCycle[] | null
  optional_protocol_body?: string | null
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

export type KnowledgeRelatedIssue = {
  id: number
  entry_kind: 'issue' | 'recommendation'
  issue_title: string | null
  description: string | null
}

export type KnowledgeConventionArticle = {
  id: number
  convention_id: number
  article_name: string
  description: string | null
  related_loi?: KnowledgeRelatedIssue[]
  related_concluding_observations?: KnowledgeRelatedIssue[]
}

export type KnowledgeConventionIssueRow = {
  id: number
  convention_id: number
  category_id: number
  entry_kind: 'issue' | 'recommendation'
  issue_title: string | null
  description: string | null
  is_active: boolean
  category: { id: number; name: string } | null
  articles: Array<{
    id: number
    article_name: string
    description?: string | null
    relevant_paragraph: string | null
  }>
}

export type KnowledgeConventionIssueDetail = KnowledgeConventionIssueRow & {
  has_quantitative: boolean
  has_qualitative: boolean
  convention: { id: number; code: string; name: string } | null
  indicators: Array<{
    id: number
    indicator_text: string
    has_quantitative?: boolean
    has_qualitative?: boolean
    collects_by_year?: boolean
    collects_by_gender?: boolean
    collects_by_age?: boolean
    collects_by_location?: boolean
    collects_by_disability?: boolean
    collects_by_religion?: boolean
    collects_by_consolidated?: boolean
    disaggregation?: string | null
    collection_by_year?: Array<{ year_id: number; label: string }>
    qualitative_collection_by_year?: Array<{ year_id: number; label: string }>
  }>
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

export async function fetchKnowledgeConventionArticles(
  conventionId: number,
): Promise<KnowledgeConventionArticle[]> {
  const res = await fetch(`/api/v1/knowledge/conventions/${conventionId}/articles`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  return ((await res.json()) as { data: KnowledgeConventionArticle[] }).data
}

export async function fetchKnowledgeConventionIssues(
  conventionId: number,
  entryKind: 'issue' | 'recommendation',
): Promise<KnowledgeConventionIssueRow[]> {
  const q = new URLSearchParams({ entry_kind: entryKind })
  const res = await fetch(`/api/v1/knowledge/conventions/${conventionId}/issues?${q}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  return ((await res.json()) as { data: KnowledgeConventionIssueRow[] }).data
}

export async function fetchKnowledgeIssue(id: number): Promise<KnowledgeConventionIssueDetail> {
  const res = await fetch(`/api/v1/knowledge/issues/${id}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  return ((await res.json()) as { data: KnowledgeConventionIssueDetail }).data
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
