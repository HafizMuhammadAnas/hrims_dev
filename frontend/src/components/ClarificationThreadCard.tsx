import type { ClarificationAttachment } from '../api/clarifications'

type Props = {
  title: string
  meta?: string | null
  message: string
  attachments?: ClarificationAttachment[]
  variant: 'region' | 'federal'
}

export function ClarificationThreadCard({ title, meta, message, attachments = [], variant }: Props) {
  return (
    <section
      className={`hr-request-view-template__card clarification-thread-card clarification-thread-card--${variant}`}
      aria-label={title}
    >
      <h4 className="clarification-thread-card__title">{title}</h4>
      {meta ? <p className="clarification-thread-card__meta muted text-compact">{meta}</p> : null}
      <div className="hr-request-view-template__prose-box clarification-thread-card__body">
        <p className="hr-request-view-template__prose" style={{ margin: 0 }}>
          {message}
        </p>
        {attachments.length > 0 ? (
          <ul className="hr-request-attachments-list clarification-thread-card__attachments">
            {attachments.map((a) => (
              <li key={a.id}>
                <a href={a.url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-compact">
                  {a.original_name}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
