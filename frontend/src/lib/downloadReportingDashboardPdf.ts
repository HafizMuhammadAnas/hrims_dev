import html2canvas from 'html2canvas'
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
 * Paint each live Recharts container to a PNG while it is still on-screen.
 * SVG serialization drops CSS fills — html2canvas of the live widget keeps bars/pies.
 */
async function rasterizeLiveCharts(liveRoot: HTMLElement): Promise<
  Array<{ png: string; width: number; height: number }>
> {
  const containers = [
    ...liveRoot.querySelectorAll<HTMLElement>('.recharts-responsive-container'),
  ]
  const out: Array<{ png: string; width: number; height: number }> = []

  for (const el of containers) {
    const rect = el.getBoundingClientRect()
    const width = Math.max(1, Math.round(rect.width || el.offsetWidth || 400))
    const height = Math.max(1, Math.round(rect.height || el.offsetHeight || 260))
    if (width < 8 || height < 8) continue

    // Capture the live painted widget (CSS fills included). Do not force x/y —
    // the node may sit mid-page; html2canvas resolves its box itself.
    const canvas = await html2canvas(el, {
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
    })

    out.push({
      png: canvas.toDataURL('image/png'),
      width,
      height,
    })
  }

  return out
}

function insertChartImages(
  cloneRoot: HTMLElement,
  charts: Array<{ png: string; width: number; height: number }>,
): void {
  const containers = [
    ...cloneRoot.querySelectorAll<HTMLElement>('.recharts-responsive-container'),
  ]
  const count = Math.min(containers.length, charts.length)

  for (let i = 0; i < count; i++) {
    const container = containers[i]
    const chart = charts[i]
    if (!container || !chart) continue

    const img = document.createElement('img')
    img.alt = 'Chart'
    img.setAttribute('data-recharts-capture', '1')
    img.width = chart.width
    img.height = chart.height
    img.style.cssText = [
      'display:block',
      'width:100%',
      'max-width:100%',
      'height:auto',
      `aspect-ratio:${chart.width} / ${chart.height}`,
      'margin:0 auto',
      'background:#ffffff',
    ].join(';')
    img.src = chart.png

    // Replace the whole responsive container (SVG + legend wrapper bits inside).
    container.replaceWith(img)
  }
}

/**
 * Export the reporting dashboard to PDF.
 * Capture host stays off-screen — callers show their own in-page loader.
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

  // Rasterize charts from the live, painted dashboard BEFORE cloning / off-screen work.
  await waitFrames(2)
  const chartImages = await rasterizeLiveCharts(sourceEl)

  const host = document.createElement('div')
  host.setAttribute('data-report-pdf-host', '1')
  host.className = 'report-generator-pdf-capture report-generator-pdf-capture--host'
  host.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    'width:794px',
    'background:#ffffff',
    'color:#111111',
    'padding:16px',
    'z-index:-1',
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

  insertChartImages(clone, chartImages)

  host.appendChild(clone)
  document.body.appendChild(host)

  try {
    await waitForImages(host)
    await waitFrames(2)
    await new Promise<void>((resolve) => setTimeout(resolve, 40))

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
    host.remove()
    window.scrollTo(scrollX, scrollY)
  }
}
