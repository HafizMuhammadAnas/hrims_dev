/**
 * Export compiled-record IWD cards as a single Excel sheet.
 * Years are columns (X); dimension categories are rows (Y).
 */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function safeFilename(name: string): string {
  const base = name.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_') || 'compiled-record'
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

function cellText(el: Element | null | undefined): string {
  if (!el) return ''
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function cellXml(value: string): string {
  const trimmed = value.trim()
  const numeric =
    trimmed !== '' &&
    trimmed !== '—' &&
    !trimmed.toLowerCase().includes('data not available') &&
    Number.isFinite(Number(trimmed))
  if (numeric) {
    return `<Cell><Data ss:Type="Number">${escapeXml(trimmed)}</Data></Cell>`
  }
  return `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`
}

function rowXml(cells: string[]): string {
  return `<Row>${cells.map((c) => cellXml(c)).join('')}</Row>`
}

function blankRow(): string[] {
  return []
}

function padRows(rows: string[][]): string[][] {
  const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 1)
  return rows.map((row) => {
    const next = [...row]
    while (next.length < maxCols) next.push('')
    return next
  })
}

type YearPanelData = {
  year: string
  /** Column header → cell value (includes Unaccounted / Total). */
  values: Record<string, string>
  columnOrder: string[]
}

function parseYearPanel(panel: Element): YearPanelData | null {
  const year = cellText(panel.querySelector('.iwd-year-panel__head'))
  if (!year) return null
  const table = panel.querySelector('table')
  if (!table) return null
  const headers = [...table.querySelectorAll('thead th')].map((th) => cellText(th))
  const bodyCells = [...(table.querySelector('tbody tr')?.querySelectorAll('td') ?? [])].map((td) =>
    cellText(td),
  )
  if (headers.length === 0) return null
  const values: Record<string, string> = {}
  const columnOrder: string[] = []
  for (let i = 0; i < headers.length; i += 1) {
    const key = headers[i] || `Col ${i + 1}`
    columnOrder.push(key)
    values[key] = bodyCells[i] ?? ''
  }
  return { year, values, columnOrder }
}

function parseYearTotals(section: Element): { years: string[]; values: string[]; grandTotal: string } {
  const years: string[] = []
  const values: string[] = []
  let grandTotal = ''
  section.querySelectorAll('.iwd-totals__year').forEach((box) => {
    const label = cellText(box.querySelector('.iwd-totals__year-label'))
    const value =
      cellText(box.querySelector('.iwd-totals__value')) ||
      (box.querySelector('input') as HTMLInputElement | null)?.value?.trim() ||
      ''
    if (!label) return
    if (box.classList.contains('iwd-totals__year--grand') || /grand\s*total/i.test(label)) {
      grandTotal = value
      return
    }
    years.push(label)
    values.push(value)
  })
  return { years, values, grandTotal }
}

/** Pivot year panels into Category × Year matrix rows. */
function dimensionMatrixRows(
  dimTitle: string,
  panels: YearPanelData[],
): string[][] {
  if (panels.length === 0) return []

  const years = panels.map((p) => p.year)
  const categoryOrder: string[] = []
  for (const panel of panels) {
    for (const col of panel.columnOrder) {
      if (!categoryOrder.includes(col)) categoryOrder.push(col)
    }
  }

  const rows: string[][] = []
  rows.push([dimTitle])
  rows.push(['Category', ...years, 'Grand Total'])

  for (const category of categoryOrder) {
    const byYear = panels.map((p) => p.values[category] ?? '')
    let grand = ''
    let sum = 0
    let any = false
    for (const v of byYear) {
      const n = Number(v)
      if (v.trim() !== '' && Number.isFinite(n)) {
        sum += n
        any = true
      }
    }
    if (any) grand = String(sum)
    rows.push([category, ...byYear, grand])
  }
  return rows
}

function exportIwdCard(card: Element): string[][] {
  const rows: string[][] = []
  const indicatorTitle =
    cellText(card.querySelector('.iwd-card__indicator-banner')) ||
    cellText(card.querySelector('.iwd-card__toolbar-title')) ||
    'Indicator'
  rows.push([indicatorTitle])

  const totalsSection = card.querySelector('.iwd-totals')
  if (totalsSection) {
    const { years, values, grandTotal } = parseYearTotals(totalsSection)
    if (years.length > 0) {
      rows.push(['Year totals'])
      rows.push(['', ...years, 'Grand Total'])
      rows.push(['Total', ...values, grandTotal])
      rows.push(blankRow())
    } else if (totalsSection.querySelector('.iwd-totals__na-msg, .iwd-totals__na-badge')) {
      rows.push(['Year totals', 'data not available'])
      rows.push(blankRow())
    }
  }

  card.querySelectorAll('.iwd-dim').forEach((dim) => {
    const dimTitle = cellText(dim.querySelector('.iwd-dim__title')) || 'Dimension'
    if (dim.classList.contains('iwd-dim--na') || dim.querySelector('.iwd-totals__na-badge')) {
      rows.push([dimTitle, 'data not available'])
      rows.push(blankRow())
      return
    }
    const panels = [...dim.querySelectorAll('.iwd-year-panel')]
      .map((p) => parseYearPanel(p))
      .filter((p): p is YearPanelData => p != null)
    if (panels.length === 0) return
    for (const row of dimensionMatrixRows(dimTitle, panels)) {
      rows.push(row)
    }
    rows.push(blankRow())
  })

  return rows
}

function exportRegionCard(article: Element): string[][] {
  const rows: string[][] = []
  const regionName =
    cellText(article.querySelector('.ministry-compiled-region-card__title')) || 'Region'
  rows.push([`Region: ${regionName}`])
  rows.push(blankRow())

  const cards = [...article.querySelectorAll('.iwd-card')]
  if (cards.length === 0) {
    // Fallback: no IWD cards — keep any remaining non-year-panel tables as flat blocks.
    const tables = [...article.querySelectorAll('table')].filter(
      (t) => !t.closest('.iwd-year-panel'),
    ) as HTMLTableElement[]
    for (const table of tables) {
      const trList = table.querySelectorAll('tr')
      trList.forEach((tr) => {
        const cells = [...tr.querySelectorAll('th, td')].map((c) => cellText(c))
        if (cells.some((c) => c !== '')) rows.push(cells)
      })
      rows.push(blankRow())
    }
    return rows
  }

  for (const card of cards) {
    for (const row of exportIwdCard(card)) {
      rows.push(row)
    }
    rows.push(blankRow())
  }
  return rows
}

export type DownloadElementTablesAsExcelOptions = {
  sheetName?: string
  documentTitle?: string
}

/**
 * Build one Excel sheet from compiled-record content:
 * years across columns, dimension categories down rows (one matrix per dimension).
 */
export function downloadElementTablesAsExcel(
  element: HTMLElement,
  filename: string,
  options: DownloadElementTablesAsExcelOptions = {},
): void {
  const sheetRows: string[][] = []
  if (options.documentTitle?.trim()) {
    sheetRows.push([options.documentTitle.trim()])
    sheetRows.push(blankRow())
  }

  const regionArticles = [
    ...element.querySelectorAll('article.ministry-compiled-region-card'),
  ].filter(
    (a) =>
      !a.classList.contains('ministry-compiled-request-card') &&
      !a.classList.contains('ministry-compiled-summary-card'),
  )

  if (regionArticles.length > 0) {
    for (const article of regionArticles) {
      for (const row of exportRegionCard(article)) {
        sheetRows.push(row)
      }
    }
  } else {
    // Standalone IWD list (no region wrappers)
    const cards = [...element.querySelectorAll('.iwd-card')]
    if (cards.length === 0) {
      throw new Error('No indicator tables found in this compiled record to export.')
    }
    for (const card of cards) {
      for (const row of exportIwdCard(card)) {
        sheetRows.push(row)
      }
      sheetRows.push(blankRow())
    }
  }

  const summaryCard = element.querySelector('article.ministry-compiled-summary-card')
  if (summaryCard) {
    const summaryText = cellText(summaryCard.querySelector('.ministry-compiled-summary-card__prose'))
    sheetRows.push(['Summary'])
    sheetRows.push([summaryText || '—'])
  }

  const hasData = sheetRows.some((r) => r.some((c) => c.trim() !== ''))
  if (!hasData) {
    throw new Error('No tabular response data found to export.')
  }

  const padded = padRows(sheetRows)
  const xmlRows = padded.map((row) => rowXml(row)).join('\n   ')
  const sheetName =
    (options.sheetName ?? 'Compiled record').replace(/[^\w ]/g, '').slice(0, 31) || 'Sheet1'

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
 <Worksheet ss:Name="${escapeXml(sheetName)}">
  <Table>
   ${xmlRows}
  </Table>
 </Worksheet>
</Workbook>`

  const blob = new Blob([xml], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  })
  triggerDownload(blob, safeFilename(filename))
}
