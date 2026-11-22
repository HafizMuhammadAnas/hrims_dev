import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ApiError, parseApiErrorResponse } from '../api/apiError'
import {
  apiLogin,
  apiLogout,
  apiMe,
  apiResend2fa,
  apiVerify2fa,
  type LoginRequires2faResponse,
} from '../api/client'
import type { AuthUser, MeResponse } from '../types/auth'

export type Pending2fa = {
  maskedEmail: string
  resendAvailableIn: number
}

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  pending2fa: Pending2fa | null
  login: (username: string, password: string) => Promise<'ok' | '2fa'>
  verify2fa: (code: string) => Promise<void>
  resend2fa: () => Promise<Pending2fa>
  cancel2fa: () => void
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending2fa, setPending2fa] = useState<Pending2fa | null>(null)

  const refresh = useCallback(async () => {
    const res = await apiMe()
    if (res.status === 200) {
      const body = (await res.json()) as MeResponse
      setUser(body.data)
      setPending2fa(null)
    } else {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    void refresh().finally(() => setLoading(false))
  }, [refresh])

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiLogin(username, password)
    if (!res.ok) {
      throw new ApiError(await parseApiErrorResponse(res))
    }
    const body = (await res.json()) as MeResponse | LoginRequires2faResponse
    if ('requires_2fa' in body && body.requires_2fa) {
      setUser(null)
      setPending2fa({
        maskedEmail: body.masked_email,
        resendAvailableIn: body.resend_available_in ?? 60,
      })
      return '2fa'
    }
    setPending2fa(null)
    setUser((body as MeResponse).data)
    return 'ok'
  }, [])

  const verify2fa = useCallback(async (code: string) => {
    const res = await apiVerify2fa(code)
    if (!res.ok) {
      throw new ApiError(await parseApiErrorResponse(res))
    }
    const body = (await res.json()) as MeResponse
    setPending2fa(null)
    setUser(body.data)
  }, [])

  const resend2fa = useCallback(async () => {
    const res = await apiResend2fa()
    if (!res.ok) {
      throw new ApiError(await parseApiErrorResponse(res))
    }
    const body = (await res.json()) as {
      masked_email: string
      resend_available_in: number
    }
    const next: Pending2fa = {
      maskedEmail: body.masked_email,
      resendAvailableIn: body.resend_available_in ?? 60,
    }
    setPending2fa(next)
    return next
  }, [])

  const cancel2fa = useCallback(() => {
    setPending2fa(null)
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setUser(null)
    setPending2fa(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      pending2fa,
      login,
      verify2fa,
      resend2fa,
      cancel2fa,
      logout,
      refresh,
    }),
    [user, loading, pending2fa, login, verify2fa, resend2fa, cancel2fa, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
