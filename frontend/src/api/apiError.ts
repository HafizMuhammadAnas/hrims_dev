/**
 * Normalizes Laravel / Sanctum JSON errors (422 validation, 403 message, etc.)
 * for consistent UI handling.
 */

export type ParsedApiError = {
  status: number
  /** Best single-line summary for alerts / toasts */
  summaryMessage: string
  /** Laravel validation shape: { field: ["msg1", ...] } */
  fieldErrors: Record<string, string[]>
  /** Top-level `message` from JSON when present */
  serverMessage: string | null
}

function defaultMessageForStatus(status: number): string {
  if (status === 401) return 'You are not signed in. Please log in again.'
  if (status === 403) return 'You do not have permission to perform this action.'
  if (status === 404) return 'The requested record was not found.'
  if (status === 422) return 'Please correct the highlighted fields.'
  if (status >= 500) return 'Something went wrong on the server. Please try again later.'
  return `Request failed (${status}).`
}

/** Flatten Laravel `errors` object from JSON body */
export function normalizeFieldErrors(raw: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, val] of Object.entries(raw)) {
    if (Array.isArray(val)) {
      out[key] = val.filter((x): x is string => typeof x === 'string')
    } else if (typeof val === 'string') {
      out[key] = [val]
    }
  }
  return out
}

/**
 * Parse a failed `fetch` Response body (read once).
 */
export async function parseApiErrorResponse(res: Response): Promise<ParsedApiError> {
  const body = (await res.json().catch(() => ({}))) as {
    message?: string
    errors?: Record<string, string[] | string>
  }

  const fieldErrors = normalizeFieldErrors(body.errors)
  const flat = Object.values(fieldErrors).flat().filter(Boolean)
  const serverMessage = typeof body.message === 'string' ? body.message : null

  const generic = defaultMessageForStatus(res.status)
  const summaryMessage =
    flat.length > 0 ? flat.join(' ') : serverMessage && serverMessage !== 'The given data was invalid.'
      ? serverMessage
      : generic

  return {
    status: res.status,
    summaryMessage,
    fieldErrors,
    serverMessage,
  }
}

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string[]>
  readonly parsed: ParsedApiError

  constructor(parsed: ParsedApiError) {
    super(parsed.summaryMessage)
    this.name = 'ApiError'
    this.parsed = parsed
    this.status = parsed.status
    this.fieldErrors = parsed.fieldErrors
  }

  firstFor(field: string): string | undefined {
    return this.fieldErrors[field]?.[0]
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}
