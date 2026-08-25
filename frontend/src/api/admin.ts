import { apiJsonHeaders, ensureCsrfCookie } from './client'
import { ApiError, parseApiErrorResponse } from './apiError'

async function throwIfNotOk(res: Response): Promise<void> {
  if (!res.ok) throw new ApiError(await parseApiErrorResponse(res))
}

export type AdminRegion = {
  id: number
  name: string
  slug: string
  created_at?: string | null
  updated_at?: string | null
}
export type AdminDistrict = {
  id: number
  region_id: number
  region_name: string | null
  name: string
  slug: string | null
  created_at?: string | null
  updated_at?: string | null
}
export type AdminCatalogDepartment = {
  id: number
  region_ids: number[]
  regions: Array<{ id: number; name: string; slug: string }>
  code: string | null
  name: string
  type: string | null
  created_at?: string | null
  updated_at?: string | null
}
export type AdminConvention = {
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
  is_active: boolean
}
export type AdminConventionComponent = {
  id: number
  convention_id: number
  parent_id: number | null
  type: string
  code: string
  title: string
  body: string | null
  sort_order: number
}
export type AdminSdgNode = {
  id: number
  parent_id: number | null
  node_type: string
  code: string
  title: string
  knowledge_icon: string | null
  summary: string | null
  body: string | null
  stat_1_value: string | null
  stat_1_label: string | null
  stat_2_value: string | null
  stat_2_label: string | null
  goal_number: number | null
  sort_order: number
}
export type AdminUpr = {
  id: number
  session_label: string
  code: string
  title: string
  body: string | null
  sort_order: number
}
export type AdminKnowledgeCard = {
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

export type AdminIssueCategory = {
  id: number
  convention_id: number
  convention?: { id: number; code: string; name: string } | null
  name: string
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export type AdminArticleRow = {
  id: number
  convention_id: number
  convention?: { id: number; code: string; name: string } | null
  article_name: string
  description: string | null
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export type AdminCollectionYear = {
  id: number
  label: string
  sort_order: number
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export type AdminCollectionGender = {
  id: number
  name: string
  sort_order: number
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export type AdminCollectionReligion = {
  id: number
  name: string
  sort_order: number
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export type AdminIssueIndicator = {
  id: number
  sort_order?: number
  is_active?: boolean
  indicator_text: string
  disaggregation: string | null
  has_quantitative: boolean
  has_qualitative: boolean
  collects_by_year: boolean
  collects_by_gender: boolean
  collects_by_age: boolean
  collects_by_location: boolean
  collects_by_disability: boolean
  collects_by_religion: boolean
  collects_by_consolidated: boolean
  collection_by_year: AdminIssueIndicatorYearRow[]
  /** Years for qualitative data gathering (separate from quantitative disaggregation years). */
  qualitative_collection_by_year?: Array<{ year_id: number; label: string }>
}

export type AdminIssueIndicatorYearRow = {
  year_id: number
  label: string
  gender_ids: number[]
  genders: { id: number; name: string }[]
  religion_ids: number[]
  religions: { id: number; name: string }[]
}

export type AdminIssueArticleRow = {
  id: number
  article_name: string
  description?: string | null
  relevant_paragraph: string | null
}

export type AdminIssueArticlePayload = {
  article_id: number
  relevant_paragraph?: string | null
}

export type IssueEntryKind = 'issue' | 'recommendation'

export type AdminIssue = {
  id: number
  convention_id: number
  category_id: number
  entry_kind: IssueEntryKind
  issue_title: string | null
  description: string | null
  has_quantitative: boolean
  has_qualitative: boolean
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
  convention: { id: number; code: string; name: string } | null
  category: { id: number; name: string } | null
  articles: AdminIssueArticleRow[]
  article_ids: number[]
  indicators: AdminIssueIndicator[]
}

async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api/v1/admin${path}`, { credentials: 'include', headers: { Accept: 'application/json' } })
  await throwIfNotOk(res)
  return (await res.json()) as T
}

async function adminSend(method: string, path: string, body?: unknown): Promise<Response> {
  await ensureCsrfCookie()
  return fetch(`/api/v1/admin${path}`, {
    method,
    credentials: 'include',
    headers: apiJsonHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

export async function adminFetchRegionsPublic(): Promise<AdminRegion[]> {
  const res = await fetch('/api/v1/regions', { credentials: 'include', headers: { Accept: 'application/json' } })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: AdminRegion[] }
  return json.data
}

export async function adminCreateRegion(body: { name: string; slug: string }): Promise<AdminRegion> {
  const res = await adminSend('POST', '/regions', body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminRegion
}

export async function adminDeleteRegion(id: number): Promise<void> {
  const res = await adminSend('DELETE', `/regions/${id}`)
  await throwIfNotOk(res)
}

export async function adminUpdateRegion(
  id: number,
  body: { name?: string; slug?: string },
): Promise<AdminRegion> {
  const res = await adminSend('PATCH', `/regions/${id}`, body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminRegion
}

export async function adminFetchDistricts(regionId?: number): Promise<AdminDistrict[]> {
  const q = regionId != null ? `?region_id=${regionId}` : ''
  const json = await adminGet<{ data: AdminDistrict[] }>(`/districts${q}`)
  return json.data
}

export async function adminCreateDistrict(body: {
  region_id: number
  name: string
  slug?: string | null
}): Promise<AdminDistrict> {
  const res = await adminSend('POST', '/districts', body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminDistrict
}

export async function adminDeleteDistrict(id: number): Promise<void> {
  const res = await adminSend('DELETE', `/districts/${id}`)
  await throwIfNotOk(res)
}

export async function adminUpdateDistrict(
  id: number,
  body: { region_id?: number; name?: string; slug?: string | null },
): Promise<AdminDistrict> {
  const res = await adminSend('PATCH', `/districts/${id}`, body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminDistrict
}

export async function adminFetchCatalogDepartments(): Promise<AdminCatalogDepartment[]> {
  const json = await adminGet<{ data: AdminCatalogDepartment[] }>('/catalog/departments')
  return json.data
}

export async function adminCreateDepartment(body: {
  region_ids: number[]
  code?: string | null
  name: string
  type?: string | null
}): Promise<AdminCatalogDepartment> {
  const res = await adminSend('POST', '/catalog/departments', body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminCatalogDepartment
}

export async function adminUpdateDepartment(
  id: number,
  body: { region_ids?: number[]; code?: string | null; name?: string; type?: string | null },
): Promise<AdminCatalogDepartment> {
  const res = await adminSend('PATCH', `/catalog/departments/${id}`, body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminCatalogDepartment
}

export async function adminDeleteDepartment(id: number): Promise<void> {
  const res = await adminSend('DELETE', `/catalog/departments/${id}`)
  await throwIfNotOk(res)
}

export async function adminFetchConventions(): Promise<AdminConvention[]> {
  const json = await adminGet<{ data: AdminConvention[] }>('/conventions')
  return json.data
}

export async function adminCreateConvention(body: {
  code: string
  name: string
  knowledge_icon?: string | null
  knowledge_adopted?: string | null
  knowledge_ratified?: string | null
  knowledge_articles?: string | null
  knowledge_implementation?: string | null
  description?: string | null
  repositories?: import('../lib/conventionKnowledgeContent').ConventionRepositoryCycle[]
  optional_protocol_body?: string | null
  sort_order?: number
  is_active?: boolean
}): Promise<AdminConvention> {
  const res = await adminSend('POST', '/conventions', body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminConvention
}

export async function adminDeleteConvention(id: number): Promise<void> {
  const res = await adminSend('DELETE', `/conventions/${id}`)
  await throwIfNotOk(res)
}

export async function adminUpdateConvention(
  id: number,
  body: Partial<{
    code: string
    name: string
    knowledge_icon: string | null
    knowledge_adopted: string | null
    knowledge_ratified: string | null
    knowledge_articles: string | null
    knowledge_implementation: string | null
    description: string | null
    repositories: import('../lib/conventionKnowledgeContent').ConventionRepositoryCycle[]
    optional_protocol_body: string | null
    sort_order: number
    is_active: boolean
  }>,
): Promise<AdminConvention> {
  const res = await adminSend('PATCH', `/conventions/${id}`, body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminConvention
}

export async function adminFetchConventionComponents(conventionId: number): Promise<AdminConventionComponent[]> {
  const json = await adminGet<{ data: AdminConventionComponent[] }>(`/conventions/${conventionId}/components`)
  return json.data
}

export async function adminCreateConventionComponent(
  conventionId: number,
  body: { type: string; code: string; title: string; body?: string | null; parent_id?: number | null; sort_order?: number },
): Promise<AdminConventionComponent> {
  const res = await adminSend('POST', `/conventions/${conventionId}/components`, body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminConventionComponent
}

export async function adminDeleteConventionComponent(id: number): Promise<void> {
  const res = await adminSend('DELETE', `/convention-components/${id}`)
  await throwIfNotOk(res)
}

export async function adminUpdateConventionComponent(
  id: number,
  body: Partial<{
    type: string
    code: string
    title: string
    body: string | null
    parent_id: number | null
    sort_order: number
  }>,
): Promise<AdminConventionComponent> {
  const res = await adminSend('PATCH', `/convention-components/${id}`, body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminConventionComponent
}

export async function adminFetchSdgNodes(): Promise<AdminSdgNode[]> {
  const json = await adminGet<{ data: AdminSdgNode[] }>('/sdg-nodes')
  return json.data
}

export async function adminCreateSdgNode(body: {
  node_type: 'goal' | 'target' | 'indicator'
  code: string
  title: string
  parent_id?: number | null
  goal_number?: number | null
  sort_order?: number
}): Promise<AdminSdgNode> {
  const res = await adminSend('POST', '/sdg-nodes', body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminSdgNode
}

export async function adminDeleteSdgNode(id: number): Promise<void> {
  const res = await adminSend('DELETE', `/sdg-nodes/${id}`)
  await throwIfNotOk(res)
}

export async function adminUpdateSdgNode(
  id: number,
  body: Partial<{
    parent_id: number | null
    node_type: 'goal' | 'target' | 'indicator'
    code: string
    title: string
    knowledge_icon: string | null
    summary: string | null
    body: string | null
    stat_1_value: string | null
    stat_1_label: string | null
    stat_2_value: string | null
    stat_2_label: string | null
    goal_number: number | null
    sort_order: number
  }>,
): Promise<AdminSdgNode> {
  const res = await adminSend('PATCH', `/sdg-nodes/${id}`, body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminSdgNode
}

export async function adminFetchUpr(): Promise<AdminUpr[]> {
  const json = await adminGet<{ data: AdminUpr[] }>('/upr-recommendations')
  return json.data
}

export async function adminCreateUpr(body: {
  session_label: string
  code: string
  title: string
  body?: string | null
  sort_order?: number
}): Promise<AdminUpr> {
  const res = await adminSend('POST', '/upr-recommendations', body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminUpr
}

export async function adminDeleteUpr(id: number): Promise<void> {
  const res = await adminSend('DELETE', `/upr-recommendations/${id}`)
  await throwIfNotOk(res)
}

export async function adminUpdateUpr(
  id: number,
  body: Partial<{
    session_label: string
    code: string
    title: string
    body: string | null
    sort_order: number
  }>,
): Promise<AdminUpr> {
  const res = await adminSend('PATCH', `/upr-recommendations/${id}`, body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminUpr
}

export async function adminFetchKnowledgeCards(section: 'indicators' | 'upr'): Promise<AdminKnowledgeCard[]> {
  const json = await adminGet<{ data: AdminKnowledgeCard[] }>(`/knowledge-cards?section=${section}`)
  return json.data
}

export async function adminCreateKnowledgeCard(body: {
  section: 'indicators' | 'upr'
  icon?: string
  title: string
  summary?: string | null
  stat_1_value?: string | null
  stat_1_label?: string | null
  stat_2_value?: string | null
  stat_2_label?: string | null
  body?: string | null
  sort_order?: number
}): Promise<AdminKnowledgeCard> {
  const res = await adminSend('POST', '/knowledge-cards', body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminKnowledgeCard
}

export async function adminUpdateKnowledgeCard(
  id: number,
  body: Partial<{
    icon: string
    title: string
    summary: string | null
    stat_1_value: string | null
    stat_1_label: string | null
    stat_2_value: string | null
    stat_2_label: string | null
    body: string | null
    sort_order: number
  }>,
): Promise<AdminKnowledgeCard> {
  const res = await adminSend('PATCH', `/knowledge-cards/${id}`, body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminKnowledgeCard
}

export async function adminDeleteKnowledgeCard(id: number): Promise<void> {
  const res = await adminSend('DELETE', `/knowledge-cards/${id}`)
  await throwIfNotOk(res)
}

export async function adminFetchIssueCategories(conventionId?: number): Promise<AdminIssueCategory[]> {
  const qs = conventionId != null ? `?convention_id=${encodeURIComponent(String(conventionId))}` : ''
  const json = await adminGet<{ data: AdminIssueCategory[] }>(`/issue-categories${qs}`)
  return json.data
}

export async function adminCreateIssueCategory(body: {
  convention_id: number
  name: string
}): Promise<AdminIssueCategory> {
  const res = await adminSend('POST', '/issue-categories', body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminIssueCategory
}

export async function adminUpdateIssueCategory(
  id: number,
  body: { convention_id?: number; name?: string; is_active?: boolean },
): Promise<AdminIssueCategory> {
  const res = await adminSend('PATCH', `/issue-categories/${id}`, body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminIssueCategory
}

export async function adminSetIssueCategoryActive(id: number, is_active: boolean): Promise<AdminIssueCategory> {
  return adminUpdateIssueCategory(id, { is_active })
}

export async function adminFetchArticles(conventionId?: number): Promise<AdminArticleRow[]> {
  const qs = conventionId != null ? `?convention_id=${encodeURIComponent(String(conventionId))}` : ''
  const json = await adminGet<{ data: AdminArticleRow[] }>(`/articles${qs}`)
  return json.data
}

export async function adminCreateArticle(body: {
  convention_id: number
  article_name: string
  description?: string | null
}): Promise<AdminArticleRow> {
  const res = await adminSend('POST', '/articles', body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminArticleRow
}

export async function adminUpdateArticle(
  id: number,
  body: {
    convention_id?: number
    article_name?: string
    description?: string | null
    is_active?: boolean
  },
): Promise<AdminArticleRow> {
  const res = await adminSend('PATCH', `/articles/${id}`, body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminArticleRow
}

export async function adminSetArticleActive(id: number, is_active: boolean): Promise<AdminArticleRow> {
  return adminUpdateArticle(id, { is_active })
}

export async function adminFetchCollectionYears(): Promise<AdminCollectionYear[]> {
  const json = await adminGet<{ data: AdminCollectionYear[] }>('/collection-years')
  return json.data
}

export async function adminCreateCollectionYear(body: { label: string }): Promise<AdminCollectionYear> {
  const res = await adminSend('POST', '/collection-years', body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminCollectionYear
}

export async function adminUpdateCollectionYear(
  id: number,
  body: { label?: string; is_active?: boolean },
): Promise<AdminCollectionYear> {
  const res = await adminSend('PATCH', `/collection-years/${id}`, body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminCollectionYear
}

export async function adminSetCollectionYearActive(id: number, is_active: boolean): Promise<AdminCollectionYear> {
  return adminUpdateCollectionYear(id, { is_active })
}

export async function adminFetchCollectionGenders(): Promise<AdminCollectionGender[]> {
  const json = await adminGet<{ data: AdminCollectionGender[] }>('/collection-genders')
  return json.data
}

export async function adminCreateCollectionGender(body: { name: string }): Promise<AdminCollectionGender> {
  const res = await adminSend('POST', '/collection-genders', body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminCollectionGender
}

export async function adminUpdateCollectionGender(
  id: number,
  body: { name?: string; is_active?: boolean },
): Promise<AdminCollectionGender> {
  const res = await adminSend('PATCH', `/collection-genders/${id}`, body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminCollectionGender
}

export async function adminSetCollectionGenderActive(id: number, is_active: boolean): Promise<AdminCollectionGender> {
  return adminUpdateCollectionGender(id, { is_active })
}

export async function adminFetchCollectionReligions(): Promise<AdminCollectionReligion[]> {
  const json = await adminGet<{ data: AdminCollectionReligion[] }>('/collection-religions')
  return json.data
}

export async function adminCreateCollectionReligion(body: { name: string }): Promise<AdminCollectionReligion> {
  const res = await adminSend('POST', '/collection-religions', body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminCollectionReligion
}

export async function adminUpdateCollectionReligion(
  id: number,
  body: { name?: string; is_active?: boolean },
): Promise<AdminCollectionReligion> {
  const res = await adminSend('PATCH', `/collection-religions/${id}`, body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminCollectionReligion
}

export async function adminSetCollectionReligionActive(
  id: number,
  is_active: boolean,
): Promise<AdminCollectionReligion> {
  return adminUpdateCollectionReligion(id, { is_active })
}

export async function adminFetchIssues(): Promise<AdminIssue[]> {
  const json = await adminGet<{ data: AdminIssue[] }>('/issues')
  return json.data
}

export async function adminFetchIssue(id: number): Promise<AdminIssue> {
  const json = await adminGet<{ data: AdminIssue }>(`/issues/${id}`)
  return json.data
}

export type AdminIssuePayload = {
  convention_id: number
  category_id: number
  entry_kind: IssueEntryKind
  issue_title: string | null
  description?: string | null
  has_quantitative: boolean
  has_qualitative: boolean
  articles: AdminIssueArticlePayload[]
  indicators?: Array<{
    /** Stable DB id — required on update/reorder so existing requests keep their links. */
    id?: number
    is_active?: boolean
    indicator_text: string
    disaggregation?: string | null
    has_quantitative?: boolean
    has_qualitative?: boolean
    collects_by_year?: boolean
    collects_by_gender?: boolean
    collects_by_age?: boolean
    collects_by_location?: boolean
    collects_by_disability?: boolean
    collects_by_religion?: boolean
    collects_by_consolidated?: boolean
    collection_by_year?: Array<{
      collection_year_id: number
      collection_gender_ids: number[]
      collection_religion_ids?: number[]
    }>
    qualitative_collection_by_year?: Array<{ collection_year_id: number }>
  }>
}

export async function adminCreateIssue(body: AdminIssuePayload): Promise<AdminIssue> {
  const res = await adminSend('POST', '/issues', body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminIssue
}

export async function adminUpdateIssue(
  id: number,
  body: Partial<AdminIssuePayload> & { is_active?: boolean },
): Promise<AdminIssue> {
  // POST: FortiGate in front of hrims.mohr.gov.pk blocks HTTP PATCH (Attack ID 20000001).
  const res = await adminSend('POST', `/issues/${id}/update`, body)
  await throwIfNotOk(res)
  return (await res.json()).data as AdminIssue
}

/** Drag-and-drop only: updates sort_order, never recreates indicator rows / ids. */
export async function adminReorderIssueIndicators(
  issueId: number,
  orderedIds: number[],
): Promise<AdminIssue> {
  const res = await adminSend('POST', `/issues/${issueId}/indicators/reorder`, {
    ordered_ids: orderedIds,
  })
  await throwIfNotOk(res)
  return (await res.json()).data as AdminIssue
}

/** Activate or deactivate an indicator without deleting it. */
export async function adminSetIssueIndicatorActive(
  issueId: number,
  indicatorId: number,
  is_active: boolean,
): Promise<AdminIssue> {
  const res = await adminSend('POST', `/issues/${issueId}/indicators/${indicatorId}/active`, {
    is_active,
  })
  await throwIfNotOk(res)
  return (await res.json()).data as AdminIssue
}

export async function adminSetIssueActive(id: number, is_active: boolean): Promise<AdminIssue> {
  return adminUpdateIssue(id, { is_active })
}

export async function adminDeleteIssue(id: number): Promise<void> {
  const res = await adminSend('DELETE', `/issues/${id}`)
  await throwIfNotOk(res)
}

export type AdminGovernanceDefaultChart = {
  id: number
  sort_order: number
  kind: 'trend' | 'comparison' | 'dimension_totals'
  title: string
  shape: 'line' | 'bar' | 'area' | 'step' | 'pie' | 'composed'
  series_a_key: string
  series_a_label: string
  series_a_indicator_id: number | null
  series_a_indicator_text: string | null
  series_b_key: string | null
  series_b_label: string | null
  series_b_indicator_id: number | null
  series_b_indicator_text: string | null
  is_active: boolean
}

export type AdminGovernanceDefaultChartPayload = {
  kind: 'trend' | 'comparison' | 'dimension_totals'
  title: string
  shape: 'line' | 'bar' | 'area' | 'step' | 'pie' | 'composed'
  series_a_key?: string | null
  series_a_label: string
  series_a_indicator_id?: number | null
  series_b_key?: string | null
  series_b_label?: string | null
  series_b_indicator_id?: number | null
  is_active?: boolean
}

export async function adminFetchGovernanceDefaultCharts(): Promise<AdminGovernanceDefaultChart[]> {
  const json = await adminGet<{ data: AdminGovernanceDefaultChart[] }>('/governance/default-charts')
  return json.data
}

export async function adminSyncGovernanceDefaultCharts(
  charts: AdminGovernanceDefaultChartPayload[],
): Promise<AdminGovernanceDefaultChart[]> {
  const res = await adminSend('PUT', '/governance/default-charts', { charts })
  await throwIfNotOk(res)
  return ((await res.json()) as { data: AdminGovernanceDefaultChart[] }).data
}
