import type { ReportBuildResult } from './reportGeneratorData'

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function cellType(value: string | number | null): 'String' | 'Number' {
  return typeof value === 'number' ? 'Number' : 'String'
}

/** Excel-compatible XML spreadsheet (opens in Excel without extra dependencies). */
export function downloadReportExcel(result: ReportBuildResult, fileBaseName = 'hrims-report'): void {
  const rows: (string | number | null)[][] = [
    result.tableHeaders,
    ...result.tableRows.map((row) => result.tableHeaders.map((h) => row[h] ?? '')),
  ]

  const rowXml = rows
    .map((row) => {
      const cells = row
        .map((value) => {
          const v = value ?? ''
          const type = cellType(v)
          const content = type === 'Number' ? String(v) : escapeXml(String(v))
          return `<Cell><Data ss:Type="${type}">${content}</Data></Cell>`
        })
        .join('')
      return `<Row>${cells}</Row>`
    })
    .join('')

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Report data">
  <Table>${rowXml}</Table>
 </Worksheet>
</Workbook>`

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileBaseName}-${new Date().toISOString().slice(0, 10)}.xls`
  a.click()
  URL.revokeObjectURL(url)
}
