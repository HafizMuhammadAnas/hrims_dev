export type ReceivedRequestWorkflowStatus =
  | 'pending'
  | 'Clarification pending'
  | 'Clarification answered'
  | 'Distributed'
  | 'In Process'
  | 'Response Delivered'

import type { StatusBadgeTone } from './statusBadgeTone'

export function receivedRequestStatusPresentation(status: ReceivedRequestWorkflowStatus): {
  label: string
  tone: StatusBadgeTone
} {
  switch (status) {
    case 'pending':
      return { label: 'Pending', tone: 'pending' }
    case 'Clarification pending':
      return { label: 'Clarifying', tone: 'warning' }
    case 'Clarification answered':
      return { label: 'Answered', tone: 'success' }
    case 'Distributed':
      return { label: 'Distributed', tone: 'in-progress' }
    case 'In Process':
      return { label: 'Processing', tone: 'warning' }
    case 'Response Delivered':
      return { label: 'Delivered', tone: 'success' }
    default:
      return { label: 'Pending', tone: 'pending' }
  }
}

/** Filter dropdown: internal value → short label. */
export const RECEIVED_REQUEST_STATUS_FILTER_OPTIONS: {
  value: ReceivedRequestWorkflowStatus
  label: string
}[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'Clarification pending', label: 'Clarifying' },
  { value: 'Clarification answered', label: 'Answered' },
  { value: 'Distributed', label: 'Distributed' },
  { value: 'In Process', label: 'Processing' },
  { value: 'Response Delivered', label: 'Delivered' },
]
