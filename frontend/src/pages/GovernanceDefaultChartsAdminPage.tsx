import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Navigate } from 'react-router-dom'
import { BarChart2, GripVertical, Plus, Trash2 } from 'lucide-react'
import {
  adminFetchGovernanceDefaultCharts,
  adminSyncGovernanceDefaultCharts,
  type AdminGovernanceDefaultChartPayload,
} from '../api/admin'
import { isApiError } from '../api/apiError'
import {
  fetchReportIndicators,
  fetchReportIssueCategories,
  type ReportLookupCategory,
  type ReportLookupIndicator,
} from '../api/reports'
import { useAuth } from '../auth/AuthContext'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { FormControl } from '../components/ui/FormControl'
import { FormGrid } from '../components/ui/FormGrid'
import { FormRow } from '../components/ui/FormRow'
import { PageSection } from '../components/ui/PageSection'
import { SearchableSelect, type SearchableSelectOption } from '../components/ui/SearchableSelect'
import { isSuperAdmin } from '../lib/roles'
import { LABEL_GOVERNANCE_DASHBOARD, LABEL_GOVERNANCE_DEFAULT_CHARTS } from '../lib/uiLabels'

type ChartKind = 'trend' | 'comparison' | 'dimension_totals'
type ChartShape = 'line' | 'bar' | 'area' | 'step' | 'pie' | 'composed'

type ChartDraft = {
  clientKey: string
  kind: ChartKind
  title: string
  shape: ChartShape
  series_a_label: string
  /** UI-only filter for series A indicator picker. */
  series_a_category_id: string
  series_a_indicator_id: string
  series_b_label: string
  /** UI-only filter for series B indicator picker. */
  series_b_category_id: string
  series_b_indicator_id: string
  is_active: boolean
}

const TREND_SHAPES: { value: ChartShape; label: string }[] = [
  { value: 'line', label: 'Line' },
  { value: 'bar', label: 'Bar' },
  { value: 'area', label: 'Area' },
  { value: 'step', label: 'Step' },
  { value: 'pie', label: 'Pie' },
  { value: 'composed', label: 'Composed' },
]

const COMPARISON_SHAPES: { value: ChartShape; label: string }[] = [
  { value: 'line', label: 'Line' },
  { value: 'bar', label: 'Bar' },
  { value: 'composed', label: 'Composed (bar + line)' },
]

/** Multi-series over years (one series per dimension Total). */
const DIMENSION_TOTALS_SHAPES: { value: ChartShape; label: string }[] = [
  { value: 'bar', label: 'Grouped bar' },
  { value: 'line', label: 'Multi-line' },
  { value: 'composed', label: 'Composed' },
]

function newClientKey(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function emptyDraft(): ChartDraft {
  return {
    clientKey: newClientKey(),
    kind: 'trend',
    title: '',
    shape: 'line',
    series_a_label: 'Total',
    series_a_category_id: '',
    series_a_indicator_id: '',
    series_b_label: '',
    series_b_category_id: '',
    series_b_indicator_id: '',
    is_active: true,
  }
}

function buildIndicatorOptions(
  pool: ReportLookupIndicator[],
  selectedId: string,
  allIndicators: ReportLookupIndicator[],
): SearchableSelectOption[] {
  const byId = new Map(pool.map((i) => [String(i.id), i.indicator_text]))
  if (selectedId && !byId.has(selectedId)) {
    const found = allIndicators.find((i) => String(i.id) === selectedId)
    if (found) byId.set(selectedId, found.indicator_text)
  }
  return [...byId.entries()].map(([value, label]) => ({ value, label }))
}

function slugKey(label: string, fallback: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48)
  return slug || fallback
}

function toPayload(drafts: ChartDraft[]): AdminGovernanceDefaultChartPayload[] {
  return drafts.map((d) => {
    const isComparison = d.kind === 'comparison'
    const base: AdminGovernanceDefaultChartPayload = {
      kind: d.kind,
      title: d.title.trim(),
      shape: d.shape,
      series_a_key: isComparison
        ? slugKey(d.series_a_label, 'series_a')
        : d.kind === 'dimension_totals'
          ? 'dimensions'
          : 'total',
      series_a_label:
        d.series_a_label.trim() ||
        (d.kind === 'dimension_totals' ? 'Dimension totals' : isComparison ? 'Series A' : 'Total'),
      series_a_indicator_id: d.series_a_indicator_id ? Number(d.series_a_indicator_id) : null,
      is_active: d.is_active,
    }
    if (isComparison) {
      base.series_b_key = slugKey(d.series_b_label, 'series_b')
      base.series_b_label = d.series_b_label.trim() || 'Series B'
      base.series_b_indicator_id = d.series_b_indicator_id ? Number(d.series_b_indicator_id) : null
      if (base.shape !== 'line' && base.shape !== 'bar' && base.shape !== 'composed') {
        base.shape = 'line'
      }
    } else if (d.kind === 'dimension_totals') {
      if (base.shape !== 'line' && base.shape !== 'bar' && base.shape !== 'composed') {
        base.shape = 'bar'
      }
    }
    return base
  })
}

export function GovernanceDefaultChartsAdminPage() {
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<ChartDraft[]>([])
  const [indicators, setIndicators] = useState<ReportLookupIndicator[]>([])
  const [categories, setCategories] = useState<ReportLookupCategory[]>([])
  const [indicatorsByCategory, setIndicatorsByCategory] = useState<
    Record<string, ReportLookupIndicator[]>
  >({})
  const categoryLoadRef = useRef(new Set<string>())

  const categoryOptions = useMemo(
    () => [
      { value: 'all', label: 'All categories' },
      ...categories.map((c) => ({ value: String(c.id), label: c.name })),
    ],
    [categories],
  )

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const [charts, inds, cats] = await Promise.all([
        adminFetchGovernanceDefaultCharts(),
        fetchReportIndicators({}),
        fetchReportIssueCategories(),
      ])
      setIndicators(inds)
      setCategories(cats)
      setDrafts(
        charts.map((c) => ({
          clientKey: `cfg-${c.id}`,
          kind: c.kind,
          title: c.title,
          shape: c.shape,
          series_a_label: c.series_a_label,
          series_a_category_id: '',
          series_a_indicator_id:
            c.series_a_indicator_id != null ? String(c.series_a_indicator_id) : '',
          series_b_label: c.series_b_label ?? '',
          series_b_category_id: '',
          series_b_indicator_id:
            c.series_b_indicator_id != null ? String(c.series_b_indicator_id) : '',
          is_active: c.is_active,
        })),
      )
    } catch (e: unknown) {
      setError(isApiError(e) ? e.message : e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const ensureCategoryIndicators = useCallback(async (categoryId: string) => {
    if (!categoryId || categoryLoadRef.current.has(categoryId)) return
    categoryLoadRef.current.add(categoryId)
    try {
      const inds = await fetchReportIndicators({ categoryId })
      setIndicatorsByCategory((prev) => ({ ...prev, [categoryId]: inds }))
    } catch {
      categoryLoadRef.current.delete(categoryId)
    }
  }, [])

  useEffect(() => {
    const needed = new Set<string>()
    for (const d of drafts) {
      if (d.series_a_category_id) needed.add(d.series_a_category_id)
      if (d.series_b_category_id) needed.add(d.series_b_category_id)
    }
    for (const id of needed) {
      void ensureCategoryIndicators(id)
    }
  }, [drafts, ensureCategoryIndicators])

  if (!user || !isSuperAdmin(user)) {
    return <Navigate to="/" replace />
  }

  function indicatorPoolForCategory(categoryId: string): ReportLookupIndicator[] {
    if (!categoryId) return indicators
    return indicatorsByCategory[categoryId] ?? []
  }

  function categorySelectValue(categoryId: string): string {
    return categoryId || 'all'
  }

  function onCategoryChange(series: 'a' | 'b', value: string): Partial<ChartDraft> {
    const categoryId = value === 'all' ? '' : value
    if (series === 'a') {
      return { series_a_category_id: categoryId, series_a_indicator_id: '' }
    }
    return { series_b_category_id: categoryId, series_b_indicator_id: '' }
  }

  function updateDraft(key: string, patch: Partial<ChartDraft>) {
    setDrafts((prev) => prev.map((d) => (d.clientKey === key ? { ...d, ...patch } : d)))
    setSuccess(null)
  }

  function moveDraft(index: number, dir: -1 | 1) {
    setDrafts((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setSuccess(null)
  }

  function handleAddGraph() {
    const key = newClientKey()
    setDrafts((prev) => [
      ...prev,
      {
        ...emptyDraft(),
        clientKey: key,
      },
    ])
    setSuccess(null)
    setError(null)
    window.requestAnimationFrame(() => {
      document.getElementById(`gov-chart-draft-${key}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }

  function renderGraphActionsBar(opts?: { addLabel?: string; style?: CSSProperties }) {
    const addLabel = opts?.addLabel ?? 'Add graph'
    return (
      <div
        className="report-generator__card governance-charts-admin__actions page-toolbar"
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          ...opts?.style,
        }}
      >
        <Button type="button" variant="secondary" disabled={busy || loading} onClick={handleAddGraph}>
          <Plus size={16} aria-hidden /> {addLabel}
        </Button>
        <Button type="button" disabled={busy || loading} onClick={() => void handleSave()}>
          {busy ? 'Saving…' : 'Save graphs'}
        </Button>
      </div>
    )
  }

  async function handleSave() {
    setError(null)
    setSuccess(null)
    for (const [i, d] of drafts.entries()) {
      if (!d.title.trim()) {
        setError(`Chart ${i + 1}: title is required.`)
        return
      }
      if (d.kind === 'comparison' && !d.series_b_label.trim()) {
        setError(`Chart ${i + 1}: comparison charts need a second series label.`)
        return
      }
    }
    setBusy(true)
    try {
      const saved = await adminSyncGovernanceDefaultCharts(toPayload(drafts))
      setDrafts(
        saved.map((c) => ({
          clientKey: `cfg-${c.id}`,
          kind: c.kind,
          title: c.title,
          shape: c.shape,
          series_a_label: c.series_a_label,
          series_a_category_id: '',
          series_a_indicator_id:
            c.series_a_indicator_id != null ? String(c.series_a_indicator_id) : '',
          series_b_label: c.series_b_label ?? '',
          series_b_category_id: '',
          series_b_indicator_id:
            c.series_b_indicator_id != null ? String(c.series_b_indicator_id) : '',
          is_active: c.is_active,
        })),
      )
      setSuccess(
        `Saved ${saved.length} default graph${saved.length === 1 ? '' : 's'} for the Governance Dashboard.`,
      )
    } catch (e: unknown) {
      setError(isApiError(e) ? e.message : e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageSection
      titleIcon={<BarChart2 size={26} color="var(--solid-blue)" aria-hidden />}
      title={LABEL_GOVERNANCE_DEFAULT_CHARTS}
      subtitle={`Configure the fixed default charts shown on ${LABEL_GOVERNANCE_DASHBOARD} before filters are applied. Filter-based visualization is unchanged.`}
    >
      {error ? <Alert variant="error">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      {loading ? (
        <p className="muted">Loading configuration…</p>
      ) : (
        <div className="governance-charts-admin__list">
          {renderGraphActionsBar({ style: { marginBottom: '1rem' } })}
          {drafts.map((draft, index) => {
            const shapes =
              draft.kind === 'comparison'
                ? COMPARISON_SHAPES
                : draft.kind === 'dimension_totals'
                  ? DIMENSION_TOTALS_SHAPES
                  : TREND_SHAPES
            return (
              <div
                key={draft.clientKey}
                id={`gov-chart-draft-${draft.clientKey}`}
                className="report-generator__card governance-charts-admin__card page-toolbar"
                style={{ marginBottom: '1rem' }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <span className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <GripVertical size={16} aria-hidden /> Graph {index + 1}
                  </span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button
                      type="button"
                      variant="secondary"
                      compact
                      disabled={index === 0 || busy}
                      onClick={() => moveDraft(index, -1)}
                    >
                      Up
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      compact
                      disabled={index === drafts.length - 1 || busy}
                      onClick={() => moveDraft(index, 1)}
                    >
                      Down
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      compact
                      disabled={busy}
                      onClick={() => {
                        setDrafts((prev) => prev.filter((d) => d.clientKey !== draft.clientKey))
                        setSuccess(null)
                      }}
                    >
                      <Trash2 size={14} aria-hidden /> Remove
                    </Button>
                  </div>
                </div>

                <FormGrid>
                  <FormRow twoCol>
                    <FormControl label="Title" htmlFor={`gdc-title-${draft.clientKey}`}>
                      <input
                        id={`gdc-title-${draft.clientKey}`}
                        value={draft.title}
                        onChange={(e) => updateDraft(draft.clientKey, { title: e.target.value })}
                        placeholder="Chart title shown on the dashboard"
                      />
                    </FormControl>
                    <FormControl label="Type" htmlFor={`gdc-kind-${draft.clientKey}`}>
                      <select
                        id={`gdc-kind-${draft.clientKey}`}
                        value={draft.kind}
                        onChange={(e) => {
                          const kind = e.target.value as ChartKind
                          const multiSeriesShape =
                            draft.shape === 'line' ||
                            draft.shape === 'bar' ||
                            draft.shape === 'composed'
                          updateDraft(draft.clientKey, {
                            kind,
                            shape:
                              kind === 'dimension_totals'
                                ? multiSeriesShape
                                  ? draft.shape
                                  : 'bar'
                                : kind === 'comparison'
                                  ? multiSeriesShape
                                    ? draft.shape
                                    : 'line'
                                  : draft.shape,
                            series_a_label:
                              kind === 'dimension_totals'
                                ? draft.series_a_label === 'Total' ||
                                  draft.series_a_label === 'Series A'
                                  ? 'Dimension totals'
                                  : draft.series_a_label
                                : kind === 'comparison' &&
                                    (draft.series_a_label === 'Total' ||
                                      draft.series_a_label === 'Dimension totals')
                                  ? 'Series A'
                                  : draft.series_a_label,
                            series_b_label:
                              kind === 'comparison' && !draft.series_b_label
                                ? 'Series B'
                                : draft.series_b_label,
                          })
                        }}
                      >
                        <option value="trend">Single indicator (gender / year total)</option>
                        <option value="comparison">Two indicators (comparison)</option>
                        <option value="dimension_totals">
                          Multi-dimension totals (years × dimensions)
                        </option>
                      </select>
                    </FormControl>
                  </FormRow>
                  <FormRow twoCol>
                    <FormControl label="Chart shape" htmlFor={`gdc-shape-${draft.clientKey}`}>
                      <select
                        id={`gdc-shape-${draft.clientKey}`}
                        value={draft.shape}
                        onChange={(e) =>
                          updateDraft(draft.clientKey, { shape: e.target.value as ChartShape })
                        }
                      >
                        {shapes.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormControl label="Visibility">
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={draft.is_active}
                          onChange={(e) =>
                            updateDraft(draft.clientKey, { is_active: e.target.checked })
                          }
                        />
                        Show on Governance Dashboard
                      </label>
                    </FormControl>
                  </FormRow>
                  {draft.kind === 'dimension_totals' ? (
                    <p className="muted" style={{ margin: '0 0 8px' }}>
                      Plots each disaggregation dimension’s year Total (Gender, Age, Disability,
                      District, Religion, Others) as separate series. Does not use gender-only total
                      like other graphs.
                    </p>
                  ) : null}
                  <FormRow twoCol>
                    <FormControl
                      label={
                        draft.kind === 'comparison'
                          ? 'Series A label'
                          : draft.kind === 'dimension_totals'
                            ? 'Legend title'
                            : 'Series label'
                      }
                      htmlFor={`gdc-a-label-${draft.clientKey}`}
                    >
                      <input
                        id={`gdc-a-label-${draft.clientKey}`}
                        value={draft.series_a_label}
                        onChange={(e) =>
                          updateDraft(draft.clientKey, { series_a_label: e.target.value })
                        }
                      />
                    </FormControl>
                    <FormControl
                      label={draft.kind === 'comparison' ? 'Series A category' : 'Category'}
                      htmlFor={`gdc-a-cat-${draft.clientKey}`}
                    >
                      <SearchableSelect
                        id={`gdc-a-cat-${draft.clientKey}`}
                        value={categorySelectValue(draft.series_a_category_id)}
                        onChange={(value) =>
                          updateDraft(draft.clientKey, onCategoryChange('a', value))
                        }
                        options={categoryOptions}
                        placeholder="All categories"
                      />
                    </FormControl>
                  </FormRow>
                  <FormRow>
                    <FormControl
                      label={
                        draft.kind === 'comparison'
                          ? 'Series A indicator'
                          : 'Indicator'
                      }
                      htmlFor={`gdc-a-ind-${draft.clientKey}`}
                    >
                      <SearchableSelect
                        id={`gdc-a-ind-${draft.clientKey}`}
                        value={draft.series_a_indicator_id}
                        onChange={(value) =>
                          updateDraft(draft.clientKey, { series_a_indicator_id: value })
                        }
                        options={buildIndicatorOptions(
                          indicatorPoolForCategory(draft.series_a_category_id),
                          draft.series_a_indicator_id,
                          indicators,
                        )}
                        placeholder={
                          draft.series_a_category_id &&
                          !indicatorsByCategory[draft.series_a_category_id]
                            ? 'Loading indicators…'
                            : 'Select indicator…'
                        }
                        emptyFilterMessage={
                          draft.series_a_category_id
                            ? 'No indicators in this category'
                            : 'No indicators'
                        }
                      />
                    </FormControl>
                  </FormRow>
                  {draft.kind === 'comparison' ? (
                    <>
                      <FormRow twoCol>
                        <FormControl
                          label="Series B label"
                          htmlFor={`gdc-b-label-${draft.clientKey}`}
                        >
                          <input
                            id={`gdc-b-label-${draft.clientKey}`}
                            value={draft.series_b_label}
                            onChange={(e) =>
                              updateDraft(draft.clientKey, { series_b_label: e.target.value })
                            }
                          />
                        </FormControl>
                        <FormControl
                          label="Series B category"
                          htmlFor={`gdc-b-cat-${draft.clientKey}`}
                        >
                          <SearchableSelect
                            id={`gdc-b-cat-${draft.clientKey}`}
                            value={categorySelectValue(draft.series_b_category_id)}
                            onChange={(value) =>
                              updateDraft(draft.clientKey, onCategoryChange('b', value))
                            }
                            options={categoryOptions}
                            placeholder="All categories"
                          />
                        </FormControl>
                      </FormRow>
                      <FormRow>
                        <FormControl
                          label="Series B indicator"
                          htmlFor={`gdc-b-ind-${draft.clientKey}`}
                        >
                          <SearchableSelect
                            id={`gdc-b-ind-${draft.clientKey}`}
                            value={draft.series_b_indicator_id}
                            onChange={(value) =>
                              updateDraft(draft.clientKey, { series_b_indicator_id: value })
                            }
                            options={buildIndicatorOptions(
                              indicatorPoolForCategory(draft.series_b_category_id),
                              draft.series_b_indicator_id,
                              indicators,
                            )}
                            placeholder={
                              draft.series_b_category_id &&
                              !indicatorsByCategory[draft.series_b_category_id]
                                ? 'Loading indicators…'
                                : 'Select indicator…'
                            }
                            emptyFilterMessage={
                              draft.series_b_category_id
                                ? 'No indicators in this category'
                                : 'No indicators'
                            }
                          />
                        </FormControl>
                      </FormRow>
                    </>
                  ) : null}
                </FormGrid>
              </div>
            )
          })}
        </div>
      )}
    </PageSection>
  )
}
