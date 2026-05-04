import { LogOut, Menu, UserCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isFederalAdmin, primaryRoleSlug } from '../lib/roles'

type Props = {
  onToggleSidebar: () => void
}

export function AppHeader({ onToggleSidebar }: Props) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const role = primaryRoleSlug(user)
  const subtitle = isFederalAdmin(user)
    ? 'Federal Admin'
    : `${user.region?.name ?? 'Regional'} · ${role?.replace(/_/g, ' ') ?? ''}`

  return (
    <header className="header" style={{ position: 'sticky', top: 0, zIndex: 1000 }}>
      <div className="header-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button
            type="button"
            onClick={onToggleSidebar}
            className="mobile-menu-btn"
            aria-label="Menu"
          >
            <Menu size={24} />
          </button>
          <div>
            <h1>Human Rights Information Management System</h1>
          </div>
        </div>
        <div className="user-info">
          <div style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => navigate('/profile')}>
            <div style={{ fontSize: '14px', fontWeight: 500 }}>{user.name}</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>{subtitle}</div>
          </div>
          <button type="button" className="back-btn" title="Profile" onClick={() => navigate('/profile')}>
            <UserCircle size={18} />
          </button>
          <button
            type="button"
            className="back-btn"
            style={{ background: '#d32f2f', border: 'none' }}
            title="Logout"
            onClick={() => void logout()}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
