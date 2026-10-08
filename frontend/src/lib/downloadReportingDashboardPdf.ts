import { downloadElementAsPdf } from './downloadElementAsPdf'

function waitFrames(count = 2): Promise<void> {
  return new Promise((resolve) => {
    const step = (n: number) => {
      if (n <= 0) resolve()
      else requestAnimationFrame(() => step(n - 1))
    }
    step(count)
  })
}

function waitForImages(root: HTMLElement): Promise<void> {
  const images = [...root.querySelectorAll('img')]
  if (images.length === 0) return Promise.resolve()
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve()
            return
          }
          const done = () => resolve()
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
        }),
    ),
  ).then(() => undefined)
}

/**
 * Replace live Recharts SVGs with raster-friendly <img> copies so html2canvas
 * does not depend on ResponsiveContainer reflow inside the capture clone.
 */
async function replaceSvgsWithImages(liveRoot: HTMLElement, cloneRoot: HTMLElement): Promise<void> {
  const liveSvgs = [...liveRoot.querySelectorAll('svg')]
  const cloneSvgs = [...cloneRoot.querySelectorAll('svg')]
  const count = Math.min(liveSvgs.length, cloneSvgs.length)

  for (let i = 0; i < count; i++) {
    const liveSvg = liveSvgs[i]
    const cloneSvg = cloneSvgs[i]
    if (!(liveSvg instanceof SVGElement) || !(cloneSvg instanceof SVGElement)) continue

    const rect = liveSvg.getBoundingClientRect()
    const width = Math.max(1, Math.round(rect.width || liveSvg.clientWidth || 400))
    const height = Math.max(1, Math.round(rect.height || liveSvg.clientHeight || 260))

    // Ensure width/height exist on the serialized SVG for correct raster sizing.
    const svgClone = liveSvg.cloneNode(true) as SVGElement
    svgClone.setAttribute('width', String(width))
    svgClone.setAttribute('height', String(height))
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    if (!svgClone.getAttribute('viewBox') && width > 0 && height > 0) {
      svgClone.setAttribute('viewBox', `0 0 ${width} ${height}`)
    }

    const xml = new XMLSerializer().serializeToString(svgClone)
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`

    const img = document.createElement('img')
    img.alt = ''
    img.width = width
    img.height = height
    img.style.cssText = `display:block;width:100%;max-width:100%;height:auto;aspect-ratio:${width}/${height};`
    img.src = url

    const parent = cloneSvg.parentElement
    if (parent) {
      // ResponsiveContainer wrappers often have a fixed height; keep that box filled.
      parent.style.width = '100%'
      parent.style.minHeight = `${height}px`
    }
    cloneSvg.replaceWith(img)
  }

  await waitForImages(cloneRoot)
}

/**
 * Export the reporting dashboard to PDF.
 * Uses an off-DOM capture host so live Recharts widgets are not resized mid-capture.
 */
export async function downloadReportingDashboardPdf(options: {
  sourceEl: HTMLElement
  filename?: string
  headerTitle?: string
}): Promise<void> {
  const {
    sourceEl,
    filename = 'reporting-dashboard',
    headerTitle = 'Reporting dashboard',
  } = options

  const scrollX = window.scrollX
  const scrollY = window.scrollY

  const overlay = document.createElement('div')
  overlay.setAttribute('data-report-pdf-overlay', '1')
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483000',
    'background:rgba(15,23,42,0.45)',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'pointer-events:all',
  ].join(';')
  const overlayLabel = document.createElement('div')
  overlayLabel.textContent = 'Generating PDF…'
  overlayLabel.style.cssText =
    'background:#ffffff;color:#173d69;padding:14px 22px;border-radius:10px;font:600 15px Arial,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,0.18);'
  overlay.appendChild(overlayLabel)

  const host = document.createElement('div')
  host.setAttribute('data-report-pdf-host', '1')
  host.className = 'report-generator-pdf-capture report-generator-pdf-capture--host'
  host.style.cssText = [
    'position:absolute',
    'top:0',
    'left:0',
    'width:794px',
    'max-width:100%',
    'background:#ffffff',
    'color:#111111',
    'padding:16px',
    'z-index:2147482990',
    'overflow:visible',
    'box-sizing:border-box',
    'pointer-events:none',
  ].join(';')

  const clone = sourceEl.cloneNode(true) as HTMLElement
  clone.querySelectorAll(
    '.reporting-dashboard__toolbar-actions, button, .btn, [data-pdf-hide]',
  ).forEach((node) => {
    if (node instanceof HTMLElement) node.style.display = 'none'
  })

  host.appendChild(clone)
  document.body.appendChild(host)
  document.body.appendChild(overlay)

  try {
    await waitFrames(2)
    await replaceSvgsWithImages(sourceEl, clone)
    await waitFrames(2)
    await new Promise<void>((resolve) => setTimeout(resolve, 60))

    if (host.scrollHeight < 40) {
      throw new Error('Reporting dashboard capture was empty. Apply filters, then try again.')
    }

    await downloadElementAsPdf(host, filename, {
      captureClass: 'report-generator-pdf-capture',
      marginMm: 6,
      headerTitle,
      save: true,
    })
  } finally {
    overlay.remove()
    host.remove()
    window.scrollTo(scrollX, scrollY)
  }
}
