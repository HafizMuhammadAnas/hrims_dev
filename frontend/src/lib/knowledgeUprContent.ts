export type KnowledgeUprKind = 'supported' | 'noted' | 'others'

export type KnowledgeUprDocument = {
  id: string
  title: string
  href: string
  type_label: string
  icon: string
  file_name: string
  path?: string
}

export type KnowledgeUprRepositoryKey =
  | 'upr_cycle'
  | 'matrix_of_recommendations'
  | 'national_report'
  | 'un_report'
  | 'civil_society_report'
  | 'outcome_review'
  | 'decision_of_the_outcome'

export const KNOWLEDGE_UPR_REPOSITORY_KEYS: KnowledgeUprRepositoryKey[] = [
  'upr_cycle',
  'matrix_of_recommendations',
  'national_report',
  'un_report',
  'civil_society_report',
  'outcome_review',
  'decision_of_the_outcome',
]

export const KNOWLEDGE_UPR_REPOSITORY_LABELS: Record<KnowledgeUprRepositoryKey, string> = {
  upr_cycle: 'UPR cycle',
  matrix_of_recommendations: 'Matrix of recommendations',
  national_report: 'National report',
  un_report: 'UN report',
  civil_society_report: 'Civil society report',
  outcome_review: 'Outcome review',
  decision_of_the_outcome: 'Decision of the outcome',
}

export const KNOWLEDGE_UPR_KIND_OPTIONS: { value: KnowledgeUprKind; label: string }[] = [
  { value: 'supported', label: 'Supported' },
  { value: 'noted', label: 'Noted' },
  { value: 'others', label: 'Others' },
]

export function knowledgeUprKindLabel(kind: string): string {
  return KNOWLEDGE_UPR_KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind
}

export const KNOWLEDGE_UPR_MAX_FILE_BYTES = 50 * 1024 * 1024

export function knowledgeUprFileTooLargeMessage(fileName: string): string {
  return `"${fileName}" is too large. Maximum upload size is 50 MB per file.`
}

export function emptyKnowledgeUprRepositories(): Record<
  KnowledgeUprRepositoryKey,
  KnowledgeUprDocument | null
> {
  return {
    upr_cycle: null,
    matrix_of_recommendations: null,
    national_report: null,
    un_report: null,
    civil_society_report: null,
    outcome_review: null,
    decision_of_the_outcome: null,
  }
}

export function normalizeKnowledgeUprRepositories(
  raw: unknown,
): Record<KnowledgeUprRepositoryKey, KnowledgeUprDocument | null> {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out = emptyKnowledgeUprRepositories()
  for (const key of KNOWLEDGE_UPR_REPOSITORY_KEYS) {
    out[key] = normalizeKnowledgeUprDocument(input[key])
  }
  return out
}

export function normalizeKnowledgeUprAnalysisFiles(raw: unknown): KnowledgeUprDocument[] {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeKnowledgeUprDocument).filter((d): d is KnowledgeUprDocument => d != null)
}

function normalizeKnowledgeUprDocument(raw: unknown): KnowledgeUprDocument | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Record<string, unknown>
  const href = String(d.href ?? d.url ?? '').trim()
  const fileName = String(d.file_name ?? d.fileName ?? '').trim()
  const path = String(d.path ?? '').trim()
  if (!href && !fileName && !path) return null
  return {
    id: String(d.id ?? ''),
    title: String(d.title ?? fileName),
    href,
    type_label: String(d.type_label ?? d.typeLabel ?? ''),
    icon: String(d.icon ?? '📄') || '📄',
    file_name: fileName,
    path,
  }
}
