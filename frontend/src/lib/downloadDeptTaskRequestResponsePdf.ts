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

  // Hide action buttons / file pickers only — keep role=switch toggles visible in the PDF.
  clone.querySelectorAll('button, input[type="file"], a.btn').forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    if (node.getAttribute('role') === 'switch') return
    if (node.classList.contains('matrix-row-toggle')) return
    node.style.display = 'none'
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
  section.className = 'pdf-export-section'
  section.style.cssText =
    'background:#ffffff;color:#111111;padding:16px 0 20px;font-family:Arial,Helvetica,sans-serif;'

  const heading = document.createElement('h2')
  heading.textContent = title
  heading.style.cssText =
    'margin:0 0 14px;padding:4px 0 8px;border-bottom:2px solid #173d69;font-size:18px;line-height:1.35;color:#173d69;'
  section.appendChild(heading)
  section.appendChild(prepareClone(source))
  return section
}

/**
 * Capture Request + Response panels into one PDF.
 * Snapshots the live DOM synchronously so a later React reload cannot drop the response form.
 * Uses an in-document capture host (html2canvas cannot reliably paint off-screen clones).
 * Does not scroll the page.
 */
export async function downloadDeptTaskRequestResponsePdf(options: {
  requestEl: HTMLElement | null
  responseEl: HTMLElement | null
  filename: string
  headerTitle: string
  /** Runs after the DOM snapshot is taken and before rasterizing (e.g. save draft). */
  afterSnapshot?: () => Promise<void>
}): Promise<void> {
  const { requestEl, responseEl, filename, headerTitle, afterSnapshot } = options
  if (!requestEl && !responseEl) {
    throw new Error('Nothing to export. Open the Request and Response tabs, then try again.')
  }
  if (!responseEl) {
    throw new Error('Response form was not available to export. Stay on the Response tab and try again.')
  }

  // Snapshot immediately — before any await — so draft save/reload cannot unmount the form.
  const sections: HTMLElement[] = []
  if (requestEl) sections.push(buildSection('Request', requestEl))
  sections.push(buildSection('Response', responseEl))

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

  // Capture host in normal document flow at the top of the body so tall content paints fully.
  const host = document.createElement('div')
  host.setAttribute('data-dept-task-pdf-host', '1')
  host.style.cssText = [
    'position:absolute',
    'top:0',
    'left:0',
    'width:794px',
    'max-width:100%',
    'background:#ffffff',
    'color:#111111',
    'padding:20px',
    'z-index:2147482990',
    'overflow:visible',
    'box-sizing:border-box',
    'pointer-events:none',
  ].join(';')

  document.body.appendChild(host)
  document.body.appendChild(overlay)

  try {
    if (afterSnapshot) {
      overlayLabel.textContent = 'Saving draft…'
      await afterSnapshot()
      overlayLabel.textContent = 'Generating PDF…'
    }

    const responseText = sections[sections.length - 1]?.innerText ?? ''
    if (responseText.trim().length < 20) {
      throw new Error('Response content was empty in the PDF snapshot. Stay on the Response tab and try again.')
    }

    // Capture each pre-cloned section separately (avoids oversized canvases) into one PDF.
    let pdf: Awaited<ReturnType<typeof downloadElementAsPdf>> | undefined
    for (let i = 0; i < sections.length; i++) {
      while (host.firstChild) host.removeChild(host.firstChild)
      host.appendChild(sections[i])

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
      await new Promise<void>((resolve) => setTimeout(resolve, 60))

      if (host.scrollHeight < 40) {
        throw new Error(
          i === 0
            ? 'Request content could not be captured for PDF.'
            : 'Response content could not be captured for PDF.',
        )
      }

      const isLastSection = i === sections.length - 1
      pdf = await downloadElementAsPdf(host, filename, {
        headerTitle,
        captureClass: 'dept-task-draft-pdf-capture',
        pdf,
        save: false,
        // Header/footer only once the full Request + Response document is assembled.
        finalizeChrome: isLastSection,
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
