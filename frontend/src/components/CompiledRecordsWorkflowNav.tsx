import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LABEL_COMPILATION_CENTER, LABEL_OPEN_HR_REQUEST, LABEL_REGIONAL_RESPONSES } from '../lib/uiLabels'

/** Path passed as `from` when drilling in from the compilation records list / modal. */
export const COMPILED_RECORDS_FROM_PATH = '/compiled-records'

export type CompiledRecordsWorkflowTab = 'request' | 'responses' | 'compilation'

type Props = {
  reqId: string
  /** Highlight the current page. Omit (or null) in modals so every item is a link. */
  activeTab?: CompiledRecordsWorkflowTab | null
  className?: string
}

function tabClass(isCurrent: boolean) {
  return 'compiled-record-modal-tab' + (isCurrent ? ' compiled-record-modal-tab--active' : '')
}

function TabItem({ isCurrent, to, children }: { isCurrent: boolean; to: string; children: ReactNode }) {
  if (isCurrent) {
    return (
      <span className={tabClass(true)} aria-current="page">
        {children}
      </span>
    )
  }
  return (
    <Link className={tabClass(false)} to={to}>
      {children}
    </Link>
  )
}

export function CompiledRecordsWorkflowNav({ reqId, activeTab = null, className = '' }: Props) {
  const { pathname } = useLocation()
  const encFrom = encodeURIComponent(COMPILED_RECORDS_FROM_PATH)
  const encReq = encodeURIComponent(reqId)

  const compilationBase =
    pathname === '/federal-compilation' || pathname.startsWith('/federal-compilation/')
      ? '/federal-compilation'
      : '/compilation'

  const requestTo = `/requests/${encReq}?from=${encFrom}`
  const responsesTo = `/responses?reqId=${encReq}&from=${encFrom}`
  const compilationTo = `${compilationBase}?reqId=${encReq}&from=${encFrom}`

  const modalMode = activeTab == null

  const onRequest = !modalMode && activeTab === 'request'
  const onResponses = !modalMode && activeTab === 'responses'
  const onCompilation =
    !modalMode &&
    activeTab === 'compilation' &&
    (pathname === '/compilation' || pathname === '/federal-compilation')

  return (
    <nav
      className={`compiled-record-modal-tabs compiled-records-page-workflow-nav${className ? ` ${className}` : ''}`.trim()}
      aria-label="Compilation workflow navigation"
    >
      <TabItem isCurrent={onRequest} to={requestTo}>
        {LABEL_OPEN_HR_REQUEST}
      </TabItem>
      <TabItem isCurrent={onResponses} to={responsesTo}>
        {LABEL_REGIONAL_RESPONSES}
      </TabItem>
      <TabItem isCurrent={onCompilation} to={compilationTo}>
        {LABEL_COMPILATION_CENTER}
      </TabItem>
    </nav>
  )
}

export function isFromCompiledRecordsPath(from: string | null | undefined): boolean {
  return Boolean(from?.includes('compiled-records'))
}
