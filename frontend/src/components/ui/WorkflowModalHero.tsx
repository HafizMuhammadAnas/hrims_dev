import type { ReactNode } from 'react'

type Props = {
  eyebrow?: string
  title: string
  titleId?: string
  /** Omit on embedded page cards (no close control). */
  onClose?: () => void
  closeLabel?: string
  /** Page-embedded tabbed card ? gradient hero without close button. */
  embedded?: boolean
  children?: ReactNode
}

export function WorkflowModalHero({
  eyebrow,
  title,
  titleId,
  onClose,
  closeLabel = 'Close',
  embedded = false,
  children,
}: Props) {
  return (
    <header
      className={
        'workflow-modal-hero' + (embedded ? ' workflow-modal-hero--embedded' : '')
      }
    >
      <div className="workflow-modal-hero__inner">
        <div className="workflow-modal-hero__text">
          {eyebrow ? <p className="workflow-modal-hero__eyebrow">{eyebrow}</p> : null}
          <h3 id={titleId} className="workflow-modal-hero__title">
            {title}
          </h3>
          {children ? <div className="workflow-modal-hero__badges">{children}</div> : null}
        </div>
        {!embedded && onClose ? (
          <button
            type="button"
            className="modal-close workflow-modal-hero__close"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <span aria-hidden="true">&times;</span>
          </button>
        ) : null}
      </div>
    </header>
  )
}
