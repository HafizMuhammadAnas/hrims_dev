/** Pakistan (Karachi) — standard display for calendar dates in the UI. */
export const APP_TIMEZONE = 'Asia/Karachi'

const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Format a calendar date as dd/mm/yyyy.
 * Accepts API date strings (YYYY-MM-DD) and ISO datetimes.
 */
export function formatAppDate(value: string | null | undefined, fallback = '—'): string {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return fallback

  const iso = trimmed.match(ISO_DATE_ONLY)
  if (iso) {
    return `${iso[3]}/${iso[2]}/${iso[1]}`
  }

  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return trimmed

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/** Date and time in Pakistan (Karachi), e.g. 08/06/2026, 14:30 */
export function formatAppDateTime(value: string | null | undefined, fallback = '—'): string {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return fallback

  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return trimmed

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

/** Long “today” line for dashboard welcome (weekday + dd/mm/yyyy, Karachi). */
export function formatAppTodayLong(now = new Date()): string {
  const weekday = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    weekday: 'long',
  }).format(now)
  const datePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(now)
  return `${weekday}, ${datePart}`
}

/** @deprecated Use formatAppDate — kept for existing call sites. */
export function formatDueDisplay(iso: string): string {
  return formatAppDate(iso)
}
