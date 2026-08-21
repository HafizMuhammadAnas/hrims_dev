import { useEffect, useRef, type ReactNode } from 'react'

export type AlertVariant = 'error' | 'warning' | 'success' | 'info'

type AlertProps = {
  variant: AlertVariant
  title?: string
  children: ReactNode
  /** When set, shows a dismiss control */
  onDismiss?: () => void
  className?: string
}

const roleByVariant: Record<AlertVariant, 'alert' | 'status'> = {
  error: 'alert',
  warning: 'alert',
  success: 'status',
  info: 'status',
}

export function Alert({ variant, title, children, onDismiss, className = '' }: AlertProps) {
  return (
    <div
      className={`app-alert app-alert--${variant}${className ? ` ${className}` : ''}`}
      role={roleByVariant[variant]}
      aria-live={variant === 'error' || variant === 'warning' ? 'assertive' : 'polite'}
    >
      <div className="app-alert__body">
        {title ? <div className="app-alert__title">{title}</div> : null}
        <div className="app-alert__content">{children}</div>
      </div>
      {onDismiss ? (
        <button type="button" className="app-alert__dismiss" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      ) : null}
    </div>
  )
}

type FieldErrorProps = {
  message?: string | null
  id?: string
}

export type ActionNotice = {
  variant: AlertVariant
  title: string
  message: string
}

const AUTO_DISMISS_MS: Partial<Record<AlertVariant, number>> = {
  success: 4500,
  info: 5000,
}

/** Dismissible page/section feedback after a user action. Success/info close on their own. */
export function ActionNoticeAlert({
  notice,
  onDismiss,
  className,
}: {
  notice: ActionNotice | null
  onDismiss?: () => void
  className?: string
}) {
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (!notice) return
    const ms = AUTO_DISMISS_MS[notice.variant]
    if (!ms) return
    const id = window.setTimeout(() => onDismissRef.current?.(), ms)
    return () => window.clearTimeout(id)
  }, [notice])

  if (!notice) return null
  return (
    <Alert variant={notice.variant} title={notice.title} onDismiss={onDismiss} className={className}>
      <p style={{ margin: 0 }}>{notice.message}</p>
    </Alert>
  )
}

/** Single validation line under an input (connect with `aria-describedby`). */
export function FieldError({ message, id }: FieldErrorProps) {
  if (!message) return null
  return (
    <p id={id} className="field-error" role="alert">
      {message}
    </p>
  )
}
