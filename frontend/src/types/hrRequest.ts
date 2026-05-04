export type HrRequestStatus = 'pending' | 'in-progress' | 'completed' | 'overdue'

export type HrRequestIssueIndicator = {
  id: number
  indicator_text: string
  disaggregation: string | null
}

export type HrRequestIssueArticle = {
  id: number
  article_name: string
  relevant_paragraph: string | null
}

export type HrRequestIssueDetail = {
  id: number
  issue_title: string
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
}

export type HrRequestIndicatorResponseRow = {
  issue_indicator_id: number
  quantitative_value: number | null
  qualitative_text: string | null
}

export interface HrRequestRow {
  id: string
  title: string
  conv: string
  convention_id?: number | null
  issue_id?: number | null
  date: string
  status: HrRequestStatus
  details?: string | null
  attachment_file_name?: string | null
  federal_group_id?: string | null
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
