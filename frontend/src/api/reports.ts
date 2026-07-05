import { ApiError, parseApiErrorResponse } from './apiError'

export type ReportLookupConvention = {
  id: number
  code: string
  name: string
}

export type ReportLookupCategory = {
  id: number
  name: string
}

export type ReportLookupArticle = {
  id: number
  convention_id: number
  article_name: string
}

export type ReportLookupIndicator = {
  id: number
  issue_id: number
  indicator_text: string
}

export type ReportIssueArticleLink = {
  issue_id: number
  article_id: number
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new ApiError(await parseApiErrorResponse(res))
  return (await res.json()) as T
}

function reportQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') qs.set(key, value)
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export async function fetchReportConventions(): Promise<ReportLookupConvention[]> {
  const json = await getJson<{ data: ReportLookupConvention[] }>('/api/v1/report-form/conventions')
  return json.data
}

export async function fetchReportIssueCategories(): Promise<ReportLookupCategory[]> {
  const json = await getJson<{ data: ReportLookupCategory[] }>('/api/v1/report-form/issue-categories')
  return json.data
}

export async function fetchReportArticles(conventionId?: string): Promise<ReportLookupArticle[]> {
  const json = await getJson<{ data: ReportLookupArticle[] }>(
    `/api/v1/report-form/articles${reportQuery({ convention_id: conventionId })}`,
  )
  return json.data
}

export async function fetchReportIndicators(filters: {
  conventionId?: string
  articleId?: string
  entryKind?: string
  categoryId?: string
}): Promise<ReportLookupIndicator[]> {
  const json = await getJson<{ data: ReportLookupIndicator[] }>(
    `/api/v1/report-form/indicators${reportQuery({
      convention_id: filters.conventionId,
      article_id: filters.articleId,
      entry_kind: filters.entryKind,
      category_id: filters.categoryId,
    })}`,
  )
  return json.data
}

export async function fetchReportIssueArticleLinks(conventionId?: string): Promise<ReportIssueArticleLink[]> {
  const json = await getJson<{ data: ReportIssueArticleLink[] }>(
    `/api/v1/report-form/issue-article-links${reportQuery({ convention_id: conventionId })}`,
  )
  return json.data
}
