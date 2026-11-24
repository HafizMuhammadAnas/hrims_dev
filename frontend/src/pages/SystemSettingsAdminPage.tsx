import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { isApiError } from '../api/apiError'
import { adminFetchSystemSettings, adminUpdateSystemSettings } from '../api/systemSettings'
import { useAuth } from '../auth/AuthContext'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { PageSection } from '../components/ui/PageSection'
import { isSuperAdmin } from '../lib/roles'
import { LABEL_SYSTEM_SETTINGS } from '../lib/uiLabels'

export function SystemSettingsAdminPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loginOtpEnabled, setLoginOtpEnabled] = useState(true)
  const [savedEnabled, setSavedEnabled] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminFetchSystemSettings()
      setLoginOtpEnabled(data.login_otp_enabled)
      setSavedEnabled(data.login_otp_enabled)
    } catch (e: unknown) {
      setError(isApiError(e) ? e.message : e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!user) return null
  if (!isSuperAdmin(user)) return <Navigate to="/" replace />

  async function onSave() {
    setSaving(true)
    setError(null)
    setInfo(null)
    try {
      const data = await adminUpdateSystemSettings({ login_otp_enabled: loginOtpEnabled })
      setLoginOtpEnabled(data.login_otp_enabled)
      setSavedEnabled(data.login_otp_enabled)
      setInfo(
        data.login_otp_enabled
          ? 'Login OTP is enabled for all users except Super Admin.'
          : 'Login OTP is disabled for all users.',
      )
    } catch (e: unknown) {
      setError(isApiError(e) ? e.message : e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const dirty = loginOtpEnabled !== savedEnabled

  return (
    <PageSection
      title={LABEL_SYSTEM_SETTINGS}
      subtitle="Control system-wide login security. Super Admin always signs in without email OTP."
      titleIcon={<Settings size={22} aria-hidden />}
    >
      {error && (
        <Alert variant="error" title="Could not update settings" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {info && (
        <Alert variant="success" title="Saved" onDismiss={() => setInfo(null)}>
          {info}
        </Alert>
      )}

      <div className="table-card table-card-padded" style={{ maxWidth: 560 }}>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                cursor: 'pointer',
                marginBottom: 16,
              }}
            >
              <input
                type="checkbox"
                checked={loginOtpEnabled}
                onChange={(e) => setLoginOtpEnabled(e.target.checked)}
                style={{ marginTop: 4, width: 18, height: 18 }}
              />
              <span>
                <strong style={{ display: 'block', marginBottom: 4 }}>Require email OTP at login</strong>
                <span className="muted" style={{ fontSize: '0.9rem' }}>
                  When enabled, every user except Super Admin must enter a one-time code from email after
                  password. When disabled, all users sign in with username and password only.
                </span>
              </span>
            </label>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button type="button" variant="primary" disabled={saving || !dirty} onClick={() => void onSave()}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              {dirty ? <span className="muted">Unsaved changes</span> : null}
            </div>
          </>
        )}
      </div>
    </PageSection>
  )
}
