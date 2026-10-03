import type { KnowledgeConventionRow } from '../api/hrRequests'
import type { HrRequestUprCycle } from './hrRequestUprForm'
import type { HrRequestRow } from '../types/hrRequest'

export type ConventionCycleKindFilter = '' | 'convention' | 'cycle'

/** Convention code or UPR cycle name shown in the list column. */
export function conventionOrCycleLabel(row: HrRequestRow): string {
  const conv = (row.conv ?? '').trim()
  if (conv) return conv
  const upr = (row.upr ?? '').trim()
  if (upr) return upr
  return '—'
}

export function isUprRequestRow(row: HrRequestRow): boolean {
  return row.reporting_framework === 'upr' || row.request_type === 'upr'
}

export function rowMatchesConventionOrCycleValue(row: HrRequestRow, selected: string): boolean {
  if (!selected) return true
  const needle = selected.trim().toLowerCase()
  if (!needle) return true
  const conv = (row.conv ?? '').trim().toLowerCase()
  const upr = (row.upr ?? '').trim().toLowerCase()
  const code = (row.convention?.code ?? '').trim().toLowerCase()
  const name = (row.convention?.name ?? '').trim().toLowerCase()
  return conv === needle || upr === needle || code === needle || name === needle
}

/** Apply kind (Convention / Cycle) plus optional specific name filter. */
export function rowMatchesConventionCycleFilters(
  row: HrRequestRow,
  kind: ConventionCycleKindFilter | string,
  value: string,
): boolean {
  const k = (kind ?? '') as ConventionCycleKindFilter
  if (k === 'convention') {
    if (isUprRequestRow(row)) return false
    return rowMatchesConventionOrCycleValue(row, value)
  }
  if (k === 'cycle') {
    if (!isUprRequestRow(row)) return false
    return rowMatchesConventionOrCycleValue(row, value)
  }
  return true
}

export function buildConventionFilterOptions(
  conventions: KnowledgeConventionRow[],
  rows: HrRequestRow[],
): Array<{ value: string; label: string }> {
  const byKey = new Map<string, string>()
  for (const c of conventions) {
    const code = (c.code ?? '').trim()
    const name = (c.name ?? '').trim()
    const key = code || name
    if (!key) continue
    byKey.set(key, code && name ? `${code} — ${name}` : key)
  }
  for (const r of rows) {
    if (isUprRequestRow(r)) continue
    const key = (r.conv ?? r.convention?.code ?? '').trim()
    if (key && !byKey.has(key)) byKey.set(key, key)
  }
  return [...byKey.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
}

export function buildCycleFilterOptions(
  uprCycles: HrRequestUprCycle[],
  rows: HrRequestRow[],
): Array<{ value: string; label: string }> {
  const byKey = new Map<string, string>()
  for (const c of uprCycles) {
    const name = (c.name ?? '').trim()
    if (name) byKey.set(name, name)
  }
  for (const r of rows) {
    if (!isUprRequestRow(r)) continue
    const key = (r.upr ?? r.conv ?? '').trim()
    if (key && !byKey.has(key)) byKey.set(key, key)
  }
  return [...byKey.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
}
