export interface AuthUser {
  id: number
  name: string
  username: string
  email: string | null
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
  region: { id: number; name: string; slug: string } | null
  department: { id: number; name: string } | null
  roles: Array<{
    slug: string
    name: string
    permissions: string[]
  }>
}

export interface MeResponse {
  data: AuthUser
}
