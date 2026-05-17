import type { ReactNode } from 'react'

type ModalHeaderProps = {
  title: ReactNode
  onClose: () => void
}

export function ModalHeader({ title, onClose }: ModalHeaderProps) {
  return (
    <div className="modal-head">
      <h3>{title}</h3>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  )
}

type ModalActionsProps = {
  children: ReactNode
  className?: string
}

export function ModalActions({ children, className = '' }: ModalActionsProps) {
  return <div className={`modal-actions${className ? ` ${className}` : ''}`}>{children}</div>
}
