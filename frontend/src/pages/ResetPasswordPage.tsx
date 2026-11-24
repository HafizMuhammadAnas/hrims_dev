import { type FormEvent, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError, parseApiErrorResponse } from '../api/apiError'
import { apiForgotPassword, apiResetPassword } from '../api/client'
import { AuthShell } from '../components/AuthShell'
import { Alert } from '../components/ui/Alert'
import { PasswordField } from '../components/ui/PasswordField'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = (searchParams.get('token') ?? '').trim()
  const emailFromLink = (searchParams.get('email') ?? '').trim()
  const hasResetLink = token !== '' && emailFromLink !== ''

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState(emailFromLink)
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const subtitle = useMemo(
    () =>
      hasResetLink
        ? 'Choose a new password for your account.'
        : 'Enter your username and the email registered on that account. We will send a reset link only if both match.',
    [hasResetLink],
  )

  async function onRequestLink(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSuccess(null)
    setError(null)
    try {
      const res = await apiForgotPassword(username.trim(), email.trim())
      if (!res.ok) {
        throw new ApiError(await parseApiErrorResponse(res))
      }
      const body = (await res.json()) as { message?: string }
      setSuccess(body.message ?? 'A password reset link has been sent to the email registered for this account.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.')
    } finally {
      setSubmitting(false)
    }
  }

  async function onResetPassword(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSuccess(null)
    setError(null)
    try {
      const res = await apiResetPassword(emailFromLink || email.trim(), token, password, passwordConfirmation)
      if (!res.ok) {
        throw new ApiError(await parseApiErrorResponse(res))
      }
      const body = (await res.json()) as { message?: string }
      setSuccess(body.message ?? 'Your password has been updated. You can sign in.')
      setPassword('')
      setPasswordConfirmation('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password.')
    } finally {
      setSubmitting(false)
    }
  }

  if (hasResetLink) {
    return (
      <AuthShell cardTitle="Set new password" cardSubtitle={subtitle}>
        <form onSubmit={onResetPassword} className="login-form">
          <label>
            Email
            <input value={emailFromLink || email} readOnly autoComplete="email" />
          </label>
          <PasswordField
            label="New password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <PasswordField
            label="Confirm new password"
            value={passwordConfirmation}
            onChange={setPasswordConfirmation}
            autoComplete="new-password"
            minLength={8}
            required
          />

          {error && (
            <Alert variant="error" title="Could not reset password" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && <Alert variant="success">{success}</Alert>}

          <button type="submit" className="btn btn-primary login-submit-btn" disabled={submitting || !!success}>
            {submitting ? 'Updating…' : 'Update password'}
          </button>
          <Link className="btn btn-link login-reset-link" to="/login">
            Back to sign in
          </Link>
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell cardTitle="Forgot password" cardSubtitle={subtitle}>
      <form onSubmit={onRequestLink} className="login-form">
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
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="Email registered on this account"
            required
          />
        </label>

        {error && (
          <Alert variant="error" title="Could not send link" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && <Alert variant="success">{success}</Alert>}

        <button type="submit" className="btn btn-primary login-submit-btn" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>
        <Link className="btn btn-link login-reset-link" to="/login">
          Back to sign in
        </Link>
      </form>
    </AuthShell>
  )
}
