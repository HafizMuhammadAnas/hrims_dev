import type { DepartmentTaskRow } from '../api/lists'
import {
  DEPARTMENT_INDICATOR_FORMAT,
  parseDepartmentTaskResponseData,
  type DepartmentIndicatorBundle,
  type DepartmentIndicatorPayload,
  type DepartmentIndicatorQualitative,
  type DepartmentIndicatorQuantitative,
  type DepartmentQuantitativeByYearGender,
  type DepartmentQuantitativeByYearKeyed,
  type DepartmentYearGenderCell,
} from './departmentTaskResponseFormat'

export type ClubbedDepartmentResponses = {
  payload: DepartmentIndicatorPayload
  contributorCount: number
}

function cellValue(cell: DepartmentYearGenderCell | null | undefined): number | null {
  if (cell?.value == null) return null
  const n = Number(cell.value)
  return Number.isFinite(n) ? n : null
}

function appendParagraph(existing: string | null | undefined, next: string | null | undefined): string | null {
  const a = (existing ?? '').trim()
  const b = (next ?? '').trim()
  if (!b) return a || null
  if (!a) return b
  return `${a}\n\n${b}`
}

function addIntoKeyed(
  target: DepartmentQuantitativeByYearKeyed,
  source: DepartmentQuantitativeByYearKeyed | DepartmentQuantitativeByYearGender | null | undefined,
): void {
  if (!source) return
  for (const [yearId, cells] of Object.entries(source)) {
    if (!cells || typeof cells !== 'object') continue
    if (!target[yearId]) target[yearId] = {}
    for (const [columnId, cell] of Object.entries(cells)) {
      const n = cellValue(cell)
      if (n == null) continue
      const prev = cellValue(target[yearId][columnId]) ?? 0
      target[yearId][columnId] = { value: prev + n }
    }
  }
}

function keyedHasData(
  bundle: DepartmentQuantitativeByYearKeyed | DepartmentQuantitativeByYearGender | null | undefined,
): boolean {
  if (!bundle) return false
  for (const cells of Object.values(bundle)) {
    if (!cells) continue
    for (const cell of Object.values(cells)) {
      if (cellValue(cell) != null) return true
    }
  }
  return false
}

function quantitativeHasSummableData(q: DepartmentIndicatorQuantitative | null | undefined): boolean {
  if (!q) return false
  if (q.value != null && Number.isFinite(Number(q.value))) return true
  return (
    keyedHasData(q.by_year_gender) ||
    keyedHasData(q.by_year_age) ||
    keyedHasData(q.by_year_disability) ||
    keyedHasData(q.by_year_district) ||
    keyedHasData(q.by_year_religion) ||
    keyedHasData(q.by_year_consolidated) ||
    keyedHasData(q.by_year_others)
  )
}

function qualitativeHasText(l: DepartmentIndicatorQualitative | null | undefined): boolean {
  if (!l) return false
  if (l.text?.trim()) return true
  if (l.by_year) {
    for (const row of Object.values(l.by_year)) {
      if (row?.text?.trim()) return true
    }
  }
  return false
}

function emptyQuantitative(): DepartmentIndicatorQuantitative {
  return {
    comment: null,
    attachment_url: null,
  }
}

function emptyQualitative(): DepartmentIndicatorQualitative {
  return {
    text: null,
    attachment_url: null,
    by_year: null,
  }
}

function ensureIndicatorBundle(
  byIndicator: Record<string, DepartmentIndicatorBundle>,
  indicatorId: string,
  label: string | null | undefined,
): DepartmentIndicatorBundle {
  if (!byIndicator[indicatorId]) {
    byIndicator[indicatorId] = {
      indicator_label: label?.trim() || null,
      quantitative: emptyQuantitative(),
      qualitative: emptyQualitative(),
    }
  }
  const bundle = byIndicator[indicatorId]
  if (!bundle.quantitative) bundle.quantitative = emptyQuantitative()
  if (!bundle.qualitative) bundle.qualitative = emptyQualitative()
  if (!bundle.indicator_label?.trim() && label?.trim()) {
    bundle.indicator_label = label.trim()
  }
  return bundle
}

function mergeQuantitative(
  into: DepartmentIndicatorQuantitative,
  source: DepartmentIndicatorQuantitative,
): void {
  if (source.value != null && Number.isFinite(Number(source.value))) {
    const add = Number(source.value)
    into.value =
      (into.value != null && Number.isFinite(Number(into.value)) ? Number(into.value) : 0) + add
  }

  // Narrative comments stay as separate paragraphs (not summed).
  into.comment = appendParagraph(into.comment, source.comment)

  if (source.by_year_gender) {
    if (!into.by_year_gender) into.by_year_gender = {}
    addIntoKeyed(into.by_year_gender, source.by_year_gender)
  }
  if (source.by_year_age) {
    if (!into.by_year_age) into.by_year_age = {}
    addIntoKeyed(into.by_year_age, source.by_year_age)
  }
  if (source.by_year_disability) {
    if (!into.by_year_disability) into.by_year_disability = {}
    addIntoKeyed(into.by_year_disability, source.by_year_disability)
  }
  if (source.by_year_district) {
    if (!into.by_year_district) into.by_year_district = {}
    addIntoKeyed(into.by_year_district, source.by_year_district)
  }
  if (source.by_year_religion) {
    if (!into.by_year_religion) into.by_year_religion = {}
    addIntoKeyed(into.by_year_religion, source.by_year_religion)
  }
  const consolidated = source.by_year_consolidated ?? source.by_year_others
  if (consolidated) {
    if (!into.by_year_consolidated) into.by_year_consolidated = {}
    addIntoKeyed(into.by_year_consolidated, consolidated)
  }
}

function mergeQualitative(
  into: DepartmentIndicatorQualitative,
  source: DepartmentIndicatorQualitative,
): void {
  into.text = appendParagraph(into.text, source.text)

  if (source.by_year) {
    if (!into.by_year) into.by_year = {}
    for (const [yearId, row] of Object.entries(source.by_year)) {
      const text = row?.text?.trim()
      if (!text) continue
      const prev = into.by_year[yearId]?.text ?? null
      into.by_year[yearId] = { text: appendParagraph(prev, text) }
    }
  }
}

/**
 * Club department responses for a region:
 * - quantitative matrix / legacy numbers are summed
 * - qualitative (and comments / challenges) are merged as separate paragraphs
 * - department names are not included in the result
 */
export function clubDepartmentTaskResponses(
  tasks: DepartmentTaskRow[],
): ClubbedDepartmentResponses | null {
  const byIndicator: Record<string, DepartmentIndicatorBundle> = {}
  let challenges: string | null = null
  let contributorCount = 0
  const legacyParagraphs: string[] = []

  for (const task of tasks) {
    const parsed = parseDepartmentTaskResponseData(task.response_data, task.attachment_url)

    if (parsed.kind === 'legacy') {
      const text = parsed.text?.trim()
      if (!text) continue
      contributorCount += 1
      legacyParagraphs.push(text)
      continue
    }

    if (parsed.kind !== 'structured') continue

    let contributed = false
    for (const [indicatorId, bundle] of Object.entries(parsed.payload.by_indicator ?? {})) {
      const q = bundle.quantitative
      const l = bundle.qualitative
      const hasQ = quantitativeHasSummableData(q) || Boolean(q?.comment?.trim())
      const hasL = qualitativeHasText(l)
      if (!hasQ && !hasL) continue
      contributed = true
      const target = ensureIndicatorBundle(byIndicator, indicatorId, bundle.indicator_label)
      if (q && (quantitativeHasSummableData(q) || q.comment?.trim())) {
        mergeQuantitative(target.quantitative!, q)
      }
      if (l && qualitativeHasText(l)) {
        mergeQualitative(target.qualitative!, l)
      }
    }

    const rootChallenges = parsed.payload.challenges?.trim()
    if (rootChallenges) {
      contributed = true
      challenges = appendParagraph(challenges, rootChallenges)
    } else {
      for (const bundle of Object.values(parsed.payload.by_indicator ?? {})) {
        const legacy = bundle.quantitative?.challenges?.trim()
        if (legacy) {
          contributed = true
          challenges = appendParagraph(challenges, legacy)
        }
      }
    }

    if (!contributed) continue
    contributorCount += 1
  }

  if (legacyParagraphs.length > 0) {
    challenges = legacyParagraphs.reduce<string | null>(
      (acc, p) => appendParagraph(acc, p),
      challenges,
    )
  }

  if (contributorCount === 0 || (Object.keys(byIndicator).length === 0 && !challenges)) {
    return null
  }

  return {
    payload: {
      format: DEPARTMENT_INDICATOR_FORMAT,
      by_indicator: byIndicator,
      challenges,
    },
    contributorCount,
  }
}

export function clubbedResponseDataJson(payload: DepartmentIndicatorPayload): string {
  return JSON.stringify(payload)
}
