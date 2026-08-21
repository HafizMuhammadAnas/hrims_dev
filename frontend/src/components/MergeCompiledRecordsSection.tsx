import { useCallback, useMemo, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import type { CompiledRecordRow } from '../api/lists'
import { downloadElementAsPdf } from '../lib/downloadElementAsPdf'
import { downloadElementAsWord } from '../lib/downloadElementAsWord'
import { formatAppDate } from '../lib/dateFormat'
import { CompiledRecordPrintDocument } from './CompiledRecordPrintDocument'
import { ActionNoticeAlert, Alert, type ActionNotice } from './ui/Alert'
import { Button } from './ui/Button'
import { SearchableMultiSelect } from './ui/SearchableMultiSelect'
import { TableCard } from './ui/TableCard'

type Props = {
  records: CompiledRecordRow[]
}

/**
 * Compilation Center section: select multiple compiled records and download
 * a single PDF/Word file with each record’s full content in sequence.
 */
export function MergeCompiledRecordsSection({ records }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [readyById, setReadyById] = useState<Record<string, boolean>>({})
  const [pdfLoading, setPdfLoading] = useState(false)
  const [wordLoading, setWordLoading] = useState(false)
  const [exportNotice, setExportNotice] = useState<ActionNotice | null>(null)
  const mergeRef = useRef<HTMLDivElement>(null)

  const options = useMemo(
    () =>
      [...records]
        .sort((a, b) => {
          const ad = a.compilation_date ?? ''
          const bd = b.compilation_date ?? ''
          if (ad !== bd) return bd.localeCompare(ad)
          return b.id.localeCompare(a.id)
        })
        .map((r) => {
          const regions = (r.region_names ?? []).join(', ')
          const date = r.compilation_date ? formatAppDate(r.compilation_date) : ''
          const bits = [
            r.req_id || r.id,
            r.title?.trim() || 'Untitled',
            r.status,
            regions || null,
            date || null,
          ].filter(Boolean)
          return { value: r.id, label: bits.join(' — ') }
        }),
    [records],
  )

  const selectedRecords = useMemo(() => {
    const byId = new Map(records.map((r) => [r.id, r]))
    return selectedIds.map((id) => byId.get(id)).filter((r): r is CompiledRecordRow => r != null)
  }, [records, selectedIds])

  const allReady =
    selectedRecords.length > 0 && selectedRecords.every((r) => readyById[r.id] === true)

  const handleReadyChange = useCallback((recordId: string, ready: boolean) => {
    setReadyById((prev) => {
      if (prev[recordId] === ready) return prev
      return { ...prev, [recordId]: ready }
    })
  }, [])

  function handleSelectionChange(values: string[]) {
    setSelectedIds(values)
    setExportNotice(null)
    setReadyById((prev) => {
      const next: Record<string, boolean> = {}
      for (const id of values) {
        if (prev[id] != null) next[id] = prev[id]
      }
      return next
    })
  }

  function exportBaseName(): string {
    if (selectedRecords.length === 1) {
      const r = selectedRecords[0]
      return [r.req_id, r.title?.trim() || r.id].filter(Boolean).join(' — ')
    }
    return `Merged compiled records (${selectedRecords.length})`
  }

  async function handleDownloadPdf() {
    const el = mergeRef.current
    if (!el || !allReady) return
    setPdfLoading(true)
    setExportNotice(null)
    try {
      await downloadElementAsPdf(el, exportBaseName(), {
        captureClass: 'ministry-compiled-pdf-capture',
        marginMm: 10,
        headerTitle: exportBaseName(),
      })
      setExportNotice({
        variant: 'info',
        title: 'PDF downloaded',
        message: `Merged PDF for ${selectedRecords.length} compiled records was generated and downloaded.`,
      })
    } catch (e: unknown) {
      setExportNotice({
        variant: 'error',
        title: 'Could not generate PDF',
        message: e instanceof Error ? e.message : 'Could not generate PDF.',
      })
    } finally {
      setPdfLoading(false)
    }
  }

  async function handleDownloadWord() {
    const el = mergeRef.current
    if (!el || !allReady) return
    setWordLoading(true)
    setExportNotice(null)
    try {
      await downloadElementAsWord(el, exportBaseName(), {
        captureClass: 'ministry-compiled-pdf-capture',
        documentTitle: exportBaseName(),
      })
      setExportNotice({
        variant: 'info',
        title: 'Word downloaded',
        message: `Merged Word file for ${selectedRecords.length} compiled records was generated and downloaded.`,
      })
    } catch (e: unknown) {
      setExportNotice({
        variant: 'error',
        title: 'Could not generate Word',
        message: e instanceof Error ? e.message : 'Could not generate Word document.',
      })
    } finally {
      setWordLoading(false)
    }
  }

  const canDownload =
    selectedRecords.length >= 2 && allReady && !pdfLoading && !wordLoading

  return (
    <TableCard padded className="merge-compiled-records-section">
      <h3 className="merge-compiled-records-section__title">Merge compiled records</h3>
      <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
        Select two or more compiled records, then download a single PDF or Word file. Each record’s
        full content (request, responses, and summary) appears one after another.
      </p>
      <ActionNoticeAlert notice={exportNotice} onDismiss={() => setExportNotice(null)} />

      {records.length === 0 ? (
        <Alert variant="info" title="No compiled records yet">
          <p style={{ margin: 0 }}>Create a national compilation above first, then return here to merge.</p>
        </Alert>
      ) : (
        <>
          <label className="muted" htmlFor="merge-compiled-records-select">
            Compiled records
          </label>
          <div style={{ marginTop: 6, marginBottom: 12 }}>
            <SearchableMultiSelect
              id="merge-compiled-records-select"
              values={selectedIds}
              onChange={handleSelectionChange}
              options={options}
              placeholder="Select compiled records…"
              selectedSummary={(count, first) =>
                count === 1 && first ? first : `${count} records selected`
              }
            />
          </div>

          {selectedRecords.length > 0 ? (
            <div className="merge-compiled-records-section__actions compiled-record-pdf-toolbar">
              <Button
                variant="secondary"
                compact
                type="button"
                disabled={!canDownload}
                onClick={() => void handleDownloadPdf()}
              >
                <Download size={16} strokeWidth={2} aria-hidden style={{ marginRight: 6 }} />
                {pdfLoading
                  ? 'Generating PDF…'
                  : selectedRecords.length < 2
                    ? 'Select at least 2'
                    : !allReady
                      ? 'Preparing…'
                      : 'Download PDF'}
              </Button>
              <Button
                variant="secondary"
                compact
                type="button"
                disabled={!canDownload}
                onClick={() => void handleDownloadWord()}
              >
                <Download size={16} strokeWidth={2} aria-hidden style={{ marginRight: 6 }} />
                {wordLoading
                  ? 'Generating Word…'
                  : selectedRecords.length < 2
                    ? 'Select at least 2'
                    : !allReady
                      ? 'Preparing…'
                      : 'Download Word'}
              </Button>
              {selectedRecords.length >= 2 && !allReady ? (
                <span className="muted small">Loading selected records…</span>
              ) : null}
            </div>
          ) : null}

          {/* Off-screen render target for PDF/Word capture */}
          {selectedRecords.length > 0 ? (
            <div className="merge-compiled-records-section__capture-host" aria-hidden>
              <div ref={mergeRef} className="merge-compiled-records-section__capture-root">
                {selectedRecords.map((record, index) => (
                  <div
                    key={record.id}
                    className={
                      'merge-compiled-records-section__record' +
                      (index > 0 ? ' merge-compiled-records-section__record--break' : '')
                    }
                  >
                    <CompiledRecordPrintDocument
                      record={record}
                      onReadyChange={(ready) => handleReadyChange(record.id, ready)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </TableCard>
  )
}
