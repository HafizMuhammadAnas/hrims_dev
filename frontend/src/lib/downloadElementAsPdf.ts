import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export type DownloadElementAsPdfOptions = {
  /** Page margin in millimetres (default 6 — tight so pages feel continuous). */
  marginMm?: number
  /** Applied to the element (and its clone) during capture for export-only CSS. */
  captureClass?: string
  /** Optional short title drawn only on the first page header. */
  headerTitle?: string
  /**
   * Existing PDF to append into. When provided, pages are added to this instance
   * and the file is not saved here (caller saves).
   */
  pdf?: InstanceType<typeof jsPDF>
  /** When true (default if `pdf` omitted), call pdf.save() at the end. */
  save?: boolean
  /**
   * Draw first-page header + last-page footer.
   * Defaults to `save`. Set true on the final append when the caller saves externally.
   */
  finalizeChrome?: boolean
}

/** Header on page 1 only; page label on the last page only. */
function applyPdfChrome(
  pdf: InstanceType<typeof jsPDF>,
  options: { marginMm: number; headerTitle?: string },
): void {
  const { marginMm, headerTitle } = options
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const contentWidthMm = pageWidth - marginMm * 2
  const totalPages = pdf.getNumberOfPages()
  if (totalPages < 1) return

  const shortTitle = (headerTitle ?? '').trim().slice(0, 90)

  if (shortTitle) {
    pdf.setPage(1)
    pdf.setTextColor(30, 58, 110)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.text(shortTitle, marginMm, marginMm + 3.5, { maxWidth: contentWidthMm })
    pdf.setDrawColor(197, 208, 230)
    pdf.setLineWidth(0.2)
    pdf.line(marginMm, marginMm + 5.5, pageWidth - marginMm, marginMm + 5.5)
  }

  pdf.setPage(totalPages)
  pdf.setTextColor(100, 116, 139)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text(`Page ${totalPages} of ${totalPages}`, pageWidth / 2, pageHeight - marginMm + 1, {
    align: 'center',
  })
  pdf.setDrawColor(197, 208, 230)
  pdf.setLineWidth(0.2)
  pdf.line(marginMm, pageHeight - marginMm - 2, pageWidth - marginMm, pageHeight - marginMm - 2)
}

/** Structural edges we may cut between — prefer small/flowing blocks over huge cards. */
const BREAK_SELECTORS = [
  '.pdf-section-break',
  '.iwd-year-panel',
  '.iwd-totals',
  '.iwd-dimension',
  '.iwd-card__toolbar',
  '.iwd-card__indicator-banner',
  '.iwd-dimension__head',
  '.dept-response-form-section__summary',
  '.dept-indicator-response-card',
  '.dept-indicator-supplementary',
  '.ministry-compiled-dept-response-item',
  '.merge-compiled-records-section__record',
  '.hr-request-view-template__section',
  '.hr-request-view-template__card',
  '.report-generator__chart-panel',
  '.reporting-rank-row',
  '.reporting-dashboard__card',
  '.regional-response-export__block',
  '.dept-task-response-modal__panel',
  '.form-row',
  'article',
  'table',
  'thead',
  'tbody tr',
  'tr',
  'h1',
  'h2',
  'h3',
  'h4',
  'p',
  'li',
  'summary',
  'ul',
  'ol',
].join(',')

/** Headings / labels that must not be left alone at the bottom of a page. */
const KEEP_WITH_NEXT_SELECTORS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'summary',
  '.dept-response-form-section__summary',
  '.iwd-card__indicator-banner',
  '.iwd-dimension__head',
  '.hr-request-view-template__section-label',
  '.hr-request-view-template__field-label',
  '.report-generator__table-head',
  '.workflow-modal-hero__title',
  '.dashboard-panel-title',
  '.card-section-heading',
].join(',')

type CssBreak = { y: number; kind: 'edge' | 'keep-with-next-end' }

function collectCssBreaks(root: HTMLElement): {
  breakYs: number[]
  /** Ranges [top, bottom] that must stay on the same page when possible (heading + following block). */
  keepRanges: Array<{ top: number; bottom: number }>
} {
  const rootRect = root.getBoundingClientRect()
  const scrollTop = root.scrollTop || 0
  const rootH = Math.ceil(root.scrollHeight)
  const points = new Set<number>([0, rootH])
  const keepRanges: Array<{ top: number; bottom: number }> = []

  const toY = (node: HTMLElement, edge: 'top' | 'bottom') => {
    const r = node.getBoundingClientRect()
    return Math.round((edge === 'top' ? r.top : r.bottom) - rootRect.top + scrollTop)
  }

  root.querySelectorAll(BREAK_SELECTORS).forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    const top = toY(node, 'top')
    const bottom = toY(node, 'bottom')
    if (top > 0 && top < rootH) points.add(top)
    if (bottom > 0 && bottom <= rootH) points.add(bottom)
  })

  root.querySelectorAll(KEEP_WITH_NEXT_SELECTORS).forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    const top = toY(node, 'top')
    let bottom = toY(node, 'bottom')
    // Keep heading with the next meaningful sibling / parent body chunk.
    let next: Element | null = node.nextElementSibling
    while (next && !(next instanceof HTMLElement)) next = next.nextElementSibling
    if (next instanceof HTMLElement) {
      const nextBottom = toY(next, 'bottom')
      // Cap keep-with-next so a huge following block doesn't force a whole-page move.
      const maxKeep = 220
      bottom = Math.min(nextBottom, top + maxKeep)
    } else {
      bottom = Math.min(rootH, bottom + 48)
    }
    if (top >= 0 && bottom > top) {
      keepRanges.push({ top, bottom })
      points.add(top)
    }
  })

  return {
    breakYs: [...points].sort((a, b) => a - b),
    keepRanges,
  }
}

/** True when a canvas row is nearly blank. Threshold is strict so letter tips are not treated as white. */
function rowIsMostlyBlank(canvas: HTMLCanvasElement, y: number): boolean {
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  const yy = Math.min(canvas.height - 1, Math.max(0, Math.floor(y)))
  const row = ctx.getImageData(0, yy, canvas.width, 1).data
  let nonWhite = 0
  const step = 12 * 4
  for (let i = 0; i < row.length; i += step) {
    const r = row[i]
    const g = row[i + 1]
    const b = row[i + 2]
    const a = row[i + 3]
    // Strict: light anti-aliased ink still counts as content.
    if (a > 8 && (r < 252 || g < 252 || b < 252)) {
      nonWhite++
      if (nonWhite > 2) return false
    }
  }
  return true
}

/** Snap upward to a fully blank gap so we never start/end a page mid-glyph. */
function snapToBlankGap(
  canvas: HTMLCanvasElement,
  y: number,
  direction: 'up' | 'down',
  limit: number,
): number {
  const max = canvas.height - 1
  let yy = Math.min(max, Math.max(0, Math.round(y)))
  if (direction === 'up') {
    const floor = Math.max(0, Math.floor(limit))
    while (yy > floor && !rowIsMostlyBlank(canvas, yy)) yy--
    while (yy > floor && rowIsMostlyBlank(canvas, yy - 1)) yy--
    return yy
  }
  const ceil = Math.min(max, Math.ceil(limit))
  while (yy < ceil && !rowIsMostlyBlank(canvas, yy)) yy++
  while (yy < ceil && rowIsMostlyBlank(canvas, yy + 1)) yy++
  return yy
}

/** Prefer a blank band close to idealEnd so pages stay full (less empty whitespace). */
function findBlankBandBreak(
  canvas: HTMLCanvasElement,
  start: number,
  idealEnd: number,
  minAdvance: number,
): number {
  const floor = Math.floor(start + minAdvance)
  const from = Math.min(canvas.height - 1, Math.floor(idealEnd))
  // Prefer breaks in the bottom 35% of the page so we don't leave large empty regions.
  const preferFrom = Math.floor(start + (idealEnd - start) * 0.65)
  let blankRun = 0
  const needed = 4
  let fallback = -1
  for (let y = from; y > floor; y--) {
    if (rowIsMostlyBlank(canvas, y)) {
      blankRun++
      if (blankRun >= needed) {
        const cut = y + 1
        if (cut >= preferFrom) return cut
        if (fallback < 0) fallback = cut
      }
    } else {
      blankRun = 0
    }
  }
  return fallback
}

function breaksKeepRange(y: number, keepRanges: Array<{ top: number; bottom: number }>): boolean {
  return keepRanges.some((r) => y > r.top + 2 && y < r.bottom - 2)
}

/**
 * Choose a page end that:
 * - avoids cutting through glyphs
 * - avoids orphaning headings
 * - fills most of the page (reduces large empty gaps)
 */
function choosePageEnd(
  canvas: HTMLCanvasElement,
  start: number,
  idealEnd: number,
  breakYs: number[],
  keepRangesCanvas: Array<{ top: number; bottom: number }>,
  minAdvance: number,
): number {
  const floor = start + minAdvance
  // Only accept structural breaks that still fill ≥65% of the page.
  const fillFloor = start + (idealEnd - start) * 0.65

  let bestFilled = -1
  let bestAny = -1
  for (const y of breakYs) {
    if (y <= floor) continue
    if (y > idealEnd) break
    if (breaksKeepRange(y, keepRangesCanvas)) continue
    bestAny = y
    if (y >= fillFloor) bestFilled = y
  }
  if (bestFilled > start) {
    return snapToBlankGap(canvas, bestFilled, 'up', floor)
  }

  const blankBreak = findBlankBandBreak(canvas, start, idealEnd, minAdvance)
  if (blankBreak > start && !breaksKeepRange(blankBreak, keepRangesCanvas)) {
    return blankBreak
  }

  // Last resort: cut at idealEnd but snap up to a blank gap so we don't slice letters.
  const snapped = snapToBlankGap(canvas, idealEnd, 'up', floor)
  if (snapped > floor && !breaksKeepRange(snapped, keepRangesCanvas)) {
    return snapped
  }
  if (bestAny > start) {
    return snapToBlankGap(canvas, bestAny, 'up', floor)
  }
  return Math.max(floor + 1, snapped)
}

function measureLeadingBlankRows(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d')
  if (!ctx || canvas.height < 8) return 0
  let top = 0
  const max = canvas.height - 1
  while (top < max && rowIsMostlyBlank(canvas, top)) top++
  // Generous padding so heading ascenders are never trimmed away.
  return Math.max(0, top - 24)
}

function measureTrailingBlankRows(canvas: HTMLCanvasElement, fromTop: number): number {
  const ctx = canvas.getContext('2d')
  if (!ctx || canvas.height < 8) return canvas.height - 1
  let bottom = canvas.height - 1
  while (bottom > fromTop && rowIsMostlyBlank(canvas, bottom)) bottom--
  return Math.min(canvas.height - 1, bottom + 16)
}

function trimCanvas(canvas: HTMLCanvasElement, top: number, bottom: number): HTMLCanvasElement {
  const height = bottom - top + 1
  if (height >= canvas.height - 2 || height < 8) return canvas
  const trimmed = document.createElement('canvas')
  trimmed.width = canvas.width
  trimmed.height = height
  const tctx = trimmed.getContext('2d')
  if (!tctx) return canvas
  tctx.fillStyle = '#ffffff'
  tctx.fillRect(0, 0, trimmed.width, trimmed.height)
  tctx.drawImage(canvas, 0, top, canvas.width, height, 0, 0, canvas.width, height)
  return trimmed
}

/** Rasterize a DOM subtree and save/append as multi-page A4 PDF with safer page cuts. */
export async function downloadElementAsPdf(
  element: HTMLElement,
  filename: string,
  options: DownloadElementAsPdfOptions = {},
): Promise<InstanceType<typeof jsPDF>> {
  const { marginMm = 6, captureClass, headerTitle, pdf: existingPdf } = options
  const shouldSave = options.save ?? !existingPdf
  const shouldFinalizeChrome = options.finalizeChrome ?? shouldSave
  /** Reserved only on the document’s first page so the title does not overlap content. */
  const headerBandMm = 8

  if (captureClass) {
    element.classList.add(captureClass)
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })

  try {
    const cssWidth = Math.max(element.scrollWidth, element.offsetWidth, element.clientWidth, 600)
    const cssHeight = Math.max(element.scrollHeight, element.offsetHeight, element.clientHeight, 1)
    const { breakYs: breakYsCss, keepRanges: keepRangesCss } = collectCssBreaks(element)

    const rawCanvas = await html2canvas(element, {
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: cssWidth,
      height: cssHeight,
      windowWidth: cssWidth,
      windowHeight: cssHeight,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      onclone: (_doc, clonedNode) => {
        if (!(clonedNode instanceof HTMLElement)) return
        if (captureClass) clonedNode.classList.add(captureClass)
        clonedNode.style.transform = 'none'
        clonedNode.style.opacity = '1'
        clonedNode.style.visibility = 'visible'
        clonedNode.style.position = 'static'
        clonedNode.style.left = 'auto'
        clonedNode.style.top = 'auto'
        clonedNode.querySelectorAll('details').forEach((d) => {
          d.open = true
        })
        const sourceControls = element.querySelectorAll('input, textarea, select')
        const cloneControls = clonedNode.querySelectorAll('input, textarea, select')
        const count = Math.min(sourceControls.length, cloneControls.length)
        for (let i = 0; i < count; i++) {
          const src = sourceControls[i]
          const dst = cloneControls[i]
          if (src instanceof HTMLInputElement && dst instanceof HTMLInputElement) {
            if (src.type === 'checkbox' || src.type === 'radio') {
              dst.checked = src.checked
            } else if (src.type !== 'file') {
              dst.value = src.value
            }
          } else if (src instanceof HTMLTextAreaElement && dst instanceof HTMLTextAreaElement) {
            dst.value = src.value
          } else if (src instanceof HTMLSelectElement && dst instanceof HTMLSelectElement) {
            dst.value = src.value
          }
        }
      },
    })

    const canvasPerCss = rawCanvas.height / Math.max(cssHeight, 1)
    const trimTop = measureLeadingBlankRows(rawCanvas)
    const trimBottom = measureTrailingBlankRows(rawCanvas, trimTop)
    const canvas = trimCanvas(rawCanvas, trimTop, trimBottom)

    const pdf = existingPdf ?? new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const contentWidthMm = pageWidth - marginMm * 2
    const fullContentHeightMm = Math.max(40, pageHeight - marginMm * 2)
    const firstPageContentHeightMm = Math.max(40, fullContentHeightMm - headerBandMm)

    const mmPerCanvasPx = contentWidthMm / canvas.width
    const isFreshPdf = !existingPdf
    const needsLeadingPage = Boolean(existingPdf) && pdf.getNumberOfPages() > 0
    const shortTitle = (headerTitle ?? filename).trim().slice(0, 90)

    const breakYsCanvas = breakYsCss
      .map((y) => y * canvasPerCss - trimTop)
      .filter((y) => y > 0 && y < canvas.height)
      .sort((a, b) => a - b)

    const keepRangesCanvas = keepRangesCss
      .map((r) => ({
        top: r.top * canvasPerCss - trimTop,
        bottom: r.bottom * canvasPerCss - trimTop,
      }))
      .filter((r) => r.bottom > 0 && r.top < canvas.height)

    const pageSlices: Array<{ start: number; end: number; isDocFirstPage: boolean }> = []
    let startCanvas = 0
    let sliceIndex = 0
    while (startCanvas < canvas.height - 1) {
      // Snap start downward out of any mid-glyph region (fixes clipped "Request"/"Response").
      if (startCanvas > 0) {
        startCanvas = snapToBlankGap(canvas, startCanvas, 'down', startCanvas + 40)
      }

      const isDocFirstPage = isFreshPdf && sliceIndex === 0
      const pageHeightMm = isDocFirstPage && shortTitle ? firstPageContentHeightMm : fullContentHeightMm
      const pageHeightCanvas = pageHeightMm / mmPerCanvasPx
      // Allow earlier breaks only when necessary; prefer filling the page.
      const minAdvanceCanvas = Math.min(pageHeightCanvas * 0.55, 140 * canvasPerCss)

      const idealEnd = Math.min(canvas.height, startCanvas + pageHeightCanvas)
      let endCanvas =
        idealEnd >= canvas.height - 1
          ? canvas.height
          : choosePageEnd(
              canvas,
              startCanvas,
              idealEnd,
              breakYsCanvas,
              keepRangesCanvas,
              minAdvanceCanvas,
            )
      if (endCanvas <= startCanvas + 2) {
        endCanvas = Math.min(canvas.height, startCanvas + pageHeightCanvas)
      }

      let sampleBlank = true
      const step = Math.max(8, Math.floor((endCanvas - startCanvas) / 8))
      for (let y = startCanvas; y < endCanvas; y += step) {
        if (!rowIsMostlyBlank(canvas, y)) {
          sampleBlank = false
          break
        }
      }
      if (!sampleBlank) {
        pageSlices.push({ start: startCanvas, end: endCanvas, isDocFirstPage })
        sliceIndex++
      }
      startCanvas = endCanvas
    }

    if (pageSlices.length === 0 && canvas.height > 0) {
      pageSlices.push({
        start: 0,
        end: canvas.height,
        isDocFirstPage: isFreshPdf,
      })
    }

    pageSlices.forEach((slice, pageIndex) => {
      if (pageIndex > 0 || needsLeadingPage) pdf.addPage()

      const sliceH = Math.max(1, slice.end - slice.start)
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = Math.ceil(sliceH)
      const ctx = pageCanvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
      ctx.drawImage(
        canvas,
        0,
        slice.start,
        canvas.width,
        sliceH,
        0,
        0,
        canvas.width,
        sliceH,
      )

      const imgData = pageCanvas.toDataURL('image/png')
      let drawHeightMm = sliceH * mmPerCanvasPx
      const drawTopMm =
        slice.isDocFirstPage && shortTitle ? marginMm + headerBandMm : marginMm
      // Never let the image overflow the page (jsPDF clips the top/bottom when it does).
      const maxDrawHeightMm = pageHeight - drawTopMm - marginMm
      if (drawHeightMm > maxDrawHeightMm) {
        drawHeightMm = maxDrawHeightMm
      }
      pdf.addImage(imgData, 'PNG', marginMm, drawTopMm, contentWidthMm, drawHeightMm)
    })

    if (shouldFinalizeChrome) {
      applyPdfChrome(pdf, { marginMm, headerTitle: shortTitle })
    }

    if (shouldSave) {
      const safeName = filename.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_') || 'compiled-record'
      pdf.save(safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`)
    }

    return pdf
  } finally {
    if (captureClass) {
      element.classList.remove(captureClass)
    }
  }
}
