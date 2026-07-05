export type TableExportColumn<T> = {
  header: string
  value: (row: T) => string | number | null | undefined
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function cellType(value: string | number | null | undefined): 'String' | 'Number' {
  return typeof value === 'number' ? 'Number' : 'String'
}

/** Excel-compatible XML spreadsheet (opens in Excel without extra dependencies). */
export function downloadTableExcel<T>(
  columns: TableExportColumn<T>[],
  rows: T[],
  fileBaseName: string,
  worksheetName = 'Data',
): void {
  const headers = columns.map((column) => column.header)
  const dataRows: (string | number | null)[][] = [
    headers,
    ...rows.map((row) =>
      columns.map((column) => {
        const value = column.value(row)
        return value ?? ''
      }),
    ),
  ]

  const rowXml = dataRows
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

  const safeSheetName = worksheetName.replace(/[^\w ]/g, '').slice(0, 31) || 'Data'
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(safeSheetName)}">
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
