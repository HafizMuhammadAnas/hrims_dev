/** Publication lifecycle for an HR request (not department/regional workflow). */
export type HrRequestStatus = 'draft' | 'active'
export type HrRequestType = 'loi' | 'concluding_observation' | 'other_issue'

/** Map legacy API values after deploy before migration runs, or old cached rows. */
export function coerceHrRequestStatus(raw: string | undefined | null): HrRequestStatus {
  const s = (raw ?? '').trim()
  if (s === 'active' || s === 'draft') return s
  if (s === 'completed' || s === 'in-progress') return 'active'
  return 'draft'
}

/** Draft requests are federal-only until published; edit/delete apply only while draft. */
export function hrRequestAllowsEditDelete(status: string | undefined | null): boolean {
  return coerceHrRequestStatus(status) === 'draft'
}

export type HrRequestIssueIndicator = {
  id: number
  indicator_text: string
  disaggregation: string | null
  /** Effective flags (per-indicator mapping; omitted on older payloads falls back to issue). */
  has_quantitative?: boolean
  has_qualitative?: boolean
  collects_by_year?: boolean
  /** When false with collects_by_year only (no other dimensions), one value per year. */
  collects_by_gender?: boolean
  collects_by_age?: boolean
  collects_by_location?: boolean
  collects_by_disability?: boolean
  collects_by_religion?: boolean
  collects_by_consolidated?: boolean
  collection_by_year?: Array<{
    year_id: number
    label: string
    gender_ids: number[]
    genders: { id: number; name: string }[]
    religion_ids?: number[]
    religions?: { id: number; name: string }[]
  }>
  /** Qualitative years (independent of quantitative disaggregation years). */
  qualitative_collection_by_year?: Array<{ year_id: number; label: string }>
}

export type HrRequestIssueArticle = {
  id: number
  article_name: string
  description?: string | null
  relevant_paragraph: string | null
}

export type HrRequestIssueDetail = {
  id: number
  entry_kind?: 'issue' | 'recommendation'
  issue_title: string | null
  description?: string | null
  has_quantitative: boolean
  has_qualitative: boolean
  category: { id: number; name: string } | null
  articles: HrRequestIssueArticle[]
  indicators: HrRequestIssueIndicator[]
}

export type HrRequestAttachmentRow = {
  id: number
  original_name: string
  mime: string | null
  size: number | null
  /** Public disk: `/storage/...`. Legacy local disk: authenticated API path. */
  url?: string | null
}

export type HrRequestIndicatorResponseRow = {
  issue_indicator_id: number
  quantitative_value: number | null
  qualitative_text: string | null
  quantitative_year_ids?: number[]
  qualitative_year_ids?: number[]
}

export interface HrRequestRow {
  id: string
  title: string
  conv: string
  convention_id?: number | null
  issue_id?: number | null
  request_type?: HrRequestType | null
  other_issue_text?: string | null
  date: string
  status: HrRequestStatus
  details?: string | null
  /** ISO timestamps from API — use for newest-first table ordering. */
  created_at?: string | null
  updated_at?: string | null
  attachment_file_name?: string | null
  region_id?: number | null
  category_id?: string | null
  subcategory_id?: string | null
  indicator_id?: string | null
  recommendation_id?: string | null
  sdg?: string | null
  sdg_indicator?: string | null
  upr?: string | null
  upr_indicator?: string | null
  issue_cards?: unknown
  region?: { id: number; name: string; slug: string } | null
  region_name?: string | null
  regions?: { id: number; name: string; slug: string }[]
  departments?: { id: number; code: string; name: string }[]
  convention?: { id: number; code: string; name: string } | null
  issue?: HrRequestIssueDetail | null
  attachments?: HrRequestAttachmentRow[]
  indicator_responses?: HrRequestIndicatorResponseRow[]
}
