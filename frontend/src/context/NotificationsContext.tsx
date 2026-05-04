import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Alert } from '../components/ui/Alert'

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
}

const NotificationsContext = createContext<NotifyFns | null>(null)

const DISMISS_MS: Record<ToastVariant, number> = {
  success: 4500,
  info: 5000,
  warning: 6500,
  error: 9000,
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
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

  const value = useMemo<NotifyFns>(
    () => ({
      success: (message, title) => push('success', message, title),
      error: (message, title) => push('error', message, title),
      info: (message, title) => push('info', message, title),
      warning: (message, title) => push('warning', message, title),
    }),
    [push],
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
