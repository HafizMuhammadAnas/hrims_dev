import type { CompiledRecordRow, RegionalResponseRow } from '../api/lists'
import type { HrRequestRow } from '../types/hrRequest'
import { formatAppDate } from './dateFormat'
import { hrRequestStatusPresentation } from './hrRequestListMetrics'
import { regionalResponseReviewPresentation } from './regionalResponseReviewStatus'
import { receivedRequestStatusPresentation, type ReceivedRequestWorkflowStatus } from './receivedRequestWorkflow'
import type { PendingRegionDisplayRow } from './regionalSubmissionCoverage'
import type { TableExportColumn } from './tableExcelExport'

function formatCompiledStatusLabel(status: string): string {
  if (status === 'submitted') return 'Submitted'
  if (status === 'draft') return 'Draft'
  const s = status.replace(/-/g, ' ')
  if (!s) return status
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function hrRequestRegionsLabel(row: HrRequestRow): string {
  if (row.regions?.length) return row.regions.map((region) => region.name).join(', ')
  return row.region_name ?? ''
}

export const HR_REQUEST_EXPORT_COLUMNS: TableExportColumn<HrRequestRow>[] = [
  { header: 'ID', value: (row) => row.id },
  { header: 'Title', value: (row) => row.title },
  { header: 'Convention', value: (row) => row.conv },
  { header: 'Region(s)', value: hrRequestRegionsLabel },
  { header: 'Due', value: (row) => formatAppDate(row.date) },
  {
    header: 'Status',
    value: (row) => hrRequestStatusPresentation(row.status).label,
  },
]

export type ReceivedRequestExportRow = HrRequestRow & { _status: ReceivedRequestWorkflowStatus }

export const RECEIVED_REQUEST_EXPORT_COLUMNS: TableExportColumn<ReceivedRequestExportRow>[] = [
  { header: 'Request ID', value: (row) => row.id },
  { header: 'Title', value: (row) => row.title },
  { header: 'Convention', value: (row) => row.conv },
  { header: 'Date', value: (row) => formatAppDate(row.date) },
  {
    header: 'Status',
    value: (row) => receivedRequestStatusPresentation(row._status).label,
  },
]

export const REGIONAL_RESPONSE_EXPORT_COLUMNS: TableExportColumn<RegionalResponseRow>[] = [
  { header: 'Response ID', value: (row) => row.id },
  { header: 'Request', value: (row) => row.req_id },
  { header: 'Region', value: (row) => row.region_name ?? '' },
  { header: 'Title', value: (row) => row.title },
  { header: 'Submitted', value: (row) => formatAppDate(row.submission_date) },
  {
    header: 'Status',
    value: (row) => regionalResponseReviewPresentation(row.review_status).label,
  },
]

export type RegionalResponseDisplayExportRow = {
  responseId: string
  requestId: string
  region: string
  title: string
  submitted: string
  status: string
}

export const REGIONAL_RESPONSE_DISPLAY_EXPORT_COLUMNS: TableExportColumn<RegionalResponseDisplayExportRow>[] =
  [
    { header: 'Response ID', value: (row) => row.responseId },
    { header: 'Request', value: (row) => row.requestId },
    { header: 'Region', value: (row) => row.region },
    { header: 'Title', value: (row) => row.title },
    { header: 'Submitted', value: (row) => row.submitted },
    { header: 'Status', value: (row) => row.status },
  ]

export function mapRegionalResponseDisplayExportRow(
  entry: { kind: 'submission'; row: RegionalResponseRow } | PendingRegionDisplayRow,
): RegionalResponseDisplayExportRow {
  if (entry.kind === 'pending') {
    return {
      responseId: '',
      requestId: entry.reqId,
      region: entry.regionName,
      title: entry.requestTitle,
      submitted: 'Not yet',
      status: 'Pending',
    }
  }
  const row = entry.row
  return {
    responseId: row.id,
    requestId: row.req_id,
    region: row.region_name ?? '',
    title: row.title,
    submitted: formatAppDate(row.submission_date),
    status: regionalResponseReviewPresentation(row.review_status).label,
  }
}

export const COMPILED_RECORD_EXPORT_COLUMNS: TableExportColumn<CompiledRecordRow>[] = [
  { header: 'Record ID', value: (row) => row.id },
  { header: 'HR request', value: (row) => row.req_id ?? '' },
  { header: 'Title', value: (row) => row.title },
  {
    header: 'Regions',
    value: (row) => (row.region_names?.length ? row.region_names.join(', ') : ''),
  },
  {
    header: 'Status',
    value: (row) => formatCompiledStatusLabel(row.status),
  },
  { header: 'Compilation date', value: (row) => formatAppDate(row.compilation_date) },
]
