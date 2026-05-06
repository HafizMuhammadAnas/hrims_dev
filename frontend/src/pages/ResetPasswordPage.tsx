import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, parseApiErrorResponse } from '../api/apiError'
import { apiResetPassword } from '../api/client'
import { Alert } from '../components/ui/Alert'
import { PasswordField } from '../components/ui/PasswordField'

export function ResetPasswordPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSuccess(null)
    setError(null)

    try {
      const res = await apiResetPassword(username, password, passwordConfirmation)
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

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Reset password</h1>
        <p className="login-sub">Enter your username and choose a new password.</p>

        <form onSubmit={onSubmit} className="login-form">
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
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

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Updating…' : 'Update password'}
          </button>
          <Link className="btn btn-link login-reset-link" to="/login">
            Back to sign in
          </Link>
        </form>
      </div>
    </div>
  )
}
