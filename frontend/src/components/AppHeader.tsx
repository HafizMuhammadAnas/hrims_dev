import { Bell, LogOut, Menu, UserCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useNotify } from '../context/NotificationsContext'
import { accountPortalSubtitle, formatAccountDisplayName } from '../lib/userDisplayLabels'

type Props = {
  onToggleSidebar: () => void
}

export function AppHeader({ onToggleSidebar }: Props) {
  const { user, logout } = useAuth()
  const { inbox, unreadCount, inboxLoading, markRead, markAllRead } = useNotify()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)

  if (!user) return null

  const subtitle = accountPortalSubtitle(user)
  const visibleItems = useMemo(() => inbox.slice(0, 8), [inbox])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!(event.target instanceof Node)) return
      if (panelRef.current?.contains(event.target)) return
      setOpen(false)
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  async function handleOpenNotification(id: number, route: string | null) {
    const item = inbox.find((entry) => entry.id === id)
    if (item && item.read_at === null) {
      await markRead(id)
    }
    setOpen(false)
    if (route) navigate(route)
  }

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
          <div className="notification-shell" ref={panelRef}>
            <button
              type="button"
              className="back-btn notification-trigger"
              title="Notifications"
              onClick={() => setOpen((value) => !value)}
            >
              <Bell size={18} />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
            {open && (
              <div className="notification-panel">
                <div className="notification-panel-head">
                  <strong>Notifications</strong>
                  {unreadCount > 0 && (
                    <button type="button" className="link-button" onClick={() => void markAllRead()}>
                      Mark all read
                    </button>
                  )}
                </div>
                {inboxLoading && <div className="notification-empty">Loading…</div>}
                {!inboxLoading && visibleItems.length === 0 && (
                  <div className="notification-empty">No notifications yet.</div>
                )}
                {!inboxLoading &&
                  visibleItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`notification-item${item.read_at ? '' : ' unread'}`}
                      onClick={() => void handleOpenNotification(item.id, item.route)}
                    >
                      <div className="notification-item-title">{item.title}</div>
                      <div className="notification-item-message">{item.message}</div>
                    </button>
                  ))}
              </div>
            )}
          </div>
          <div className="header-account-meta" onClick={() => navigate('/profile')}>
            <div className="header-account-name">{formatAccountDisplayName(user.name)}</div>
            <div className="header-account-subtitle">{subtitle}</div>
          </div>
          <button
            type="button"
            className="back-btn app-header-profile-btn"
            title="Profile"
            onClick={() => navigate('/profile')}
          >
            <UserCircle size={18} />
            <span>Profile</span>
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
