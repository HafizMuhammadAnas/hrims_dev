import { jsPDF } from 'jspdf'
import { downloadElementAsPdf } from './downloadElementAsPdf'

function copyFormControlValues(sourceRoot: HTMLElement, targetRoot: HTMLElement): void {
  const sourceControls = sourceRoot.querySelectorAll('input, textarea, select')
  const targetControls = targetRoot.querySelectorAll('input, textarea, select')
  const count = Math.min(sourceControls.length, targetControls.length)
  for (let i = 0; i < count; i++) {
    const src = sourceControls[i]
    const dst = targetControls[i]
    if (src instanceof HTMLInputElement && dst instanceof HTMLInputElement) {
      if (src.type === 'checkbox' || src.type === 'radio') {
        dst.checked = src.checked
        if (src.checked) dst.setAttribute('checked', 'checked')
        else dst.removeAttribute('checked')
      } else if (src.type !== 'file') {
        dst.value = src.value
        dst.setAttribute('value', src.value)
      }
    } else if (src instanceof HTMLTextAreaElement && dst instanceof HTMLTextAreaElement) {
      dst.value = src.value
      dst.textContent = src.value
    } else if (src instanceof HTMLSelectElement && dst instanceof HTMLSelectElement) {
      dst.value = src.value
      Array.from(dst.options).forEach((opt) => {
        if (opt.value === src.value) opt.selected = true
      })
    }
  }
}

function openAllDetails(root: HTMLElement): void {
  root.querySelectorAll('details').forEach((el) => {
    el.open = true
  })
}

function prepareClone(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement
  clone.style.display = 'block'
  clone.style.visibility = 'visible'
  clone.style.opacity = '1'
  clone.style.position = 'static'
  clone.style.width = '100%'
  clone.style.maxWidth = '100%'
  clone.style.height = 'auto'
  clone.style.overflow = 'visible'
  clone.removeAttribute('hidden')
  clone.classList.remove('is-tab-hidden')
  openAllDetails(clone)
  copyFormControlValues(source, clone)

  clone.querySelectorAll('button, input[type="file"]').forEach((node) => {
    if (node instanceof HTMLElement) node.style.display = 'none'
  })

  // Force expanded layouts that may be collapsed by CSS when parent was hidden.
  clone.querySelectorAll<HTMLElement>('[hidden]').forEach((el) => {
    el.removeAttribute('hidden')
    el.style.display = ''
  })

  return clone
}

function buildSection(title: string, source: HTMLElement): HTMLElement {
  const section = document.createElement('section')
  section.style.cssText =
    'background:#ffffff;color:#111111;padding:8px 0 20px;font-family:Arial,Helvetica,sans-serif;'

  const heading = document.createElement('h2')
  heading.textContent = title
  heading.style.cssText =
    'margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #173d69;font-size:18px;color:#173d69;'
  section.appendChild(heading)
  section.appendChild(prepareClone(source))
  return section
}

/**
 * Capture Request + Response panels into one PDF.
 * Uses an in-viewport capture host (html2canvas cannot reliably paint off-screen clones).
 * Does not scroll the page.
 */
export async function downloadDeptTaskRequestResponsePdf(options: {
  requestEl: HTMLElement | null
  responseEl: HTMLElement | null
  filename: string
  headerTitle: string
}): Promise<void> {
  const { requestEl, responseEl, filename, headerTitle } = options
  if (!requestEl && !responseEl) {
    throw new Error('Nothing to export. Open the Request and Response tabs, then try again.')
  }

  const scrollX = window.scrollX
  const scrollY = window.scrollY

  const overlay = document.createElement('div')
  overlay.setAttribute('data-dept-task-pdf-overlay', '1')
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

  // Capture host must be in the viewport so browsers paint it for html2canvas.
  const host = document.createElement('div')
  host.setAttribute('data-dept-task-pdf-host', '1')
  host.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'width:794px',
    'max-width:100vw',
    'background:#ffffff',
    'color:#111111',
    'padding:20px',
    'z-index:2147482990',
    'overflow:visible',
    'box-sizing:border-box',
  ].join(';')

  document.body.appendChild(host)
  document.body.appendChild(overlay)

  try {
    const sections: HTMLElement[] = []
    if (requestEl) sections.push(buildSection('Request', requestEl))
    if (responseEl) sections.push(buildSection('Response', responseEl))

    let pdf: InstanceType<typeof jsPDF> | undefined
    for (let i = 0; i < sections.length; i++) {
      // Capture one section at a time for cleaner page breaks.
      while (host.firstChild) host.removeChild(host.firstChild)
      host.appendChild(sections[i])

      // Allow layout/paint before rasterizing.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
      await new Promise<void>((resolve) => setTimeout(resolve, 50))

      pdf = await downloadElementAsPdf(host, filename, {
        headerTitle,
        captureClass: 'dept-task-draft-pdf-capture',
        pdf,
        save: false,
      })
    }

    if (!pdf) {
      throw new Error('PDF generation produced no pages.')
    }

    const safeName = filename.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_') || 'hrims-draft'
    pdf.save(safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`)
  } finally {
    overlay.remove()
    host.remove()
    // Restore exact scroll so the user stays at the button.
    window.scrollTo(scrollX, scrollY)
  }
}
