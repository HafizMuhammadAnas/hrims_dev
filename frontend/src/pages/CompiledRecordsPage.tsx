import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCompiledRecords, type CompiledRecordRow } from '../api/lists'
import { Button } from '../components/ui/Button'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { ModalActions, ModalHeader } from '../components/ui/ModalChrome'
import { PageSection } from '../components/ui/PageSection'
import { TableCard } from '../components/ui/TableCard'

export function CompiledRecordsPage() {
  const [rows, setRows] = useState<CompiledRecordRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<CompiledRecordRow | null>(null)

  useEffect(() => {
    void fetchCompiledRecords()
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [])

  return (
    <PageSection
      title="Compiled records"
      subtitle={
        <>
          National compilation snapshots saved from the{' '}
          <Link to="/compilation">Compilation center</Link>. Use <strong>View</strong> for the full summary and links to
          the HR request or <Link to="/responses">Regional responses</Link> to review underlying provincial compilations.
        </>
      }
    >
      {error && <p className="login-error">{error}</p>}
      <TableCard>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>HR request</th>
              <th>Title</th>
              <th>Regions</th>
              <th>Status</th>
              <th>Compilation date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.req_id ?? '—'}</td>
                <td>{r.title}</td>
                <td>{r.region_names?.join(', ')}</td>
                <td>{r.status}</td>
                <td>{r.compilation_date ?? '—'}</td>
                <td className="table-actions">
                  <Button variant="secondary" compact type="button" onClick={() => setDetail(r)}>
                    View
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyStateRow colSpan={7} message="No compiled records available." />}
          </tbody>
        </table>
      </TableCard>

      {detail && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setDetail(null)}>
          <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title="Compiled record" onClose={() => setDetail(null)} />
            <nav className="compiled-record-modal-tabs" aria-label="Open related workflow pages">
              {detail.req_id ? (
                <Link
                  className="compiled-record-modal-tab"
                  to={`/requests/${encodeURIComponent(detail.req_id)}?from=${encodeURIComponent('/compiled-records')}`}
                >
                  Open HR request
                </Link>
              ) : (
                <span className="compiled-record-modal-tab compiled-record-modal-tab--disabled">Open HR request</span>
              )}
              {detail.req_id ? (
                <Link
                  className="compiled-record-modal-tab"
                  to={`/responses?reqId=${encodeURIComponent(detail.req_id)}`}
                >
                  Regional responses (review)
                </Link>
              ) : (
                <span className="compiled-record-modal-tab compiled-record-modal-tab--disabled">
                  Regional responses (review)
                </span>
              )}
              <Link className="compiled-record-modal-tab" to="/compilation">
                Compilation center
              </Link>
            </nav>
            <div className="modal-form">
              <div className="form-grid">
                <div className="form-row">
                  <label>Record ID</label>
                  <input value={detail.id} readOnly disabled />
                </div>
                <div className="form-row">
                  <label>HR request</label>
                  <input value={detail.req_id ?? '—'} readOnly disabled />
                </div>
                <div className="form-row">
                  <label>Title</label>
                  <input value={detail.title} readOnly disabled />
                </div>
                <div className="form-row">
                  <label>Status</label>
                  <input value={detail.status} readOnly disabled />
                </div>
                <div className="form-row">
                  <label>Regions included</label>
                  <input value={detail.region_names?.join(', ') ?? '—'} readOnly disabled />
                </div>
                <div className="form-row">
                  <label>Compilation date</label>
                  <input value={detail.compilation_date ?? '—'} readOnly disabled />
                </div>
                {detail.submission_date ? (
                  <div className="form-row">
                    <label>Submission date</label>
                    <input value={detail.submission_date} readOnly disabled />
                  </div>
                ) : null}
                {detail.submitted_to ? (
                  <div className="form-row">
                    <label>Submitted to</label>
                    <input value={detail.submitted_to} readOnly disabled />
                  </div>
                ) : null}
                {detail.attachment ? (
                  <div className="form-row">
                    <label>Attachment</label>
                    <input value={detail.attachment} readOnly disabled />
                  </div>
                ) : null}
                <div className="form-row">
                  <label>National summary</label>
                  <textarea
                    readOnly
                    rows={10}
                    value={detail.summary?.trim() ? detail.summary : '—'}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <p className="muted small" style={{ margin: '0 0 12px' }}>
                Provincial compilations that fed this record are reviewed on{' '}
                <strong>Regional responses</strong> (accept / request changes per region). This dialog is the saved national
                record only.
              </p>
              <ModalActions>
                <Button variant="secondary" compact type="button" onClick={() => setDetail(null)}>
                  Close
                </Button>
              </ModalActions>
            </div>
          </div>
        </div>
      )}
    </PageSection>
  )
}
