import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts'
import { BarChart2, Filter, Image as ImageIcon, RefreshCcw } from 'lucide-react'
import { fetchRegionalResponses, type RegionalResponseRow } from '../api/lists'
import { fetchHrRequests } from '../api/hrRequests'
import { PageSection } from '../components/ui/PageSection'
import type { HrRequestRow } from '../types/hrRequest'

/** Pastels aligned with hrims_old Analysis.tsx (muted, print-friendly). */
const PASTEL_PALETTE = [
  '#6BA8C4',
  '#6BB89A',
  '#E0A55C',
  '#7CAD76',
  '#D97D90',
  '#7AA8D4',
  '#B8955E',
  '#6B96C8',
  '#C97582',
  '#5BB88E',
  '#76A89E',
  '#D4B055',
]

const PASTEL_AREA_REQ_STROKE = '#4A8FB0'
const PASTEL_AREA_REQ_FILL = '#6BA8C4'
const PASTEL_AREA_COMP_STROKE = '#559A75'
const PASTEL_AREA_COMP_FILL = '#6BB89A'
const PASTEL_BAR_CATEGORY = '#6BA8C4'
const PASTEL_BAR_SDG = '#6B96C8'
const PASTEL_BAR_CONVENTION = '#E0A55C'
const PASTEL_RADAR_STROKE = '#5A9A8E'
const PASTEL_RADAR_FILL = '#6BB89A'
const PASTEL_TABLE_PROGRESS = '#5D9A6A'
const PASTEL_TABLE_ONGOING = '#9A7340'
const PASTEL_TABLE_ACCOMPLISHED = '#559A72'

const STATUS_COLORS: Record<string, string> = {
  pending: '#E0A55C',
  'in-progress': '#6B96C8',
  completed: '#6BB89A',
  overdue: '#D97D90',
}

type DraftFilters = {
  convention: string
  status: string
  province: string
  dateFrom: string
  dateTo: string
  sdg: string
  category: string
}

const DEFAULT_FILTERS: DraftFilters = {
  convention: 'All',
  status: 'All',
  province: 'All',
  dateFrom: '',
  dateTo: '',
  sdg: 'All',
  category: 'All',
}

function regionLabel(r: HrRequestRow): string {
  return r.region_name ?? r.region?.name ?? 'Unknown'
}

function applyRequestFilters(reqs: HrRequestRow[], f: DraftFilters): HrRequestRow[] {
  return reqs.filter((r) => {
    if (f.convention !== 'All' && r.conv !== f.convention) return false
    if (f.status !== 'All' && r.status !== f.status) return false
    if (f.province !== 'All' && regionLabel(r) !== f.province) return false
    if (f.dateFrom && r.date < f.dateFrom) return false
    if (f.dateTo && r.date > f.dateTo) return false
    if (f.sdg !== 'All' && (r.sdg ?? '') !== f.sdg) return false
    if (f.category !== 'All') {
      const cn = r.issue?.category?.name ?? ''
      if (cn !== f.category) return false
    }
    return true
  })
}

function lastNMonthKeys(n: number): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

function monthShortLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('default', { month: 'short' })
}

function downloadChartAsImage(chartId: string, title: string) {
  const container = document.getElementById(chartId)
  if (!container) return
  const svg = container.querySelector('svg')
  if (!svg) {
    window.alert('Chart not ready for export.')
    return
  }
  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(svg)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const img = new Image()
  const svgData = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgData)
  img.onload = () => {
    canvas.width = img.width + 40
    canvas.height = img.height + 60
    if (ctx) {
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.font = 'bold 16px sans-serif'
      ctx.fillStyle = '#5a6b7a'
      ctx.fillText(title, 20, 30)
      ctx.drawImage(img, 20, 50)
      const pngUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = pngUrl
      a.download = `${title.replace(/\s+/g, '_')}_Analysis.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
    URL.revokeObjectURL(url)
  }
  img.src = url
}

function ChartCard({
  title,
  id,
  loading,
  fullWidth,
  children,
  emptyMessage,
}: {
  title: string
  id: string
  loading: boolean
  fullWidth?: boolean
  children: ReactNode
  emptyMessage?: string
}) {
  return (
    <div
      id={id}
      className={
        'analysis-chart-card' + (fullWidth ? ' analysis-chart-card--span2' : '')
      }
    >
      <div className="analysis-chart-card__head">
        <h3>{title}</h3>
        <div className="analysis-chart-card__export">
          <button
            type="button"
            onClick={() => downloadChartAsImage(id, title)}
            title="Save as image"
          >
            <ImageIcon size={16} aria-hidden />
          </button>
        </div>
      </div>
      {loading ? (
        <div className="analysis-chart-card__body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="analysis-spinner" role="status" aria-label="Loading" />
        </div>
      ) : emptyMessage ? (
        <div className="analysis-chart-card__empty">{emptyMessage}</div>
      ) : (
        <div className="analysis-chart-card__body">{children}</div>
      )}
    </div>
  )
}

export function AnalysisPage() {
  const [requests, setRequests] = useState<HrRequestRow[]>([])
  const [responses, setResponses] = useState<RegionalResponseRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftFilters>(DEFAULT_FILTERS)
  const [applied, setApplied] = useState<DraftFilters>(DEFAULT_FILTERS)

  useEffect(() => {
    void Promise.all([fetchHrRequests(), fetchRegionalResponses()])
      .then(([reqs, resp]) => {
        setRequests(reqs)
        setResponses(resp)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load analysis data'))
  }, [])

  const filteredRequests = useMemo(() => applyRequestFilters(requests, applied), [requests, applied])

  const filteredIds = useMemo(() => new Set(filteredRequests.map((r) => r.id)), [filteredRequests])

  const filteredResponses = useMemo(
    () => responses.filter((r) => filteredIds.has(r.req_id)),
    [responses, filteredIds],
  )

  const conventionOptions = useMemo(() => {
    const u = [...new Set(requests.map((r) => r.conv))].sort()
    return u
  }, [requests])

  const provinceOptions = useMemo(() => {
    const u = [...new Set(requests.map(regionLabel))].filter((x) => x !== 'Unknown').sort()
    return u
  }, [requests])

  const sdgOptions = useMemo(() => {
    const u = [...new Set(requests.map((r) => r.sdg).filter(Boolean) as string[])].sort()
    return u
  }, [requests])

  const categoryOptions = useMemo(() => {
    const u = [
      ...new Set(
        requests.map((r) => r.issue?.category?.name).filter(Boolean) as string[],
      ),
    ].sort()
    return u
  }, [requests])

  const timelineData = useMemo(() => {
    const keys = lastNMonthKeys(6)
    return keys.map((ym) => {
      const label = monthShortLabel(ym)
      const reqN = filteredRequests.filter((r) => r.date.startsWith(ym)).length
      const respN = filteredResponses.filter((r) => r.submission_date.startsWith(ym)).length
      return { name: label, ym, requests: reqN, completed: respN }
    })
  }, [filteredRequests, filteredResponses])

  const statusPieData = useMemo(() => {
    const map: Record<string, number> = {}
    filteredRequests.forEach((r) => {
      map[r.status] = (map[r.status] ?? 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({
      name: name.replace(/-/g, ' '),
      key: name,
      value,
    }))
  }, [filteredRequests])

  const categoryBarData = useMemo(() => {
    const map: Record<string, number> = {}
    filteredRequests.forEach((r) => {
      const k = r.issue?.category?.name ?? 'Uncategorized'
      map[k] = (map[k] ?? 0) + 1
    })
    return Object.entries(map)
      .map(([name, records]) => ({
        name: name.length > 28 ? `${name.slice(0, 28)}…` : name,
        fullName: name,
        records,
      }))
      .sort((a, b) => b.records - a.records)
  }, [filteredRequests])

  const sdgBarData = useMemo(() => {
    const map: Record<string, number> = {}
    filteredRequests.forEach((r) => {
      const k = r.sdg?.trim() || 'Not tagged'
      map[k] = (map[k] ?? 0) + 1
    })
    return Object.entries(map)
      .map(([name, records]) => ({
        name: name.length > 32 ? `${name.slice(0, 32)}…` : name,
        fullName: name,
        records,
      }))
      .sort((a, b) => b.records - a.records)
      .slice(0, 16)
  }, [filteredRequests])

  const categoryPieData = useMemo(() => {
    const map: Record<string, number> = {}
    filteredRequests.forEach((r) => {
      const k = r.issue?.category?.name ?? 'Uncategorized'
      map[k] = (map[k] ?? 0) + 1
    })
    return Object.entries(map)
      .map(([name, value]) => ({
        name: name.length > 18 ? `${name.slice(0, 18)}…` : name,
        fullName: name,
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [filteredRequests])

  const conventionBarData = useMemo(() => {
    const map: Record<string, number> = {}
    filteredRequests.forEach((r) => {
      map[r.conv] = (map[r.conv] ?? 0) + 1
    })
    return Object.entries(map)
      .map(([name, records]) => ({ name, records }))
      .sort((a, b) => b.records - a.records)
  }, [filteredRequests])

  const provincePieData = useMemo(() => {
    const map: Record<string, number> = {}
    filteredRequests.forEach((r) => {
      const k = regionLabel(r)
      map[k] = (map[k] ?? 0) + 1
    })
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filteredRequests])

  const sdgRadarData = useMemo(() => {
    const map: Record<string, number> = {}
    filteredRequests.forEach((r) => {
      const k = r.sdg?.trim() || 'Not tagged'
      map[k] = (map[k] ?? 0) + 1
    })
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6)
    const maxV = Math.max(1, ...entries.map(([, v]) => v))
    const fullMark = Math.ceil(maxV * 1.15)
    return entries.map(([subject, A]) => ({
      subject: subject.length > 22 ? `${subject.slice(0, 22)}…` : subject,
      fullSubject: subject,
      A,
      fullMark,
    }))
  }, [filteredRequests])

  const metricsRows = useMemo(() => {
    const byConv = new Map<string, HrRequestRow[]>()
    filteredRequests.forEach((r) => {
      const arr = byConv.get(r.conv) ?? []
      arr.push(r)
      byConv.set(r.conv, arr)
    })
    const hasResp = new Set(filteredResponses.map((x) => x.req_id))
    return Array.from(byConv.entries())
      .map(([name, list]) => {
        const total = list.length
        const respCount = list.filter((r) => hasResp.has(r.id)).length
        const compliance = total ? Math.min(100, Math.round((respCount / total) * 100)) : 0
        const ongoing = list.filter((x) => x.status === 'pending' || x.status === 'in-progress').length
        const accomplished = list.filter((x) => x.status === 'completed').length
        return { name, records: total, compliance, ongoing, accomplished }
      })
      .sort((a, b) => b.records - a.records)
  }, [filteredRequests, filteredResponses])

  function handleReset() {
    setDraft(DEFAULT_FILTERS)
    setApplied(DEFAULT_FILTERS)
  }

  function handleApply() {
    setApplied({ ...draft })
  }

  const hasData = filteredRequests.length > 0

  return (
    <PageSection
      titleIcon={<BarChart2 size={26} color="var(--solid-blue)" aria-hidden />}
      title="Data Analytics & Performance"
      subtitle="Interactive charts driven by HR requests and regional responses visible to your account."
      detail="Palette and layout follow the legacy HRIMS analysis dashboard: soft pastels, indigo filter accent, and exportable chart cards."
    >
      {error && <p className="login-error">{error}</p>}

      <div className="analysis-page">
        <div className="analysis-filter-card">
          <div className="analysis-filter-card__head">
            <Filter size={20} color="#6366f1" aria-hidden />
            <h3>Filters configuration</h3>
          </div>
          <div className="analysis-filter-grid">
            <div className="analysis-field">
              <label htmlFor="an-conv">Convention</label>
              <select
                id="an-conv"
                value={draft.convention}
                onChange={(e) => setDraft((d) => ({ ...d, convention: e.target.value }))}
              >
                <option value="All">All conventions</option>
                {conventionOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="analysis-field">
              <label htmlFor="an-status">Status</label>
              <select
                id="an-status"
                value={draft.status}
                onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
              >
                <option value="All">All statuses</option>
                <option value="pending">Pending</option>
                <option value="in-progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <div className="analysis-field">
              <label>Date range</label>
              <div className="analysis-field-row">
                <div>
                  <input
                    type="date"
                    value={draft.dateFrom}
                    onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))}
                  />
                </div>
                <div>
                  <input
                    type="date"
                    value={draft.dateTo}
                    onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="analysis-field">
              <label htmlFor="an-prov">Province / region</label>
              <select
                id="an-prov"
                value={draft.province}
                onChange={(e) => setDraft((d) => ({ ...d, province: e.target.value }))}
              >
                <option value="All">All provinces</option>
                {provinceOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="analysis-field">
              <label htmlFor="an-sdg">SDG goal</label>
              <select
                id="an-sdg"
                value={draft.sdg}
                onChange={(e) => setDraft((d) => ({ ...d, sdg: e.target.value }))}
              >
                <option value="All">All goals</option>
                {sdgOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="analysis-field">
              <label htmlFor="an-cat">Category</label>
              <select
                id="an-cat"
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
              >
                <option value="All">All categories</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="analysis-field analysis-filter-actions">
              <button type="button" className="analysis-btn analysis-btn--secondary" onClick={handleReset}>
                <RefreshCcw size={16} aria-hidden /> Reset
              </button>
              <button type="button" className="analysis-btn analysis-btn--primary" onClick={handleApply}>
                Apply filters
              </button>
            </div>
          </div>
        </div>

        <div className="analysis-charts-grid analysis-charts-grid--r1">
          <ChartCard
            title="Monthly activity trend"
            id="chart-timeline"
            loading={false}
            fullWidth
            emptyMessage={!hasData ? 'No requests in the current filter set.' : undefined}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="anColorReq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PASTEL_AREA_REQ_FILL} stopOpacity={0.85} />
                    <stop offset="95%" stopColor={PASTEL_AREA_REQ_FILL} stopOpacity={0.08} />
                  </linearGradient>
                  <linearGradient id="anColorComp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PASTEL_AREA_COMP_FILL} stopOpacity={0.85} />
                    <stop offset="95%" stopColor={PASTEL_AREA_COMP_FILL} stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="requests"
                  stroke={PASTEL_AREA_REQ_STROKE}
                  fillOpacity={1}
                  fill="url(#anColorReq)"
                  name="Requests (new)"
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke={PASTEL_AREA_COMP_STROKE}
                  fillOpacity={1}
                  fill="url(#anColorComp)"
                  name="Regional responses"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Request status distribution"
            id="chart-status"
            loading={false}
            emptyMessage={!hasData ? 'No status data to chart.' : undefined}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={88}
                  paddingAngle={4}
                >
                  {statusPieData.map((s, i) => (
                    <Cell
                      key={s.key}
                      fill={STATUS_COLORS[s.key] ?? PASTEL_PALETTE[i % PASTEL_PALETTE.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="analysis-charts-grid analysis-charts-grid--r3">
          <ChartCard
            title="Records by category"
            id="chart-categories"
            loading={false}
            emptyMessage={!hasData ? 'No category breakdown.' : undefined}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryBarData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={108} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="records" fill={PASTEL_BAR_CATEGORY} radius={[0, 4, 4, 0]} name="Records" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Records by SDG tag"
            id="chart-sdg-bars"
            loading={false}
            emptyMessage={!hasData ? 'No SDG tags on requests.' : undefined}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sdgBarData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="records" fill={PASTEL_BAR_SDG} radius={[0, 4, 4, 0]} name="Records" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Category share"
            id="chart-category-pie"
            loading={false}
            emptyMessage={!hasData ? 'No categories to show.' : undefined}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(p: { name?: string; percent?: number }) =>
                    `${String(p.name ?? '')} ${((p.percent ?? 0) * 100).toFixed(0)}%`
                  }
                  outerRadius={92}
                >
                  {categoryPieData.map((_, i) => (
                    <Cell key={i} fill={PASTEL_PALETTE[i % PASTEL_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="analysis-charts-grid analysis-charts-grid--r2">
          <ChartCard
            title="Records by convention"
            id="chart-conventions"
            loading={false}
            emptyMessage={!hasData ? 'No convention data.' : undefined}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={conventionBarData} layout="vertical" margin={{ left: 4, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={52} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="records" fill={PASTEL_BAR_CONVENTION} radius={[0, 4, 4, 0]} name="Records" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Provincial volume"
            id="chart-provinces"
            loading={false}
            emptyMessage={!hasData ? 'No regional distribution.' : undefined}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={provincePieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  labelLine
                  label={(p: { name?: string; percent?: number }) =>
                    `${String(p.name ?? '')} ${((p.percent ?? 0) * 100).toFixed(0)}%`
                  }
                  outerRadius={96}
                >
                  {provincePieData.map((_, i) => (
                    <Cell key={i} fill={PASTEL_PALETTE[i % PASTEL_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="analysis-charts-grid analysis-charts-grid--r1">
          <ChartCard
            title="SDG alignment (top tags)"
            id="chart-sdg"
            loading={false}
            emptyMessage={!hasData ? 'No SDG-tagged requests in range.' : undefined}
          >
            {sdgRadarData.length === 0 || !hasData ? null : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={sdgRadarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, sdgRadarData[0]?.fullMark ?? 10]} />
                  <Radar
                    name="Tagged requests"
                    dataKey="A"
                    stroke={PASTEL_RADAR_STROKE}
                    fill={PASTEL_RADAR_FILL}
                    fillOpacity={0.55}
                  />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <div className="analysis-metrics-table-wrap analysis-chart-card--span2">
            <header>
              <h3>Detailed implementation metrics</h3>
            </header>
            <div className="table-scroll">
              <table className="analysis-metrics-table">
                <thead>
                  <tr>
                    <th>Convention</th>
                    <th>Total records</th>
                    <th>Response coverage</th>
                    <th>Active (pending / in progress)</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {metricsRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--txt-lt)', padding: 24 }}>
                        No data matches current filters.
                      </td>
                    </tr>
                  ) : (
                    metricsRows.map((row) => (
                      <tr key={row.name}>
                        <td style={{ fontWeight: 600 }}>{row.name}</td>
                        <td>{row.records}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="analysis-progress-track">
                              <div
                                className="analysis-progress-fill"
                                style={{
                                  width: `${row.compliance}%`,
                                  backgroundColor: PASTEL_TABLE_PROGRESS,
                                }}
                              />
                            </div>
                            <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                              {row.compliance}%
                            </span>
                          </div>
                        </td>
                        <td style={{ fontWeight: 600, color: PASTEL_TABLE_ONGOING }}>{row.ongoing}</td>
                        <td style={{ fontWeight: 600, color: PASTEL_TABLE_ACCOMPLISHED }}>{row.accomplished}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </PageSection>
  )
}
