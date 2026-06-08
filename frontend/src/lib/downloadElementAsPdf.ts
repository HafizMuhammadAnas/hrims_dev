import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export type DownloadElementAsPdfOptions = {
  /** Page margin in millimetres (default 12). */
  marginMm?: number
  /** Applied to the element (and its clone) during capture for export-only CSS. */
  captureClass?: string
}

/** Rasterize a DOM subtree and save as a multi-page A4 PDF. */
export async function downloadElementAsPdf(
  element: HTMLElement,
  filename: string,
  options: DownloadElementAsPdfOptions = {},
): Promise<void> {
  const { marginMm = 12, captureClass } = options

  if (captureClass) {
    element.classList.add(captureClass)
  }

  window.scrollTo(0, 0)
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })

  try {
    const width = Math.max(element.scrollWidth, element.offsetWidth, element.clientWidth)
    const height = Math.max(element.scrollHeight, element.offsetHeight, element.clientHeight)

    const canvas = await html2canvas(element, {
      scale: 2,
      logging: false,
      useCORS: true,
      backgroundColor: '#ffffff',
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: -window.scrollY,
      onclone: (_doc, clonedNode) => {
        if (captureClass && clonedNode instanceof HTMLElement) {
          clonedNode.classList.add(captureClass)
        }
      },
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const contentWidth = pageWidth - marginMm * 2
    const contentHeight = pageHeight - marginMm * 2
    const imgWidth = contentWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    let offsetY = 0
    let pageIndex = 0
    while (offsetY < imgHeight - 0.5) {
      if (pageIndex > 0) {
        pdf.addPage()
      }
      pdf.addImage(imgData, 'PNG', marginMm, marginMm - offsetY, imgWidth, imgHeight)
      offsetY += contentHeight
      pageIndex += 1
    }

    const safeName = filename.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_') || 'compiled-record'
    pdf.save(safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`)
  } finally {
    if (captureClass) {
      element.classList.remove(captureClass)
    }
  }
}
