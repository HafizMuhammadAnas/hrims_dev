export type DateRangePreset =
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'last_year'
  | 'month_year'
  | 'custom'

export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
  this_month: 'This month',
  last_month: 'Last month',
  this_quarter: 'This quarter',
  last_quarter: 'Last quarter',
  this_year: 'This year',
  last_year: 'Last year',
  month_year: 'Select month & year',
  custom: 'Custom date range',
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function startOfMonth(y: number, m: number): Date {
  return new Date(y, m, 1)
}

function endOfMonth(y: number, m: number): Date {
  return new Date(y, m + 1, 0)
}

function quarterBounds(y: number, q: number): { from: Date; to: Date } {
  const startMonth = (q - 1) * 3
  return {
    from: startOfMonth(y, startMonth),
    to: endOfMonth(y, startMonth + 2),
  }
}

export function resolveReportDateRange(input: {
  preset: DateRangePreset
  dateFrom: string
  dateTo: string
  monthYearMonth: string
  monthYearYear: string
}): { dateFrom: string; dateTo: string; label: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  if (input.preset === 'this_month') {
    return {
      dateFrom: toIso(startOfMonth(y, m)),
      dateTo: toIso(endOfMonth(y, m)),
      label: DATE_RANGE_PRESET_LABELS.this_month,
    }
  }
  if (input.preset === 'last_month') {
    const lm = m === 0 ? 11 : m - 1
    const ly = m === 0 ? y - 1 : y
    return {
      dateFrom: toIso(startOfMonth(ly, lm)),
      dateTo: toIso(endOfMonth(ly, lm)),
      label: DATE_RANGE_PRESET_LABELS.last_month,
    }
  }
  if (input.preset === 'this_quarter') {
    const q = Math.floor(m / 3) + 1
    const { from, to } = quarterBounds(y, q)
    return { dateFrom: toIso(from), dateTo: toIso(to), label: DATE_RANGE_PRESET_LABELS.this_quarter }
  }
  if (input.preset === 'last_quarter') {
    const q = Math.floor(m / 3) + 1
    const lq = q === 1 ? 4 : q - 1
    const ly = q === 1 ? y - 1 : y
    const { from, to } = quarterBounds(ly, lq)
    return { dateFrom: toIso(from), dateTo: toIso(to), label: DATE_RANGE_PRESET_LABELS.last_quarter }
  }
  if (input.preset === 'this_year') {
    return {
      dateFrom: `${y}-01-01`,
      dateTo: `${y}-12-31`,
      label: DATE_RANGE_PRESET_LABELS.this_year,
    }
  }
  if (input.preset === 'last_year') {
    return {
      dateFrom: `${y - 1}-01-01`,
      dateTo: `${y - 1}-12-31`,
      label: DATE_RANGE_PRESET_LABELS.last_year,
    }
  }
  if (input.preset === 'month_year') {
    const mm = Number(input.monthYearMonth)
    const yy = Number(input.monthYearYear)
    if (mm >= 1 && mm <= 12 && yy >= 2000 && yy <= 2100) {
      const from = startOfMonth(yy, mm - 1)
      const to = endOfMonth(yy, mm - 1)
      const monthName = from.toLocaleString('default', { month: 'long', year: 'numeric' })
      return { dateFrom: toIso(from), dateTo: toIso(to), label: monthName }
    }
    return { dateFrom: '', dateTo: '', label: DATE_RANGE_PRESET_LABELS.month_year }
  }

  const from = input.dateFrom
  const to = input.dateTo
  if (from && to) return { dateFrom: from, dateTo: to, label: `${from} – ${to}` }
  if (from) return { dateFrom: from, dateTo: '', label: `From ${from}` }
  if (to) return { dateFrom: '', dateTo: to, label: `Until ${to}` }
  return { dateFrom: '', dateTo: '', label: 'All dates' }
}
