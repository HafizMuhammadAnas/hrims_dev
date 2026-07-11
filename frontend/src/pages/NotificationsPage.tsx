import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchNotifications } from '../api/notifications'
import { useAuth } from '../auth/AuthContext'
import { useNotify } from '../context/NotificationsContext'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { PageSection } from '../components/ui/PageSection'
import { TableCard } from '../components/ui/TableCard'
import { formatAppDateTime } from '../lib/dateFormat'
import { resolveNotificationRoute } from '../lib/notificationRoutes'
import type { AppNotification } from '../types/notification'

const PAGE_LIMIT = 100

export function NotificationsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { markRead, markAllRead, unreadCount, refreshInbox } = useNotify()
  const [rows, setRows] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchNotifications(PAGE_LIMIT)
      setRows(res.data)
    } catch (e: unknown) {
      setRows([])
      setError(e instanceof Error ? e.message : 'Could not load notifications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  async function handleOpen(item: AppNotification) {
    if (item.read_at === null) {
      await markRead(item.id)
      setRows((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, read_at: row.read_at ?? new Date().toISOString() } : row,
        ),
      )
    }
    const route = resolveNotificationRoute(item, user)
    if (route) navigate(route)
  }

  async function handleMarkAllRead() {
    await markAllRead()
    const now = new Date().toISOString()
    setRows((prev) => prev.map((row) => ({ ...row, read_at: row.read_at ?? now })))
    void refreshInbox()
  }

  return (
    <PageSection title="Notifications">
      {error ? (
        <Alert variant="error" title="Could not load notifications" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <div className="notifications-page-toolbar">
        <p className="muted text-compact" style={{ margin: 0 }}>
          {loading ? 'Loading…' : `${rows.length} notification${rows.length === 1 ? '' : 's'}`}
          {!loading && unreadCount > 0 ? ` · ${unreadCount} unread` : ''}
        </p>
        {unreadCount > 0 ? (
          <Button variant="secondary" compact type="button" onClick={() => void handleMarkAllRead()}>
            Mark all read
          </Button>
        ) : null}
      </div>

      <TableCard className="notifications-page-card">
        {loading ? <p className="muted" style={{ margin: 0 }}>Loading notifications…</p> : null}
        {!loading && rows.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No notifications yet.
          </p>
        ) : null}
        {!loading && rows.length > 0 ? (
          <ul className="notifications-page-list">
            {rows.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`notifications-page-item${item.read_at ? '' : ' unread'}`}
                  onClick={() => void handleOpen(item)}
                >
                  <div className="notifications-page-item__head">
                    <strong className="notifications-page-item__title">{item.title}</strong>
                    <span className="muted small">{formatAppDateTime(item.created_at)}</span>
                  </div>
                  <div className="notifications-page-item__message">{item.message}</div>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </TableCard>
    </PageSection>
  )
}
