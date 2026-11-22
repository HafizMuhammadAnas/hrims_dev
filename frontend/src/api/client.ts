/**
 * All requests use relative URLs so Vite dev proxy forwards to Laravel (same-origin cookies).
 */

function getCookie(name: string): string | undefined {
  const m = document.cookie.match(new RegExp(`(^|; )${name}=([^;]*)`))
  return m ? decodeURIComponent(m[2]) : undefined
}

export async function ensureCsrfCookie(): Promise<void> {
  await fetch('/api/v1/auth/csrf-cookie', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
}

export function apiJsonHeaders(): HeadersInit {
  const token = getCookie('XSRF-TOKEN')
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { 'X-XSRF-TOKEN': token } : {}),
  }
}

/** For `FormData` uploads — do not set Content-Type (browser sets boundary). */
export function apiMultipartHeaders(): HeadersInit {
  const token = getCookie('XSRF-TOKEN')
  return {
    Accept: 'application/json',
    ...(token ? { 'X-XSRF-TOKEN': token } : {}),
  }
}

export async function apiLogin(username: string, password: string): Promise<Response> {
  await ensureCsrfCookie()
  return fetch('/api/v1/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: apiJsonHeaders(),
    body: JSON.stringify({ username, password }),
  })
}

export type LoginRequires2faResponse = {
  requires_2fa: true
  message?: string
  masked_email: string
  resend_available_in: number
}

export async function apiVerify2fa(code: string): Promise<Response> {
  await ensureCsrfCookie()
  return fetch('/api/v1/auth/verify-2fa', {
    method: 'POST',
    credentials: 'include',
    headers: apiJsonHeaders(),
    body: JSON.stringify({ code }),
  })
}

export async function apiResend2fa(): Promise<Response> {
  await ensureCsrfCookie()
  return fetch('/api/v1/auth/resend-2fa', {
    method: 'POST',
    credentials: 'include',
    headers: apiJsonHeaders(),
  })
}

export async function apiLogout(): Promise<Response> {
  await ensureCsrfCookie()
  return fetch('/api/v1/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: apiJsonHeaders(),
  })
}

export async function apiMe(): Promise<Response> {
  return fetch('/api/v1/auth/me', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
}

export async function apiResetPassword(
  username: string,
  password: string,
  passwordConfirmation: string,
): Promise<Response> {
  await ensureCsrfCookie()
  return fetch('/api/v1/auth/reset-password', {
    method: 'POST',
    credentials: 'include',
    headers: apiJsonHeaders(),
    body: JSON.stringify({
      username,
      password,
      password_confirmation: passwordConfirmation,
    }),
  })
}
