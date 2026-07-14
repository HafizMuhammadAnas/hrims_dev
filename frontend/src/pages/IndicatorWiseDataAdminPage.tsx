/**
 * Wireframe: Super Admin — Indicator-wise year totals → dimension distribution.
 * Matches Indicator Wise Flow.xlsx: year totals first, then Gender / Age / PWD / Religion
 * with Unaccounted = yearTotal − distributed (submit blocked when distributed > yearTotal).
 * Submissions are stored in localStorage for wireframe Create → View only.
 */
import { useEffect, useMemo, useState } from 'react'
import { Navigate, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ClipboardList, Eye, Plus, Trash2 } from 'lucide-react'
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
import { PageSection } from '../components/ui/PageSection'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { TableCard } from '../components/ui/TableCard'
import { isSuperAdmin } from '../lib/roles'
import { LABEL_INDICATOR_WISE_DATA } from '../lib/uiLabels'

const STORAGE_KEY = 'hrims_indicator_wise_wireframe_v1'

type DataView = 'list' | 'create' | 'view'

type DimensionId = 'gender' | 'age' | 'pwd' | 'religion'

type DimDef = {
  id: DimensionId
  title: string
  columns: { key: string; label: string }[]
}

const DIMENSIONS: DimDef[] = [
  {
    id: 'gender',
    title: 'Gender Disaggregate',
    columns: [
      { key: 'female', label: 'Female' },
      { key: 'male', label: 'Male' },
      { key: 'tg', label: 'TG' },
    ],
  },
  {
    id: 'age',
    title: 'Age Disaggregate',
    columns: [
      { key: 'under_18', label: 'Under 18' },
      { key: 'age_18_60', label: '18-60' },
      { key: 'above_60', label: '60+' },
    ],
  },
  {
    id: 'pwd',
    title: 'PWDs Disaggregated',
    columns: [
      { key: 'pwds', label: 'PWDs' },
      { key: 'not_pwds', label: 'Not PWDs' },
    ],
  },
  {
    id: 'religion',
    title: 'Religion Disaggregate',
    columns: [
      { key: 'muslim', label: 'Muslim' },
      { key: 'christian', label: 'Christian' },
      { key: 'hindu', label: 'Hindu' },
      { key: 'sikh', label: 'Sikh' },
      { key: 'ahmadis', label: 'Ahmadis' },
      { key: 'others', label: 'Others' },
    ],
  },
]

/** yearLabel → columnKey → value */
type DimCells = Record<string, Record<string, number | ''>>

type WireframeRecord = {
  id: string
  createdAt: string
  indicatorId: string
  indicatorText: string
  categoryId: string
  categoryName: string
  /** Year label → declared total (top bar) */
  yearTotals: Record<string, number>
  /** dimension → year → column → value */
  dimensions: Record<DimensionId, DimCells>
}

const TABS: { view: DataView; to: string; label: string; end?: boolean }[] = [
  { view: 'list', to: '/admin/indicator-wise-data', label: 'View list', end: true },
  { view: 'create', to: '/admin/indicator-wise-data/create', label: 'Create' },
]

function readStore(): WireframeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as WireframeRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeStore(rows: WireframeRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

function num(v: number | '' | undefined): number {
  if (v === '' || v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function sumColumns(cells: Record<string, number | ''> | undefined, keys: string[]): number {
  if (!cells) return 0
  return keys.reduce((s, k) => s + num(cells[k]), 0)
}

function unaccounted(yearTotal: number, distributed: number): number {
  return yearTotal - distributed
}

function emptyDimCells(years: string[], columns: { key: string }[]): DimCells {
  const out: DimCells = {}
  for (const y of years) {
    out[y] = {}
    for (const c of columns) out[y][c.key] = ''
  }
  return out
}

export function IndicatorWiseDataAdminPage() {
  const { user } = useAuth()
  const { recordId } = useParams<{ recordId?: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const path = location.pathname
  const view: DataView = path.includes('/create')
    ? 'create'
    : path.includes('/view/')
      ? 'view'
      : 'list'

  if (!user || !isSuperAdmin(user)) {
    return <Navigate to="/" replace />
  }

  return (
    <PageSection
      titleIcon={<ClipboardList size={26} color="var(--solid-blue)" aria-hidden />}
      title={LABEL_INDICATOR_WISE_DATA}
      subtitle="Wireframe: enter year totals for an indicator, then distribute by dimension. Remaining values appear in Unaccounted. Submit is blocked if any dimension exceeds the year total."
    >
      <nav className="issues-admin-tabs compiled-record-modal-tabs" aria-label="Indicator-wise data sections">
        {TABS.map((tab) => (
          <NavLink
            key={tab.view}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `compiled-record-modal-tab issues-admin-tab${isActive ? ' compiled-record-modal-tab--active' : ''}`
            }
          >
            {tab.label}
          </NavLink>
        ))}
        {view === 'view' ? (
          <span className="compiled-record-modal-tab issues-admin-tab compiled-record-modal-tab--active">
            View record
          </span>
        ) : null}
      </nav>

      {view === 'list' ? <ListSection /> : null}
      {view === 'create' ? (
        <CreateSection onSaved={(id) => navigate(`/admin/indicator-wise-data/view/${id}`)} />
      ) : null}
      {view === 'view' ? <ViewSection recordId={recordId} /> : null}
    </PageSection>
  )
}

function ListSection() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<WireframeRecord[]>(() => readStore())

  useEffect(() => {
    setRows(readStore())
  }, [])

  return (
    <TableCard padded>
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
        <h3 style={{ margin: 0 }}>Submitted indicator-wise records</h3>
        <Button type="button" onClick={() => navigate('/admin/indicator-wise-data/create')}>
          <Plus size={16} aria-hidden /> Create
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          No submissions yet. Use Create to add the first wireframe record.
        </p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Indicator</th>
                <th>Category</th>
                <th>Years</th>
                <th>Grand total</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const years = Object.keys(r.yearTotals)
                const grand = years.reduce((s, y) => s + num(r.yearTotals[y]), 0)
                return (
                  <tr key={r.id}>
                    <td>{r.indicatorText}</td>
                    <td>{r.categoryName || '—'}</td>
                    <td>{years.join(', ') || '—'}</td>
                    <td>{grand}</td>
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                    <td>
                      <NavLink to={`/admin/indicator-wise-data/view/${r.id}`} className="link-button">
                        <Eye size={14} aria-hidden /> View
                      </NavLink>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </TableCard>
  )
}

type IndicatorCardDraft = {
  clientKey: string
  categoryId: string
  indicatorId: string
  years: string[]
  yearTotals: Record<string, number | ''>
  dimensions: Record<DimensionId, DimCells>
}

function newClientKey(): string {
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const DEFAULT_WIREFRAME_YEARS = ['2024', '2025', '2026'] as const

function blankCard(years: string[] = [...DEFAULT_WIREFRAME_YEARS]): IndicatorCardDraft {
  const yearTotals: Record<string, number | ''> = {}
  for (const y of years) yearTotals[y] = ''
  const dimensions = {} as Record<DimensionId, DimCells>
  for (const d of DIMENSIONS) dimensions[d.id] = emptyDimCells(years, d.columns)
  return {
    clientKey: newClientKey(),
    categoryId: '',
    indicatorId: '',
    years,
    yearTotals,
    dimensions,
  }
}

/** Wireframe always uses three years so the card matches the spreadsheet layout. */
function yearsForIndicator(_ind: ReportLookupIndicator | null | undefined): string[] {
  return [...DEFAULT_WIREFRAME_YEARS]
}

function validateAll(
  years: string[],
  yearTotals: Record<string, number | ''>,
  dimData: Record<DimensionId, DimCells>,
  labelPrefix = '',
): { ok: boolean; message: string } {
  const prefix = labelPrefix ? `${labelPrefix}: ` : ''
  for (const dim of DIMENSIONS) {
    const keys = dim.columns.map((c) => c.key)
    for (const y of years) {
      const yt = num(yearTotals[y])
      const distributed = sumColumns(dimData[dim.id][y], keys)
      if (distributed > yt) {
        return {
          ok: false,
          message: `${prefix}${dim.title} for ${y}: distributed (${distributed}) exceeds year total (${yt}).`,
        }
      }
    }
  }
  return { ok: true, message: '' }
}

function CreateSection({ onSaved }: { onSaved: (id: string) => void }) {
  const [categories, setCategories] = useState<ReportLookupCategory[]>([])
  const [allIndicators, setAllIndicators] = useState<ReportLookupIndicator[]>([])
  const [cards, setCards] = useState<IndicatorCardDraft[]>(() => [blankCard()])
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [indicatorsByCategory, setIndicatorsByCategory] = useState<
    Record<string, ReportLookupIndicator[]>
  >({})

  useEffect(() => {
    void Promise.all([fetchReportIssueCategories(), fetchReportIndicators({})])
      .then(([cats, inds]) => {
        setCategories(cats)
        setAllIndicators(inds)
      })
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : 'Failed to load indicators')
      })
  }, [])

  const categoryOptions = useMemo(
    () => [
      { value: 'all', label: 'All categories' },
      ...categories.map((c) => ({ value: String(c.id), label: c.name })),
    ],
    [categories],
  )

  async function ensureCategoryIndicators(categoryId: string) {
    if (!categoryId || categoryId === 'all' || indicatorsByCategory[categoryId]) return
    try {
      const inds = await fetchReportIndicators({ categoryId })
      setIndicatorsByCategory((prev) => ({ ...prev, [categoryId]: inds }))
    } catch {
      /* ignore — fall back to allIndicators */
    }
  }

  function indicatorOptionsFor(categoryId: string) {
    const pool =
      categoryId && categoryId !== 'all'
        ? (indicatorsByCategory[categoryId] ?? allIndicators)
        : allIndicators
    const used = new Set(cards.map((c) => c.indicatorId).filter(Boolean))
    return pool
      .filter((i) => !used.has(String(i.id)) || true)
      .map((i) => ({ value: String(i.id), label: i.indicator_text }))
  }

  function updateCard(key: string, patch: Partial<IndicatorCardDraft>) {
    setCards((prev) => prev.map((c) => (c.clientKey === key ? { ...c, ...patch } : c)))
    setError(null)
  }

  function setCardIndicator(card: IndicatorCardDraft, indicatorId: string) {
    const ind = allIndicators.find((i) => String(i.id) === indicatorId) ?? null
    const years = yearsForIndicator(ind)
    const yearTotals: Record<string, number | ''> = {}
    for (const y of years) yearTotals[y] = ''
    const dimensions = {} as Record<DimensionId, DimCells>
    for (const d of DIMENSIONS) dimensions[d.id] = emptyDimCells(years, d.columns)
    updateCard(card.clientKey, { indicatorId, years, yearTotals, dimensions })
  }

  function setYearTotal(cardKey: string, year: string, value: string) {
    const v = value === '' ? '' : Number(value)
    setCards((prev) =>
      prev.map((c) => {
        if (c.clientKey !== cardKey) return c
        return {
          ...c,
          yearTotals: {
            ...c.yearTotals,
            [year]: v === '' || Number.isFinite(v) ? v : c.yearTotals[year],
          },
        }
      }),
    )
    setError(null)
  }

  function setDimCell(
    cardKey: string,
    dim: DimensionId,
    year: string,
    key: string,
    value: string,
  ) {
    const v = value === '' ? '' : Number(value)
    setCards((prev) =>
      prev.map((c) => {
        if (c.clientKey !== cardKey) return c
        return {
          ...c,
          dimensions: {
            ...c.dimensions,
            [dim]: {
              ...c.dimensions[dim],
              [year]: {
                ...(c.dimensions[dim][year] ?? {}),
                [key]:
                  v === '' || Number.isFinite(v) ? v : c.dimensions[dim][year]?.[key] ?? '',
              },
            },
          },
        }
      }),
    )
    setError(null)
  }

  const formValidation = useMemo(() => {
    for (const card of cards) {
      if (!card.indicatorId) continue
      const ind = allIndicators.find((i) => String(i.id) === card.indicatorId)
      const label = ind?.indicator_text?.slice(0, 48) ?? 'Indicator'
      const v = validateAll(card.years, card.yearTotals, card.dimensions, label)
      if (!v.ok) return v
    }
    return { ok: true, message: '' }
  }, [cards, allIndicators])

  function handleSubmit() {
    setError(null)
    const ready = cards.filter((c) => c.indicatorId)
    if (ready.length === 0) {
      setError('Add at least one indicator card and select an indicator.')
      return
    }
    for (const card of ready) {
      if (card.years.every((y) => num(card.yearTotals[y]) <= 0)) {
        setError('Each indicator needs at least one year total greater than zero.')
        return
      }
      const ind = allIndicators.find((i) => String(i.id) === card.indicatorId)
      const v = validateAll(
        card.years,
        card.yearTotals,
        card.dimensions,
        ind?.indicator_text?.slice(0, 48) ?? 'Indicator',
      )
      if (!v.ok) {
        setError(v.message)
        return
      }
    }

    const now = Date.now()
    const created: WireframeRecord[] = ready.map((card, index) => {
      const ind = allIndicators.find((i) => String(i.id) === card.indicatorId)!
      const catName =
        categories.find((c) => String(c.id) === card.categoryId)?.name ?? ''
      const normalizedYears: Record<string, number> = {}
      for (const y of card.years) normalizedYears[y] = num(card.yearTotals[y])
      const normalizedDims = {} as Record<DimensionId, DimCells>
      for (const d of DIMENSIONS) {
        normalizedDims[d.id] = {}
        for (const y of card.years) {
          normalizedDims[d.id][y] = {}
          for (const c of d.columns) {
            normalizedDims[d.id][y][c.key] = num(card.dimensions[d.id][y]?.[c.key])
          }
        }
      }
      return {
        id: `iwd-${now}-${index}`,
        createdAt: new Date(now).toISOString(),
        indicatorId: String(ind.id),
        indicatorText: ind.indicator_text,
        categoryId: card.categoryId === 'all' ? '' : card.categoryId,
        categoryName: catName,
        yearTotals: normalizedYears,
        dimensions: normalizedDims,
      }
    })

    writeStore([...created, ...readStore()])
    onSaved(created[0].id)
  }

  return (
    <div className="iwd-wireframe">
      {loadError ? <Alert variant="error">{loadError}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      {!formValidation.ok && !error ? (
        <Alert variant="warning">{formValidation.message}</Alert>
      ) : null}

      <p className="muted text-compact">
        Each indicator is one card (year totals on top, then Gender / Age / PWDs / Religion). Add
        more cards for additional indicators. Unaccounted = year total − distributed. Submit is
        blocked when any breakdown exceeds its year total.
      </p>

      <div className="iwd-wireframe__card-list">
        {cards.map((card, index) => {
          const ind = allIndicators.find((i) => String(i.id) === card.indicatorId) ?? null
          const options = indicatorOptionsFor(card.categoryId).map((opt) =>
            cards.some((c) => c.clientKey !== card.clientKey && c.indicatorId === opt.value)
              ? { ...opt, label: `${opt.label} (also selected)` }
              : opt,
          )
          return (
            <IndicatorSpreadsheetCard
              key={card.clientKey}
              index={index}
              card={card}
              indicator={ind}
              categoryOptions={categoryOptions}
              indicatorOptions={options}
              canRemove={cards.length > 1}
              readOnly={false}
              onRemove={() => {
                setCards((prev) => prev.filter((c) => c.clientKey !== card.clientKey))
                setError(null)
              }}
              onCategoryChange={(value) => {
                const categoryId = value === 'all' ? '' : value
                void ensureCategoryIndicators(categoryId)
                updateCard(card.clientKey, { categoryId, indicatorId: '' })
              }}
              onIndicatorChange={(value) => setCardIndicator(card, value)}
              onYearTotalChange={(year, value) => setYearTotal(card.clientKey, year, value)}
              onDimCellChange={(dim, year, key, value) =>
                setDimCell(card.clientKey, dim, year, key, value)
              }
            />
          )
        })}
      </div>

      <div className="iwd-wireframe__actions iwd-wireframe__actions--split">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setCards((prev) => [...prev, blankCard()])
            setError(null)
          }}
        >
          <Plus size={16} aria-hidden /> Add another indicator
        </Button>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button type="button" variant="secondary" onClick={() => window.history.back()}>
            Cancel
          </Button>
          <Button type="button" disabled={!formValidation.ok} onClick={handleSubmit}>
            Submit all
          </Button>
        </div>
      </div>
    </div>
  )
}

function IndicatorSpreadsheetCard({
  index,
  card,
  indicator,
  categoryOptions,
  indicatorOptions,
  canRemove,
  readOnly,
  metaLine,
  onRemove,
  onCategoryChange,
  onIndicatorChange,
  onYearTotalChange,
  onDimCellChange,
}: {
  index: number
  card: IndicatorCardDraft
  indicator: ReportLookupIndicator | null
  categoryOptions: { value: string; label: string }[]
  indicatorOptions: { value: string; label: string }[]
  canRemove?: boolean
  readOnly: boolean
  metaLine?: string
  onRemove?: () => void
  onCategoryChange?: (value: string) => void
  onIndicatorChange?: (value: string) => void
  onYearTotalChange?: (year: string, value: string) => void
  onDimCellChange?: (dim: DimensionId, year: string, key: string, value: string) => void
}) {
  const years = card.years
  const grand = years.reduce((s, y) => s + num(card.yearTotals[y]), 0)
  const title =
    indicator?.indicator_text ??
    (card.indicatorId ? `Indicator #${card.indicatorId}` : `Indicator card ${index + 1}`)

  return (
    <article className="iwd-card">
      <header className="iwd-card__toolbar">
        <strong className="iwd-card__toolbar-title">Indicator {index + 1}</strong>
        {metaLine ? <span className="muted text-compact">{metaLine}</span> : null}
        {!readOnly && canRemove ? (
          <Button type="button" variant="danger" compact onClick={onRemove}>
            <Trash2 size={14} aria-hidden /> Remove
          </Button>
        ) : null}
      </header>

      {!readOnly ? (
        <div className="iwd-card__pickers">
          <FormControl label="Category" htmlFor={`iwd-cat-${card.clientKey}`}>
            <SearchableSelect
              id={`iwd-cat-${card.clientKey}`}
              value={card.categoryId || 'all'}
              onChange={(v) => onCategoryChange?.(v)}
              options={categoryOptions}
              placeholder="All categories"
            />
          </FormControl>
          <FormControl label="Indicator" htmlFor={`iwd-ind-${card.clientKey}`}>
            <SearchableSelect
              id={`iwd-ind-${card.clientKey}`}
              value={card.indicatorId}
              onChange={(v) => onIndicatorChange?.(v)}
              options={indicatorOptions}
              placeholder="Select indicator…"
            />
          </FormControl>
        </div>
      ) : null}

      {readOnly || card.indicatorId ? (
        <div className="iwd-card__body">
          <div className="iwd-card__indicator-banner" title={title}>
            {title}
          </div>

          <section className="iwd-totals" aria-label="Year totals">
            <div className="iwd-totals__label">Year totals</div>
            <div className="iwd-totals__years">
              {years.map((y) => (
                <label key={y} className="iwd-totals__year">
                  <span className="iwd-totals__year-label">{y}</span>
                  {readOnly ? (
                    <span className="iwd-totals__value">{num(card.yearTotals[y])}</span>
                  ) : (
                    <input
                      className="iwd-sheet__input iwd-totals__input"
                      type="number"
                      min={0}
                      step={1}
                      value={card.yearTotals[y] ?? ''}
                      onChange={(e) => onYearTotalChange?.(y, e.target.value)}
                      aria-label={`${title} total ${y}`}
                    />
                  )}
                </label>
              ))}
              <div className="iwd-totals__year iwd-totals__year--grand">
                <span className="iwd-totals__year-label">Grand Total</span>
                <span className="iwd-totals__value">{grand}</span>
              </div>
            </div>
          </section>

          {DIMENSIONS.map((dim) => (
            <DimensionYearPanels
              key={dim.id}
              def={dim}
              years={years}
              yearTotals={card.yearTotals}
              cells={card.dimensions[dim.id]}
              readOnly={readOnly}
              onChange={
                readOnly
                  ? undefined
                  : (year, key, value) => onDimCellChange?.(dim.id, year, key, value)
              }
            />
          ))}
        </div>
      ) : (
        <p className="muted iwd-card__empty-hint">Select an indicator to open its data sheet.</p>
      )}
    </article>
  )
}

/** Dimension block with one compact panel per year (avoids ultra-wide tables). */
function DimensionYearPanels({
  def,
  years,
  yearTotals,
  cells,
  readOnly,
  onChange,
}: {
  def: DimDef
  years: string[]
  yearTotals: Record<string, number | ''>
  cells: DimCells
  readOnly: boolean
  onChange?: (year: string, key: string, value: string) => void
}) {
  const keys = def.columns.map((c) => c.key)

  return (
    <section className="iwd-dim">
      <h4 className="iwd-dim__title">{def.title}</h4>
      <div className="iwd-dim__years">
        {years.map((y) => {
          const yt = num(yearTotals[y])
          const distributed = sumColumns(cells[y], keys)
          const ua = unaccounted(yt, distributed)
          const over = ua < 0
          return (
            <div key={y} className="iwd-year-panel">
              <div className="iwd-year-panel__head">{y}</div>
              <table className="iwd-year-panel__table">
                <thead>
                  <tr>
                    {def.columns.map((c) => (
                      <th key={c.key}>{c.label}</th>
                    ))}
                    <th className="iwd-year-panel__ua-h">Unaccounted</th>
                    <th className="iwd-year-panel__total-h">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {def.columns.map((c) => (
                      <td key={c.key}>
                        {readOnly ? (
                          <span className="iwd-sheet__num">
                            {cells[y]?.[c.key] === '' || cells[y]?.[c.key] == null
                              ? ''
                              : num(cells[y]?.[c.key])}
                          </span>
                        ) : (
                          <input
                            className="iwd-sheet__input"
                            type="number"
                            min={0}
                            step={1}
                            value={cells[y]?.[c.key] ?? ''}
                            onChange={(e) => onChange?.(y, c.key, e.target.value)}
                            aria-label={`${def.title} ${c.label} ${y}`}
                          />
                        )}
                      </td>
                    ))}
                    <td className={`iwd-year-panel__ua${over ? ' is-over' : ''}`}>{ua}</td>
                    <td className="iwd-year-panel__total">{yt}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ViewSection({ recordId }: { recordId?: string }) {
  const record = useMemo(() => {
    if (!recordId) return null
    return readStore().find((r) => r.id === recordId) ?? null
  }, [recordId])

  if (!recordId || !record) {
    return (
      <Alert variant="warning">
        Record not found.{' '}
        <NavLink to="/admin/indicator-wise-data">Back to list</NavLink>
      </Alert>
    )
  }

  const card: IndicatorCardDraft = {
    clientKey: record.id,
    categoryId: record.categoryId,
    indicatorId: record.indicatorId,
    years: Object.keys(record.yearTotals),
    yearTotals: record.yearTotals,
    dimensions: record.dimensions,
  }

  return (
    <div className="iwd-wireframe">
      <div className="iwd-wireframe__actions" style={{ marginBottom: 12 }}>
        <NavLink to="/admin/indicator-wise-data" className="btn btn-secondary">
          Back to list
        </NavLink>
      </div>
      <IndicatorSpreadsheetCard
        index={0}
        card={card}
        indicator={{
          id: Number(record.indicatorId),
          issue_id: 0,
          indicator_text: record.indicatorText,
        }}
        categoryOptions={[]}
        indicatorOptions={[]}
        readOnly
        metaLine={`Submitted ${new Date(record.createdAt).toLocaleString()}${
          record.categoryName ? ` · ${record.categoryName}` : ''
        }`}
      />
    </div>
  )
}
