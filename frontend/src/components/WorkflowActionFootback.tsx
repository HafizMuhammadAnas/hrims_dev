import type { CSSProperties, ReactNode } from 'react'
import { Alert, type AlertVariant } from './ui/Alert'

export type WorkflowActionFeedback = {
  message: string
  /** Validation hints (e.g. missing required comment) vs save/API failures. */
  kind: 'validation' | 'error'
}

type Props = {
  feedback: WorkflowActionFeedback | null
  onDismiss?: () => void
  children: ReactNode
  className?: string
  style?: CSSProperties
}

function feedbackTitle(kind: WorkflowActionFeedback['kind']): string {
  return kind === 'validation' ? 'Action required' : 'Could not save'
}

function feedbackVariant(kind: WorkflowActionFeedback['kind']): AlertVariant {
  return kind === 'validation' ? 'warning' : 'error'
}

export function WorkflowActionAlert({
  feedback,
  onDismiss,
  className,
}: {
  feedback: WorkflowActionFeedback
  onDismiss?: () => void
  className?: string
}) {
  return (
    <Alert
      variant={feedbackVariant(feedback.kind)}
      title={feedbackTitle(feedback.kind)}
      className={className ?? 'workflow-action-footback__alert'}
      onDismiss={onDismiss}
    >
      <p style={{ margin: 0 }}>{feedback.message}</p>
    </Alert>
  )
}

/** Action bar with inline alert above buttons (validation / errors stay near the control). */
export function WorkflowActionFootback({
  feedback,
  onDismiss,
  children,
  className,
  style,
}: Props) {
  return (
    <div
      className={
        className ?? 'hr-request-view-footback hr-request-view-footback--actions workflow-action-footback'
      }
      style={style}
    >
      {feedback ? (
        <Alert
          variant={feedbackVariant(feedback.kind)}
          title={feedbackTitle(feedback.kind)}
          className="workflow-action-footback__alert"
          onDismiss={onDismiss}
        >
          <p style={{ margin: 0 }}>{feedback.message}</p>
        </Alert>
      ) : null}
      <div className="workflow-action-footback__actions">{children}</div>
    </div>
  )
}
