export const DEPARTMENT_INDICATOR_FORMAT = 'department_indicator_v1' as const

export type DepartmentYearGenderCell = {
  value: number
  comment?: string | null
}

/** year_id → gender_id → cell */
export type DepartmentQuantitativeByYearGender = Record<string, Record<string, DepartmentYearGenderCell>>

/** year_id → cell_key → cell (age, disability, region, district, religion) */
export type DepartmentQuantitativeByYearKeyed = Record<string, Record<string, DepartmentYearGenderCell>>

export type DepartmentIndicatorQuantitative = {
  /** Legacy single value when indicator does not use year collection matrix. */
  value?: number | null
  comment: string | null
  attachment_url: string | null
  /** Per-dimension row inclusion toggles (false = department excluded this metric row). */
  matrix_row_enabled?: Partial<
    Record<'gender' | 'age' | 'disability' | 'district' | 'religion', boolean>
  > | null
  by_year_gender?: DepartmentQuantitativeByYearGender | null
  by_year_age?: DepartmentQuantitativeByYearKeyed | null
  by_year_disability?: DepartmentQuantitativeByYearKeyed | null
  by_year_region?: DepartmentQuantitativeByYearKeyed | null
  by_year_district?: DepartmentQuantitativeByYearKeyed | null
  by_year_religion?: DepartmentQuantitativeByYearKeyed | null
}

export type DepartmentIndicatorQualitative = {
  text: string | null
  attachment_url: string | null
}

export type DepartmentIndicatorBundle = {
  indicator_label?: string | null
  quantitative: DepartmentIndicatorQuantitative | null
  qualitative: DepartmentIndicatorQualitative | null
}

export type DepartmentIndicatorPayload = {
  format: typeof DEPARTMENT_INDICATOR_FORMAT
  by_indicator: Record<string, DepartmentIndicatorBundle>
}

export type ParsedDepartmentResponse =
  | { kind: 'legacy'; text: string; attachmentUrl: string | null }
  | { kind: 'structured'; payload: DepartmentIndicatorPayload }

export function parseDepartmentTaskResponseData(
  responseData: string | null | undefined,
  attachmentUrl?: string | null,
): ParsedDepartmentResponse {
  const raw = responseData?.trim() ?? ''
  if (raw.startsWith('{')) {
    try {
      const d = JSON.parse(raw) as unknown
      if (
        d &&
        typeof d === 'object' &&
        (d as DepartmentIndicatorPayload).format === DEPARTMENT_INDICATOR_FORMAT &&
        typeof (d as DepartmentIndicatorPayload).by_indicator === 'object'
      ) {
        return { kind: 'structured', payload: d as DepartmentIndicatorPayload }
      }
    } catch {
      /* fall through */
    }
  }
  return {
    kind: 'legacy',
    text: raw,
    attachmentUrl: attachmentUrl?.trim() ? attachmentUrl : null,
  }
}

/** Plain text for compilation prefill and simple previews. */
export function formatDepartmentResponseAsPlaintext(
  responseData: string | null | undefined,
  attachmentUrl?: string | null,
): string {
  const p = parseDepartmentTaskResponseData(responseData, attachmentUrl)
  if (p.kind === 'legacy') {
    const parts = [p.text || 'No response data yet.']
    if (p.attachmentUrl) parts.push(`Attachment: ${p.attachmentUrl}`)
    return parts.join('\n')
  }
  const lines: string[] = []
  const entries = Object.entries(p.payload.by_indicator).sort(([a], [b]) => Number(a) - Number(b))
  for (const [id, bundle] of entries) {
    const title = bundle.indicator_label?.trim() || `Indicator #${id}`
    lines.push(`— ${title} —`)
    if (bundle.quantitative) {
      const q = bundle.quantitative
      if (q.by_year_gender && Object.keys(q.by_year_gender).length > 0) {
        for (const [yearId, genders] of Object.entries(q.by_year_gender)) {
          for (const [genderId, cell] of Object.entries(genders)) {
            if (cell?.value == null || Number.isNaN(cell.value)) continue
            lines.push(
              genderId === '0'
                ? `  ${yearId}: ${cell.value}`
                : `  ${yearId}/${genderId}: ${cell.value}`,
            )
          }
        }
      } else if (q.value != null && !Number.isNaN(q.value)) {
        lines.push(`  Quantitative: ${q.value}`)
      }
      if (q.comment) lines.push(`  Comment: ${q.comment}`)
      if (q.attachment_url) lines.push(`  Quant attachment: ${q.attachment_url}`)
    }
    if (bundle.qualitative) {
      const l = bundle.qualitative
      if (l.text) lines.push(`  Qualitative: ${l.text}`)
      if (l.attachment_url) lines.push(`  Qual attachment: ${l.attachment_url}`)
    }
    lines.push('')
  }
  return lines.join('\n').trim() || 'No response data yet.'
}

/** Plain text only (no attachment URLs) — for consolidated regional views where files are listed separately. */
export function formatDepartmentResponseTextOnly(
  responseData: string | null | undefined,
  attachmentUrl?: string | null,
): string {
  const p = parseDepartmentTaskResponseData(responseData, attachmentUrl)
  if (p.kind === 'legacy') {
    return (p.text ?? '').trim() || '—'
  }
  const lines: string[] = []
  const entries = Object.entries(p.payload.by_indicator).sort(([a], [b]) => Number(a) - Number(b))
  for (const [id, bundle] of entries) {
    const title = bundle.indicator_label?.trim() || `Indicator #${id}`
    lines.push(`— ${title} —`)
    if (bundle.quantitative) {
      const q = bundle.quantitative
      if (q.by_year_gender && Object.keys(q.by_year_gender).length > 0) {
        for (const [yearId, genders] of Object.entries(q.by_year_gender)) {
          for (const [genderId, cell] of Object.entries(genders)) {
            if (cell?.value == null || Number.isNaN(cell.value)) continue
            lines.push(
              genderId === '0'
                ? `  ${yearId}: ${cell.value}`
                : `  ${yearId}/${genderId}: ${cell.value}`,
            )
          }
        }
      } else if (q.value != null && !Number.isNaN(q.value)) {
        lines.push(`  Quantitative: ${q.value}`)
      }
      if (q.comment) lines.push(`  Comment: ${q.comment}`)
    }
    if (bundle.qualitative) {
      const l = bundle.qualitative
      if (l.text) lines.push(`  Qualitative: ${l.text}`)
    }
    lines.push('')
  }
  return lines.join('\n').trim() || '—'
}

/** All attachment URLs from a department task (legacy single file + structured per-indicator files). */
export function collectAttachmentUrlsFromDepartmentTask(
  responseData: string | null | undefined,
  attachmentUrl?: string | null,
): string[] {
  const p = parseDepartmentTaskResponseData(responseData, attachmentUrl)
  if (p.kind === 'legacy') {
    return p.attachmentUrl ? [p.attachmentUrl] : []
  }
  const out: string[] = []
  for (const bundle of Object.values(p.payload.by_indicator)) {
    const q = bundle.quantitative?.attachment_url?.trim()
    if (q) out.push(q)
    const l = bundle.qualitative?.attachment_url?.trim()
    if (l) out.push(l)
  }
  return out
}

export function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const u of urls) {
    const t = u.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}
