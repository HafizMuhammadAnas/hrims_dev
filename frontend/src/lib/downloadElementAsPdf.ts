import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export type DownloadElementAsPdfOptions = {
  /** Page margin in millimetres (default 10). */
  marginMm?: number
  /** Applied to the element (and its clone) during capture for export-only CSS. */
  captureClass?: string
  /** Optional short title drawn in the page header. */
  headerTitle?: string
}

const BREAK_SELECTORS = [
  '.iwd-card',
  '.iwd-year-panel',
  '.iwd-totals',
  '.iwd-dimension',
  '.iwd-card__toolbar',
  '.iwd-card__indicator-banner',
  '.ministry-compiled-region-card',
  '.ministry-compiled-dept-response-item',
  '.ministry-compiled-print-document',
  '.merge-compiled-records-section__record',
  '.dept-indicator-response-card',
  '.workflow-modal-hero',
  '.hr-request-view-template',
  'article',
  'table',
  'thead',
  'tbody tr',
  'h1',
  'h2',
  'h3',
  'h4',
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

/** Rasterize a DOM subtree and save as a multi-page A4 PDF with safer page cuts. */
export async function downloadElementAsPdf(
  element: HTMLElement,
  filename: string,
  options: DownloadElementAsPdfOptions = {},
): Promise<void> {
  const { marginMm = 10, captureClass, headerTitle } = options
  const headerBandMm = 8
  const footerBandMm = 8

  if (captureClass) {
    element.classList.add(captureClass)
  }

  window.scrollTo(0, 0)
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })

  try {
    const cssWidth = Math.max(element.scrollWidth, element.offsetWidth, element.clientWidth)
    const cssHeight = Math.max(element.scrollHeight, element.offsetHeight, element.clientHeight)
    const breakYsCss = collectCssBreakYs(element)

    const canvas = await html2canvas(element, {
      scale: 2,
      logging: false,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: cssWidth,
      height: cssHeight,
      windowWidth: cssWidth,
      windowHeight: cssHeight,
      scrollX: 0,
      scrollY: -window.scrollY,
      onclone: (_doc, clonedNode) => {
        if (captureClass && clonedNode instanceof HTMLElement) {
          clonedNode.classList.add(captureClass)
        }
      },
    })

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const contentWidthMm = pageWidth - marginMm * 2
    const contentTopMm = marginMm + headerBandMm
    const contentBottomMm = pageHeight - marginMm - footerBandMm
    const contentHeightMm = Math.max(40, contentBottomMm - contentTopMm)

    // Map CSS pixels → canvas pixels → PDF mm for the full image width.
    const canvasPerCss = canvas.height / Math.max(cssHeight, 1)
    const mmPerCanvasPx = contentWidthMm / canvas.width
    const pageHeightCanvas = contentHeightMm / mmPerCanvasPx
    const minAdvanceCanvas = Math.min(pageHeightCanvas * 0.35, 120 * canvasPerCss)

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
      // Avoid tiny leftover pages / zero-height slices.
      if (endCanvas <= startCanvas + 2) {
        endCanvas = Math.min(canvas.height, startCanvas + pageHeightCanvas)
      }
      pageSlices.push({ start: startCanvas, end: endCanvas })
      startCanvas = endCanvas
    }

    const totalPages = pageSlices.length
    pageSlices.forEach((slice, pageIndex) => {
      if (pageIndex > 0) pdf.addPage()

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

      pdf.setTextColor(100, 116, 139)
      pdf.text(`Page ${pageIndex + 1} of ${totalPages}`, pageWidth / 2, pageHeight - marginMm + 1, {
        align: 'center',
      })
      pdf.line(
        marginMm,
        pageHeight - marginMm - footerBandMm + 1.5,
        pageWidth - marginMm,
        pageHeight - marginMm - footerBandMm + 1.5,
      )
    })

    const safeName = filename.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_') || 'compiled-record'
    pdf.save(safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`)
  } finally {
    if (captureClass) {
      element.classList.remove(captureClass)
    }
  }
}
