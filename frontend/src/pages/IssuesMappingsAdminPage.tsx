import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Navigate, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  adminCreateArticle,
  adminCreateIssue,
  adminCreateCollectionGender,
  adminCreateCollectionYear,
  adminCreateIssueCategory,
  adminFetchArticles,
  adminFetchCollectionGenders,
  adminFetchCollectionReligions,
  adminFetchCollectionYears,
  adminFetchConventions,
  adminFetchIssue,
  adminFetchIssueCategories,
  adminFetchIssues,
  adminDeleteIssue,
  adminSetArticleActive,
  adminSetCollectionGenderActive,
  adminSetCollectionReligionActive,
  adminSetCollectionYearActive,
  adminSetIssueActive,
  adminSetIssueCategoryActive,
  adminUpdateArticle,
  adminUpdateCollectionGender,
  adminUpdateCollectionReligion,
  adminUpdateCollectionYear,
  adminUpdateIssue,
  adminUpdateIssueCategory,
  adminReorderIssueIndicators,
  adminSetIssueIndicatorActive,
  type AdminArticleRow,
  type AdminCollectionGender,
  type AdminCollectionReligion,
  type AdminCollectionYear,
  type AdminConvention,
  type AdminIssue,
  type AdminIssueCategory,
  type AdminIssueIndicator,
} from '../api/admin'
import { isApiError } from '../api/apiError'
import { useAuth } from '../auth/AuthContext'
import { DragHandle } from '../components/ui/DragHandle'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { EmptyStateRow } from '../components/ui/EmptyStateRow'
import { FormControl } from '../components/ui/FormControl'
import { FormField } from '../components/ui/FormField'
import { FormGrid } from '../components/ui/FormGrid'
import { FormRow } from '../components/ui/FormRow'
import { PageSection } from '../components/ui/PageSection'
import { PaginationBar } from '../components/ui/PaginationBar'
import { RowActionsMenu } from '../components/ui/RowActionsMenu'
import { SortColumnHeader } from '../components/ui/SortColumnHeader'
import { TableCard } from '../components/ui/TableCard'
import { TableToolbar } from '../components/ui/TableToolbar'
import { WorkflowPageBack } from '../components/WorkflowPageBack'
import { workflowBackLabel } from '../lib/workflowNavigation'
import { reorderList } from '../lib/reorderList'
import { derivePaginatedRows, useClientTableState, type SortDirection } from '../hooks/useClientTableState'
import { compareNumberValues, compareStringValues, compareTimestampValues, pickActivityTimestamp } from '../lib/tableRowSort'
import { filterSelectableCollectionGenders } from '../lib/collectionGenderOptions'
import { sortCollectionYearsByLabelValue } from '../lib/collectionYearSort'
import {
  coerceIssueEntryKind,
  issueEntrySaveBlocked,
  issueEntryDescriptionFieldLabel,
  issueEntryDescriptionPlaceholder,
  issueEntryFormShowsTitleField,
  issueEntryIndicatorsLinkedLabel,
  issueEntryKindBadgeLabel,
  issueEntryKindToggleAriaLabel,
  issueEntryListShowsTitleColumn,
  issueEntryLoiTableCellText,
  issueEntryLoiTableTitleLabel,
  issueEntryPayloadFields,
  issueEntryTitleFieldLabel,
  issueEntryViewPageTitle,
  issuesAdminSectionsAriaLabel,
  issuesCreateTabLabel,
  issuesListTabLabel,
  noIndicatorsForLoiHint,
  type IssueEntryKind,
} from '../lib/issueEntryKind'
import { isSuperAdmin } from '../lib/roles'
import type { AuthUser } from '../types/auth'

const ISSUES_PAGE_SIZE = 10

type IssuesView = 'list' | 'create' | 'categories' | 'articles' | 'years' | 'genders' | 'religions'

const ISSUES_TABS: { view: IssuesView; to: string; label: string; end?: boolean }[] = [
  { view: 'list', to: '/admin/issues', label: issuesListTabLabel(), end: true },
  { view: 'create', to: '/admin/issues/create', label: issuesCreateTabLabel() },
  { view: 'categories', to: '/admin/issues/categories', label: 'Category' },
  { view: 'articles', to: '/admin/issues/articles', label: 'Article' },
  { view: 'years', to: '/admin/issues/years', label: 'Year' },
  { view: 'genders', to: '/admin/issues/genders', label: 'Gender' },
  { view: 'religions', to: '/admin/issues/religions', label: 'Religion' },
]

function resolveIssuesView(param: string | undefined): IssuesView | null {
  if (!param) return 'list'
  if (
    param === 'list' ||
    param === 'create' ||
    param === 'categories' ||
    param === 'articles' ||
    param === 'years' ||
    param === 'genders' ||
    param === 'religions'
  ) {
    return param
  }
  return null
}


export function IssuesMappingsAdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    issuesView: issuesViewParam,
    issueId: routeIssueIdParam,
    articleId: routeArticleIdParam,
  } = useParams<{
    issuesView?: string
    issueId?: string
    articleId?: string
  }>()
  const isIssueEditRoute = location.pathname.includes('/admin/issues/edit/')
  const isIssueViewRoute = location.pathname.includes('/admin/issues/view/')
  const isArticleViewRoute = location.pathname.includes('/admin/issues/articles/view/')
  const editIssueId =
    isIssueEditRoute && routeIssueIdParam && !Number.isNaN(Number(routeIssueIdParam))
      ? Number(routeIssueIdParam)
      : null
  const viewIssueId =
    isIssueViewRoute && routeIssueIdParam && !Number.isNaN(Number(routeIssueIdParam))
      ? Number(routeIssueIdParam)
      : null
  const viewArticleId =
    isArticleViewRoute && routeArticleIdParam && !Number.isNaN(Number(routeArticleIdParam))
      ? Number(routeArticleIdParam)
      : null
  const view =
    isIssueEditRoute || isIssueViewRoute || isArticleViewRoute ? null : resolveIssuesView(issuesViewParam)

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [issues, setIssues] = useState<AdminIssue[]>([])
  const [conventions, setConventions] = useState<AdminConvention[]>([])
  const [categories, setCategories] = useState<AdminIssueCategory[]>([])
  const [articles, setArticles] = useState<AdminArticleRow[]>([])
  const [collectionYears, setCollectionYears] = useState<AdminCollectionYear[]>([])
  const [collectionGenders, setCollectionGenders] = useState<AdminCollectionGender[]>([])
  const [collectionReligions, setCollectionReligions] = useState<AdminCollectionReligion[]>([])
  const refreshLookups = useCallback(async () => {
    const [conv, cat, art, years, genders, religions] = await Promise.all([
      adminFetchConventions(),
      adminFetchIssueCategories(),
      adminFetchArticles(),
      adminFetchCollectionYears(),
      adminFetchCollectionGenders(),
      adminFetchCollectionReligions(),
    ])
    setConventions(conv)
    setCategories(cat)
    setArticles(art)
    setCollectionYears(years)
    setCollectionGenders(genders)
    setCollectionReligions(religions)
  }, [])

  const refreshIssues = useCallback(async () => {
    setIssues(await adminFetchIssues())
  }, [])

  const refreshAll = useCallback(async () => {
    setError(null)
    try {
      await Promise.all([refreshIssues(), refreshLookups()])
    } catch (e: unknown) {
      setError(isApiError(e) ? e.message : e instanceof Error ? e.message : 'Load failed')
    }
  }, [refreshIssues, refreshLookups])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  const activeCategories = useMemo(() => categories.filter(catalogIsActive), [categories])
  const activeArticles = useMemo(() => articles.filter(catalogIsActive), [articles])
  const activeCollectionYears = useMemo(
    () => sortCollectionYearsByLabelValue(collectionYears.filter(catalogIsActive)),
    [collectionYears],
  )
  const activeCollectionGenders = useMemo(() => collectionGenders.filter(catalogIsActive), [collectionGenders])

  if (!user || !isSuperAdmin(user)) {
    return <Navigate to="/" replace />
  }

  if (!view && !editIssueId && viewIssueId == null && viewArticleId == null) {
    return <Navigate to="/admin/issues" replace />
  }

  if (viewIssueId != null) {
    return (
      <IssuesIssueViewPage
        issueId={viewIssueId}
        user={user}
        issues={issues}
        error={error}
        setError={setError}
        onRefreshIssues={refreshIssues}
      />
    )
  }

  if (viewArticleId != null) {
    return (
      <IssuesArticleViewPage
        articleId={viewArticleId}
        articles={articles}
        conventions={conventions}
        user={user}
        error={error}
        setError={setError}
      />
    )
  }

  if (editIssueId != null) {
    return (
      <IssuesIssueEditPage
        issueId={editIssueId}
        user={user}
        conventions={conventions}
        categories={activeCategories}
        articles={activeArticles}
        collectionYears={activeCollectionYears}
        collectionGenders={activeCollectionGenders}
        busy={busy}
        setBusy={setBusy}
        error={error}
        setError={setError}
        onDone={async () => {
          await refreshIssues()
        }}
      />
    )
  }

  return (
    <div className="page-shell">
      {error && (
        <Alert variant="error" title="Error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <nav className="issues-admin-tabs compiled-record-modal-tabs" aria-label={issuesAdminSectionsAriaLabel()}>
        {ISSUES_TABS.map((tab) => (
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
      </nav>

      {view === 'list' && (
        <IssuesListSection issues={issues} setError={setError} onRefreshIssues={refreshIssues} />
      )}

      {view === 'create' && (
        <TableCard padded>
          <IssuesCreateForm
            conventions={conventions}
            categories={activeCategories}
            articles={activeArticles}
            collectionYears={activeCollectionYears}
            collectionGenders={activeCollectionGenders}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onDone={async () => {
              await refreshIssues()
              navigate('/admin/issues')
            }}
            onCancel={() => navigate('/admin/issues')}
          />
        </TableCard>
      )}

      {view === 'categories' && (
        <IssuesCategoriesSection
          categories={categories}
          conventions={conventions}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onRefresh={refreshLookups}
        />
      )}

      {view === 'articles' && (
        <IssuesArticlesSection
          articles={articles}
          conventions={conventions}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onRefresh={refreshLookups}
        />
      )}

      {view === 'years' && (
        <IssuesCollectionYearsSection
          years={collectionYears}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onRefresh={refreshLookups}
        />
      )}

      {view === 'genders' && (
        <IssuesCollectionGendersSection
          genders={collectionGenders}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onRefresh={refreshLookups}
        />
      )}

      {view === 'religions' && (
        <IssuesCollectionReligionsSection
          religions={collectionReligions}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onRefresh={refreshLookups}
        />
      )}
    </div>
  )
}

function issueIsActive(issue: AdminIssue): boolean {
  return issue.is_active !== false
}

async function toggleIssueActive(
  issue: AdminIssue,
  onRefreshIssues: () => Promise<void>,
  setError: (s: string | null) => void,
): Promise<void> {
  const active = issueIsActive(issue)
  const next = !active
  const kind = coerceIssueEntryKind(issue.entry_kind)
  const label = issueEntryKindBadgeLabel(kind)
  if (!window.confirm(`${next ? 'Activate' : 'Deactivate'} this ${label}?`)) return
  try {
    await adminSetIssueActive(issue.id, next)
    await onRefreshIssues()
  } catch (e: unknown) {
    setError(isApiError(e) ? e.message : `${next ? 'Activate' : 'Deactivate'} failed`)
  }
}

async function deleteIssueEntry(
  issue: AdminIssue,
  onRefreshIssues: () => Promise<void>,
  setError: (s: string | null) => void,
): Promise<void> {
  const kind = coerceIssueEntryKind(issue.entry_kind)
  const label = issueEntryKindBadgeLabel(kind)
  if (!window.confirm(`Permanently delete this ${label}? This cannot be undone.`)) return
  try {
    await adminDeleteIssue(issue.id)
    await onRefreshIssues()
  } catch (e: unknown) {
    setError(isApiError(e) ? e.message : 'Delete failed')
  }
}

function issueStatusLabel(issue: AdminIssue): string {
  return issueIsActive(issue) ? 'Active' : 'Inactive'
}

type CatalogRow = { is_active?: boolean }

function catalogIsActive(row: CatalogRow): boolean {
  return row.is_active !== false
}

function catalogStatusLabel(row: CatalogRow): string {
  return catalogIsActive(row) ? 'Active' : 'Inactive'
}

type CatalogIdNameSortKey = 'updated_at' | 'id' | 'name' | 'status'
type ArticleCatalogSortKey = 'updated_at' | 'id' | 'convention' | 'article_name' | 'status'
type CategoryCatalogSortKey = 'updated_at' | 'id' | 'convention' | 'name' | 'status'
type YearCatalogSortKey = 'updated_at' | 'id' | 'label' | 'status'
type IssuesListSortKey = 'updated_at' | 'id' | 'convention' | 'articles' | 'category' | 'issue_title' | 'status'

function sortCatalogIdNameRows<
  T extends { id: number; name: string; created_at?: string | null; updated_at?: string | null } & CatalogRow,
>(
  rows: T[],
  sortKey: CatalogIdNameSortKey | undefined,
  sortDir: SortDirection,
): T[] {
  const key = sortKey ?? 'updated_at'
  return [...rows].sort((a, b) => {
    switch (key) {
      case 'updated_at':
        return compareTimestampValues(
          pickActivityTimestamp(a.updated_at, a.created_at, a.id),
          pickActivityTimestamp(b.updated_at, b.created_at, b.id),
          sortDir,
        )
      case 'id':
        return compareNumberValues(a.id, b.id, sortDir)
      case 'name':
        return compareStringValues(a.name, b.name, sortDir)
      case 'status':
        return compareStringValues(catalogStatusLabel(a), catalogStatusLabel(b), sortDir)
      default:
        return compareTimestampValues(
          pickActivityTimestamp(a.updated_at, a.created_at, a.id),
          pickActivityTimestamp(b.updated_at, b.created_at, b.id),
          'desc',
        )
    }
  })
}

function sortYearCatalogRows(
  rows: AdminCollectionYear[],
  sortKey: YearCatalogSortKey | undefined,
  sortDir: SortDirection,
): AdminCollectionYear[] {
  const key = sortKey ?? 'updated_at'
  return [...rows].sort((a, b) => {
    switch (key) {
      case 'updated_at':
        return compareTimestampValues(
          pickActivityTimestamp(a.updated_at, a.created_at, a.id),
          pickActivityTimestamp(b.updated_at, b.created_at, b.id),
          sortDir,
        )
      case 'id':
        return compareNumberValues(a.id, b.id, sortDir)
      case 'label':
        return compareStringValues(a.label, b.label, sortDir)
      case 'status':
        return compareStringValues(catalogStatusLabel(a), catalogStatusLabel(b), sortDir)
      default:
        return compareTimestampValues(
          pickActivityTimestamp(a.updated_at, a.created_at, a.id),
          pickActivityTimestamp(b.updated_at, b.created_at, b.id),
          'desc',
        )
    }
  })
}

function issueArticlesLabel(issue: AdminIssue): string {
  return issue.articles.map((a) => a.article_name).join(', ') || 'None'
}

function sortIssueListRows(
  rows: AdminIssue[],
  sortKey: IssuesListSortKey | undefined,
  sortDir: SortDirection,
): AdminIssue[] {
  const key = sortKey ?? 'updated_at'
  return [...rows].sort((a, b) => {
    switch (key) {
      case 'updated_at':
        return compareTimestampValues(
          pickActivityTimestamp(a.updated_at, a.created_at, a.id),
          pickActivityTimestamp(b.updated_at, b.created_at, b.id),
          sortDir,
        )
      case 'id':
        return compareNumberValues(a.id, b.id, sortDir)
      case 'convention':
        return compareStringValues(issueConventionLabel(a), issueConventionLabel(b), sortDir)
      case 'articles':
        return compareStringValues(issueArticlesLabel(a), issueArticlesLabel(b), sortDir)
      case 'category':
        return compareStringValues(
          a.category?.name ?? String(a.category_id),
          b.category?.name ?? String(b.category_id),
          sortDir,
        )
      case 'issue_title':
        return compareStringValues(issueEntryLoiTableCellText(a), issueEntryLoiTableCellText(b), sortDir)
      case 'status':
        return compareStringValues(issueStatusLabel(a), issueStatusLabel(b), sortDir)
      default:
        return compareTimestampValues(
          pickActivityTimestamp(a.updated_at, a.created_at, a.id),
          pickActivityTimestamp(b.updated_at, b.created_at, b.id),
          'desc',
        )
    }
  })
}

async function toggleCatalogActive(
  itemLabel: string,
  row: CatalogRow,
  setActive: (is_active: boolean) => Promise<unknown>,
  onRefresh: () => Promise<void>,
  setError: (s: string | null) => void,
  setBusy: (v: boolean) => void,
): Promise<void> {
  const active = catalogIsActive(row)
  const next = !active
  if (!window.confirm(`${next ? 'Activate' : 'Deactivate'} ${itemLabel}?`)) return
  setBusy(true)
  setError(null)
  try {
    await setActive(next)
    await onRefresh()
  } catch (e: unknown) {
    setError(isApiError(e) ? e.message : `${next ? 'Activate' : 'Deactivate'} failed`)
  } finally {
    setBusy(false)
  }
}

function IssuesListSection({
  issues,
  setError,
  onRefreshIssues,
}: {
  issues: AdminIssue[]
  setError: (s: string | null) => void
  onRefreshIssues: () => Promise<void>
}) {
  const navigate = useNavigate()
  const { search, setSearch, page, setPage, pageSize, sortKey, sortDir, toggleSort } =
    useClientTableState<IssuesListSortKey>({
      pageSize: ISSUES_PAGE_SIZE,
      initialSortKey: 'updated_at',
      initialSortDir: 'desc',
    })
  const [listEntryKind, setListEntryKind] = useState<IssueEntryKind>('issue')

  const kindFilteredIssues = useMemo(
    () => issues.filter((i) => coerceIssueEntryKind(i.entry_kind) === listEntryKind),
    [issues, listEntryKind],
  )

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = !q
      ? kindFilteredIssues
      : kindFilteredIssues.filter((i) => {
          const convCode = (i.convention?.code ?? '').toLowerCase()
          const convName = (i.convention?.name ?? '').toLowerCase()
          const arts = i.articles.map((a) => a.article_name).join(' ').toLowerCase()
          const cat = (i.category?.name ?? String(i.category_id)).toLowerCase()
          return (
            String(i.id).includes(q) ||
            (i.issue_title ?? '').toLowerCase().includes(q) ||
            (i.description ?? '').toLowerCase().includes(q) ||
            convCode.includes(q) ||
            convName.includes(q) ||
            arts.includes(q) ||
            cat.includes(q)
          )
        })
    return sortIssueListRows(filtered, sortKey, sortDir)
  }, [kindFilteredIssues, search, sortKey, sortDir])

  const { pageRows } = derivePaginatedRows(processed, page, pageSize)
  const showLoiTitleColumn = issueEntryListShowsTitleColumn(listEntryKind)
  const tableColSpan = showLoiTitleColumn ? 6 : 5

  const emptyListMessage =
    search.trim()
      ? 'No entries match your search.'
      : `No ${issueEntryKindBadgeLabel(listEntryKind)} yet. Use ${issuesCreateTabLabel()} to add one.`

  return (
    <>

      <TableToolbar className="issues-list-toolbar">
        <IssueEntryKindToggle
          value={listEntryKind}
          onChange={(next) => {
            setListEntryKind(next)
            setPage(1)
          }}
        />
        <input
          type="search"
          placeholder="Search ID, issue, convention, category, articles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search issues"
        />
        <Button variant="secondary" compact onClick={() => setSearch('')}>
          Reset search
        </Button>
      </TableToolbar>

      <TableCard className="issues-mapping-list-card">
          <table className="data-table issues-mapping-table">
            <thead>
              <tr>
                <SortColumnHeader
                  label="Convention"
                  active={sortKey === 'convention'}
                  direction={sortDir}
                  onSort={() => toggleSort('convention')}
                />
                <SortColumnHeader
                  label="Articles"
                  active={sortKey === 'articles'}
                  direction={sortDir}
                  onSort={() => toggleSort('articles')}
                />
                <SortColumnHeader
                  label="Category"
                  active={sortKey === 'category'}
                  direction={sortDir}
                  onSort={() => toggleSort('category')}
                />
                {showLoiTitleColumn ? (
                  <SortColumnHeader
                    label={issueEntryLoiTableTitleLabel()}
                    active={sortKey === 'issue_title'}
                    direction={sortDir}
                    onSort={() => toggleSort('issue_title')}
                  />
                ) : null}
                <SortColumnHeader
                  label="Status"
                  active={sortKey === 'status'}
                  direction={sortDir}
                  onSort={() => toggleSort('status')}
                />
                <th className="issues-mapping-table__actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <EmptyStateRow colSpan={tableColSpan} message={emptyListMessage} />
              ) : (
                pageRows.map((i) => {
                  const entryKind = coerceIssueEntryKind(i.entry_kind ?? 'issue')
                  return (
                  <tr
                    key={i.id}
                    className={`issues-mapping-table__row issues-mapping-table__row--${entryKind}${
                      issueIsActive(i) ? '' : ' issues-mapping-table__row--inactive'
                    }`}
                  >
                    <td className="text-compact issues-mapping-table__convention">{issueConventionLabel(i)}</td>
                    <td className="text-compact issues-mapping-table__articles">
                      {i.articles.map((a) => a.article_name).join(', ') || 'None'}
                    </td>
                    <td className="issues-mapping-table__category">{i.category?.name ?? i.category_id}</td>
                    {showLoiTitleColumn ? (
                      <td
                        className="issues-mapping-table__issue"
                        aria-label={`${issueEntryKindBadgeLabel(entryKind)}: ${issueEntryLoiTableCellText(i)}`}
                      >
                        {issueEntryLoiTableCellText(i)}
                      </td>
                    ) : null}
                    <td className="issues-mapping-table__status">{issueStatusLabel(i)}</td>
                    <td className="issues-mapping-table__actions">
                      <ActionMenu>
                        <Button
                          variant="link"
                          compact
                          onClick={() => navigate(`/admin/issues/view/${i.id}`)}
                        >
                          View
                        </Button>
                        <Button
                          variant="link"
                          compact
                          onClick={() => navigate(`/admin/issues/edit/${i.id}`)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="link"
                          dangerLink={issueIsActive(i)}
                          onClick={() => {
                            void toggleIssueActive(i, onRefreshIssues, setError)
                          }}
                        >
                          {issueIsActive(i) ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          variant="link"
                          dangerLink
                          onClick={() => {
                            void deleteIssueEntry(i, onRefreshIssues, setError)
                          }}
                        >
                          Delete
                        </Button>
                      </ActionMenu>
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={processed.length} onPageChange={setPage} />
    </>
  )
}


function IssuesCategoriesSection({
  categories,
  conventions,
  busy,
  setBusy,
  setError,
  onRefresh,
}: {
  categories: AdminIssueCategory[]
  conventions: AdminConvention[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onRefresh: () => Promise<void>
}) {
  const sortedConventions = useMemo(
    () => [...conventions].sort((a, b) => a.code.localeCompare(b.code)),
    [conventions],
  )
  const [newCategoryConventionId, setNewCategoryConventionId] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [listConventionFilter, setListConventionFilter] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [editCategoryConventionId, setEditCategoryConventionId] = useState('')
  const [editCategoryName, setEditCategoryName] = useState('')
  const { search, setSearch, page, setPage, pageSize, sortKey, sortDir, toggleSort } =
    useClientTableState<CategoryCatalogSortKey>({
      pageSize: ISSUES_PAGE_SIZE,
      initialSortKey: 'updated_at',
      initialSortDir: 'desc',
    })

  const conventionFilteredCategories = useMemo(() => {
    if (!listConventionFilter) return categories
    return categories.filter((c) => String(c.convention_id) === listConventionFilter)
  }, [categories, listConventionFilter])

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = !q
      ? conventionFilteredCategories
      : conventionFilteredCategories.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            categoryConventionLabel(c, conventions).toLowerCase().includes(q) ||
            String(c.id).includes(q),
        )
    return sortCategoryCatalogRows(filtered, conventions, sortKey, sortDir)
  }, [conventionFilteredCategories, search, conventions, sortKey, sortDir])

  const { pageRows } = derivePaginatedRows(processed, page, pageSize)

  return (
    <div className="issues-catalog-page">
      <div style={{ marginBottom: 16 }}>
        <TableCard padded>
          <div className="issues-catalog-add-form">
            <FormField label="Convention">
              <select
                value={newCategoryConventionId}
                onChange={(e) => setNewCategoryConventionId(e.target.value)}
                disabled={busy}
                style={{ width: '100%', boxSizing: 'border-box' }}
              >
                <option value="">Select convention</option>
                {sortedConventions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {conventionSelectLabel(c)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Category name">
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g. Thematic"
                disabled={busy || !newCategoryConventionId}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </FormField>
            <div className="issues-catalog-add-form__actions">
              <Button
                variant="primary"
                compact
                disabled={busy || !newCategory.trim() || !newCategoryConventionId}
                onClick={() => {
                  void (async () => {
                    setBusy(true)
                    setError(null)
                    try {
                      await adminCreateIssueCategory({
                        convention_id: Number(newCategoryConventionId),
                        name: newCategory.trim(),
                      })
                      setNewCategory('')
                      await onRefresh()
                    } catch (e: unknown) {
                      setError(isApiError(e) ? e.message : 'Save failed')
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              >
                Add category
              </Button>
            </div>
          </div>
        </TableCard>
      </div>

      <TableToolbar className="issues-list-toolbar">
        <select
          value={listConventionFilter}
          onChange={(e) => {
            setListConventionFilter(e.target.value)
            setPage(1)
          }}
          aria-label="Filter categories by convention"
          disabled={busy}
        >
          <option value="">All conventions</option>
          {sortedConventions.map((c) => (
            <option key={c.id} value={c.id}>
              {conventionSelectLabel(c)}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Search ID, convention, or category name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search categories"
        />
        <Button variant="secondary" compact onClick={() => setSearch('')}>
          Reset search
        </Button>
      </TableToolbar>

      <TableCard className="issues-catalog-list-card">
        <table className="data-table issues-catalog-table">
          <IssuesCatalogTableColgroup variant="articles" />
          <thead>
            <tr>
              <SortColumnHeader
                label="ID"
                active={sortKey === 'id'}
                direction={sortDir}
                onSort={() => toggleSort('id')}
              />
              <SortColumnHeader
                label="Convention"
                active={sortKey === 'convention'}
                direction={sortDir}
                onSort={() => toggleSort('convention')}
              />
              <SortColumnHeader
                label="Name"
                active={sortKey === 'name'}
                direction={sortDir}
                onSort={() => toggleSort('name')}
              />
              <SortColumnHeader
                label="Status"
                active={sortKey === 'status'}
                direction={sortDir}
                onSort={() => toggleSort('status')}
              />
              <th className="table-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <EmptyStateRow
                colSpan={5}
                message={
                  search.trim() || listConventionFilter
                    ? 'No categories match your search.'
                    : 'No categories yet.'
                }
              />
            ) : (
              pageRows.map((c) => {
                if (editingCategoryId === c.id) {
                  return (
                    <tr key={c.id} className="catalog-table-edit-row">
                      <td colSpan={5}>
                        <div className="catalog-inline-edit">
                          <p className="catalog-inline-edit__meta muted small">ID {c.id}</p>
                          <FormField label="Convention">
                            <select
                              className="catalog-inline-edit-input"
                              value={editCategoryConventionId}
                              onChange={(e) => setEditCategoryConventionId(e.target.value)}
                              disabled={busy}
                            >
                              <option value="">Select convention</option>
                              {sortedConventions.map((conv) => (
                                <option key={conv.id} value={conv.id}>
                                  {conventionSelectLabel(conv)}
                                </option>
                              ))}
                            </select>
                          </FormField>
                          <FormField label="Category name">
                            <input
                              className="catalog-inline-edit-input"
                              value={editCategoryName}
                              onChange={(e) => setEditCategoryName(e.target.value)}
                              aria-label="Category name"
                            />
                          </FormField>
                          <CatalogInlineEditActions
                            busy={busy}
                            saveDisabled={!editCategoryName.trim() || !editCategoryConventionId}
                            onCancel={() => setEditingCategoryId(null)}
                            onSave={() => {
                              void (async () => {
                                setBusy(true)
                                setError(null)
                                try {
                                  await adminUpdateIssueCategory(c.id, {
                                    convention_id: Number(editCategoryConventionId),
                                    name: editCategoryName.trim(),
                                  })
                                  setEditingCategoryId(null)
                                  await onRefresh()
                                } catch (e: unknown) {
                                  setError(isApiError(e) ? e.message : 'Update failed')
                                } finally {
                                  setBusy(false)
                                }
                              })()
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                }
                return (
                  <tr
                    key={c.id}
                    className={
                      catalogIsActive(c) ? undefined : 'issues-mapping-table__row--inactive'
                    }
                  >
                    <td>{c.id}</td>
                    <td>{categoryConventionLabel(c, conventions)}</td>
                    <td>{c.name}</td>
                    <td>{catalogStatusLabel(c)}</td>
                    <td className="table-actions">
                      <ActionMenu>
                        <Button
                          variant="link"
                          compact
                          disabled={busy}
                          onClick={() => {
                            setEditingCategoryId(c.id)
                            setEditCategoryConventionId(String(c.convention_id ?? ''))
                            setEditCategoryName(c.name)
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="link"
                          compact
                          dangerLink={catalogIsActive(c)}
                          disabled={busy}
                          onClick={() => {
                            void toggleCatalogActive(
                              `category "${c.name}"`,
                              c,
                              (is_active) => adminSetIssueCategoryActive(c.id, is_active),
                              onRefresh,
                              setError,
                              setBusy,
                            )
                          }}
                        >
                          {catalogIsActive(c) ? 'Deactivate' : 'Activate'}
                        </Button>
                      </ActionMenu>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={processed.length} onPageChange={setPage} />
    </div>
  )
}


function IssuesArticlesSection({
  articles,
  conventions,
  busy,
  setBusy,
  setError,
  onRefresh,
}: {
  articles: AdminArticleRow[]
  conventions: AdminConvention[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onRefresh: () => Promise<void>
}) {
  const navigate = useNavigate()
  const sortedConventions = useMemo(
    () => [...conventions].sort((a, b) => a.code.localeCompare(b.code)),
    [conventions],
  )
  const [newArticleConventionId, setNewArticleConventionId] = useState('')
  const [newArticle, setNewArticle] = useState('')
  const [newArticleDescription, setNewArticleDescription] = useState('')
  const [listConventionFilter, setListConventionFilter] = useState('')
  const [editingArticleId, setEditingArticleId] = useState<number | null>(null)
  const [editArticleConventionId, setEditArticleConventionId] = useState('')
  const [editArticleName, setEditArticleName] = useState('')
  const [editArticleDescription, setEditArticleDescription] = useState('')
  const { search, setSearch, page, setPage, pageSize, sortKey, sortDir, toggleSort } =
    useClientTableState<ArticleCatalogSortKey>({
      pageSize: ISSUES_PAGE_SIZE,
      initialSortKey: 'updated_at',
      initialSortDir: 'desc',
    })

  const conventionFilteredArticles = useMemo(() => {
    if (!listConventionFilter) return articles
    return articles.filter((a) => String(a.convention_id) === listConventionFilter)
  }, [articles, listConventionFilter])

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = !q
      ? conventionFilteredArticles
      : conventionFilteredArticles.filter(
          (a) =>
            a.article_name.toLowerCase().includes(q) ||
            (a.description ?? '').toLowerCase().includes(q) ||
            articleConventionLabel(a, conventions).toLowerCase().includes(q) ||
            String(a.id).includes(q),
        )
    return sortArticleCatalogRows(filtered, conventions, sortKey, sortDir)
  }, [conventionFilteredArticles, search, conventions, sortKey, sortDir])

  const { pageRows } = derivePaginatedRows(processed, page, pageSize)

  return (
    <div className="issues-catalog-page">
      <div style={{ marginBottom: 16 }}>
      <TableCard padded>
        <div className="issues-catalog-add-form">
          <FormField label="Convention">
            <select
              value={newArticleConventionId}
              onChange={(e) => setNewArticleConventionId(e.target.value)}
              disabled={busy}
              style={{ width: '100%', boxSizing: 'border-box' }}
            >
              <option value="">Select convention</option>
              {sortedConventions.map((c) => (
                <option key={c.id} value={c.id}>
                  {conventionSelectLabel(c)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Article name">
            <input
              value={newArticle}
              onChange={(e) => setNewArticle(e.target.value)}
              placeholder='e.g. "Article 16"'
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </FormField>
          <FormField label="Description">
            <textarea
              className="issues-description-field"
              rows={5}
              value={newArticleDescription}
              onChange={(e) => setNewArticleDescription(e.target.value)}
              placeholder="Optional description shown on federal and other portalsâ€¦"
              disabled={busy}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </FormField>
          <div className="issues-catalog-add-form__actions">
            <Button
              variant="primary"
              compact
              disabled={busy || !newArticle.trim() || !newArticleConventionId}
              onClick={() => {
                void (async () => {
                  setBusy(true)
                  setError(null)
                  try {
                    await adminCreateArticle({
                      convention_id: Number(newArticleConventionId),
                      article_name: newArticle.trim(),
                      description: newArticleDescription.trim() || null,
                    })
                    setNewArticle('')
                    setNewArticleDescription('')
                    await onRefresh()
                  } catch (e: unknown) {
                    setError(isApiError(e) ? e.message : 'Save failed')
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
            >
              Add article
            </Button>
          </div>
        </div>
      </TableCard>
      </div>

      <TableToolbar className="issues-list-toolbar">
        <select
          value={listConventionFilter}
          onChange={(e) => {
            setListConventionFilter(e.target.value)
            setPage(1)
          }}
          aria-label="Filter articles by convention"
          disabled={busy}
        >
          <option value="">All conventions</option>
          {sortedConventions.map((c) => (
            <option key={c.id} value={c.id}>
              {conventionSelectLabel(c)}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Search ID, convention, name, or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search articles"
        />
        <Button variant="secondary" compact onClick={() => setSearch('')}>
          Reset search
        </Button>
      </TableToolbar>

      <TableCard className="issues-catalog-list-card">
        <table className="data-table issues-catalog-table">
          <IssuesCatalogTableColgroup variant="articles" />
          <thead>
            <tr>
              <SortColumnHeader
                label="ID"
                active={sortKey === 'id'}
                direction={sortDir}
                onSort={() => toggleSort('id')}
              />
              <SortColumnHeader
                label="Convention"
                active={sortKey === 'convention'}
                direction={sortDir}
                onSort={() => toggleSort('convention')}
              />
              <SortColumnHeader
                label="Article name"
                active={sortKey === 'article_name'}
                direction={sortDir}
                onSort={() => toggleSort('article_name')}
              />
              <SortColumnHeader
                label="Status"
                active={sortKey === 'status'}
                direction={sortDir}
                onSort={() => toggleSort('status')}
              />
              <th className="table-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <EmptyStateRow
                colSpan={5}
                message={search.trim() ? 'No articles match your search.' : 'No articles yet.'}
              />
              ) : (
                pageRows.map((a) => {
                  if (editingArticleId === a.id) {
                    return (
                      <tr key={a.id} className="catalog-table-edit-row">
                        <td colSpan={5}>
                          <div className="catalog-inline-edit">
                            <p className="catalog-inline-edit__meta muted small">ID {a.id}</p>
                            <FormField label="Convention">
                              <select
                                className="catalog-inline-edit-input"
                                value={editArticleConventionId}
                                onChange={(e) => setEditArticleConventionId(e.target.value)}
                                disabled={busy}
                              >
                                <option value="">Select convention</option>
                                {sortedConventions.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {conventionSelectLabel(c)}
                                  </option>
                                ))}
                              </select>
                            </FormField>
                            <FormField label="Article name">
                              <input
                                className="catalog-inline-edit-input"
                                value={editArticleName}
                                onChange={(e) => setEditArticleName(e.target.value)}
                              />
                            </FormField>
                            <FormField label="Description">
                              <textarea
                                className="issues-description-field catalog-inline-edit-textarea"
                                rows={4}
                                value={editArticleDescription}
                                onChange={(e) => setEditArticleDescription(e.target.value)}
                              />
                            </FormField>
                            <CatalogInlineEditActions
                              busy={busy}
                              saveDisabled={!editArticleName.trim() || !editArticleConventionId}
                              onCancel={() => setEditingArticleId(null)}
                              onSave={() => {
                                void (async () => {
                                  setBusy(true)
                                  setError(null)
                                  try {
                                    await adminUpdateArticle(a.id, {
                                      convention_id: Number(editArticleConventionId),
                                      article_name: editArticleName.trim(),
                                      description: editArticleDescription.trim() || null,
                                    })
                                    setEditingArticleId(null)
                                    await onRefresh()
                                  } catch (e: unknown) {
                                    setError(isApiError(e) ? e.message : 'Update failed')
                                  } finally {
                                    setBusy(false)
                                  }
                                })()
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  return (
                    <tr
                      key={a.id}
                      className={catalogIsActive(a) ? undefined : 'issues-mapping-table__row--inactive'}
                    >
                      <td>{a.id}</td>
                      <td>{articleConventionLabel(a, conventions)}</td>
                      <td>{a.article_name}</td>
                      <td>{catalogStatusLabel(a)}</td>
                      <td className="table-actions">
                        <ActionMenu>
                          <Button
                            variant="link"
                            compact
                            onClick={() => navigate(`/admin/issues/articles/view/${a.id}`)}
                          >
                            View
                          </Button>
                          <Button
                            variant="link"
                            compact
                            disabled={busy}
                            onClick={() => {
                              setEditingArticleId(a.id)
                              setEditArticleConventionId(String(a.convention_id))
                              setEditArticleName(a.article_name)
                              setEditArticleDescription(a.description ?? '')
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="link"
                            compact
                            dangerLink={catalogIsActive(a)}
                            disabled={busy}
                            onClick={() => {
                              void toggleCatalogActive(
                                `article "${a.article_name}"`,
                                a,
                                (is_active) => adminSetArticleActive(a.id, is_active),
                                onRefresh,
                                setError,
                                setBusy,
                              )
                            }}
                          >
                            {catalogIsActive(a) ? 'Deactivate' : 'Activate'}
                          </Button>
                        </ActionMenu>
                      </td>
                    </tr>
                  )
                })
              )}
          </tbody>
        </table>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={processed.length} onPageChange={setPage} />
    </div>
  )
}

function IssuesCollectionYearsSection({
  years,
  busy,
  setBusy,
  setError,
  onRefresh,
}: {
  years: AdminCollectionYear[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onRefresh: () => Promise<void>
}) {
  const [newLabel, setNewLabel] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const { search, setSearch, page, setPage, pageSize, sortKey, sortDir, toggleSort } =
    useClientTableState<YearCatalogSortKey>({
      pageSize: ISSUES_PAGE_SIZE,
      initialSortKey: 'updated_at',
      initialSortDir: 'desc',
    })

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = !q
      ? years
      : years.filter((y) => y.label.toLowerCase().includes(q) || String(y.id).includes(q))
    return sortYearCatalogRows(filtered, sortKey, sortDir)
  }, [years, search, sortKey, sortDir])

  const { pageRows } = derivePaginatedRows(processed, page, pageSize)

  return (
    <div className="issues-catalog-page">
      <div style={{ marginBottom: 16 }}>
        <TableCard padded>
          <div className="issues-catalog-add-form">
            <FormField label="Year">
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. 2025"
                maxLength={32}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </FormField>
            <div className="issues-catalog-add-form__actions">
              <Button
                variant="primary"
                compact
                disabled={busy || !newLabel.trim()}
                onClick={() => {
                  void (async () => {
                    setBusy(true)
                    setError(null)
                    try {
                      await adminCreateCollectionYear({ label: newLabel.trim() })
                      setNewLabel('')
                      await onRefresh()
                    } catch (e: unknown) {
                      setError(isApiError(e) ? e.message : 'Save failed')
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              >
                Add year
              </Button>
            </div>
          </div>
        </TableCard>
      </div>

      <TableToolbar className="issues-list-toolbar">
        <input
          type="search"
          placeholder="Search ID or year..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search years"
        />
        <Button variant="secondary" compact onClick={() => setSearch('')}>
          Reset search
        </Button>
      </TableToolbar>

      <TableCard className="issues-catalog-list-card">
        <table className="data-table issues-catalog-table">
          <IssuesCatalogTableColgroup />
          <thead>
            <tr>
              <SortColumnHeader
                label="ID"
                active={sortKey === 'id'}
                direction={sortDir}
                onSort={() => toggleSort('id')}
              />
              <SortColumnHeader
                label="Year"
                active={sortKey === 'label'}
                direction={sortDir}
                onSort={() => toggleSort('label')}
              />
              <SortColumnHeader
                label="Status"
                active={sortKey === 'status'}
                direction={sortDir}
                onSort={() => toggleSort('status')}
              />
              <th className="table-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <EmptyStateRow
                colSpan={4}
                message={search.trim() ? 'No years match your search.' : 'No years yet.'}
              />
              ) : (
                pageRows.map((y) => (
                  <tr
                    key={y.id}
                    className={
                      editingId === y.id
                        ? 'catalog-table-row-editing'
                        : catalogIsActive(y)
                          ? undefined
                          : 'issues-mapping-table__row--inactive'
                    }
                  >
                    <td>{y.id}</td>
                    <td>
                      {editingId === y.id ? (
                        <input
                          className="catalog-inline-edit-input"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          maxLength={32}
                          aria-label="Year"
                        />
                      ) : (
                        y.label
                      )}
                    </td>
                    <td>{catalogStatusLabel(y)}</td>
                    <td className="table-actions">
                      {editingId === y.id ? (
                        <CatalogInlineEditActions
                          busy={busy}
                          saveDisabled={!editLabel.trim()}
                          onCancel={() => setEditingId(null)}
                          onSave={() => {
                            void (async () => {
                              setBusy(true)
                              setError(null)
                              try {
                                await adminUpdateCollectionYear(y.id, { label: editLabel.trim() })
                                setEditingId(null)
                                await onRefresh()
                              } catch (e: unknown) {
                                setError(isApiError(e) ? e.message : 'Update failed')
                              } finally {
                                setBusy(false)
                              }
                            })()
                          }}
                        />
                      ) : (
                        <ActionMenu>
                          <Button
                            variant="link"
                            compact
                            disabled={busy}
                            onClick={() => {
                              setEditingId(y.id)
                              setEditLabel(y.label)
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="link"
                            compact
                            dangerLink={catalogIsActive(y)}
                            disabled={busy}
                            onClick={() => {
                              void toggleCatalogActive(
                                `year "${y.label}"`,
                                y,
                                (is_active) => adminSetCollectionYearActive(y.id, is_active),
                                onRefresh,
                                setError,
                                setBusy,
                              )
                            }}
                          >
                            {catalogIsActive(y) ? 'Deactivate' : 'Activate'}
                          </Button>
                        </ActionMenu>
                      )}
                    </td>
                  </tr>
                ))
              )}
          </tbody>
        </table>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={processed.length} onPageChange={setPage} />
    </div>
  )
}

function IssuesCollectionGendersSection({
  genders,
  busy,
  setBusy,
  setError,
  onRefresh,
}: {
  genders: AdminCollectionGender[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onRefresh: () => Promise<void>
}) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const { search, setSearch, page, setPage, pageSize, sortKey, sortDir, toggleSort } =
    useClientTableState<CatalogIdNameSortKey>({
      pageSize: ISSUES_PAGE_SIZE,
      initialSortKey: 'updated_at',
      initialSortDir: 'desc',
    })

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = !q
      ? genders
      : genders.filter((g) => g.name.toLowerCase().includes(q) || String(g.id).includes(q))
    return sortCatalogIdNameRows(filtered, sortKey, sortDir)
  }, [genders, search, sortKey, sortDir])

  const { pageRows } = derivePaginatedRows(processed, page, pageSize)

  return (
    <div className="issues-catalog-page">
      <div style={{ marginBottom: 16 }}>
        <TableCard padded>
          <div className="issues-catalog-add-form">
            <FormField label="Gender">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Female"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </FormField>
            <div className="issues-catalog-add-form__actions">
              <Button
                variant="primary"
                compact
                disabled={busy || !newName.trim()}
                onClick={() => {
                  void (async () => {
                    setBusy(true)
                    setError(null)
                    try {
                      await adminCreateCollectionGender({ name: newName.trim() })
                      setNewName('')
                      await onRefresh()
                    } catch (e: unknown) {
                      setError(isApiError(e) ? e.message : 'Save failed')
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              >
                Add gender
              </Button>
            </div>
          </div>
        </TableCard>
      </div>

      <TableToolbar className="issues-list-toolbar">
        <input
          type="search"
          placeholder="Search ID or gender..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search genders"
        />
        <Button variant="secondary" compact onClick={() => setSearch('')}>
          Reset search
        </Button>
      </TableToolbar>

      <TableCard className="issues-catalog-list-card">
        <table className="data-table issues-catalog-table">
          <IssuesCatalogTableColgroup />
          <thead>
            <tr>
              <SortColumnHeader
                label="ID"
                active={sortKey === 'id'}
                direction={sortDir}
                onSort={() => toggleSort('id')}
              />
              <SortColumnHeader
                label="Gender"
                active={sortKey === 'name'}
                direction={sortDir}
                onSort={() => toggleSort('name')}
              />
              <SortColumnHeader
                label="Status"
                active={sortKey === 'status'}
                direction={sortDir}
                onSort={() => toggleSort('status')}
              />
              <th className="table-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <EmptyStateRow
                colSpan={4}
                message={search.trim() ? 'No genders match your search.' : 'No genders yet.'}
              />
              ) : (
                pageRows.map((g) => (
                  <tr
                    key={g.id}
                    className={
                      editingId === g.id
                        ? 'catalog-table-row-editing'
                        : catalogIsActive(g)
                          ? undefined
                          : 'issues-mapping-table__row--inactive'
                    }
                  >
                    <td>{g.id}</td>
                    <td>
                      {editingId === g.id ? (
                        <input
                          className="catalog-inline-edit-input"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          aria-label="Gender"
                        />
                      ) : (
                        g.name
                      )}
                    </td>
                    <td>{catalogStatusLabel(g)}</td>
                    <td className="table-actions">
                      {editingId === g.id ? (
                        <CatalogInlineEditActions
                          busy={busy}
                          saveDisabled={!editName.trim()}
                          onCancel={() => setEditingId(null)}
                          onSave={() => {
                            void (async () => {
                              setBusy(true)
                              setError(null)
                              try {
                                await adminUpdateCollectionGender(g.id, { name: editName.trim() })
                                setEditingId(null)
                                await onRefresh()
                              } catch (e: unknown) {
                                setError(isApiError(e) ? e.message : 'Update failed')
                              } finally {
                                setBusy(false)
                              }
                            })()
                          }}
                        />
                      ) : (
                        <ActionMenu>
                          <Button
                            variant="link"
                            compact
                            disabled={busy}
                            onClick={() => {
                              setEditingId(g.id)
                              setEditName(g.name)
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="link"
                            compact
                            dangerLink={catalogIsActive(g)}
                            disabled={busy}
                            onClick={() => {
                              void toggleCatalogActive(
                                `gender "${g.name}"`,
                                g,
                                (is_active) => adminSetCollectionGenderActive(g.id, is_active),
                                onRefresh,
                                setError,
                                setBusy,
                              )
                            }}
                          >
                            {catalogIsActive(g) ? 'Deactivate' : 'Activate'}
                          </Button>
                        </ActionMenu>
                      )}
                    </td>
                  </tr>
                ))
              )}
          </tbody>
        </table>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={processed.length} onPageChange={setPage} />
    </div>
  )
}

function IssuesCollectionReligionsSection({
  religions,
  busy,
  setBusy,
  setError,
  onRefresh,
}: {
  religions: AdminCollectionReligion[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onRefresh: () => Promise<void>
}) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const { search, setSearch, page, setPage, pageSize, sortKey, sortDir, toggleSort } =
    useClientTableState<CatalogIdNameSortKey>({
      pageSize: ISSUES_PAGE_SIZE,
      initialSortKey: 'updated_at',
      initialSortDir: 'desc',
    })

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = !q
      ? religions
      : religions.filter((r) => r.name.toLowerCase().includes(q) || String(r.id).includes(q))
    return sortCatalogIdNameRows(filtered, sortKey, sortDir)
  }, [religions, search, sortKey, sortDir])

  const { pageRows } = derivePaginatedRows(processed, page, pageSize)

  return (
    <div className="issues-catalog-page">
      <div style={{ marginBottom: 16 }}>
        <TableCard padded>
          <p className="text-muted text-compact" style={{ margin: 0 }}>
            Official religion options are stored in the database. Quantitative indicators always include the Religion
            dimension; respondents see the full list below for the collection years selected on the indicator.
          </p>
        </TableCard>
      </div>

      <TableToolbar className="issues-list-toolbar">
        <input
          type="search"
          placeholder="Search ID or religion..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search religions"
        />
        <Button variant="secondary" compact onClick={() => setSearch('')}>
          Reset search
        </Button>
      </TableToolbar>

      <TableCard className="issues-catalog-list-card">
        <table className="data-table issues-catalog-table">
          <IssuesCatalogTableColgroup />
          <thead>
            <tr>
              <SortColumnHeader
                label="ID"
                active={sortKey === 'id'}
                direction={sortDir}
                onSort={() => toggleSort('id')}
              />
              <SortColumnHeader
                label="Religion"
                active={sortKey === 'name'}
                direction={sortDir}
                onSort={() => toggleSort('name')}
              />
              <SortColumnHeader
                label="Status"
                active={sortKey === 'status'}
                direction={sortDir}
                onSort={() => toggleSort('status')}
              />
              <th className="table-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <EmptyStateRow
                colSpan={4}
                message={search.trim() ? 'No religions match your search.' : 'No religions yet.'}
              />
            ) : (
              pageRows.map((r) => (
                <tr
                  key={r.id}
                  className={
                    editingId === r.id
                      ? 'catalog-table-row-editing'
                      : catalogIsActive(r)
                        ? undefined
                        : 'issues-mapping-table__row--inactive'
                  }
                >
                  <td>{r.id}</td>
                  <td>
                    {editingId === r.id ? (
                      <input
                        className="catalog-inline-edit-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        aria-label="Religion"
                      />
                    ) : (
                      r.name
                    )}
                  </td>
                  <td>{catalogStatusLabel(r)}</td>
                  <td className="table-actions">
                    {editingId === r.id ? (
                      <CatalogInlineEditActions
                        busy={busy}
                        saveDisabled={!editName.trim()}
                        onCancel={() => setEditingId(null)}
                        onSave={() => {
                          void (async () => {
                            setBusy(true)
                            setError(null)
                            try {
                              await adminUpdateCollectionReligion(r.id, { name: editName.trim() })
                              setEditingId(null)
                              await onRefresh()
                            } catch (e: unknown) {
                              setError(isApiError(e) ? e.message : 'Update failed')
                            } finally {
                              setBusy(false)
                            }
                          })()
                        }}
                      />
                    ) : (
                      <ActionMenu>
                        <Button
                          variant="link"
                          compact
                          disabled={busy}
                          onClick={() => {
                            setEditingId(r.id)
                            setEditName(r.name)
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="link"
                          compact
                          dangerLink={catalogIsActive(r)}
                          disabled={busy}
                          onClick={() => {
                            void toggleCatalogActive(
                              `religion "${r.name}"`,
                              r,
                              (is_active) => adminSetCollectionReligionActive(r.id, is_active),
                              onRefresh,
                              setError,
                              setBusy,
                            )
                          }}
                        >
                          {catalogIsActive(r) ? 'Deactivate' : 'Activate'}
                        </Button>
                      </ActionMenu>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableCard>
      <PaginationBar page={page} pageSize={pageSize} totalItems={processed.length} onPageChange={setPage} />
    </div>
  )
}

function issueConventionLabel(issue: AdminIssue): string {
  if (issue.convention?.code) {
    return issue.convention.code
  }
  return String(issue.convention_id)
}

function conventionSelectLabel(convention: AdminConvention): string {
  return `${convention.code} - ${convention.name}`
}

function articleConventionLabel(
  article: AdminArticleRow,
  conventions: AdminConvention[],
): string {
  if (article.convention?.code) {
    return article.convention.code
  }
  const match = conventions.find((c) => c.id === article.convention_id)
  return match?.code ?? (article.convention_id ? String(article.convention_id) : '—')
}

function categoryConventionLabel(
  category: AdminIssueCategory,
  conventions: AdminConvention[],
): string {
  if (category.convention?.code) {
    return category.convention.code
  }
  const match = conventions.find((c) => c.id === category.convention_id)
  return match?.code ?? (category.convention_id ? String(category.convention_id) : '—')
}

function sortCategoryCatalogRows(
  rows: AdminIssueCategory[],
  conventions: AdminConvention[],
  sortKey: CategoryCatalogSortKey | undefined,
  sortDir: SortDirection,
): AdminIssueCategory[] {
  const key = sortKey ?? 'updated_at'
  return [...rows].sort((a, b) => {
    switch (key) {
      case 'updated_at':
        return compareTimestampValues(
          pickActivityTimestamp(a.updated_at, a.created_at, a.id),
          pickActivityTimestamp(b.updated_at, b.created_at, b.id),
          sortDir,
        )
      case 'id':
        return compareNumberValues(a.id, b.id, sortDir)
      case 'convention':
        return compareStringValues(
          categoryConventionLabel(a, conventions),
          categoryConventionLabel(b, conventions),
          sortDir,
        )
      case 'name':
        return compareStringValues(a.name, b.name, sortDir)
      case 'status':
        return compareStringValues(catalogStatusLabel(a), catalogStatusLabel(b), sortDir)
      default:
        return compareTimestampValues(
          pickActivityTimestamp(a.updated_at, a.created_at, a.id),
          pickActivityTimestamp(b.updated_at, b.created_at, b.id),
          'desc',
        )
    }
  })
}

function sortArticleCatalogRows(
  rows: AdminArticleRow[],
  conventions: AdminConvention[],
  sortKey: ArticleCatalogSortKey | undefined,
  sortDir: SortDirection,
): AdminArticleRow[] {
  const key = sortKey ?? 'updated_at'
  return [...rows].sort((a, b) => {
    switch (key) {
      case 'updated_at':
        return compareTimestampValues(
          pickActivityTimestamp(a.updated_at, a.created_at, a.id),
          pickActivityTimestamp(b.updated_at, b.created_at, b.id),
          sortDir,
        )
      case 'id':
        return compareNumberValues(a.id, b.id, sortDir)
      case 'convention':
        return compareStringValues(
          articleConventionLabel(a, conventions),
          articleConventionLabel(b, conventions),
          sortDir,
        )
      case 'article_name':
        return compareStringValues(a.article_name, b.article_name, sortDir)
      case 'status':
        return compareStringValues(catalogStatusLabel(a), catalogStatusLabel(b), sortDir)
      default:
        return compareTimestampValues(
          pickActivityTimestamp(a.updated_at, a.created_at, a.id),
          pickActivityTimestamp(b.updated_at, b.created_at, b.id),
          'desc',
        )
    }
  })
}

function effectiveIndicatorQl(
  ind: AdminIssue['indicators'][number],
  issue: AdminIssue,
): { quantitative: boolean; qualitative: boolean } {
  const legacy = !ind.has_quantitative && !ind.has_qualitative
  return {
    quantitative: legacy ? issue.has_quantitative : ind.has_quantitative,
    qualitative: legacy ? issue.has_qualitative : ind.has_qualitative,
  }
}

/** Q/L response types (matches create/edit form and HR request UI). */
function indicatorDataTypeLabel(ind: AdminIssue['indicators'][number], issue: AdminIssue): string {
  const { quantitative, qualitative } = effectiveIndicatorQl(ind, issue)
  const parts: string[] = []
  if (quantitative) parts.push('Quantitative')
  if (qualitative) parts.push('Qualitative')
  return parts.length > 0 ? parts.join(' Â· ') : 'â€”'
}

/** Year collection and disaggregation dimensions summary. */
function indicatorDisaggregationLabel(ind: AdminIssue['indicators'][number]): string {
  const parts: string[] = []
  if (ind.has_quantitative && ind.collects_by_year && (ind.collection_by_year?.length ?? 0) > 0) {
    const years = [...ind.collection_by_year]
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
      .map((y) => y.label)
      .join('; ')
    const dims: string[] = []
    if (ind.collects_by_gender) dims.push('Gender')
    if (ind.collects_by_age) dims.push('Age')
    if (ind.collects_by_location) dims.push('Location')
    if (ind.collects_by_disability) dims.push('Disability')
    if (ind.collects_by_religion) dims.push('Religion')
    if (ind.collects_by_consolidated) dims.push('Consolidated Data')
    parts.push(dims.length > 0 ? `Q: ${years} (${dims.join(', ')})` : `Q: ${years}`)
  }
  const qualYears = ind.qualitative_collection_by_year ?? []
  if (ind.has_qualitative && qualYears.length > 0) {
    parts.push(
      `L: ${[...qualYears]
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
        .map((y) => y.label)
        .join('; ')}`,
    )
  }
  if (parts.length > 0) return parts.join(' Â· ')
  const text = ind.disaggregation?.trim()
  return text || 'â€”'
}

function CatalogInlineEditActions({
  busy,
  saveDisabled,
  onSave,
  onCancel,
}: {
  busy: boolean
  saveDisabled?: boolean
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="catalog-inline-edit-actions">
      <Button variant="primary" compact disabled={busy || saveDisabled} onClick={onSave}>
        Save
      </Button>
      <Button variant="secondary" compact disabled={busy} onClick={onCancel}>
        Cancel
      </Button>
    </div>
  )
}

function IssuesCatalogTableColgroup({ variant = 'standard' }: { variant?: 'standard' | 'articles' }) {
  if (variant === 'articles') {
    return (
      <colgroup>
        <col className="issues-catalog-table__col-id" />
        <col className="issues-catalog-table__col-convention" />
        <col className="issues-catalog-table__col-name" />
        <col className="issues-catalog-table__col-status" />
        <col className="issues-catalog-table__col-actions" />
      </colgroup>
    )
  }

  return (
    <colgroup>
      <col className="issues-catalog-table__col-id" />
      <col className="issues-catalog-table__col-name" />
      <col className="issues-catalog-table__col-status" />
      <col className="issues-catalog-table__col-actions" />
    </colgroup>
  )
}

function ActionMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <RowActionsMenu isOpen={open} onOpenChange={setOpen}>
      {children}
    </RowActionsMenu>
  )
}
type IndicatorDisaggregatedYearRow = {
  year_id: number
  gender_ids: number[]
}

type IndicatorDraft = {
  /** Stable server id when editing an existing indicator — never changed by drag-and-drop. */
  id?: number
  client_key: string
  indicator_text: string
  collects_quantitative: boolean
  collects_qualitative: boolean
  /** Quantitative disaggregation years (with genders). */
  disaggregated_years: IndicatorDisaggregatedYearRow[]
  /** Qualitative years only â€” independent of quantitative years. */
  qualitative_year_ids: number[]
  collects_by_gender: boolean
  collects_by_age: boolean
  collects_by_location: boolean
  collects_by_disability: boolean
  collects_by_religion: boolean
  collects_by_consolidated: boolean
}

let indicatorClientKeyCounter = 0

function nextIndicatorClientKey(existingId?: number): string {
  if (existingId != null) return `ind-${existingId}`
  indicatorClientKeyCounter += 1
  return `new-${indicatorClientKeyCounter}`
}

function emptyIndicator(): IndicatorDraft {
  return {
    client_key: nextIndicatorClientKey(),
    indicator_text: '',
    collects_quantitative: false,
    collects_qualitative: true,
    disaggregated_years: [],
    qualitative_year_ids: [],
    collects_by_gender: false,
    collects_by_age: false,
    collects_by_location: false,
    collects_by_disability: false,
    collects_by_religion: false,
    collects_by_consolidated: false,
  }
}

function validateIndicatorDataTypes(rows: IndicatorDraft[]): string | null {
  const filled = rows.filter((x) => x.indicator_text.trim())
  for (const x of filled) {
    if (!x.collects_quantitative && !x.collects_qualitative) {
      return 'Each indicator must have Quantitative and/or Qualitative selected.'
    }
  }
  return null
}

function indicatorFromAdmin(ind: AdminIssueIndicator): IndicatorDraft {
  const quantitative = ind.has_quantitative
  const qualitative = ind.has_qualitative
  const quantYearRows = quantitative
    ? (ind.collection_by_year ?? []).map((y) => ({
        year_id: y.year_id,
        gender_ids: y.gender_ids ?? [],
      }))
    : []
  const qualFromApi = ind.qualitative_collection_by_year ?? []
  let qualitative_year_ids = qualitative ? qualFromApi.map((y) => y.year_id) : []
  // Legacy: qualitative-only year-only rows lived in collection_by_year.
  if (qualitative && !quantitative && qualitative_year_ids.length === 0) {
    qualitative_year_ids = (ind.collection_by_year ?? []).map((y) => y.year_id)
  }
  return {
    id: ind.id,
    client_key: nextIndicatorClientKey(ind.id),
    indicator_text: ind.indicator_text,
    collects_quantitative: quantitative,
    collects_qualitative: qualitative,
    disaggregated_years: quantYearRows,
    qualitative_year_ids,
    collects_by_gender: quantitative,
    collects_by_age: quantitative,
    collects_by_location: false,
    collects_by_disability: quantitative,
    collects_by_religion: quantitative,
    collects_by_consolidated: quantitative,
  }
}

/** Quantitative: dimensions only. Years are selected by Federal Admin on each HR request. */
function indicatorToPayload(x: IndicatorDraft, _fallbackGenderIds: number[] = []) {
  return {
    ...(x.id != null ? { id: x.id } : {}),
    indicator_text: x.indicator_text.trim(),
    disaggregation: null as string | null,
    has_quantitative: x.collects_quantitative,
    has_qualitative: x.collects_qualitative,
    collects_by_year: x.collects_quantitative,
    collects_by_gender: x.collects_quantitative,
    collects_by_age: x.collects_quantitative,
    collects_by_location: false,
    collects_by_disability: x.collects_quantitative,
    collects_by_religion: x.collects_quantitative,
    collects_by_consolidated: x.collects_quantitative,
    // Years are request-scoped (Federal Admin); clear catalog years on save.
    collection_by_year: [] as Array<{
      collection_year_id: number
      collection_gender_ids: number[]
      collection_religion_ids: number[]
    }>,
    qualitative_collection_by_year: [] as Array<{ collection_year_id: number }>,
  }
}

function ArticleMultiSelectDropdown({
  articles,
  selectedIds,
  onChange,
  disabled,
}: {
  articles: AdminArticleRow[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  const sorted = useMemo(
    () =>
      [...articles].sort((a, b) =>
        a.article_name.localeCompare(b.article_name, undefined, { numeric: true, sensitivity: 'base' }),
      ),
    [articles],
  )

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((a) => a.article_name.toLowerCase().includes(q))
  }, [sorted, filter])

  useEffect(() => {
    if (!open) {
      setFilter('')
      return
    }
    function onDoc(e: MouseEvent) {
      if (!(e.target instanceof Node)) return
      if (wrapRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const toggle = (id: number) => {
    const set = new Set(selectedIds)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    onChange([...set].sort((a, b) => a - b))
  }

  const summary =
    selectedIds.length === 0
      ? 'Select articles...'
      : selectedIds.length === 1
        ? sorted.find((a) => a.id === selectedIds[0])?.article_name ?? '1 selected'
        : `${selectedIds.length} articles selected`

  return (
    <div className="article-multi-dropdown" ref={wrapRef}>
      <button
        type="button"
        className="article-multi-dropdown__trigger"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="article-multi-dropdown__trigger-text">{summary}</span>
        <span className="article-multi-dropdown__chevron" aria-hidden />
      </button>
      {open && (
        <div className="article-multi-dropdown__panel" role="listbox" aria-multiselectable>
          <input
            type="search"
            className="article-multi-dropdown__filter"
            placeholder="Filter articles..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
          />
          <div className="article-multi-dropdown__list">
            {filtered.length === 0 ? (
              <div className="article-multi-dropdown__empty">No articles match.</div>
            ) : (
              filtered.map((a) => (
                <label key={a.id} className="article-multi-dropdown__item">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(a.id)}
                    onChange={() => toggle(a.id)}
                    disabled={disabled}
                  />
                  <span>{a.article_name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}


function IssueIndicatorsEditor({
  rows,
  onChange,
  collectionYears: _collectionYears,
  collectionGenders,
  disabled,
}: {
  rows: IndicatorDraft[]
  onChange: (rows: IndicatorDraft[]) => void
  collectionYears: AdminCollectionYear[]
  collectionGenders: AdminCollectionGender[]
  disabled?: boolean
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const allSelectableGenderIds = useMemo(
    () =>
      filterSelectableCollectionGenders([...collectionGenders])
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        .map((g) => g.id),
    [collectionGenders],
  )

  function finishDrag() {
    setDragIndex(null)
    setDropIndex(null)
  }

  function handleDrop(toIndex: number) {
    if (dragIndex == null || disabled) {
      finishDrag()
      return
    }
    onChange(reorderList(rows, dragIndex, toIndex))
    finishDrag()
  }

  function patchRow(idx: number, patch: Partial<IndicatorDraft>) {
    const next = [...rows]
    next[idx] = { ...rows[idx], ...patch }
    onChange(next)
  }

  function setQuantitative(idx: number, row: IndicatorDraft, checked: boolean) {
    if (checked) {
      const years = row.disaggregated_years.map((y) => ({
        year_id: y.year_id,
        gender_ids: y.gender_ids.length > 0 ? y.gender_ids : allSelectableGenderIds,
      }))
      patchRow(idx, {
        collects_quantitative: true,
        disaggregated_years: years,
        collects_by_gender: true,
        collects_by_age: true,
        collects_by_location: false,
        collects_by_disability: true,
        collects_by_religion: true,
        collects_by_consolidated: true,
      })
      return
    }
    patchRow(idx, {
      collects_quantitative: false,
      disaggregated_years: [],
      collects_by_gender: false,
      collects_by_age: false,
      collects_by_location: false,
      collects_by_disability: false,
      collects_by_religion: false,
      collects_by_consolidated: false,
    })
  }

  function setQualitative(idx: number, row: IndicatorDraft, checked: boolean) {
    patchRow(idx, {
      collects_qualitative: checked,
      qualitative_year_ids: checked ? row.qualitative_year_ids : [],
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.length > 1 && !disabled ? (
        <p className="text-muted text-compact" style={{ margin: 0 }}>
          Drag indicators to set the list order shown to departments and in reports.
        </p>
      ) : null}
      {rows.length === 0 && (
        <p className="text-muted text-compact" style={{ margin: 0 }}>
          {noIndicatorsForLoiHint()}
        </p>
      )}
      {rows.map((row, idx) => (
        <div
          key={row.client_key}
          className={
            'issue-indicator-card' +
            (dropIndex === idx ? ' issue-indicator-card--drop-target' : '') +
            (dragIndex === idx ? ' issue-indicator-card--dragging' : '')
          }
          draggable={!disabled}
          onDragStart={() => {
            if (disabled) return
            setDragIndex(idx)
          }}
          onDragEnd={finishDrag}
          onDragOver={(e) => {
            if (disabled || dragIndex == null) return
            e.preventDefault()
            setDropIndex(idx)
          }}
          onDrop={(e) => {
            e.preventDefault()
            handleDrop(idx)
          }}
        >
          <div className="issue-indicator-card__head">
            <DragHandle disabled={disabled} className="issue-indicator-card__drag" />
            <span className="issue-indicator-card__position text-muted text-compact">#{idx + 1}</span>
          </div>
          <FormRow twoCol>
            <FormControl label="Indicator text">
              <input
                placeholder="Indicator text"
                value={row.indicator_text}
                disabled={disabled}
                onChange={(e) => patchRow(idx, { indicator_text: e.target.value })}
              />
            </FormControl>
            <FormControl label="Response data type (Q/L)">
              <div className="issue-indicator-type-checks">
                <label className="checkbox-label issue-indicator-type-checks__item">
                  <input
                    type="checkbox"
                    checked={row.collects_quantitative}
                    disabled={disabled}
                    onChange={(e) => setQuantitative(idx, row, e.target.checked)}
                  />
                  Quantitative
                </label>
                <label className="checkbox-label issue-indicator-type-checks__item">
                  <input
                    type="checkbox"
                    checked={row.collects_qualitative}
                    disabled={disabled}
                    onChange={(e) => setQualitative(idx, row, e.target.checked)}
                  />
                  Qualitative
                </label>
              </div>
            </FormControl>
          </FormRow>
          {row.collects_quantitative ? (
            <div className="issue-indicator-mapping-block">
              <div className="issue-indicator-dimension-checks" role="group" aria-label="Disaggregation dimensions">
                {(
                  [
                    'Gender',
                    'Age (Under 18, 18 - 60, Above 60 for respondents)',
                    'Disability (Hearing, Lower Limb, Mental, Speech, Upper Limb, Visual Full, Visual Partial, Other)',
                    'Religion (full list for respondents)',
                    'Consolidated Data (Total count only for respondents)',
                  ] as const
                ).map((label) => (
                  <label key={label} className="checkbox-label issue-indicator-dimension-checks__item">
                    <input type="checkbox" checked disabled />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="link"
              compact
              dangerLink
              disabled={disabled}
              onClick={() => onChange(rows.filter((_, i) => i !== idx))}
            >
              {row.id != null ? 'Deactivate indicator' : 'Remove indicator'}
            </Button>
          </div>
        </div>
      ))}
      <Button variant="link" compact disabled={disabled} onClick={() => onChange([...rows, emptyIndicator()])}>
        + Add indicator
      </Button>
    </div>
  )
}

function IssuesCreateForm({
  conventions,
  categories,
  articles,
  collectionYears,
  collectionGenders,
  busy,
  setBusy,
  setError,
  setSuccess,
  onDone,
  onCancel,
  editIssue,
}: {
  conventions: AdminConvention[]
  categories: AdminIssueCategory[]
  articles: AdminArticleRow[]
  collectionYears: AdminCollectionYear[]
  collectionGenders: AdminCollectionGender[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  setSuccess?: (s: string | null) => void
  onDone: () => Promise<void>
  onCancel: () => void
  editIssue?: AdminIssue | null
}) {
  const sortedArticles = [...articles].sort((a, b) =>
    a.article_name.localeCompare(b.article_name, undefined, { numeric: true, sensitivity: 'base' }),
  )
  const [entryKind, setEntryKind] = useState<IssueEntryKind>('issue')
  const [conventionId, setConventionId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [issueTitle, setIssueTitle] = useState('')
  const [issueDescription, setIssueDescription] = useState('')
  const [selectedArticleIds, setSelectedArticleIds] = useState<number[]>([])
  const [indicators, setIndicators] = useState<IndicatorDraft[]>([])
  const conventionArticles = sortedArticles.filter((a) => String(a.convention_id) === conventionId)
  const conventionCategories = categories.filter((c) => String(c.convention_id) === conventionId)
  const selectedCategory = categories.find((c) => String(c.id) === categoryId)
  const categoryOptions =
    selectedCategory && !conventionCategories.some((c) => c.id === selectedCategory.id)
      ? [selectedCategory, ...conventionCategories]
      : conventionCategories
  const isEditing = editIssue != null
  const activeEntryKind =
    isEditing && editIssue ? coerceIssueEntryKind(editIssue.entry_kind) : entryKind

  useEffect(() => {
    if (!editIssue) return
    const kind = coerceIssueEntryKind(editIssue.entry_kind)
    setEntryKind(kind)
    setConventionId(String(editIssue.convention_id))
    setCategoryId(String(editIssue.category_id))
    setIssueTitle(kind === 'issue' ? editIssue.issue_title ?? '' : '')
    setIssueDescription(editIssue.description?.trim() || '')
    setSelectedArticleIds(
      editIssue.article_ids.length
        ? editIssue.article_ids
        : editIssue.articles.map((a) => a.id),
    )
    setIndicators(
      editIssue.indicators.filter((ind) => ind.is_active !== false).map(indicatorFromAdmin),
    )
  }, [editIssue])

  return (
    <div className="issues-create-form">
      {!isEditing ? (
        <div className="issues-create-form__kind">
          <IssueEntryKindToggle value={entryKind} onChange={setEntryKind} disabled={busy} />
        </div>
      ) : (
        <p className="issues-create-form__kind-label muted text-compact">
          {issueEntryKindBadgeLabel(activeEntryKind)}
        </p>
      )}
      <FormGrid>
        <div className="issues-form-top-grid">
          <FormControl label="Convention">
            <select
              value={conventionId}
              onChange={(e) => {
                setConventionId(e.target.value)
                setSelectedArticleIds([])
                setCategoryId('')
              }}
            >
              <option value="">Select convention</option>
              {conventions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </FormControl>
          <FormControl label="Articles">
            <ArticleMultiSelectDropdown
              articles={conventionArticles}
              selectedIds={selectedArticleIds}
              onChange={setSelectedArticleIds}
              disabled={busy || !conventionId}
            />
          </FormControl>
          <FormControl label="Category">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={busy || !conventionId}
            >
              <option value="">{conventionId ? 'Select category' : 'Select convention first'}</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormControl>
        </div>
        {issueEntryFormShowsTitleField(activeEntryKind) ? (
          <FormField label={issueEntryTitleFieldLabel(activeEntryKind)}>
            <input
              placeholder={issueEntryTitleFieldLabel(activeEntryKind)}
              value={issueTitle}
              onChange={(e) => setIssueTitle(e.target.value)}
            />
          </FormField>
        ) : null}
        <FormField label={issueEntryDescriptionFieldLabel(activeEntryKind)}>
          <textarea
            className="issues-description-field"
            placeholder={issueEntryDescriptionPlaceholder(activeEntryKind)}
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            disabled={busy}
            rows={10}
          />
        </FormField>
      </FormGrid>
      <strong className="font-semibold text-compact" style={{ display: 'block', marginTop: 16 }}>
        {issueEntryIndicatorsLinkedLabel(activeEntryKind)}
      </strong>
      <IssueIndicatorsEditor
        rows={indicators}
        onChange={setIndicators}
        collectionYears={collectionYears}
        collectionGenders={collectionGenders}
        disabled={busy}
      />
      <div className="issues-create-form__actions" style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="secondary" compact disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          compact
          disabled={
            busy ||
            issueEntrySaveBlocked(
              activeEntryKind,
              issueTitle,
              issueDescription,
              conventionId,
              categoryId,
              selectedArticleIds,
            )
          }
          onClick={() => {
            void (async () => {
              setBusy(true)
              setError(null)
              setSuccess?.(null)
              try {
                const typeErr = validateIndicatorDataTypes(indicators)
                if (typeErr) {
                  setError(typeErr)
                  return
                }
                const filled = indicators.filter((x) => x.indicator_text.trim())
                const fallbackGenderIds = filterSelectableCollectionGenders(collectionGenders).map((g) => g.id)
                const indPayload = filled.map((x) => indicatorToPayload(x, fallbackGenderIds))
                const hasQuantitative = filled.some((x) => x.collects_quantitative)
                const hasQualitative = filled.some((x) => x.collects_qualitative)
                const textFields = issueEntryPayloadFields(activeEntryKind, issueTitle, issueDescription)
                const payload = {
                  convention_id: Number(conventionId),
                  category_id: Number(categoryId),
                  entry_kind: activeEntryKind,
                  issue_title: textFields.issue_title,
                  description: textFields.description,
                  has_quantitative: hasQuantitative,
                  has_qualitative: hasQualitative,
                  articles: selectedArticleIds.map((articleId) => ({ article_id: articleId })),
                  indicators: indPayload.length ? indPayload : undefined,
                }
                if (isEditing && editIssue) {
                  await adminUpdateIssue(editIssue.id, payload)
                  await onDone()
                  setSuccess?.(
                    `${issueEntryKindBadgeLabel(activeEntryKind)} updated successfully.`,
                  )
                } else {
                  await adminCreateIssue(payload)
                  setEntryKind('issue')
                  setConventionId('')
                  setCategoryId('')
                  setIssueTitle('')
                  setIssueDescription('')
                  setSelectedArticleIds([])
                  setIndicators([])
                  await onDone()
                }
              } catch (e: unknown) {
                setError(isApiError(e) ? e.message : 'Save failed')
              } finally {
                setBusy(false)
              }
            })()
          }}
        >
          {isEditing ? 'Save changes' : `Save ${issueEntryKindBadgeLabel(activeEntryKind)}`}
        </Button>
      </div>
    </div>
  )
}

function IssuesIssueEditPage({
  issueId,
  user,
  conventions,
  categories,
  articles,
  collectionYears,
  collectionGenders,
  busy,
  setBusy,
  error,
  setError,
  onDone,
}: {
  issueId: number
  user: AuthUser
  conventions: AdminConvention[]
  categories: AdminIssueCategory[]
  articles: AdminArticleRow[]
  collectionYears: AdminCollectionYear[]
  collectionGenders: AdminCollectionGender[]
  busy: boolean
  setBusy: (v: boolean) => void
  error: string | null
  setError: (s: string | null) => void
  onDone: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [issue, setIssue] = useState<AdminIssue | null>(null)
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void adminFetchIssue(issueId)
      .then((row) => {
        if (!cancelled) setIssue(row)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(isApiError(e) ? e.message : 'Load failed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [issueId, setError])

  if (!user || !isSuperAdmin(user)) {
    return <Navigate to="/" replace />
  }

  const kind = issue ? coerceIssueEntryKind(issue.entry_kind) : 'issue'

  return (
    <PageSection
      title={issue ? `Edit ${issueEntryViewPageTitle(kind, issue.id)}` : 'Edit entry'}
      leading={
        <WorkflowPageBack to="/admin/issues" label={workflowBackLabel('/admin/issues')} placement="header" />
      }
    >
      {error && (
        <Alert variant="error" title="Error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" title="Saved" onDismiss={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      {loading && <p className="muted">Loading…</p>}
      {!loading && !issue && <p className="login-error">Entry not found.</p>}
      {issue && (
        <TableCard padded>
          <IssuesCreateForm
            conventions={conventions}
            categories={categories}
            articles={articles}
            collectionYears={collectionYears}
            collectionGenders={collectionGenders}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            setSuccess={setSuccess}
            editIssue={issue}
            onDone={async () => {
              await onDone()
              const row = await adminFetchIssue(issueId)
              setIssue(row)
            }}
            onCancel={() => navigate('/admin/issues')}
          />
        </TableCard>
      )}
    </PageSection>
  )
}

function IssueEntryKindToggle({
  value,
  onChange,
  disabled,
}: {
  value: IssueEntryKind
  onChange: (next: IssueEntryKind) => void
  disabled?: boolean
}) {
  return (
    <div className="issue-entry-kind-toggle" role="radiogroup" aria-label={issueEntryKindToggleAriaLabel()}>
      <button
        type="button"
        className={'issue-entry-kind-toggle__btn' + (value === 'issue' ? ' issue-entry-kind-toggle__btn--active' : '')}
        disabled={disabled}
        aria-pressed={value === 'issue'}
        onClick={() => onChange('issue')}
      >
        {issueEntryKindBadgeLabel('issue')}
      </button>
      <button
        type="button"
        className={
          'issue-entry-kind-toggle__btn' +
          (value === 'recommendation' ? ' issue-entry-kind-toggle__btn--active' : '')
        }
        disabled={disabled}
        aria-pressed={value === 'recommendation'}
        onClick={() => onChange('recommendation')}
      >
        {issueEntryKindBadgeLabel('recommendation')}
      </button>
    </div>
  )
}

function IssuesIssueViewPage({
  issueId,
  user,
  issues,
  error,
  setError,
  onRefreshIssues,
}: {
  issueId: number
  user: AuthUser
  issues: AdminIssue[]
  error: string | null
  setError: (s: string | null) => void
  onRefreshIssues: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [issue, setIssue] = useState<AdminIssue | null>(null)
  const [loading, setLoading] = useState(true)
  const [reorderBusy, setReorderBusy] = useState(false)

  async function saveIndicatorOrder(next: AdminIssueIndicator[]) {
    if (!issue) return
    setReorderBusy(true)
    setError(null)
    try {
      const updated = await adminReorderIssueIndicators(
        issue.id,
        next.map((ind) => ind.id),
      )
      setIssue(updated)
      await onRefreshIssues()
    } catch (e: unknown) {
      setError(isApiError(e) ? e.message : e instanceof Error ? e.message : 'Could not save indicator order')
    } finally {
      setReorderBusy(false)
    }
  }

  async function setIndicatorActive(indicatorId: number, nextActive: boolean) {
    if (!issue) return
    const label = nextActive ? 'Activate' : 'Deactivate'
    if (!window.confirm(`${label} this indicator? Existing requests keep their data; deactivated indicators are hidden from new requests.`)) {
      return
    }
    setReorderBusy(true)
    setError(null)
    try {
      const updated = await adminSetIssueIndicatorActive(issue.id, indicatorId, nextActive)
      setIssue(updated)
      await onRefreshIssues()
    } catch (e: unknown) {
      setError(isApiError(e) ? e.message : e instanceof Error ? e.message : `${label} failed`)
    } finally {
      setReorderBusy(false)
    }
  }

  useEffect(() => {
    const cached = issues.find((i) => i.id === issueId)
    if (cached) {
      setIssue(cached)
      setLoading(false)
    }
    let cancelled = false
    void adminFetchIssue(issueId)
      .then((row) => {
        if (!cancelled) setIssue(row)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(isApiError(e) ? e.message : 'Load failed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [issueId, issues, setError])

  if (!user || !isSuperAdmin(user)) {
    return <Navigate to="/" replace />
  }

  const kind = issue ? coerceIssueEntryKind(issue.entry_kind) : 'issue'

  return (
    <PageSection
      title={issue ? issueEntryViewPageTitle(kind, issue.id) : 'View entry'}
      leading={
        <WorkflowPageBack to="/admin/issues" label={workflowBackLabel('/admin/issues')} placement="header" />
      }
    >
      {error && (
        <Alert variant="error" title="Error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {loading && <p className="muted">Loadingâ€¦</p>}
      {!loading && !issue && <p className="login-error">Entry not found.</p>}
      {issue && (
        <TableCard padded>
          <IssueDetailReadOnlyPanel
            issue={issue}
            reorderIndicators
            onReorderIndicators={(next) => void saveIndicatorOrder(next)}
            reorderBusy={reorderBusy}
            onSetIndicatorActive={(id, next) => void setIndicatorActive(id, next)}
          />
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" compact onClick={() => navigate('/admin/issues')}>
              Back to list
            </Button>
            <Button
              variant="link"
              dangerLink={issueIsActive(issue)}
              compact
              onClick={() => {
                void toggleIssueActive(issue, onRefreshIssues, setError)
              }}
            >
              {issueIsActive(issue) ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        </TableCard>
      )}
    </PageSection>
  )
}

function IssueIndicatorsDisplayTable({
  issue,
  indicators,
  reorderable,
  onReorder,
  reorderBusy,
  onSetActive,
}: {
  issue: AdminIssue
  indicators: AdminIssueIndicator[]
  reorderable?: boolean
  onReorder?: (next: AdminIssueIndicator[]) => void
  reorderBusy?: boolean
  onSetActive?: (indicatorId: number, isActive: boolean) => void
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  function finishDrag() {
    setDragIndex(null)
    setDropIndex(null)
  }

  function handleDrop(toIndex: number) {
    if (dragIndex == null || !reorderable || !onReorder || reorderBusy) {
      finishDrag()
      return
    }
    onReorder(reorderList(indicators, dragIndex, toIndex))
    finishDrag()
  }

  return (
    <table className="data-table issue-detail-indicators-table">
      <thead>
        <tr>
          {reorderable ? <th className="issue-indicator-order-col" aria-label="Reorder" /> : null}
          <th>Indicator</th>
          <th>Data types</th>
          <th>Disaggregation</th>
          <th>Status</th>
          {onSetActive ? <th>Actions</th> : null}
        </tr>
      </thead>
      <tbody>
        {indicators.map((ind, idx) => {
          const active = ind.is_active !== false
          return (
            <tr
              key={ind.id}
              className={
                (dropIndex === idx ? ' issue-indicator-row--drop-target' : '') +
                (dragIndex === idx ? ' issue-indicator-row--dragging' : '') +
                (!active ? ' issue-indicator-row--inactive' : '')
              }
              draggable={Boolean(reorderable && !reorderBusy && active)}
              onDragStart={() => {
                if (!reorderable || reorderBusy || !active) return
                setDragIndex(idx)
              }}
              onDragEnd={finishDrag}
              onDragOver={(e) => {
                if (!reorderable || reorderBusy || dragIndex == null) return
                e.preventDefault()
                setDropIndex(idx)
              }}
              onDrop={(e) => {
                e.preventDefault()
                handleDrop(idx)
              }}
            >
              {reorderable ? (
                <td className="issue-indicator-order-col">
                  {active ? <DragHandle disabled={reorderBusy} /> : null}
                </td>
              ) : null}
              <td>{ind.indicator_text}</td>
              <td>{indicatorDataTypeLabel(ind, issue)}</td>
              <td>{indicatorDisaggregationLabel(ind)}</td>
              <td>{active ? 'Active' : 'Inactive'}</td>
              {onSetActive ? (
                <td>
                  <Button
                    variant="link"
                    compact
                    dangerLink={active}
                    disabled={reorderBusy}
                    onClick={() => onSetActive(ind.id, !active)}
                  >
                    {active ? 'Deactivate' : 'Activate'}
                  </Button>
                </td>
              ) : null}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function IssueDetailReadOnlyPanel({
  issue,
  reorderIndicators,
  onReorderIndicators,
  reorderBusy,
  onSetIndicatorActive,
}: {
  issue: AdminIssue
  reorderIndicators?: boolean
  onReorderIndicators?: (next: AdminIssueIndicator[]) => void
  reorderBusy?: boolean
  onSetIndicatorActive?: (indicatorId: number, isActive: boolean) => void
}) {
  const kind = coerceIssueEntryKind(issue.entry_kind)
  const activeIndicators = issue.indicators.filter((ind) => ind.is_active !== false)
  const inactiveIndicators = issue.indicators.filter((ind) => ind.is_active === false)
  return (
    <div className="issue-detail-readonly">
      <dl className="issue-detail-readonly__grid">
        <div>
          <dt>Type</dt>
          <dd>{issueEntryKindBadgeLabel(kind)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{issueStatusLabel(issue)}</dd>
        </div>
        <div>
          <dt>Convention</dt>
          <dd>{issueConventionLabel(issue)}</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>{issue.category?.name ?? issue.category_id}</dd>
        </div>
        {issueEntryFormShowsTitleField(kind) ? (
          <div className="issue-detail-readonly__full">
            <dt>{issueEntryTitleFieldLabel(kind)}</dt>
            <dd>{issue.issue_title}</dd>
          </div>
        ) : null}
        <div className="issue-detail-readonly__full">
          <dt>{issueEntryDescriptionFieldLabel(kind)}</dt>
          <dd style={{ whiteSpace: 'pre-wrap' }}>{issue.description?.trim() || '—'}</dd>
        </div>
        <div className="issue-detail-readonly__full">
          <dt>Articles</dt>
          <dd>
            {issue.articles.length === 0 ? (
              '—'
            ) : (
              <ul className="issues-mapping-indicator-list issues-article-detail-list">
                {issue.articles.map((a) => (
                  <li key={a.id}>
                    <strong>{a.article_name}</strong>
                    {a.description?.trim() ? (
                      <p className="muted text-compact" style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>
                        {a.description.trim()}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
      <h4 className="font-semibold text-compact" style={{ margin: '20px 0 10px' }}>
        Indicators
      </h4>
      {reorderIndicators && activeIndicators.length > 1 ? (
        <p className="text-muted text-compact" style={{ margin: '0 0 10px' }}>
          Drag rows to set indicator order.{reorderBusy ? ' Saving…' : ''}
        </p>
      ) : null}
      {activeIndicators.length === 0 ? (
        <p className="muted text-compact">No active indicators</p>
      ) : (
        <IssueIndicatorsDisplayTable
          issue={issue}
          indicators={activeIndicators}
          reorderable={reorderIndicators}
          onReorder={onReorderIndicators}
          reorderBusy={reorderBusy}
          onSetActive={onSetIndicatorActive}
        />
      )}
      {inactiveIndicators.length > 0 ? (
        <>
          <h4 className="font-semibold text-compact" style={{ margin: '20px 0 10px' }}>
            Inactive indicators
          </h4>
          <p className="text-muted text-compact" style={{ margin: '0 0 10px' }}>
            Hidden from new requests. Existing request and response data is preserved.
          </p>
          <IssueIndicatorsDisplayTable
            issue={issue}
            indicators={inactiveIndicators}
            reorderable={false}
            reorderBusy={reorderBusy}
            onSetActive={onSetIndicatorActive}
          />
        </>
      ) : null}
    </div>
  )
}

function IssuesArticleViewPage({
  articleId,
  articles,
  conventions,
  user,
  error,
  setError,
}: {
  articleId: number
  articles: AdminArticleRow[]
  conventions: AdminConvention[]
  user: AuthUser
  error: string | null
  setError: (s: string | null) => void
}) {
  const article = articles.find((a) => a.id === articleId) ?? null

  if (!user || !isSuperAdmin(user)) {
    return <Navigate to="/" replace />
  }

  return (
    <PageSection
      title={article ? article.article_name : 'View article'}
      leading={
        <WorkflowPageBack
          to="/admin/issues/articles"
          label="Back to article list"
          placement="header"
        />
      }
    >
      {error && (
        <Alert variant="error" title="Error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {!article ? (
        <p className="login-error">Article not found.</p>
      ) : (
        <TableCard padded>
          <div className="issue-detail-readonly">
            <div className="form-row">
              <span className="issue-detail-readonly__label">Convention</span>
              <p style={{ margin: 0 }}>
                {article ? articleConventionLabel(article, conventions) : 'â€”'}
              </p>
            </div>
            <div className="form-row">
              <span className="issue-detail-readonly__label">Description</span>
              <p className="issue-detail-readonly__prose" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {article.description?.trim() || 'â€”'}
              </p>
            </div>
          </div>
        </TableCard>
      )}
    </PageSection>
  )
}
