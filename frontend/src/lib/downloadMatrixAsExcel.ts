/** Build and download a matrix table as an Excel-compatible .xls (SpreadsheetML). */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function safeFilename(name: string): string {
  const base = name.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_') || 'matrix'
  return base.toLowerCase().endsWith('.xls') ? base : `${base}.xls`
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function cellXml(value: string, type: 'String' | 'Number' = 'String'): string {
  const trimmed = value.trim()
  if (type === 'Number' && trimmed !== '' && Number.isFinite(Number(trimmed))) {
    return `<Cell><Data ss:Type="Number">${escapeXml(trimmed)}</Data></Cell>`
  }
  return `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`
}

export type MatrixExcelColumn = {
  header: string
  /** Year label for the parent header row (optional). */
  yearLabel?: string
}

export type MatrixExcelRow = {
  metric: string
  /** Status note e.g. data not available */
  note?: string
  cells: string[]
}

export type DownloadMatrixAsExcelInput = {
  sheetName: string
  filename: string
  /** Second header row: Gender / Age bucket / etc. */
  columns: MatrixExcelColumn[]
  rows: MatrixExcelRow[]
}

/**
 * Download matrix data as .xls that opens in Microsoft Excel / LibreOffice / Google Sheets.
 */
export function downloadMatrixAsExcel(input: DownloadMatrixAsExcelInput): void {
  const { sheetName, filename, columns, rows } = input
  const hasYearRow = columns.some((c) => Boolean(c.yearLabel))

  const yearHeaderCells: string[] = [cellXml('')]
  if (hasYearRow) {
    let i = 0
    while (i < columns.length) {
      const year = columns[i].yearLabel ?? ''
      let span = 1
      while (i + span < columns.length && (columns[i + span].yearLabel ?? '') === year) {
        span += 1
      }
      if (year) {
        yearHeaderCells.push(
          `<Cell ss:MergeAcross="${span - 1}"><Data ss:Type="String">${escapeXml(year)}</Data></Cell>`,
        )
      } else {
        for (let k = 0; k < span; k += 1) yearHeaderCells.push(cellXml(''))
      }
      i += span
    }
  }

  const colHeaderCells = [cellXml('Metric'), ...columns.map((c) => cellXml(c.header))]

  const bodyRows = rows.map((row) => {
    const metricLabel = row.note ? `${row.metric} (${row.note})` : row.metric
    const cells = [cellXml(metricLabel)]
    for (let i = 0; i < columns.length; i += 1) {
      const raw = row.cells[i] ?? ''
      const numeric =
        raw.trim() !== '' &&
        raw !== '—' &&
        !raw.toLowerCase().includes('data not available') &&
        Number.isFinite(Number(raw.trim()))
      cells.push(cellXml(raw, numeric ? 'Number' : 'String'))
    }
    return `<Row>${cells.join('')}</Row>`
  })

  const headerRows = hasYearRow
    ? [`<Row>${yearHeaderCells.join('')}</Row>`, `<Row>${colHeaderCells.join('')}</Row>`]
    : [`<Row>${colHeaderCells.join('')}</Row>`]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Top" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(sheetName.slice(0, 31) || 'Sheet1')}">
  <Table>
   ${headerRows.join('\n   ')}
   ${bodyRows.join('\n   ')}
  </Table>
 </Worksheet>
</Workbook>`

  const blob = new Blob([xml], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  })
  triggerDownload(blob, safeFilename(filename))
}
