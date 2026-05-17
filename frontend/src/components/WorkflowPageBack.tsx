import { useNavigate } from 'react-router-dom'
import { workflowBackLabel } from '../lib/workflowNavigation'
import { Button } from './ui/Button'

type Props = {
  to: string
  label?: string
  className?: string
  /** `header` — above page title; `footer` — bottom of workflow view (default). */
  placement?: 'header' | 'footer'
}

export function WorkflowPageBack({ to, label, className, placement = 'footer' }: Props) {
  const navigate = useNavigate()
  const backTo = to.startsWith('/') ? to : `/${to}`
  const text = label ?? workflowBackLabel(backTo)

  const wrapperClass =
    placement === 'header'
      ? 'page-header-back'
      : 'hr-request-view-footback hr-request-view-footback--actions'

  return (
    <div className={wrapperClass + (className ? ` ${className}` : '')}>
      <Button variant="secondary" compact type="button" onClick={() => navigate(backTo)}>
        {text}
      </Button>
    </div>
  )
}
