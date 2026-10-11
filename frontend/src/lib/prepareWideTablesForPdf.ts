/** Shared class applied during PDF capture so wide matrices fit / wrap. */
export const PDF_MATRIX_FIT_CLASS = 'pdf-matrix-fit'

/** Max middle (data) columns per IWD year-panel row-group on A4 portrait. */
const MAX_IWD_DATA_COLS = 5

/** Max year-groups per dept-data-matrix row-group (each year may span several gender cols). */
const MAX_MATRIX_YEAR_GROUPS = 2

type Undo = () => void

function tableColumnCount(table: HTMLTableElement): number {
  const row = table.querySelector('thead tr') ?? table.querySelector('tr')
  if (!row) return 0
  return Array.from(row.children).reduce((sum, cell) => {
    return sum + Math.max(1, (cell as HTMLTableCellElement).colSpan || 1)
  }, 0)
}

function analyzeIwdHeader(ths: Element[]): {
  leadCount: number
  trailCount: number
  middleCount: number
} {
  let leadCount = 0
  if (ths[0]?.classList.contains('iwd-year-panel__pwd-total-h')) leadCount = 1

  let trailCount = 0
  const last = ths[ths.length - 1]
  const secondLast = ths[ths.length - 2]
  if (last?.classList.contains('iwd-year-panel__total-h')) trailCount += 1
  if (secondLast?.classList.contains('iwd-year-panel__ua-h')) trailCount += 1

  const middleCount = Math.max(0, ths.length - leadCount - trailCount)
  return { leadCount, trailCount, middleCount }
}

function cloneRowKeepingColumns(sourceRow: Element, keep: Set<number>): HTMLTableRowElement {
  const tr = sourceRow.cloneNode(false) as HTMLTableRowElement
  Array.from(sourceRow.children).forEach((cell, index) => {
    if (keep.has(index)) tr.appendChild(cell.cloneNode(true))
  })
  return tr
}

/**
 * Rebuild one IWD year panel as stacked row-groups under a single year header.
 * PWD total appears only on the first row; Unaccounted / Total only on the last.
 * No (1/2) labels.
 */
function splitIwdYearPanel(panel: HTMLElement, maxDataCols: number): Undo | null {
  const table = panel.querySelector<HTMLTableElement>('table.iwd-year-panel__table')
  if (!table) return null

  const headRow = table.querySelector('thead tr')
  const bodyRow = table.querySelector('tbody tr')
  if (!headRow || !bodyRow) return null

  const ths = Array.from(headRow.children)
  const { leadCount, trailCount, middleCount } = analyzeIwdHeader(ths)
  if (middleCount <= maxDataCols) return null

  const middleStart = leadCount
  const trailStart = ths.length - trailCount
  const chunks: number[][] = []
  for (let i = 0; i < middleCount; i += maxDataCols) {
    const slice: number[] = []
    for (let j = 0; j < maxDataCols && i + j < middleCount; j++) {
      slice.push(middleStart + i + j)
    }
    chunks.push(slice)
  }

  const parent = panel.parentElement
  if (!parent) return null

  const yearLabel =
    panel.querySelector('.iwd-year-panel__head')?.textContent?.trim() || 'Year'

  const replacement = document.createElement('div')
  replacement.className = `${panel.className} pdf-matrix-fit__split-panel`.trim()

  const head = document.createElement('div')
  head.className = 'iwd-year-panel__head'
  head.textContent = yearLabel
  replacement.appendChild(head)

  const scroll = document.createElement('div')
  scroll.className = 'iwd-year-panel__scroll'

  chunks.forEach((middleIdxs, chunkIndex) => {
    const isFirst = chunkIndex === 0
    const isLast = chunkIndex === chunks.length - 1
    const keep = new Set<number>()
    if (isFirst) {
      for (let i = 0; i < leadCount; i++) keep.add(i)
    }
    middleIdxs.forEach((idx) => keep.add(idx))
    if (isLast) {
      for (let i = trailStart; i < ths.length; i++) keep.add(i)
    }

    const rowTable = document.createElement('table')
    rowTable.className = 'iwd-year-panel__table pdf-matrix-fit__row-table'
    const thead = document.createElement('thead')
    thead.appendChild(cloneRowKeepingColumns(headRow, keep))
    const tbody = document.createElement('tbody')
    tbody.appendChild(cloneRowKeepingColumns(bodyRow, keep))
    rowTable.appendChild(thead)
    rowTable.appendChild(tbody)
    scroll.appendChild(rowTable)
  })

  replacement.appendChild(scroll)
  parent.insertBefore(replacement, panel)

  const prevDisplay = panel.style.display
  panel.style.display = 'none'
  panel.setAttribute('data-pdf-matrix-hidden', '1')

  return () => {
    replacement.remove()
    panel.style.display = prevDisplay
    panel.removeAttribute('data-pdf-matrix-hidden')
  }
}

type YearGroup = { start: number; span: number }

function filterRowByColumnKeep(
  tr: Element,
  keep: Set<number>,
): HTMLTableRowElement {
  const out = tr.cloneNode(false) as HTMLTableRowElement
  const cells = Array.from(tr.children) as HTMLTableCellElement[]
  let c = 0
  for (const cell of cells) {
    const span = Math.max(1, cell.colSpan || 1)
    const start = c
    const end = c + span
    let kept = 0
    for (let i = start; i < end; i++) {
      if (keep.has(i)) kept++
    }
    if (kept > 0) {
      const clone = cell.cloneNode(true) as HTMLTableCellElement
      if (span > 1 && kept !== span) clone.colSpan = kept
      out.appendChild(clone)
    }
    c = end
  }
  return out
}

/**
 * Stack dept-data-matrix year groups as multiple table rows under one section.
 * Metric / include columns only on the first row-group; grand total only on the last.
 * No (1/2) labels.
 */
function splitDeptDataMatrix(wrap: HTMLElement, maxYearGroups: number): Undo | null {
  const table = wrap.querySelector<HTMLTableElement>('table.dept-data-matrix')
  if (!table) return null

  const headRows = Array.from(table.querySelectorAll('thead tr'))
  if (headRows.length < 1) return null

  const yearRow = headRows[0]
  if (!yearRow) return null

  const groups: YearGroup[] = []
  let col = 0
  Array.from(yearRow.children).forEach((cell) => {
    const th = cell as HTMLTableCellElement
    const span = Math.max(1, th.colSpan || 1)
    if (th.classList.contains('dept-data-matrix__year-head')) {
      groups.push({ start: col, span })
    }
    col += span
  })

  if (groups.length <= maxYearGroups) return null

  const leadCols = groups[0]?.start ?? 0
  const last = groups[groups.length - 1]
  const totalCols = tableColumnCount(table)
  const trailStart = last ? last.start + last.span : totalCols

  const parent = wrap.parentElement
  if (!parent) return null

  const chunks: YearGroup[][] = []
  for (let i = 0; i < groups.length; i += maxYearGroups) {
    chunks.push(groups.slice(i, i + maxYearGroups))
  }

  const replacement = wrap.cloneNode(false) as HTMLElement
  replacement.className = `${wrap.className} pdf-matrix-fit__split-wrap`.trim()

  // Preserve section heading / toolbar once (no part labels).
  const head = wrap.querySelector('.dept-data-matrix-section__head')
  if (head) replacement.appendChild(head.cloneNode(true))

  const bodyRows = Array.from(table.querySelectorAll('tbody tr'))

  chunks.forEach((yearChunk, chunkIndex) => {
    const isFirst = chunkIndex === 0
    const isLast = chunkIndex === chunks.length - 1
    const keep = new Set<number>()
    if (isFirst) {
      for (let i = 0; i < leadCols; i++) keep.add(i)
    }
    yearChunk.forEach((g) => {
      for (let i = 0; i < g.span; i++) keep.add(g.start + i)
    })
    if (isLast) {
      for (let i = trailStart; i < totalCols; i++) keep.add(i)
    }

    const scroll = document.createElement('div')
    scroll.className = 'dept-data-matrix-wrap table-card-scroll pdf-matrix-fit__row-wrap'

    const rowTable = document.createElement('table')
    rowTable.className = 'dept-data-matrix pdf-matrix-fit__row-table'
    const thead = document.createElement('thead')
    headRows.forEach((hr) => thead.appendChild(filterRowByColumnKeep(hr, keep)))
    const tbody = document.createElement('tbody')
    bodyRows.forEach((br) => tbody.appendChild(filterRowByColumnKeep(br, keep)))
    rowTable.appendChild(thead)
    rowTable.appendChild(tbody)
    scroll.appendChild(rowTable)
    replacement.appendChild(scroll)
  })

  // Copy hint paragraphs once if present.
  wrap.querySelectorAll('.dept-data-matrix__hint').forEach((hint) => {
    replacement.appendChild(hint.cloneNode(true))
  })

  parent.insertBefore(replacement, wrap)

  const prevDisplay = wrap.style.display
  wrap.style.display = 'none'
  wrap.setAttribute('data-pdf-matrix-hidden', '1')

  return () => {
    replacement.remove()
    wrap.style.display = prevDisplay
    wrap.removeAttribute('data-pdf-matrix-hidden')
  }
}

/**
 * Prepare wide disaggregation / matrix tables for PDF capture:
 * - apply fit/wrap styles
 * - wrap wide IWD / dept matrices into stacked rows (no duplicate summary columns)
 *
 * Returns a cleanup function that restores the live DOM (React nodes stay intact).
 */
export function prepareWideTablesForPdfCapture(root: HTMLElement): Undo {
  const undos: Undo[] = []

  root.classList.add(PDF_MATRIX_FIT_CLASS)
  undos.push(() => root.classList.remove(PDF_MATRIX_FIT_CLASS))

  const iwdPanels = Array.from(root.querySelectorAll<HTMLElement>('.iwd-year-panel')).filter(
    (el) => !el.closest('[data-pdf-matrix-hidden]'),
  )
  for (const panel of iwdPanels) {
    if (panel.getAttribute('data-pdf-matrix-hidden') === '1') continue
    const undo = splitIwdYearPanel(panel, MAX_IWD_DATA_COLS)
    if (undo) undos.push(undo)
  }

  const matrixSections = Array.from(
    root.querySelectorAll<HTMLElement>('.dept-data-matrix-section, .dept-data-matrix-wrap'),
  )
  const seen = new Set<HTMLElement>()
  for (const el of matrixSections) {
    const wrap = el.classList.contains('dept-data-matrix-section')
      ? el
      : el.closest<HTMLElement>('.dept-data-matrix-section') ?? el
    if (seen.has(wrap) || wrap.getAttribute('data-pdf-matrix-hidden') === '1') continue
    seen.add(wrap)
    const undo = splitDeptDataMatrix(wrap, MAX_MATRIX_YEAR_GROUPS)
    if (undo) undos.push(undo)
  }

  return () => {
    for (let i = undos.length - 1; i >= 0; i--) undos[i]?.()
  }
}
