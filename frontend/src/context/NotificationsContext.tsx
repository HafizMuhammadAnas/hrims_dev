import {
  createContext,
  useCallback,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notifications'
import { useAuth } from '../auth/AuthContext'
import { Alert } from '../components/ui/Alert'
import type { AppNotification } from '../types/notification'

type ToastVariant = 'success' | 'error' | 'info' | 'warning'

type ToastItem = {
  id: number
  variant: ToastVariant
  message: string
  title?: string
}

type NotifyFns = {
  success: (message: string, title?: string) => void
  error: (message: string, title?: string) => void
  info: (message: string, title?: string) => void
  warning: (message: string, title?: string) => void
  inbox: AppNotification[]
  unreadCount: number
  inboxLoading: boolean
  refreshInbox: () => Promise<void>
  markRead: (id: number) => Promise<void>
  markAllRead: () => Promise<void>
}

const NotificationsContext = createContext<NotifyFns | null>(null)

const DISMISS_MS: Record<ToastVariant, number> = {
  success: 4500,
  info: 5000,
  warning: 6500,
  error: 9000,
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [inbox, setInbox] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [inboxLoading, setInboxLoading] = useState(false)
  const idRef = useRef(0)

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const push = useCallback(
    (variant: ToastVariant, message: string, title?: string) => {
      const id = ++idRef.current
      setToasts((t) => [...t, { id, variant, message, title }])
      window.setTimeout(() => remove(id), DISMISS_MS[variant])
    },
    [remove],
  )

  const refreshInbox = useCallback(async () => {
    if (!user) {
      setInbox([])
      setUnreadCount(0)
      return
    }

    setInboxLoading(true)
    try {
      const res = await fetchNotifications()
      setInbox(res.data)
      setUnreadCount(res.meta.unread_count)
    } catch {
      setInbox([])
      setUnreadCount(0)
    } finally {
      setInboxLoading(false)
    }
  }, [user])

  const markRead = useCallback(async (id: number) => {
    await markNotificationRead(id)
    let changedUnread = false
    setInbox((items) =>
      items.map((item) => {
        if (item.id !== id) return item
        if (item.read_at === null) changedUnread = true
        return { ...item, read_at: item.read_at ?? new Date().toISOString() }
      }),
    )
    if (changedUnread) {
      setUnreadCount((count) => Math.max(0, count - 1))
    }
  }, [])

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead()
    const now = new Date().toISOString()
    setInbox((items) => items.map((item) => ({ ...item, read_at: item.read_at ?? now })))
    setUnreadCount(0)
  }, [])

  useEffect(() => {
    void refreshInbox()
  }, [refreshInbox])

  useEffect(() => {
    if (!user) return
    const timer = window.setInterval(() => {
      void refreshInbox()
    }, 30000)
    return () => window.clearInterval(timer)
  }, [user, refreshInbox])

  const value = useMemo<NotifyFns>(
    () => ({
      success: (message, title) => push('success', message, title),
      error: (message, title) => push('error', message, title),
      info: (message, title) => push('info', message, title),
      warning: (message, title) => push('warning', message, title),
      inbox,
      unreadCount,
      inboxLoading,
      refreshInbox,
      markRead,
      markAllRead,
    }),
    [push, inbox, unreadCount, inboxLoading, refreshInbox, markRead, markAllRead],
  )

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <div className="app-notify-stack" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div key={t.id} className="app-notify-item">
            <Alert
              variant={t.variant === 'success' ? 'success' : t.variant === 'warning' ? 'warning' : t.variant === 'info' ? 'info' : 'error'}
              title={t.title}
              onDismiss={() => remove(t.id)}
            >
              {t.message}
            </Alert>
          </div>
        ))}
      </div>
    </NotificationsContext.Provider>
  )
}

export function useNotify(): NotifyFns {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error('useNotify must be used within NotificationsProvider')
  }
  return ctx
}
