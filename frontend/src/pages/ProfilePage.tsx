import { Building2, Camera, Mail, MapPin, ShieldCheck, UserCircle, UserSquare2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { PageSection } from '../components/ui/PageSection'
import { TableCard } from '../components/ui/TableCard'
import { formatAccountDisplayName, formatPrimaryRoleLabel } from '../lib/userDisplayLabels'

const PROFILE_PHOTO_KEY = 'hrims_profile_photo'

export function ProfilePage() {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  if (!user) return null

  const primaryRole = formatPrimaryRoleLabel(user)
  const displayName = formatAccountDisplayName(user.name)

  useEffect(() => {
    const savedPhoto = window.localStorage.getItem(PROFILE_PHOTO_KEY)
    if (savedPhoto) {
      setPhotoDataUrl(savedPhoto)
    }
  }, [])

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null
      if (!result) return
      setPhotoDataUrl(result)
      window.localStorage.setItem(PROFILE_PHOTO_KEY, result)
    }
    reader.readAsDataURL(file)
  }

  function clearPhoto() {
    setPhotoDataUrl(null)
    window.localStorage.removeItem(PROFILE_PHOTO_KEY)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <PageSection title="Profile" subtitle="Signed-in account and access summary.">
      <div className="profile-hero">
        <div className="profile-hero-avatar">
          {photoDataUrl ? (
            <img src={photoDataUrl} alt={`${user.name} profile`} className="profile-hero-avatar-image" />
          ) : (
            <UserCircle size={44} />
          )}
        </div>
        <div className="profile-hero-copy">
          <h3>{displayName}</h3>
          <p>@{user.username}</p>
          <div className="profile-chip-list">
            <span className="profile-chip">{primaryRole}</span>
            <span className={`profile-chip ${user.is_active ? 'active' : 'inactive'}`}>
              {user.is_active ? 'Active account' : 'Inactive account'}
            </span>
          </div>
        </div>
        <div className="profile-photo-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="profile-photo-input"
            onChange={handlePhotoChange}
          />
          <button
            type="button"
            className="btn btn-secondary btn-compact profile-photo-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera size={16} />
            Upload photo
          </button>
          {photoDataUrl && (
            <button type="button" className="link-button" onClick={clearPhoto}>
              Remove photo
            </button>
          )}
          <div className="profile-photo-help">Choose a profile photo from your device.</div>
        </div>
      </div>

      <div className="profile-grid">
        <TableCard className="profile-card">
          <h3 className="profile-card-title">Account details</h3>
          <div className="profile-info-list">
            <div className="profile-info-row">
              <span className="profile-info-icon">
                <UserSquare2 size={18} />
              </span>
              <div>
                <div className="profile-info-label">Username</div>
                <div className="profile-info-value">@{user.username}</div>
              </div>
            </div>
            <div className="profile-info-row">
              <span className="profile-info-icon">
                <Mail size={18} />
              </span>
              <div>
                <div className="profile-info-label">Email</div>
                <div className="profile-info-value">{user.email ?? 'No email added'}</div>
              </div>
            </div>
            <div className="profile-info-row">
              <span className="profile-info-icon">
                <MapPin size={18} />
              </span>
              <div>
                <div className="profile-info-label">Region</div>
                <div className="profile-info-value">
                  {user.region ? `${user.region.name} (${user.region.slug})` : 'Not assigned'}
                </div>
              </div>
            </div>
            <div className="profile-info-row">
              <span className="profile-info-icon">
                <Building2 size={18} />
              </span>
              <div>
                <div className="profile-info-label">Department</div>
                <div className="profile-info-value">{user.department?.name ?? 'Not assigned'}</div>
              </div>
            </div>
          </div>
        </TableCard>

        <TableCard className="profile-card">
          <h3 className="profile-card-title">Access summary</h3>
          <div className="profile-info-list">
            <div className="profile-info-row">
              <span className="profile-info-icon">
                <ShieldCheck size={18} />
              </span>
              <div>
                <div className="profile-info-label">Primary role</div>
                <div className="profile-info-value">{formatPrimaryRoleLabel(user)}</div>
              </div>
            </div>
            <div className="profile-info-row">
              <span className="profile-info-icon">
                <ShieldCheck size={18} />
              </span>
              <div>
                <div className="profile-info-label">Assigned roles</div>
                <div className="profile-info-value">{user.roles.length}</div>
              </div>
            </div>
            <div className="profile-info-row">
              <span className="profile-info-icon">
                <ShieldCheck size={18} />
              </span>
              <div>
                <div className="profile-info-label">Permissions</div>
                <div className="profile-info-value">
                  {user.roles.reduce((count, role) => count + role.permissions.length, 0)}
                </div>
              </div>
            </div>
          </div>
        </TableCard>
      </div>

    </PageSection>
  )
}
