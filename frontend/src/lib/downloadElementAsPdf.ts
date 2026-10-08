import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export type DownloadElementAsPdfOptions = {
  /** Page margin in millimetres (default 10). */
  marginMm?: number
  /** Applied to the element (and its clone) during capture for export-only CSS. */
  captureClass?: string
  /** Optional short title drawn in the page header. */
  headerTitle?: string
  /**
   * Existing PDF to append into. When provided, pages are added to this instance
   * and the file is not saved here (caller saves).
   */
  pdf?: InstanceType<typeof jsPDF>
  /** When true (default if `pdf` omitted), call pdf.save() at the end. */
  save?: boolean
}

const BREAK_SELECTORS = [
  '.iwd-card',
  '.iwd-year-panel',
  '.iwd-totals',
  '.iwd-dimension',
  '.iwd-card__toolbar',
  '.iwd-card__indicator-banner',
  '.dept-response-form-section',
  '.dept-response-form-section__summary',
  '.dept-response-form-section__body',
  '.ministry-compiled-region-card',
  '.ministry-compiled-dept-response-item',
  '.ministry-compiled-print-document',
  '.merge-compiled-records-section__record',
  '.dept-indicator-response-card',
  '.workflow-modal-hero',
  '.hr-request-view-template',
  '.hr-request-view-template__card',
  'article',
  'table',
  'thead',
  'tbody tr',
  'h1',
  'h2',
  'h3',
  'h4',
  'p',
  'details',
].join(',')

/** Prefer cutting the canvas between these block edges so rows/sections are not sliced. */
function collectCssBreakYs(root: HTMLElement): number[] {
  const rootRect = root.getBoundingClientRect()
  const scrollTop = root.scrollTop || 0
  const points = new Set<number>([0, Math.ceil(root.scrollHeight)])

  root.querySelectorAll(BREAK_SELECTORS).forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    const r = node.getBoundingClientRect()
    const top = Math.round(r.top - rootRect.top + scrollTop)
    const bottom = Math.round(r.bottom - rootRect.top + scrollTop)
    if (top > 0 && top < root.scrollHeight) points.add(top)
    if (bottom > 0 && bottom <= root.scrollHeight) points.add(bottom)
  })

  return [...points].sort((a, b) => a - b)
}

/**
 * Pick the largest break at or before idealEnd so we do not cut through a block.
 * Falls back to idealEnd when a single block is taller than one page.
 */
function choosePageEndCss(
  startCss: number,
  idealEndCss: number,
  breakYs: number[],
  minAdvanceCss: number,
): number {
  const floor = startCss + minAdvanceCss
  let best = -1
  for (const y of breakYs) {
    if (y <= floor) continue
    if (y > idealEndCss) break
    best = y
  }
  if (best > startCss) return best
  return idealEndCss
}

/** True when a canvas row is nearly blank (avoids emitting empty trailing pages). */
function rowIsMostlyBlank(canvas: HTMLCanvasElement, y: number): boolean {
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  const yy = Math.min(canvas.height - 1, Math.max(0, Math.floor(y)))
  const row = ctx.getImageData(0, yy, canvas.width, 1).data
  let nonWhite = 0
  const step = 16 * 4
  for (let i = 0; i < row.length; i += step) {
    const r = row[i]
    const g = row[i + 1]
    const b = row[i + 2]
    const a = row[i + 3]
    if (a > 8 && (r < 248 || g < 248 || b < 248)) {
      nonWhite++
      if (nonWhite > 3) return false
    }
  }
  return true
}

function trimBlankCanvasEdges(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')
  if (!ctx || canvas.height < 8) return canvas

  let top = 0
  let bottom = canvas.height - 1
  while (top < bottom && rowIsMostlyBlank(canvas, top)) top++
  while (bottom > top && rowIsMostlyBlank(canvas, bottom)) bottom--

  // Keep a little padding.
  top = Math.max(0, top - 4)
  bottom = Math.min(canvas.height - 1, bottom + 4)
  const height = bottom - top + 1
  if (height >= canvas.height - 2) return canvas

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
  const { marginMm = 10, captureClass, headerTitle, pdf: existingPdf } = options
  const shouldSave = options.save ?? !existingPdf
  const headerBandMm = 8
  const footerBandMm = 8

  if (captureClass) {
    element.classList.add(captureClass)
  }

  // Do NOT scroll the window — keeps the user on the action button.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })

  try {
    const cssWidth = Math.max(element.scrollWidth, element.offsetWidth, element.clientWidth, 600)
    const cssHeight = Math.max(element.scrollHeight, element.offsetHeight, element.clientHeight, 1)
    const breakYsCss = collectCssBreakYs(element)

    let canvas = await html2canvas(element, {
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
        clonedNode.querySelectorAll('details').forEach((d) => {
          d.open = true
        })
      },
    })

    canvas = trimBlankCanvasEdges(canvas)

    const pdf = existingPdf ?? new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const contentWidthMm = pageWidth - marginMm * 2
    const contentTopMm = marginMm + headerBandMm
    const contentBottomMm = pageHeight - marginMm - footerBandMm
    const contentHeightMm = Math.max(40, contentBottomMm - contentTopMm)

    const canvasPerCss = canvas.height / Math.max(cssHeight, 1)
    const mmPerCanvasPx = contentWidthMm / canvas.width
    const pageHeightCanvas = contentHeightMm / mmPerCanvasPx
    const minAdvanceCanvas = Math.min(pageHeightCanvas * 0.25, 80 * canvasPerCss)

    const breakYsCanvas = breakYsCss.map((y) => y * canvasPerCss)

    const shortTitle = (headerTitle ?? filename).trim().slice(0, 90)
    const pageSlices: Array<{ start: number; end: number }> = []
    let startCanvas = 0
    while (startCanvas < canvas.height - 1) {
      const idealEnd = Math.min(canvas.height, startCanvas + pageHeightCanvas)
      let endCanvas =
        idealEnd >= canvas.height - 1
          ? canvas.height
          : choosePageEndCss(startCanvas, idealEnd, breakYsCanvas, minAdvanceCanvas)
      if (endCanvas <= startCanvas + 2) {
        endCanvas = Math.min(canvas.height, startCanvas + pageHeightCanvas)
      }
      // Skip slices that are almost entirely blank.
      let sampleBlank = true
      for (let y = startCanvas; y < endCanvas; y += Math.max(8, Math.floor((endCanvas - startCanvas) / 6))) {
        if (!rowIsMostlyBlank(canvas, y)) {
          sampleBlank = false
          break
        }
      }
      if (!sampleBlank) {
        pageSlices.push({ start: startCanvas, end: endCanvas })
      }
      startCanvas = endCanvas
    }

    if (pageSlices.length === 0 && canvas.height > 0) {
      pageSlices.push({ start: 0, end: canvas.height })
    }

    const startingPageCount = pdf.getNumberOfPages()
    // If appending to an existing PDF that already has content, add a new page first.
    const needsLeadingPage = Boolean(existingPdf) && startingPageCount > 0

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
      const drawHeightMm = sliceH * mmPerCanvasPx
      pdf.addImage(imgData, 'PNG', marginMm, contentTopMm, contentWidthMm, drawHeightMm)

      pdf.setTextColor(30, 58, 110)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      if (shortTitle) {
        pdf.text(shortTitle, marginMm, marginMm + 4, {
          maxWidth: contentWidthMm,
        })
      }
      pdf.setDrawColor(197, 208, 230)
      pdf.setLineWidth(0.2)
      pdf.line(marginMm, marginMm + headerBandMm - 1.5, pageWidth - marginMm, marginMm + headerBandMm - 1.5)
    })

    // Stamp page numbers after all pages exist.
    const totalPages = pdf.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i)
      pdf.setTextColor(100, 116, 139)
      pdf.setFontSize(8)
      pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - marginMm + 1, {
        align: 'center',
      })
      pdf.setDrawColor(197, 208, 230)
      pdf.setLineWidth(0.2)
      pdf.line(
        marginMm,
        pageHeight - marginMm - footerBandMm + 1.5,
        pageWidth - marginMm,
        pageHeight - marginMm - footerBandMm + 1.5,
      )
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
