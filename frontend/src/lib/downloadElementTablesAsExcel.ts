/**
 * Export compiled-record IWD cards as a structured, colour-coded Excel sheet.
 * Years are columns (X); dimension categories are rows (Y).
 */

type CellKind =
  | 'title'
  | 'metaLabel'
  | 'metaValue'
  | 'region'
  | 'indicator'
  | 'section'
  | 'colHeader'
  | 'totalHeader'
  | 'data'
  | 'dataAlt'
  | 'totalRow'
  | 'grandTotal'
  | 'na'
  | 'summary'
  | 'blank'

type ExcelCell = {
  value: string
  kind: CellKind
  mergeAcross?: number
}

type ExcelRow = {
  cells: ExcelCell[]
  height?: number
}

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

function isNumericValue(value: string): boolean {
  const trimmed = value.trim()
  return (
    trimmed !== '' &&
    trimmed !== '—' &&
    !trimmed.toLowerCase().includes('data not available') &&
    Number.isFinite(Number(trimmed))
  )
}

function blankRow(): ExcelRow {
  return { cells: [], height: 8 }
}

function titleRow(text: string, cols = 6): ExcelRow {
  return {
    height: 28,
    cells: [{ value: text, kind: 'title', mergeAcross: Math.max(0, cols - 1) }],
  }
}

function regionRow(text: string, cols = 6): ExcelRow {
  return {
    height: 24,
    cells: [{ value: text, kind: 'region', mergeAcross: Math.max(0, cols - 1) }],
  }
}

function indicatorRow(text: string, cols = 6): ExcelRow {
  return {
    height: 22,
    cells: [{ value: text, kind: 'indicator', mergeAcross: Math.max(0, cols - 1) }],
  }
}

function sectionRow(text: string, cols = 6): ExcelRow {
  return {
    height: 20,
    cells: [{ value: text, kind: 'section', mergeAcross: Math.max(0, cols - 1) }],
  }
}

function metaRows(pairs: Array<[string, string]>): ExcelRow[] {
  return pairs
    .filter(([, v]) => v.trim() !== '')
    .map(([label, value]) => ({
      cells: [
        { value: label, kind: 'metaLabel' },
        { value, kind: 'metaValue', mergeAcross: 4 },
      ],
    }))
}

function styledCellXml(cell: ExcelCell): string {
  const trimmed = cell.value.trim()
  const numeric = cell.kind !== 'metaLabel' && cell.kind !== 'colHeader' && isNumericValue(trimmed)
  const type = numeric ? 'Number' : 'String'
  const content = numeric ? trimmed : escapeXml(cell.value)
  const merge =
    cell.mergeAcross != null && cell.mergeAcross > 0 ? ` ss:MergeAcross="${cell.mergeAcross}"` : ''
  return `<Cell ss:StyleID="${cell.kind}"${merge}><Data ss:Type="${type}">${content}</Data></Cell>`
}

function rowXml(row: ExcelRow): string {
  const height = row.height != null ? ` ss:Height="${row.height}"` : ''
  if (row.cells.length === 0) {
    return `<Row${height}><Cell ss:StyleID="blank"><Data ss:Type="String"></Data></Cell></Row>`
  }
  return `<Row${height}>${row.cells.map((c) => styledCellXml(c)).join('')}</Row>`
}

type YearPanelData = {
  year: string
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

function dimensionMatrixRows(dimTitle: string, panels: YearPanelData[]): ExcelRow[] {
  if (panels.length === 0) return []

  const years = panels.map((p) => p.year)
  const categoryOrder: string[] = []
  for (const panel of panels) {
    for (const col of panel.columnOrder) {
      if (!categoryOrder.includes(col)) categoryOrder.push(col)
    }
  }

  const rows: ExcelRow[] = []
  rows.push(sectionRow(dimTitle, years.length + 2))
  rows.push({
    cells: [
      { value: 'Category', kind: 'colHeader' },
      ...years.map((y) => ({ value: y, kind: 'colHeader' as const })),
      { value: 'Grand Total', kind: 'totalHeader' },
    ],
  })

  categoryOrder.forEach((category, index) => {
    const byYear = panels.map((p) => p.values[category] ?? '')
    let grand = ''
    let sum = 0
    let any = false
    for (const v of byYear) {
      if (isNumericValue(v)) {
        sum += Number(v)
        any = true
      }
    }
    if (any) grand = String(sum)
    const isTotalLike = /^(total|unaccounted|grand\s*total)$/i.test(category.trim())
    const baseKind: CellKind = isTotalLike ? 'totalRow' : index % 2 === 0 ? 'data' : 'dataAlt'
    rows.push({
      cells: [
        { value: category, kind: baseKind },
        ...byYear.map((v) => ({ value: v, kind: baseKind })),
        { value: grand, kind: 'grandTotal' },
      ],
    })
  })
  return rows
}

function exportIwdCard(card: Element): ExcelRow[] {
  const rows: ExcelRow[] = []
  const indicatorTitle =
    cellText(card.querySelector('.iwd-card__indicator-banner')) ||
    cellText(card.querySelector('.iwd-card__toolbar-title')) ||
    'Indicator'
  rows.push(indicatorRow(indicatorTitle))

  const dept =
    cellText(card.closest('.ministry-compiled-dept-response-item')?.querySelector('.ministry-compiled-dept-response-item__dept'))
  if (dept) {
    rows.push({
      cells: [
        { value: 'Department', kind: 'metaLabel' },
        { value: dept, kind: 'metaValue', mergeAcross: 4 },
      ],
    })
  }

  const totalsSection = card.querySelector('.iwd-totals')
  if (totalsSection) {
    const { years, values, grandTotal } = parseYearTotals(totalsSection)
    if (years.length > 0) {
      rows.push(sectionRow('Year totals', years.length + 2))
      rows.push({
        cells: [
          { value: '', kind: 'colHeader' },
          ...years.map((y) => ({ value: y, kind: 'colHeader' as const })),
          { value: 'Grand Total', kind: 'totalHeader' },
        ],
      })
      rows.push({
        cells: [
          { value: 'Total', kind: 'totalRow' },
          ...values.map((v) => ({ value: v, kind: 'totalRow' as const })),
          { value: grandTotal, kind: 'grandTotal' },
        ],
      })
      rows.push(blankRow())
    } else if (totalsSection.querySelector('.iwd-totals__na-msg, .iwd-totals__na-badge')) {
      rows.push({
        cells: [
          { value: 'Year totals', kind: 'section' },
          { value: 'Data not available', kind: 'na', mergeAcross: 3 },
        ],
      })
      rows.push(blankRow())
    }
  }

  card.querySelectorAll('.iwd-dim').forEach((dim) => {
    const dimTitle = cellText(dim.querySelector('.iwd-dim__title')) || 'Dimension'
    if (dim.classList.contains('iwd-dim--na') || dim.querySelector('.iwd-totals__na-badge')) {
      rows.push({
        cells: [
          { value: dimTitle, kind: 'section' },
          { value: 'Data not available', kind: 'na', mergeAcross: 3 },
        ],
      })
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

function exportRegionCard(article: Element): ExcelRow[] {
  const rows: ExcelRow[] = []
  const regionName =
    cellText(article.querySelector('.ministry-compiled-region-card__title')) || 'Region'
  rows.push(regionRow(`Region: ${regionName}`))
  rows.push(blankRow())

  const cards = [...article.querySelectorAll('.iwd-card')]
  if (cards.length === 0) {
    const tables = [...article.querySelectorAll('table')].filter(
      (t) => !t.closest('.iwd-year-panel'),
    ) as HTMLTableElement[]
    for (const table of tables) {
      const trList = table.querySelectorAll('tr')
      trList.forEach((tr, rowIndex) => {
        const cells = [...tr.querySelectorAll('th, td')].map((c) => cellText(c))
        if (!cells.some((c) => c !== '')) return
        const isHeader = tr.querySelectorAll('th').length > 0 || rowIndex === 0
        rows.push({
          cells: cells.map((value) => ({
            value,
            kind: isHeader ? 'colHeader' : 'data',
          })),
        })
      })
      rows.push(blankRow())
    }
    if (tables.length === 0) {
      rows.push({
        cells: [{ value: 'No tabular response data for this region.', kind: 'na', mergeAcross: 4 }],
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

function exportOriginalRequest(element: HTMLElement): ExcelRow[] {
  const requestCard = element.querySelector('article.ministry-compiled-request-card')
  if (!requestCard) return []

  const rows: ExcelRow[] = []
  rows.push(sectionRow('Original request'))

  const reqId =
    cellText(requestCard.querySelector('.hr-request-view-template__req-id')) ||
    cellText(element.querySelector('.workflow-modal-hero__chip'))
  const title = cellText(requestCard.querySelector('.hr-request-view-template__title'))
  const status = cellText(requestCard.querySelector('.status-badge'))
  const due = cellText(requestCard.querySelector('.hr-request-view-template__meta-chip'))
  const regions = [...requestCard.querySelectorAll('.hr-request-view-template__meta-pill')]
    .map((el) => cellText(el))
    .filter(Boolean)
    .join(', ')

  const convention =
    cellText(
      [...requestCard.querySelectorAll('.hr-request-view-template__field-label')].find((el) =>
        /convention/i.test(cellText(el)),
      )?.nextElementSibling,
    ) ||
    cellText(
      [...requestCard.querySelectorAll('.hr-request-view-template__field-label')].find((el) =>
        /convention/i.test(cellText(el)),
      )?.parentElement?.querySelector('.hr-request-view-template__field-value'),
    )

  const fieldPairs: Array<[string, string]> = []
  requestCard.querySelectorAll('.hr-request-view-template__field-label').forEach((labelEl) => {
    const label = cellText(labelEl)
    const valueEl =
      (labelEl.nextElementSibling?.classList.contains('hr-request-view-template__field-value')
        ? labelEl.nextElementSibling
        : null) ??
      labelEl.parentElement?.querySelector(':scope > .hr-request-view-template__field-value')
    const value = cellText(valueEl)
    if (label && value) fieldPairs.push([label, value])
  })

  rows.push(
    ...metaRows([
      ['Request ID', reqId],
      ['Title', title],
      ['Status', status],
      ['Due', due.replace(/^Due:\s*/i, '')],
      ['Assigned regions', regions],
      ...(convention && !fieldPairs.some(([l]) => /convention/i.test(l))
        ? ([['Convention', convention]] as Array<[string, string]>)
        : []),
      ...fieldPairs,
    ]),
  )
  rows.push(blankRow())
  return rows
}

const STYLES_XML = `
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1A2233"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E8EDF7"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E8EDF7"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E8EDF7"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E8EDF7"/>
   </Borders>
  </Style>
  <Style ss:ID="title">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E3A6E" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#2E4FA3"/>
   </Borders>
  </Style>
  <Style ss:ID="metaLabel">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#1E3A6E"/>
   <Interior ss:Color="#EEF3FF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CFD9F3"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CFD9F3"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CFD9F3"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CFD9F3"/>
   </Borders>
  </Style>
  <Style ss:ID="metaValue">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1A2233"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CFD9F3"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CFD9F3"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CFD9F3"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CFD9F3"/>
   </Borders>
  </Style>
  <Style ss:ID="region">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#2E4FA3" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="indicator">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#3D6FD4" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="section">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#1E3A6E"/>
   <Interior ss:Color="#D6E4FF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#8FB4F0"/>
   </Borders>
  </Style>
  <Style ss:ID="colHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#1A3A5C"/>
   <Interior ss:Color="#E8EEFB" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B8CCFF"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B8CCFF"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B8CCFF"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B8CCFF"/>
   </Borders>
  </Style>
  <Style ss:ID="totalHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#17653A"/>
   <Interior ss:Color="#C8EED8" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#8FD4A8"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#8FD4A8"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#8FD4A8"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#8FD4A8"/>
   </Borders>
  </Style>
  <Style ss:ID="data">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1A2233"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE4F5"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE4F5"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE4F5"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE4F5"/>
   </Borders>
  </Style>
  <Style ss:ID="dataAlt">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1A2233"/>
   <Interior ss:Color="#F7F9FD" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE4F5"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE4F5"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE4F5"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE4F5"/>
   </Borders>
  </Style>
  <Style ss:ID="totalRow">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#916100"/>
   <Interior ss:Color="#FFF7E6" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F7DCA3"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F7DCA3"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F7DCA3"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F7DCA3"/>
   </Borders>
  </Style>
  <Style ss:ID="grandTotal">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#17653A"/>
   <Interior ss:Color="#E8F8EF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B8EACB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B8EACB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B8EACB"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B8EACB"/>
   </Borders>
  </Style>
  <Style ss:ID="na">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Italic="1" ss:Color="#6B7A99"/>
   <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="summary">
   <Alignment ss:Horizontal="Left" ss:Vertical="Top" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1A2233"/>
   <Interior ss:Color="#FCFFFE" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CFD9F3"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CFD9F3"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CFD9F3"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CFD9F3"/>
   </Borders>
  </Style>
  <Style ss:ID="blank">
   <Alignment ss:Vertical="Center"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
  </Style>
 </Styles>`

export type DownloadElementTablesAsExcelOptions = {
  sheetName?: string
  documentTitle?: string
}

/**
 * Build one colour-coded Excel sheet from compiled-record content:
 * document header → original request → region / indicator matrices → summary.
 */
export function downloadElementTablesAsExcel(
  element: HTMLElement,
  filename: string,
  options: DownloadElementTablesAsExcelOptions = {},
): void {
  const sheetRows: ExcelRow[] = []
  const docTitle = options.documentTitle?.trim() || 'Compiled record'
  sheetRows.push(titleRow(docTitle))
  sheetRows.push(blankRow())
  sheetRows.push(...exportOriginalRequest(element))

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
    sheetRows.push(sectionRow('Summary'))
    sheetRows.push({
      height: 48,
      cells: [{ value: summaryText || '—', kind: 'summary', mergeAcross: 5 }],
    })
  }

  const hasData = sheetRows.some((r) => r.cells.some((c) => c.value.trim() !== ''))
  if (!hasData) {
    throw new Error('No tabular response data found to export.')
  }

  const maxCols = sheetRows.reduce(
    (max, row) =>
      Math.max(
        max,
        row.cells.reduce((n, c) => n + 1 + (c.mergeAcross ?? 0), 0),
      ),
    6,
  )

  const columnWidths = Array.from({ length: maxCols }, (_, i) => {
    const width = i === 0 ? 160 : 90
    return `<Column ss:Index="${i + 1}" ss:AutoFitWidth="0" ss:Width="${width}"/>`
  }).join('\n   ')

  const xmlRows = sheetRows.map((row) => rowXml(row)).join('\n   ')
  const sheetName =
    (options.sheetName ?? 'Compiled record').replace(/[^\w ]/g, '').slice(0, 31) || 'Sheet1'

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
${STYLES_XML}
 <Worksheet ss:Name="${escapeXml(sheetName)}">
  <Table ss:ExpandedColumnCount="${maxCols}" x:FullColumns="1" x:FullRows="1">
   ${columnWidths}
   ${xmlRows}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <PageSetup>
    <Layout x:Orientation="Landscape"/>
    <Header x:Margin="0.3"/>
    <Footer x:Margin="0.3"/>
    <PageMargins x:Bottom="0.5" x:Left="0.5" x:Right="0.5" x:Top="0.5"/>
   </PageSetup>
   <FitToPage/>
   <Print>
    <FitHeight>0</FitHeight>
    <ValidPrinterInfo/>
    <HorizontalResolution>600</HorizontalResolution>
    <VerticalResolution>600</VerticalResolution>
   </Print>
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>1</SplitHorizontal>
   <TopRowBottomPane>1</TopRowBottomPane>
   <ActivePane>2</ActivePane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`

  const blob = new Blob([xml], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  })
  triggerDownload(blob, safeFilename(filename))
}
