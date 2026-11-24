import { apiJsonHeaders } from './client'

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return
  let message = `Request failed (${res.status})`
  try {
    const body = (await res.json()) as { message?: string; errors?: Record<string, string[]> }
    if (body.message) message = body.message
    else if (body.errors) {
      const first = Object.values(body.errors)[0]
      if (first?.[0]) message = first[0]
    }
  } catch {
    /* ignore */
  }
  throw new Error(message)
}

export type SystemSettings = {
  login_otp_enabled: boolean
}

export async function adminFetchSystemSettings(): Promise<SystemSettings> {
  const res = await fetch('/api/v1/admin/settings', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  const body = (await res.json()) as { data: SystemSettings }
  return body.data
}

export async function adminUpdateSystemSettings(payload: SystemSettings): Promise<SystemSettings> {
  const res = await fetch('/api/v1/admin/settings/update', {
    method: 'POST',
    credentials: 'include',
    headers: apiJsonHeaders(),
    body: JSON.stringify(payload),
  })
  await throwIfNotOk(res)
  const body = (await res.json()) as { data: SystemSettings }
  return body.data
}
