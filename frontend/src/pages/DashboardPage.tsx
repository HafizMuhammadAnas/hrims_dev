import {
  AlertCircle,
  Bell,
  BookOpen,
  CheckCircle,
  Clock,
  FileText,
  Globe,
  RefreshCcw,
  Target,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'
import { fetchDashboardSummary } from '../api/dashboard'
import type {
  DashboardSummary,
  MonthCountPoint,
  UrgentDepartmentTaskRow,
  UrgentRequestRow,
} from '../api/dashboard'
import { useAuth } from '../auth/AuthContext'
import { useNotify } from '../context/NotificationsContext'
import { Alert } from '../components/ui/Alert'
import {
  isDepartmentAdmin,
  isFederalAdmin,
  isRegionalAdmin,
  isSuperAdmin,
  isViewer,
} from '../lib/roles'
import { formatAppDate, formatAppTodayLong } from '../lib/dateFormat'

const HR_STATUS_ORDER = ['draft', 'active'] as const
const HR_PIE_LABELS: Record<(typeof HR_STATUS_ORDER)[number], string> = {
  draft: 'Draft',
  active: 'Active',
}
const HR_PIE_COLORS = ['#c4a574', '#2e4fa3']

const TASK_PIE_COLORS = ['#5b8def', '#2e4fa3', '#0f766e', '#c4a574', '#f44336', '#9333ea']

function count(map: Record<string, number> | undefined, key: string): number {
  return map?.[key] ?? 0
}

function statusBadgeClass(status: string): string {
  if (status === 'active') return 'status-badge success'
  if (status === 'draft') return 'status-badge warning'
  return 'status-badge default'
}

function urgentRowChrome(status: string): { background: string; borderLeft: string } {
  if (status === 'needs-revision') {
    return { background: '#fff8e1', borderLeft: '#e69a00' }
  }
  if (status === 'active') {
    return { background: '#e8eefb', borderLeft: '#2e4fa3' }
  }
  return { background: '#fff8e1', borderLeft: '#e69a00' }
}

function formatStatus(s: string): string {
  if (s === 'needs-revision') return 'Needs revision'
  return s.replace(/-/g, ' ')
}

type DashboardVariant = 'federal' | 'regional' | 'department' | 'viewer' | 'minimal'

function dashboardVariant(user: ReturnType<typeof useAuth>['user']): DashboardVariant {
  if (!user) return 'minimal'
  if (isSuperAdmin(user) || isFederalAdmin(user)) return 'federal'
  if (isRegionalAdmin(user)) return 'regional'
  if (isDepartmentAdmin(user)) return 'department'
  if (isViewer(user)) return 'viewer'
  return 'minimal'
}

function hrPieData(byStatus: Record<string, number>) {
  return HR_STATUS_ORDER.map((key) => ({
    name: HR_PIE_LABELS[key],
    value: count(byStatus, key),
  })).filter((d) => d.value > 0)
}

function taskPieData(byStatus: Record<string, number>) {
  const entries = Object.entries(byStatus)
  return entries
    .map(([k, value]) => ({
      name: formatStatus(k),
      value,
    }))
    .filter((d) => d.value > 0)
}

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { inbox, inboxLoading, markRead } = useNotify()
  const variant = dashboardVariant(user)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchDashboardSummary()
      .then((s) => {
        if (!cancelled) setSummary(s)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const by = summary?.by_status ?? {}
  const draft = count(by, 'draft')
  const active = count(by, 'active')

  const review = summary?.regional_responses_by_review
  const respTotal = summary?.regional_responses_total ?? 0
  const acceptedResp = count(review, 'accepted')
  const needsMod = count(review, 'needs-modification')
  const taskBy = summary?.department_tasks_by_status
  const taskTotal = summary?.department_tasks_total ?? 0
  const taskAssigned = count(taskBy, 'assigned')
  const taskSubmitted = count(taskBy, 'submitted')

  const resolvedRatePct =
    summary && summary.hr_requests_total > 0
      ? Math.round((active / summary.hr_requests_total) * 100)
      : 0
  const acceptedRatePct =
    respTotal > 0 ? Math.round((acceptedResp / respTotal) * 100) : null
  const taskDonePct =
    taskTotal > 0 ? Math.round((taskSubmitted / taskTotal) * 100) : null

  const piePrimary = useMemo(() => {
    if (!summary) return []
    if (variant === 'department' || variant === 'viewer') {
      return taskPieData(taskBy ?? {})
    }
    return hrPieData(by)
  }, [summary, variant, taskBy, by])

  const trendSeries: MonthCountPoint[] = useMemo(() => {
    if (!summary) return []
    if (variant === 'department' || variant === 'viewer') {
      return summary.department_tasks_by_month ?? summary.requests_created_by_month
    }
    return summary.requests_created_by_month
  }, [summary, variant])

  const trendChartData = useMemo(
    () => trendSeries.map((p) => ({ name: p.label, count: p.count })),
    [trendSeries],
  )

  const welcomeTagline = useMemo(() => {
    if (!user) return ''
    if (variant === 'federal') {
      return isSuperAdmin(user)
        ? 'Super administrator — full visibility across regions and catalog tools.'
        : 'Federal control center — national requests, reviews, and reporting.'
    }
    if (variant === 'regional') {
      return `Regional overview — ${user.region?.name ?? 'your region'}`
    }
    if (variant === 'department' || variant === 'viewer') {
      return `Department workspace — ${user.department?.name ?? user.region?.name ?? 'your assignments'}`
    }
    return 'HRIMS dashboard'
  }, [user, variant])

  const urgentList = summary?.urgent_requests ?? []
  const urgentDeptTasks = summary?.urgent_department_tasks ?? []
  const urgentRequestCount = urgentList.length
  const compiledReportsTotal = summary?.compiled_records_total ?? 0
  const clarificationsPending = summary?.clarifications_pending_federal ?? 0
  const federalNotifications = useMemo(() => inbox.slice(0, 8), [inbox])

  const requestsPanelRows: (UrgentRequestRow | (UrgentDepartmentTaskRow & { task_id: string }))[] =
    variant === 'department' || variant === 'viewer'
      ? urgentDeptTasks.length > 0
        ? urgentDeptTasks
        : urgentList
      : urgentList

  const pieTitle =
    variant === 'department' || variant === 'viewer'
      ? 'Task status mix'
      : 'Request status distribution'
  const trendTitle =
    variant === 'department' || variant === 'viewer'
      ? 'Tasks assigned (6 months)'
      : 'New requests in scope (6 months)'

  return (
    <div className="page-shell">
      {error && (
        <Alert variant="error" title="Could not load dashboard" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {summary && user && (
        <>
          <div className="dashboard-welcome-banner">
            <div>
              <h2>Welcome, {user.name}</h2>
              <p className="muted" style={{ margin: 0 }}>
                {welcomeTagline}
              </p>
            </div>
            <div className="muted" style={{ textAlign: 'right' }}>
              {formatAppTodayLong()}
            </div>
          </div>

          {variant === 'minimal' && (
            <div className="dashboard-shortcuts">
              <Link to="/requests" className="btn btn-secondary btn-compact">
                HR requests
              </Link>
            </div>
          )}

          <div className="dashboard-kpi-grid">
            {variant === 'department' || variant === 'viewer' ? (
              <>
                <div className="dashboard-card brown">
                  <div className="dashboard-card-icon">
                    <Clock size={22} strokeWidth={2.2} />
                  </div>
                  <div className="dashboard-card-title">Open tasks</div>
                  <div className="dashboard-card-value">{taskAssigned}</div>
                  <div className="dashboard-card-subtitle">Assigned and awaiting your submission</div>
                </div>
                <div className="dashboard-card blue">
                  <div className="dashboard-card-icon">
                    <TrendingUp size={22} strokeWidth={2.2} />
                  </div>
                  <div className="dashboard-card-title">Submitted rate</div>
                  <div className="dashboard-card-value">
                    {taskTotal ? `${taskDonePct}%` : '—'}
                  </div>
                  <div className="dashboard-card-subtitle">Submitted / total department tasks</div>
                </div>
                <div className="dashboard-card teal">
                  <div className="dashboard-card-icon">
                    <AlertCircle size={22} strokeWidth={2.2} />
                  </div>
                  <div className="dashboard-card-title">Linked request attention</div>
                  <div className="dashboard-card-value">{draft}</div>
                  <div className="dashboard-card-subtitle">
                    {draft} draft · {urgentRequestCount} in urgent queue (HR requests in your scope)
                  </div>
                </div>
              </>
            ) : variant === 'regional' ? (
              <>
                <div className="dashboard-card brown">
                  <div className="dashboard-card-icon">
                    <Clock size={22} strokeWidth={2.2} />
                  </div>
                  <div className="dashboard-card-title">Active requests</div>
                  <div className="dashboard-card-value">{active}</div>
                  <div className="dashboard-card-subtitle">HR requests marked active (circulated)</div>
                </div>
                <div className="dashboard-card blue">
                  <div className="dashboard-card-icon">
                    <TrendingUp size={22} strokeWidth={2.2} />
                  </div>
                  <div className="dashboard-card-title">Accepted rate</div>
                  <div className="dashboard-card-value">
                    {acceptedRatePct !== null ? `${acceptedRatePct}%` : '—'}
                  </div>
                  <div className="dashboard-card-subtitle">Accepted responses / total submitted</div>
                </div>
                <div className="dashboard-card teal">
                  <div className="dashboard-card-icon">
                    <AlertCircle size={22} strokeWidth={2.2} />
                  </div>
                  <div className="dashboard-card-title">Needs attention</div>
                  <div className="dashboard-card-value">{draft + needsMod}</div>
                  <div className="dashboard-card-subtitle">
                    {draft} draft requests · {needsMod} responses need modification
                  </div>
                </div>
              </>
            ) : variant === 'federal' ? (
              <>
                <div className="dashboard-card brown">
                  <div className="dashboard-card-icon">
                    <Clock size={22} strokeWidth={2.2} />
                  </div>
                  <div className="dashboard-card-title">Total requests</div>
                  <div className="dashboard-card-value">{summary.hr_requests_total}</div>
                  <div className="dashboard-card-subtitle">
                    {draft} draft · {active} active in your scope
                  </div>
                </div>
                <div className="dashboard-card blue">
                  <div className="dashboard-card-icon">
                    <TrendingUp size={22} strokeWidth={2.2} />
                  </div>
                  <div className="dashboard-card-title">Active requests</div>
                  <div className="dashboard-card-value">{active}</div>
                  <div className="dashboard-card-subtitle">Requests marked active (circulated to regions)</div>
                </div>
                <div className="dashboard-card teal">
                  <div className="dashboard-card-icon">
                    <FileText size={22} strokeWidth={2.2} />
                  </div>
                  <div className="dashboard-card-title">Compiled reports</div>
                  <div className="dashboard-card-value">{compiledReportsTotal}</div>
                  <div className="dashboard-card-subtitle">National records saved from federal compilation</div>
                </div>
              </>
            ) : (
              <>
                <div className="dashboard-card brown">
                  <div className="dashboard-card-icon">
                    <Clock size={22} strokeWidth={2.2} />
                  </div>
                  <div className="dashboard-card-title">Active requests</div>
                  <div className="dashboard-card-value">{active}</div>
                  <div className="dashboard-card-subtitle">Requests marked active (circulated)</div>
                </div>
                <div className="dashboard-card blue">
                  <div className="dashboard-card-icon">
                    <TrendingUp size={22} strokeWidth={2.2} />
                  </div>
                  <div className="dashboard-card-title">Active share</div>
                  <div className="dashboard-card-value">{summary.hr_requests_total ? `${resolvedRatePct}%` : '—'}</div>
                  <div className="dashboard-card-subtitle">Active / total requests in scope</div>
                </div>
                <div className="dashboard-card teal">
                  <div className="dashboard-card-icon">
                    <AlertCircle size={22} strokeWidth={2.2} />
                  </div>
                  <div className="dashboard-card-title">Urgent queue</div>
                  <div className="dashboard-card-value">{urgentRequestCount}</div>
                  <div className="dashboard-card-subtitle">
                    {draft} draft total · draft or past-due active requests listed below
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="stats-row" style={{ marginBottom: 28 }}>
            {variant === 'federal' ? (
              <>
                <div className="stat-card">
                  <div className="stat-card-value">{respTotal}</div>
                  <div className="stat-card-label">Responses</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #ffb300' }}>
                  <div className="stat-card-value" style={{ color: '#ffb300' }}>
                    {draft}
                  </div>
                  <div className="stat-card-label">Draft</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #00bcd4' }}>
                  <div className="stat-card-value" style={{ color: '#00bcd4' }}>
                    {clarificationsPending}
                  </div>
                  <div className="stat-card-label">Clarification</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #4caf50' }}>
                  <div className="stat-card-value" style={{ color: '#4caf50' }}>
                    {needsMod}
                  </div>
                  <div className="stat-card-label">Modifications</div>
                </div>
              </>
            ) : (
              <>
                <div className="stat-card">
                  <div className="stat-card-value">{summary.hr_requests_total}</div>
                  <div className="stat-card-label">
                    {variant === 'minimal' ? 'Requests in scope' : 'HR requests'}
                  </div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #ffb300' }}>
                  <div className="stat-card-value" style={{ color: '#ffb300' }}>
                    {draft}
                  </div>
                  <div className="stat-card-label">Draft</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #00bcd4' }}>
                  <div className="stat-card-value" style={{ color: '#00bcd4' }}>
                    {active}
                  </div>
                  <div className="stat-card-label">Active</div>
                </div>
              </>
            )}
            {variant !== 'federal' && (
              <>
                {variant === 'regional' ? (
              <>
                <div className="stat-card" style={{ borderLeft: '4px solid #4caf50' }}>
                  <div className="stat-card-value" style={{ color: '#4caf50' }}>
                    {acceptedResp}
                  </div>
                  <div className="stat-card-label">Accepted responses</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #f44336' }}>
                  <div className="stat-card-value" style={{ color: '#f44336' }}>
                    {needsMod}
                  </div>
                  <div className="stat-card-label">Needs modification</div>
                </div>
              </>
            ) : variant === 'department' || variant === 'viewer' ? (
              <>
                <div className="stat-card" style={{ borderLeft: '4px solid #4caf50' }}>
                  <div className="stat-card-value" style={{ color: '#4caf50' }}>
                    {taskSubmitted}
                  </div>
                  <div className="stat-card-label">Tasks submitted</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #f44336' }}>
                  <div className="stat-card-value" style={{ color: '#f44336' }}>
                    {taskAssigned}
                  </div>
                  <div className="stat-card-label">Tasks open</div>
                </div>
              </>
            ) : variant === 'minimal' ? (
              <>
                <div className="stat-card" style={{ borderLeft: '4px solid #4caf50' }}>
                  <div className="stat-card-value" style={{ color: '#4caf50' }}>
                    {urgentRequestCount}
                  </div>
                  <div className="stat-card-label">Urgent queue</div>
                </div>
              </>
            ) : null}
              </>
            )}
          </div>

          {(variant === 'federal' || variant === 'regional') && respTotal > 0 && (
            <div className="table-card table-card-padded" style={{ marginBottom: 24 }}>
              <h3 className="dashboard-panel-title" style={{ marginBottom: 12 }}>
                {variant === 'federal' ? 'Regional responses' : 'Regional response pipeline'}
              </h3>
              <div className="summary-metric-grid">
                {['pending', 'accepted', 'needs-modification', 'rejected'].map((k) => (
                  <div key={k} className="summary-metric-card">
                    <div className="summary-metric-title">{formatStatus(k)}</div>
                    <div className="summary-metric-value">{count(review, k)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 24,
              marginBottom: 36,
            }}
          >
            <div className="table-card table-card-padded">
              <div className="dashboard-panel-head">
                <h3 className="dashboard-panel-title">
                  {variant === 'federal' ? <Bell size={20} /> : <Clock size={20} />}
                  {variant === 'federal' ? 'Notifications' : 'Requests'}
                </h3>
                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  onClick={() =>
                    variant === 'federal' ? navigate('/requests/clarifications') : navigate('/requests')
                  }
                >
                  View all
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {variant === 'federal' ? (
                  federalNotifications.length > 0 ? (
                    federalNotifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          void (async () => {
                            if (n.read_at === null) await markRead(n.id)
                            if (n.route) navigate(n.route)
                          })()
                        }}
                        style={{
                          textAlign: 'left',
                          cursor: 'pointer',
                          padding: 12,
                          background: n.read_at ? '#f5f7fb' : '#e8eefb',
                          borderRadius: 8,
                          border: 'none',
                          borderLeft: `4px solid ${n.read_at ? '#c5d0e6' : '#2e4fa3'}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                          font: 'inherit',
                          color: 'inherit',
                        }}
                      >
                        <div className="font-semibold text-sm">{n.title}</div>
                        <div className="muted small">{n.message}</div>
                      </button>
                    ))
                  ) : (
                    <div className="empty-state">
                      <CheckCircle size={32} style={{ margin: '0 auto 10px', display: 'block' }} />
                      {inboxLoading ? 'Loading notifications…' : 'No notifications yet.'}
                    </div>
                  )
                ) : requestsPanelRows.length > 0 ? (
                  requestsPanelRows.map((r) => {
                    const chrome = urgentRowChrome(r.status)
                    const taskId = 'task_id' in r ? r.task_id : null
                    return (
                      <button
                        key={taskId ? `${r.id}-${taskId}` : r.id}
                        type="button"
                        onClick={() => {
                          const q = taskId
                            ? `?task=${encodeURIComponent(taskId)}&from=${encodeURIComponent('/')}`
                            : `?from=${encodeURIComponent('/')}`
                          navigate(`/requests/${encodeURIComponent(r.id)}${q}`)
                        }}
                        style={{
                          textAlign: 'left',
                          cursor: 'pointer',
                          padding: 12,
                          background: chrome.background,
                          borderRadius: 8,
                          border: 'none',
                          borderLeft: `4px solid ${chrome.borderLeft}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 12,
                          font: 'inherit',
                          color: 'inherit',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div className="font-semibold text-sm">{r.title}</div>
                          <div className="muted small" style={{ marginTop: 2 }}>
                            {r.region_name ?? '—'} · Due {formatAppDate(r.date)}
                          </div>
                        </div>
                        <span
                          className={statusBadgeClass(r.status)}
                          style={{ fontSize: 'var(--font-size-micro)', flexShrink: 0 }}
                        >
                          {formatStatus(r.status)}
                        </span>
                      </button>
                    )
                  })
                ) : (
                  <div className="empty-state">
                    <CheckCircle size={32} style={{ margin: '0 auto 10px', display: 'block' }} />
                    No urgent actions in your current scope.
                  </div>
                )}
              </div>
            </div>

            <div className="table-card table-card-padded">
              <div className="dashboard-panel-head">
                <h3 className="dashboard-panel-title">Performance overview</h3>
                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  onClick={() => navigate('/analysis')}
                >
                  Full analysis
                </button>
              </div>
              <div className="dashboard-charts-row">
                <div className="dashboard-chart-col">
                  <h4 className="chart-caption">{pieTitle}</h4>
                  <div style={{ width: '100%', height: 220, minWidth: 0 }}>
                    {piePrimary.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220} minWidth={0}>
                        <PieChart>
                          <Pie
                            data={piePrimary}
                            cx="50%"
                            cy="50%"
                            innerRadius={48}
                            outerRadius={72}
                            paddingAngle={4}
                            dataKey="value"
                            nameKey="name"
                          >
                            {piePrimary.map((_, i) => (
                              <Cell
                                key={`cell-${i}`}
                                fill={
                                  variant === 'department' || variant === 'viewer'
                                    ? TASK_PIE_COLORS[i % TASK_PIE_COLORS.length]
                                    : HR_PIE_COLORS[i % HR_PIE_COLORS.length]
                                }
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="empty-state" style={{ paddingTop: 48 }}>
                        No data for this chart yet.
                      </div>
                    )}
                  </div>
                </div>
                <div className="dashboard-chart-col">
                  <h4 className="chart-caption">{trendTitle}</h4>
                  <div style={{ width: '100%', height: 220, minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height={220} minWidth={0}>
                      <LineChart data={trendChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#2e4fa3"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section>
            <div className="dashboard-panel-head" style={{ marginBottom: 12 }}>
              <h3 className="dashboard-panel-title">Knowledge & frameworks</h3>
            </div>
            <div className="knowledge-grid">
              <button
                type="button"
                className="knowledge-card"
                onClick={() => navigate('/conventions')}
              >
                <div className="knowledge-card-icon" style={{ color: '#2e4fa3' }}>
                  <BookOpen size={32} />
                </div>
                <h3>Core conventions</h3>
                <p>Human rights treaties ratified by Pakistan and how they map into HRIMS.</p>
              </button>
              <button
                type="button"
                className="knowledge-card"
                onClick={() => navigate('/indicators')}
              >
                <div className="knowledge-card-icon" style={{ color: '#8b7345' }}>
                  <Target size={32} />
                </div>
                <h3>Indicators</h3>
                <p>Key performance indicators across sectors and monitoring themes.</p>
              </button>
              <button type="button" className="knowledge-card" onClick={() => navigate('/sdgs')}>
                <div className="knowledge-card-icon" style={{ color: '#0f766e' }}>
                  <Globe size={32} />
                </div>
                <h3>Sustainable development goals</h3>
                <p>SDG links and progress framing for national reporting.</p>
              </button>
              <button type="button" className="knowledge-card" onClick={() => navigate('/upr')}>
                <div className="knowledge-card-icon" style={{ color: '#26488a' }}>
                  <RefreshCcw size={32} />
                </div>
                <h3>Universal periodic review</h3>
                <p>UPR cycle context and concluding observations tracking.</p>
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
