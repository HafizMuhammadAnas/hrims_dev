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
import { fetchRegionalResponses, type RegionalResponseRow } from '../api/lists'
import { useAuth } from '../auth/AuthContext'
import { Alert } from '../components/ui/Alert'
import { StatsCards } from '../components/ui/StatsCards'
import {
  isConventionAdmin,
  isDepartmentAdmin,
  isFederalAdmin,
  isRegionalAdmin,
  isSuperAdmin,
  isViewer,
} from '../lib/roles'
import { formatAccountDisplayName } from '../lib/userDisplayLabels'
import { formatAppDate, formatAppTodayLong } from '../lib/dateFormat'
import { regionalResponseReviewPresentation } from '../lib/regionalResponseReviewStatus'
import { regionalResponseFederalReviewPath } from '../lib/workflowNavigation'
import {
  LABEL_ACCEPTED_RATE,
  LABEL_ACTIVE_REQUESTS,
  LABEL_ACTIVE_SHARE,
  LABEL_COMPILED_REPORTS,
  LABEL_HUMAN_RIGHTS_INDICATORS,
  LABEL_LINKED_REQUEST_ATTENTION,
  LABEL_NEEDS_ATTENTION,
  LABEL_NEW_REQUESTS_SCOPE_6MO,
  LABEL_OPEN_TASKS,
  LABEL_PENDING_REQUESTS,
  LABEL_PERFORMANCE_OVERVIEW,
  LABEL_REGIONAL_RESPONSES,
  LABEL_REPORTING_DASHBOARD,
  LABEL_REQUEST_MANAGEMENT,
  LABEL_REQUEST_STATUS_DISTRIBUTION,
  LABEL_SUBMITTED_RATE,
  LABEL_SUSTAINABLE_DEVELOPMENT_GOALS,
  LABEL_TASK_STATUS_MIX,
  LABEL_TASKS_ASSIGNED_6MO,
  LABEL_TOTAL_REQUESTS,
  LABEL_UNIVERSAL_PERIODIC_REVIEW,
  LABEL_URGENT_QUEUE,
  LABEL_VIEW_ALL,
} from '../lib/uiLabels'

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
  if (s === 'needs-revision') return 'Needs Revision'
  if (s === 'needs-modification') return 'Needs Modification'
  if (s === 'pending') return 'Pending'
  if (s === 'accepted') return 'Accepted'
  if (s === 'rejected') return 'Rejected'
  if (s === 'assigned') return 'Assigned'
  if (s === 'submitted') return 'Submitted'
  if (s === 'draft') return 'Draft'
  if (s === 'active') return 'Active'
  return s
    .split('-')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
}

type DashboardVariant = 'federal' | 'regional' | 'department' | 'viewer' | 'minimal'

function dashboardVariant(user: ReturnType<typeof useAuth>['user']): DashboardVariant {
  if (!user) return 'minimal'
  if (isSuperAdmin(user) || isFederalAdmin(user) || isConventionAdmin(user)) return 'federal'
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
  const variant = dashboardVariant(user)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recentResponses, setRecentResponses] = useState<RegionalResponseRow[]>([])
  const [responsesLoading, setResponsesLoading] = useState(false)

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

  useEffect(() => {
    if (variant !== 'federal') {
      setRecentResponses([])
      return
    }
    let cancelled = false
    setResponsesLoading(true)
    void fetchRegionalResponses()
      .then((rows) => {
        if (cancelled) return
        const statusRank: Record<string, number> = {
          pending: 0,
          'needs-modification': 1,
          accepted: 2,
          rejected: 3,
        }
        const sorted = [...rows].sort((a, b) => {
          const rankDiff = (statusRank[a.review_status] ?? 9) - (statusRank[b.review_status] ?? 9)
          if (rankDiff !== 0) return rankDiff
          const aTime = Date.parse(a.submission_date ?? '') || 0
          const bTime = Date.parse(b.submission_date ?? '') || 0
          return bTime - aTime
        })
        setRecentResponses(sorted.slice(0, 8))
      })
      .catch(() => {
        if (!cancelled) setRecentResponses([])
      })
      .finally(() => {
        if (!cancelled) setResponsesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [variant])

  const by = summary?.by_status ?? {}
  const draft = count(by, 'draft')
  const active = count(by, 'active')

  const review = summary?.regional_responses_by_review
  const taskWorkflow = summary?.department_tasks_by_workflow
  const taskBy = summary?.department_tasks_by_status
  const taskTotal = summary?.department_tasks_total ?? 0
  const taskAssigned = count(taskBy, 'assigned')
  const taskSubmitted = count(taskBy, 'submitted')
  const workflowPending = taskWorkflow?.in_process ?? 0
  const workflowReview = taskWorkflow?.responded ?? 0
  const workflowRevision = taskWorkflow?.revision ?? 0
  const workflowAccepted = taskWorkflow?.accepted ?? 0

  const resolvedRatePct =
    summary && summary.hr_requests_total > 0
      ? Math.round((active / summary.hr_requests_total) * 100)
      : 0
  const deptAcceptedRatePct =
    taskTotal > 0 ? Math.round((workflowAccepted / taskTotal) * 100) : null
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
      return `${user.region?.name ?? 'Province'} overview — manage requests and responses for your province`
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
  const pendingRequests =
    summary?.hr_requests_pending_federal ?? Math.max(0, active - compiledReportsTotal)

  const requestsPanelRows: (UrgentRequestRow | (UrgentDepartmentTaskRow & { task_id: string }))[] =
    variant === 'department' || variant === 'viewer'
      ? urgentDeptTasks.length > 0
        ? urgentDeptTasks
        : urgentList
      : urgentList

  const pieTitle =
    variant === 'department' || variant === 'viewer'
      ? LABEL_TASK_STATUS_MIX
      : LABEL_REQUEST_STATUS_DISTRIBUTION
  const trendTitle =
    variant === 'department' || variant === 'viewer'
      ? LABEL_TASKS_ASSIGNED_6MO
      : LABEL_NEW_REQUESTS_SCOPE_6MO

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
              <h2>Welcome, {formatAccountDisplayName(user.name)}</h2>
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
                {LABEL_REQUEST_MANAGEMENT}
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
                  <div className="dashboard-card-title">{LABEL_OPEN_TASKS}</div>
                  <div className="dashboard-card-value">{taskAssigned}</div>
                  <div className="dashboard-card-subtitle">Assigned and awaiting your submission</div>
                </div>
                <div className="dashboard-card blue">
                  <div className="dashboard-card-icon">
                    <TrendingUp size={22} strokeWidth={2.2} />
                  </div>
                  <div className="dashboard-card-title">{LABEL_SUBMITTED_RATE}</div>
                  <div className="dashboard-card-value">
                    {taskTotal ? `${taskDonePct}%` : '—'}
                  </div>
                  <div className="dashboard-card-subtitle">Submitted / total department tasks</div>
                </div>
                <div className="dashboard-card teal">
                  <div className="dashboard-card-icon">
                    <AlertCircle size={22} strokeWidth={2.2} />
                  </div>
                  <div className="dashboard-card-title">{LABEL_LINKED_REQUEST_ATTENTION}</div>
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
                  <div className="dashboard-card-title">{LABEL_ACTIVE_REQUESTS}</div>
                  <div className="dashboard-card-value">{active}</div>
                  <div className="dashboard-card-subtitle">HR requests marked active (circulated)</div>
                </div>
                <div className="dashboard-card blue">
                  <div className="dashboard-card-icon">
                    <TrendingUp size={22} strokeWidth={2.2} />
                  </div>
                  <div className="dashboard-card-title">{LABEL_ACCEPTED_RATE}</div>
                  <div className="dashboard-card-value">
                    {deptAcceptedRatePct !== null ? `${deptAcceptedRatePct}%` : '—'}
                  </div>
                  <div className="dashboard-card-subtitle">Accepted department responses / total tasks</div>
                </div>
                <div className="dashboard-card teal">
                  <div className="dashboard-card-icon">
                    <AlertCircle size={22} strokeWidth={2.2} />
                  </div>
                  <div className="dashboard-card-title">{LABEL_NEEDS_ATTENTION}</div>
                  <div className="dashboard-card-value">{draft + workflowRevision}</div>
                  <div className="dashboard-card-subtitle">
                    {draft} draft requests · {workflowRevision} department responses need revision
                  </div>
                </div>
              </>
            ) : variant === 'federal' ? (
              <>
                <div className="dashboard-card brown">
                  <div className="dashboard-card-icon">
                    <Clock size={22} strokeWidth={2.2} />
                  </div>
                  <div className="dashboard-card-title">{LABEL_TOTAL_REQUESTS}</div>
                  <div className="dashboard-card-value">{summary.hr_requests_total}</div>
                  <div className="dashboard-card-subtitle">
                    {draft} draft · {active} active in your scope
                  </div>
                </div>
                <div className="dashboard-card blue">
                  <div className="dashboard-card-icon">
                    <Clock size={22} strokeWidth={2.2} />
                  </div>
                  <div className="dashboard-card-title">{LABEL_PENDING_REQUESTS}</div>
                  <div className="dashboard-card-value">{pendingRequests}</div>
                  <div className="dashboard-card-subtitle">
                    {active} active · {pendingRequests} pending · {compiledReportsTotal} compiled
                  </div>
                </div>
                <div className="dashboard-card teal">
                  <div className="dashboard-card-icon">
                    <FileText size={22} strokeWidth={2.2} />
                  </div>
                  <div className="dashboard-card-title">{LABEL_COMPILED_REPORTS}</div>
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
                  <div className="dashboard-card-title">{LABEL_ACTIVE_REQUESTS}</div>
                  <div className="dashboard-card-value">{active}</div>
                  <div className="dashboard-card-subtitle">Requests marked active (circulated)</div>
                </div>
                <div className="dashboard-card blue">
                  <div className="dashboard-card-icon">
                    <TrendingUp size={22} strokeWidth={2.2} />
                  </div>
                  <div className="dashboard-card-title">{LABEL_ACTIVE_SHARE}</div>
                  <div className="dashboard-card-value">{summary.hr_requests_total ? `${resolvedRatePct}%` : '—'}</div>
                  <div className="dashboard-card-subtitle">Active / total requests in scope</div>
                </div>
                <div className="dashboard-card teal">
                  <div className="dashboard-card-icon">
                    <AlertCircle size={22} strokeWidth={2.2} />
                  </div>
                  <div className="dashboard-card-title">{LABEL_URGENT_QUEUE}</div>
                  <div className="dashboard-card-value">{urgentRequestCount}</div>
                  <div className="dashboard-card-subtitle">
                    {draft} draft total · draft or past-due active requests listed below
                  </div>
                </div>
              </>
            )}
          </div>

          {variant === 'federal' ? (
            <StatsCards
              className="dashboard-status-stats"
              items={[
                { label: 'Pending', value: count(review, 'pending'), accent: '#ffb300' },
                { label: 'Accepted', value: count(review, 'accepted'), accent: '#4caf50' },
                {
                  label: 'Needs Modification',
                  value: count(review, 'needs-modification'),
                  accent: '#00bcd4',
                },
                { label: 'Rejected', value: count(review, 'rejected'), accent: '#f44336' },
              ]}
            />
          ) : variant === 'regional' || variant === 'department' || variant === 'viewer' ? (
            <StatsCards
              className="dashboard-status-stats"
              items={[
                { label: 'Pending', value: workflowPending, accent: '#ffb300' },
                { label: 'Under Review', value: workflowReview, accent: '#00bcd4' },
                { label: 'Revision', value: workflowRevision, accent: '#f44336' },
                { label: 'Accepted', value: workflowAccepted, accent: '#4caf50' },
              ]}
            />
          ) : (
            <StatsCards
              className="dashboard-status-stats"
              items={[
                {
                  label: variant === 'minimal' ? 'Requests in scope' : 'HR requests',
                  value: summary.hr_requests_total,
                },
                { label: 'Draft', value: draft, accent: '#ffb300' },
                { label: 'Active', value: active, accent: '#00bcd4' },
                { label: 'Urgent queue', value: urgentRequestCount, accent: '#4caf50' },
              ]}
            />
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
                  {variant === 'federal'
                    ? 'Recent Responses'
                    : variant === 'department' || variant === 'viewer'
                      ? 'Recent Tasks'
                      : 'Recent Requests'}
                </h3>
                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  onClick={() => {
                    if (variant === 'federal') {
                      navigate('/responses')
                      return
                    }
                    if (variant === 'regional') {
                      navigate('/region-received')
                      return
                    }
                    if (variant === 'department' || variant === 'viewer') {
                      navigate('/department-tasks')
                      return
                    }
                    navigate('/requests')
                  }}
                >
                  {LABEL_VIEW_ALL}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {variant === 'federal' ? (
                  recentResponses.length > 0 ? (
                    recentResponses.map((r) => {
                      const review = regionalResponseReviewPresentation(r.review_status)
                      const preview = (r.comments ?? r.content ?? '').trim()
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => navigate(regionalResponseFederalReviewPath(r.id, '/'))}
                          style={{
                            textAlign: 'left',
                            cursor: 'pointer',
                            padding: 12,
                            background: r.review_status === 'pending' ? '#e8eefb' : '#f5f7fb',
                            borderRadius: 8,
                            border: 'none',
                            borderLeft: `4px solid ${
                              r.review_status === 'pending'
                                ? '#2e4fa3'
                                : r.review_status === 'needs-modification'
                                  ? '#00bcd4'
                                  : r.review_status === 'accepted'
                                    ? '#4caf50'
                                    : r.review_status === 'rejected'
                                      ? '#f44336'
                                      : '#c5d0e6'
                            }`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 12,
                            font: 'inherit',
                            color: 'inherit',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div className="font-semibold text-sm">
                              {r.title?.trim() || r.req_id}
                            </div>
                            <div className="muted small" style={{ marginTop: 2 }}>
                              {r.region_name ?? '—'}
                              {r.submission_date ? ` · ${formatAppDate(r.submission_date)}` : ''}
                              {preview
                                ? ` · ${preview.length > 100 ? `${preview.slice(0, 100)}…` : preview}`
                                : ''}
                            </div>
                          </div>
                          <span
                            className={`status-badge ${
                              review.tone === 'success'
                                ? 'success'
                                : review.tone === 'warning'
                                  ? 'warning'
                                  : review.tone === 'danger'
                                    ? 'danger'
                                    : 'default'
                            }`}
                            style={{ fontSize: 'var(--font-size-micro)', flexShrink: 0 }}
                          >
                            {review.label}
                          </span>
                        </button>
                      )
                    })
                  ) : (
                    <div className="empty-state">
                      <CheckCircle size={32} style={{ margin: '0 auto 10px', display: 'block' }} />
                      {responsesLoading
                        ? `Loading ${LABEL_REGIONAL_RESPONSES.toLowerCase()}…`
                        : 'No regional responses yet.'}
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
                          if (variant === 'regional') {
                            navigate(
                              `/requests/${encodeURIComponent(r.id)}?from=${encodeURIComponent('/region-received')}`,
                            )
                            return
                          }
                          const from =
                            variant === 'department' || variant === 'viewer'
                              ? '/department-tasks'
                              : '/'
                          const q = taskId
                            ? `?task=${encodeURIComponent(taskId)}&from=${encodeURIComponent(from)}`
                            : `?from=${encodeURIComponent(from)}`
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
                <h3 className="dashboard-panel-title">{LABEL_PERFORMANCE_OVERVIEW}</h3>
                {(variant === 'federal' || variant === 'regional') && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-compact"
                    onClick={() => navigate('/report-generator')}
                  >
                    {LABEL_REPORTING_DASHBOARD}
                  </button>
                )}
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
              <h3 className="dashboard-panel-title">Knowledge & Frameworks</h3>
            </div>
            <div className="knowledge-hub">
              <div className="cards-grid">
              <button
                type="button"
                className="card"
                onClick={() => navigate('/conventions')}
              >
                <div className="card-icon" style={{ color: '#fff' }}>
                  <BookOpen size={28} />
                </div>
                <h3 className="card-title">Core Conventions</h3>
                <p className="card-desc">Human rights treaties ratified by Pakistan and how they map into HRIMS.</p>
              </button>
              <button
                type="button"
                className="card"
                onClick={() => navigate('/indicators')}
              >
                <div className="card-icon" style={{ color: '#fff' }}>
                  <Target size={28} />
                </div>
                <h3 className="card-title">{LABEL_HUMAN_RIGHTS_INDICATORS}</h3>
                <p className="card-desc">Key performance indicators across sectors and monitoring themes.</p>
              </button>
              <button type="button" className="card" onClick={() => navigate('/sdgs')}>
                <div className="card-icon" style={{ color: '#fff' }}>
                  <Globe size={28} />
                </div>
                <h3 className="card-title">{LABEL_SUSTAINABLE_DEVELOPMENT_GOALS}</h3>
                <p className="card-desc">SDG links and progress framing for national reporting.</p>
              </button>
              <button type="button" className="card" onClick={() => navigate('/upr')}>
                <div className="card-icon" style={{ color: '#fff' }}>
                  <RefreshCcw size={28} />
                </div>
                <h3 className="card-title">{LABEL_UNIVERSAL_PERIODIC_REVIEW}</h3>
                <p className="card-desc">UPR cycle context and Concluding Observations tracking.</p>
              </button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
