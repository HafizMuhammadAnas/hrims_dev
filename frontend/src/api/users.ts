import { apiJsonHeaders, ensureCsrfCookie } from './client'
import { ApiError, parseApiErrorResponse } from './apiError'
import type { AuthUser } from '../types/auth'

async function throwIfNotOk(res: Response): Promise<void> {
  if (!res.ok) throw new ApiError(await parseApiErrorResponse(res))
}

export type UserCreateInput = {
  name: string
  username: string
  email?: string | null
  password: string
  role_slug: 'federal_admin' | 'regional_admin' | 'department_admin' | 'viewer'
  region_id?: number | null
  department_id?: number | null
}

export async function fetchUsers(): Promise<AuthUser[]> {
  const res = await fetch('/api/v1/users', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: AuthUser[] }
  return json.data
}

export async function createUser(input: UserCreateInput): Promise<AuthUser> {
  await ensureCsrfCookie()
  const res = await fetch('/api/v1/users', {
    method: 'POST',
    credentials: 'include',
    headers: apiJsonHeaders(),
    body: JSON.stringify(input),
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: AuthUser }
  return json.data
}

export async function deleteUser(id: number): Promise<void> {
  await ensureCsrfCookie()
  const res = await fetch(`/api/v1/users/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: apiJsonHeaders(),
  })
  await throwIfNotOk(res)
}

export async function updateUser(
  id: number,
  body: { name?: string; email?: string | null; is_active?: boolean; password?: string },
): Promise<AuthUser> {
  await ensureCsrfCookie()
  const res = await fetch(`/api/v1/users/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: apiJsonHeaders(),
    body: JSON.stringify(body),
  })
  await throwIfNotOk(res)
  const json = (await res.json()) as { data: AuthUser }
  return json.data
}
