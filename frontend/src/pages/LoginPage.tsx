import { type FormEvent, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AuthShell } from '../components/AuthShell'
import { Alert } from '../components/ui/Alert'
import { PasswordField } from '../components/ui/PasswordField'

export function LoginPage() {
  const { user, login, verify2fa, resend2fa, cancel2fa, pending2fa, loading } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (!pending2fa) {
      setResendIn(0)
      return
    }
    setResendIn(pending2fa.resendAvailableIn)
  }, [pending2fa])

  useEffect(() => {
    if (resendIn <= 0) return
    const t = window.setTimeout(() => setResendIn((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearTimeout(t)
  }, [resendIn])

  if (!loading && user) {
    return <Navigate to="/" replace />
  }

  async function onCredentialsSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      const result = await login(username, password)
      if (result === '2fa') {
        setOtpCode('')
        setInfo('A verification code was sent to your email.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function onOtpSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      await verify2fa(otpCode.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function onResend() {
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      const next = await resend2fa()
      setResendIn(next.resendAvailableIn)
      setInfo('A new verification code was sent.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code')
    } finally {
      setSubmitting(false)
    }
  }

  if (pending2fa) {
    return (
      <AuthShell
        cardTitle="Verify sign-in"
        cardSubtitle={`Enter the 6-digit code sent to ${pending2fa.maskedEmail}`}
      >
        <form onSubmit={onOtpSubmit} className="login-form">
          <label>
            Verification code
            <input
              className="login-otp-input"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              required
              maxLength={6}
              autoFocus
            />
          </label>
          {error && (
            <Alert variant="error" title="Verification failed" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}
          {info && (
            <Alert variant="success" title="Code sent" onDismiss={() => setInfo(null)}>
              {info}
            </Alert>
          )}
          <div className="login-form-actions login-form-actions--split">
            <button
              type="button"
              className="login-forgot-link"
              disabled={submitting || resendIn > 0}
              onClick={() => void onResend()}
            >
              {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
            </button>
            <button
              type="button"
              className="login-forgot-link"
              disabled={submitting}
              onClick={() => {
                cancel2fa()
                setOtpCode('')
                setError(null)
                setInfo(null)
              }}
            >
              Back to login
            </button>
          </div>
          <button
            type="submit"
            className="btn btn-primary login-submit-btn"
            disabled={submitting || loading || otpCode.length < 6}
          >
            {submitting ? 'Verifying…' : 'Verify and sign in'}
          </button>
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell cardTitle="Login">
      <form onSubmit={onCredentialsSubmit} className="login-form">
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="Enter your username"
            required
          />
        </label>
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />
        {error && (
          <Alert variant="error" title="Sign-in failed" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        <div className="login-form-actions">
          <Link className="login-forgot-link" to="/reset-password">
            Forgot password?
          </Link>
        </div>
        <button type="submit" className="btn btn-primary login-submit-btn" disabled={submitting || loading}>
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </AuthShell>
  )
}
