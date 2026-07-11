export type DownloadElementAsWordOptions = {
  /** Applied to the source element while cloning (export-only CSS hooks). */
  captureClass?: string
  documentTitle?: string
}

function safeFilename(name: string, ext: string): string {
  const base = name.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_') || 'compiled-record'
  const lower = base.toLowerCase()
  if (lower.endsWith(`.${ext}`)) return base
  return `${base}.${ext}`
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

/** Inline styles so Word does not depend on the app stylesheet. */
const WORD_EXPORT_STYLES = `
  body {
    font-family: Calibri, Arial, Helvetica, sans-serif;
    font-size: 11pt;
    color: #111827;
    line-height: 1.45;
  }
  h1, h2, h3, h4 {
    color: #1a237e;
    page-break-after: avoid;
  }
  h1 { font-size: 18pt; }
  h2 { font-size: 14pt; margin-top: 18pt; }
  h3, h4 { font-size: 12pt; }
  p { margin: 0 0 8pt; }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 8pt 0 12pt;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 4pt 6pt;
    vertical-align: top;
    font-size: 10pt;
  }
  th { background: #f1f5f9; font-weight: 600; }
  a { color: #1a237e; text-decoration: none; }
  .muted, .text-muted { color: #64748b; }
  button, .btn, input, select, textarea { display: none !important; }
`

/**
 * Export a DOM subtree as a Word-compatible .doc (HTML Office format).
 * Opens cleanly in Microsoft Word, LibreOffice, and Google Docs.
 */
export async function downloadElementAsWord(
  element: HTMLElement,
  filename: string,
  options: DownloadElementAsWordOptions = {},
): Promise<void> {
  const { captureClass, documentTitle } = options

  if (captureClass) {
    element.classList.add(captureClass)
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })

  try {
    const clone = element.cloneNode(true) as HTMLElement
    if (captureClass) {
      clone.classList.add(captureClass)
    }

    // Drop interactive / non-print chrome from the export.
    clone
      .querySelectorAll('button, input, select, textarea, .btn, .modal-actions, .ministry-compiled-single__toolbar')
      .forEach((node) => node.remove())

    const title =
      documentTitle?.trim() ||
      clone.querySelector('h1, h2, [id$="-title"]')?.textContent?.trim() ||
      'Compiled record'

    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<title>${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>${WORD_EXPORT_STYLES}</style>
</head>
<body>${clone.innerHTML}</body>
</html>`

    const blob = new Blob(['\ufeff', html], {
      type: 'application/msword;charset=utf-8',
    })
    triggerDownload(blob, safeFilename(filename, 'doc'))
  } finally {
    if (captureClass) {
      element.classList.remove(captureClass)
    }
  }
}
