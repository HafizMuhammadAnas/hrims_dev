export interface AuthUser {
  id: number
  name: string
  username: string
  email: string | null
  is_active: boolean
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
