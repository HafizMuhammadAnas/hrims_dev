import type { CompiledRecordRow, RegionalResponseRow } from '../api/lists'
import type { HrRequestRow } from '../types/hrRequest'

export type ChartKind = 'pie' | 'line' | 'bar' | 'area'

export type ReportPreviewFilters = {
  dataSource: 'requests' | 'responses' | 'consolidated'
  province: string
  convention: string
  issueCategory: string
  sdg: string
  indicator: string
  uprCycle: string
  dateFrom: string
  dateTo: string
}

export type ReportPreviewResult = {
  chartType: ChartKind
  title: string
  intro: string
  insights: { label: string; text: string }[]
  recommendation: string
  pieData: { name: string; value: number }[]
  timelineData: { name: string; primary: number; secondary: number }[]
  barData: { name: string; value: number }[]
}

function lastNMonthKeys(n: number): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

function monthShortLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('default', { month: 'short' })
}

function regionOfRequest(r: HrRequestRow): string {
  return r.region_name ?? r.region?.name ?? ''
}

function matchesConvention(r: HrRequestRow, convention: string): boolean {
  if (!convention) return true
  const name = r.convention?.name
  const code = r.convention?.code
  return r.conv === convention || name === convention || code === convention
}

function matchesSdg(r: HrRequestRow, sdg: string): boolean {
  if (!sdg) return true
  const v = (r.sdg ?? '').toLowerCase()
  const needle = sdg.toLowerCase()
  return v === needle || v.includes(needle.slice(0, 32)) || needle.includes(v)
}

function matchesIndicator(r: HrRequestRow, indicator: string): boolean {
  if (!indicator) return true
  const n = indicator.toLowerCase()
  return (
    r.issue?.indicators?.some((i) => i.indicator_text.toLowerCase().includes(n.slice(0, 80))) ?? false
  )
}

function matchesUpr(r: HrRequestRow, uprCycle: string): boolean {
  if (!uprCycle) return true
  return (r.upr ?? '').toLowerCase().includes(uprCycle.toLowerCase())
}

function matchesIssueCategory(r: HrRequestRow, issueCategory: string): boolean {
  if (!issueCategory) return true
  return (r.issue?.category?.name ?? '') === issueCategory
}

/** Request-level filters (date on request `date`). */
function filterRequests(requests: HrRequestRow[], f: ReportPreviewFilters): HrRequestRow[] {
  return requests.filter((r) => {
    if (f.province && regionOfRequest(r) !== f.province) return false
    if (!matchesConvention(r, f.convention)) return false
    if (!matchesIssueCategory(r, f.issueCategory)) return false
    if (!matchesSdg(r, f.sdg)) return false
    if (!matchesIndicator(r, f.indicator)) return false
    if (!matchesUpr(r, f.uprCycle)) return false
    if (f.dateFrom && r.date < f.dateFrom) return false
    if (f.dateTo && r.date > f.dateTo) return false
    return true
  })
}

function filterResponses(
  responses: RegionalResponseRow[],
  requests: HrRequestRow[],
  f: ReportPreviewFilters,
): RegionalResponseRow[] {
  const reqById = new Map(requests.map((r) => [r.id, r]))
  return responses.filter((resp) => {
    if (f.province && (resp.region_name ?? '') !== f.province) return false
    if (f.dateFrom && resp.submission_date < f.dateFrom) return false
    if (f.dateTo && resp.submission_date > f.dateTo) return false
    const req = reqById.get(resp.req_id)
    if (!req) return false
    if (!matchesConvention(req, f.convention)) return false
    if (!matchesIssueCategory(req, f.issueCategory)) return false
    if (!matchesSdg(req, f.sdg)) return false
    if (!matchesIndicator(req, f.indicator)) return false
    if (!matchesUpr(req, f.uprCycle)) return false
    return true
  })
}

function filterCompiled(compiled: CompiledRecordRow[], f: ReportPreviewFilters): CompiledRecordRow[] {
  return compiled.filter((c) => {
    if (f.province && !c.region_names.some((n) => n === f.province)) return false
    const d = c.compilation_date ?? ''
    if (f.dateFrom && (!d || d < f.dateFrom)) return false
    if (f.dateTo && (!d || d > f.dateTo)) return false
    return true
  })
}

function countMapToPie(map: Record<string, number>): { name: string; value: number }[] {
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
}

function topBarFromMap(map: Record<string, number>, limit: number): { name: string; value: number }[] {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, value]) => ({
      name: name.length > 24 ? `${name.slice(0, 24)}…` : name,
      value,
    }))
}

export function buildReportPreview(
  requests: HrRequestRow[],
  responses: RegionalResponseRow[],
  compiled: CompiledRecordRow[],
  f: ReportPreviewFilters,
  chartType: ChartKind,
  selectedPrompts: string[],
  customPrompt: string,
): ReportPreviewResult {
  const fr = filterRequests(requests, f)
  const sr = filterResponses(responses, requests, f)
  const cr = filterCompiled(compiled, f)

  const frIds = new Set(fr.map((r) => r.id))

  let pieData: { name: string; value: number }[] = []
  let timelineData: { name: string; primary: number; secondary: number }[] = []
  let barData: { name: string; value: number }[] = []
  let title = 'Scoped report'
  let scopeCount = 0

  if (f.dataSource === 'requests') {
    title = `Report: HR requests (${fr.length} in scope)`
    scopeCount = fr.length
    const byStatus: Record<string, number> = {}
    fr.forEach((r) => {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
    })
    pieData = countMapToPie(byStatus)

    const months = lastNMonthKeys(6)
    timelineData = months.map((ym) => {
      const primary = fr.filter((r) => r.date.startsWith(ym)).length
      const secondary = responses.filter(
        (x) => frIds.has(x.req_id) && x.submission_date.startsWith(ym),
      ).length
      return { name: monthShortLabel(ym), primary, secondary }
    })

    const byConv: Record<string, number> = {}
    fr.forEach((r) => {
      const k = r.conv || '—'
      byConv[k] = (byConv[k] ?? 0) + 1
    })
    barData = topBarFromMap(byConv, 10)
  } else if (f.dataSource === 'responses') {
    title = `Report: regional responses (${sr.length} in scope)`
    scopeCount = sr.length
    const byRev: Record<string, number> = {}
    sr.forEach((r) => {
      const k = r.review_status || 'unknown'
      byRev[k] = (byRev[k] ?? 0) + 1
    })
    pieData = countMapToPie(byRev)

    const months = lastNMonthKeys(6)
    timelineData = months.map((ym) => ({
      name: monthShortLabel(ym),
      primary: sr.filter((x) => x.submission_date.startsWith(ym)).length,
      secondary: 0,
    }))

    const byReg: Record<string, number> = {}
    sr.forEach((r) => {
      const k = r.region_name ?? '—'
      byReg[k] = (byReg[k] ?? 0) + 1
    })
    barData = topBarFromMap(byReg, 10)
  } else {
    title = `Report: compiled records (${cr.length} in scope)`
    scopeCount = cr.length
    const bySt: Record<string, number> = {}
    cr.forEach((c) => {
      const k = c.status || 'unknown'
      bySt[k] = (bySt[k] ?? 0) + 1
    })
    pieData = countMapToPie(bySt)

    const months = lastNMonthKeys(6)
    timelineData = months.map((ym) => ({
      name: monthShortLabel(ym),
      primary: cr.filter((c) => (c.compilation_date ?? '').startsWith(ym)).length,
      secondary: 0,
    }))

    const byStatusBar: Record<string, number> = {}
    cr.forEach((c) => {
      const k = c.status || '—'
      byStatusBar[k] = (byStatusBar[k] ?? 0) + 1
    })
    barData = topBarFromMap(byStatusBar, 8)
  }

  const filterBits = [
    `Source: ${f.dataSource}`,
    f.province ? `Region: ${f.province}` : null,
    f.convention ? `Convention: ${f.convention}` : null,
    f.issueCategory ? `Issue category: ${f.issueCategory}` : null,
    f.sdg ? `SDG: ${f.sdg}` : null,
    f.indicator ? `Indicator filter applied` : null,
    f.uprCycle ? `UPR cycle contains: ${f.uprCycle}` : null,
    f.dateFrom || f.dateTo
      ? `Dates: ${f.dateFrom || '…'} – ${f.dateTo || '…'}`
      : null,
  ].filter(Boolean)

  const notes: string[] = []
  if (selectedPrompts.length > 0) {
    notes.push(`Review topics noted: ${selectedPrompts.slice(0, 5).join('; ')}${selectedPrompts.length > 5 ? '…' : ''}.`)
  }
  if (customPrompt.trim()) {
    notes.push(`Additional notes: ${customPrompt.trim().slice(0, 400)}${customPrompt.length > 400 ? '…' : ''}`)
  }

  const intro =
    `This preview is computed only from live data in your HRIMS scope (${scopeCount} primary records). ` +
    `Active filters: ${filterBits.join('; ')}. ` +
    (f.dataSource === 'consolidated' && f.convention
      ? 'Convention filter does not apply to compiled records (field not stored on those rows). '
      : '') +
    (notes.length ? notes.join(' ') : '')

  const completed = f.dataSource === 'requests' ? fr.filter((r) => r.status === 'completed').length : 0
  const overdue = f.dataSource === 'requests' ? fr.filter((r) => r.status === 'overdue').length : 0
  const inProgress = f.dataSource === 'requests' ? fr.filter((r) => r.status === 'in-progress').length : 0

  let responseCoverage = 0
  if (f.dataSource === 'requests' && fr.length > 0) {
    const withResp = fr.filter((r) => responses.some((x) => x.req_id === r.id)).length
    responseCoverage = Math.min(100, Math.round((withResp / fr.length) * 100))
  }

  const topPie = pieData[0]
  const insights: { label: string; text: string }[] = []

  if (f.dataSource === 'requests') {
    insights.push({
      label: 'Volume',
      text: `${fr.length} HR request(s) match the current filters. ${completed} completed, ${inProgress} in progress, ${overdue} overdue.`,
    })
    if (fr.length > 0) {
      insights.push({
        label: 'Response coverage',
        text: `${responseCoverage}% of scoped requests have at least one regional response in the system.`,
      })
    }
    if (topPie && fr.length > 0) {
      insights.push({
        label: 'Largest status slice',
        text: `“${topPie.name}” accounts for ${topPie.value} record(s) (${Math.round((topPie.value / fr.length) * 100)}% of scoped requests).`,
      })
    }
  } else if (f.dataSource === 'responses') {
    insights.push({
      label: 'Volume',
      text: `${sr.length} regional response(s) match the current filters.`,
    })
    if (topPie) {
      insights.push({
        label: 'Review status',
        text: `Most common review status: “${topPie.name}” (${topPie.value} response(s)).`,
      })
    }
  } else {
    insights.push({
      label: 'Volume',
      text: `${cr.length} compiled record(s) match the current filters.`,
    })
    if (topPie) {
      insights.push({
        label: 'Compilation status',
        text: `Most common status: “${topPie.name}” (${topPie.value} record(s)).`,
      })
    }
  }

  if (insights.length < 4 && topPie && f.dataSource !== 'requests') {
    insights.push({
      label: 'Distribution',
      text: `Chart totals reflect ${pieData.reduce((s, x) => s + x.value, 0)} categorized row(s) in the active dataset.`,
    })
  }

  let recommendation = ''
  if (f.dataSource === 'requests') {
    if (overdue > 0) {
      recommendation = `${overdue} request(s) in this scope are overdue — review ownership and deadlines in the Requests workspace.`
    } else if (fr.length > 0 && responseCoverage < 40) {
      recommendation = `Response coverage is ${responseCoverage}% — consider following up on provinces or sectors with no regional response yet.`
    } else if (fr.length === 0) {
      recommendation = 'No requests match these filters; widen the date range or clear filters to see data.'
    } else {
      recommendation = 'No overdue items in this scope; keep monitoring in-progress work and submission timelines.'
    }
  } else if (f.dataSource === 'responses') {
    recommendation =
      sr.length === 0
        ? 'No responses match these filters; adjust dates or region.'
        : 'Figures reflect submitted regional responses only — pair with the Requests view for full workflow context.'
  } else {
    recommendation =
      cr.length === 0
        ? 'No compiled records match these filters.'
        : 'Compiled figures are limited to federal compilation records visible to your role.'
  }

  return {
    chartType,
    title,
    intro,
    insights,
    recommendation,
    pieData,
    timelineData,
    barData,
  }
}
