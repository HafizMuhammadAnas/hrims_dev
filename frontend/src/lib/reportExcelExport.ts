import type { ReportBuildResult } from './reportGeneratorData'
import { downloadTableExcel, type TableExportColumn } from './tableExcelExport'

/** Excel-compatible XML spreadsheet (opens in Excel without extra dependencies). */
export function downloadReportExcel(result: ReportBuildResult, fileBaseName = 'hrims-report'): void {
  const columns: TableExportColumn<Record<string, string | number | null>>[] = result.tableHeaders.map(
    (header) => ({
      header,
      value: (row) => row[header] ?? '',
    }),
  )
  downloadTableExcel(columns, result.tableRows, fileBaseName, 'Report data')
}
