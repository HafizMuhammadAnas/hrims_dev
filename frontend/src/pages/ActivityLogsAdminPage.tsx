import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ScrollText } from 'lucide-react'
import {
  adminFetchActivityLogs,
  type ActivityLogRow,
} from '../api/activityLogs'
import { isApiError } from '../api/apiError'
import { useAuth } from '../auth/AuthContext'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { FormControl } from '../components/ui/FormControl'
import { FormRow } from '../components/ui/FormRow'
import { PageSection } from '../components/ui/PageSection'
import { PaginationBar } from '../components/ui/PaginationBar'
import { TableCard } from '../components/ui/TableCard'
import { isSuperAdmin } from '../lib/roles'
import { LABEL_ACTIVITY_LOGS } from '../lib/uiLabels'

const PAGE_SIZE = 25

function formatWhen(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

function actionLabel(action: string): string {
  if (action === 'login') return 'Login'
  if (action === 'logout') return 'Logout'
  if (action === 'download') return 'Download'
  return action
}

function fileTypeLabel(type: string | null): string {
  if (!type) return '—'
  if (type === 'pdf') return 'PDF'
  if (type === 'word') return 'Word'
  if (type === 'excel') return 'Excel'
  return type
}

export function ActivityLogsAdminPage() {
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<ActivityLogRow[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [action, setAction] = useState<'' | 'login' | 'logout' | 'download'>('')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [appliedQ, setAppliedQ] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')
  const [appliedAction, setAppliedAction] = useState<'' | 'login' | 'logout' | 'download'>('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await adminFetchActivityLogs({
        action: appliedAction,
        q: appliedQ,
        from: appliedFrom || undefined,
        to: appliedTo || undefined,
        page,
        per_page: PAGE_SIZE,
      })
      setRows(result.data)
      setTotal(result.meta.total)
    } catch (e: unknown) {
      setError(isApiError(e) ? e.message : e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [appliedAction, appliedFrom, appliedQ, appliedTo, page])

  useEffect(() => {
    void load()
  }, [load])

  if (!user || !isSuperAdmin(user)) {
    return <Navigate to="/" replace />
  }

  function applyFilters() {
    setPage(1)
    setAppliedAction(action)
    setAppliedQ(q.trim())
    setAppliedFrom(from)
    setAppliedTo(to)
  }

  return (
    <PageSection
      titleIcon={<ScrollText size={26} color="var(--solid-blue)" aria-hidden />}
      title={LABEL_ACTIVITY_LOGS}
      subtitle="Login, logout, and file download history for all users (PDF, Word, Excel, and other files)."
    >
      {error ? (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <TableCard padded>
        <FormRow twoCol>
          <FormControl label="Action">
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as '' | 'login' | 'logout' | 'download')}
            >
              <option value="">All actions</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="download">Download</option>
            </select>
          </FormControl>
          <FormControl label="Search user / file">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Username, name, or file name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyFilters()
              }}
            />
          </FormControl>
        </FormRow>
        <FormRow twoCol>
          <FormControl label="From date">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </FormControl>
          <FormControl label="To date">
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </FormControl>
        </FormRow>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <Button type="button" compact onClick={applyFilters} disabled={loading}>
            Apply filters
          </Button>
          <Button
            type="button"
            variant="secondary"
            compact
            disabled={loading}
            onClick={() => {
              setAction('')
              setQ('')
              setFrom('')
              setTo('')
              setPage(1)
              setAppliedAction('')
              setAppliedQ('')
              setAppliedFrom('')
              setAppliedTo('')
            }}
          >
            Clear
          </Button>
        </div>
      </TableCard>

      <TableCard>
        <div className="table-card-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & time</th>
                <th>User</th>
                <th>Username</th>
                <th>Action</th>
                <th>File</th>
                <th>Type</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <EmptyStateRow colSpan={7} message="Loading activity logs…" />
              ) : rows.length === 0 ? (
                <EmptyStateRow colSpan={7} message="No activity logs match your filters." />
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="text-compact">{formatWhen(row.created_at)}</td>
                    <td className="text-compact">{row.user_name || '—'}</td>
                    <td className="text-compact">{row.username || '—'}</td>
                    <td className="text-compact">{actionLabel(row.action)}</td>
                    <td className="text-compact" title={row.file_name ?? undefined}>
                      {row.action === 'download' ? row.file_name || '—' : '—'}
                    </td>
                    <td className="text-compact">
                      {row.action === 'download' ? fileTypeLabel(row.file_type) : '—'}
                    </td>
                    <td className="text-compact">{row.ip_address || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </TableCard>

      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        totalItems={total}
        onPageChange={setPage}
      />
    </PageSection>
  )
}
