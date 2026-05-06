import { type FormEvent, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Alert } from '../components/ui/Alert'
import { PasswordField } from '../components/ui/PasswordField'

export function LoginPage() {
  const { user, login, loading } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>HRIMS</h1>
        <p className="login-sub">Human Rights Information Management System</p>
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
          <button type="submit" className="btn btn-primary" disabled={submitting || loading}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
          <Link className="btn btn-link login-reset-link" to="/reset-password">
            Reset password
          </Link>
        </form>
      </div>
    </div>
  )
}
