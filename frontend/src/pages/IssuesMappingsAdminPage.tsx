import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Navigate, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  adminCreateArticle,
  adminCreateIssue,
  adminCreateCollectionGender,
  adminCreateCollectionYear,
  adminCreateIssueCategory,
  adminDeleteArticle,
  adminDeleteCollectionGender,
  adminDeleteCollectionYear,
  adminDeleteIssue,
  adminDeleteIssueCategory,
  adminFetchArticles,
  adminFetchCollectionGenders,
  adminFetchCollectionYears,
  adminFetchConventions,
  adminFetchIssue,
  adminFetchIssueCategories,
  adminFetchIssues,
  adminUpdateArticle,
  adminUpdateCollectionGender,
  adminUpdateCollectionYear,
  adminUpdateIssue,
  adminUpdateIssueCategory,
  type AdminArticleRow,
  type AdminCollectionGender,
  type AdminCollectionYear,
  type AdminConvention,
  type AdminIssue,
  type AdminIssueCategory,
} from '../api/admin'
import { isApiError } from '../api/apiError'
import { useAuth } from '../auth/AuthContext'
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
import { TableCard } from '../components/ui/TableCard'
import { TableToolbar } from '../components/ui/TableToolbar'
import { WorkflowPageBack } from '../components/WorkflowPageBack'
import { workflowBackLabel } from '../lib/workflowNavigation'
import { derivePaginatedRows, useClientTableState } from '../hooks/useClientTableState'
import {
  coerceIssueEntryKind,
  issueEntryKindBadgeLabel,
  issueEntryKindToggleAriaLabel,
  issueEntryTitleColumnLabel,
  issueEntryTitleFieldLabel,
  issueEntryViewPageTitle,
  issuesCreateTabLabel,
  issuesEmptyListHint,
  issuesListTabLabel,
  type IssueEntryKind,
} from '../lib/issueEntryKind'
import { isSuperAdmin } from '../lib/roles'
import type { AuthUser } from '../types/auth'

const ISSUES_PAGE_SIZE = 10

type IssuesView = 'list' | 'create' | 'categories' | 'articles' | 'years' | 'genders'

const ISSUES_TABS: { view: IssuesView; to: string; label: string; end?: boolean }[] = [
  { view: 'list', to: '/admin/issues', label: issuesListTabLabel(), end: true },
  { view: 'create', to: '/admin/issues/create', label: issuesCreateTabLabel() },
  { view: 'categories', to: '/admin/issues/categories', label: 'Category list' },
  { view: 'articles', to: '/admin/issues/articles', label: 'Article list' },
  { view: 'years', to: '/admin/issues/years', label: 'Year list' },
  { view: 'genders', to: '/admin/issues/genders', label: 'Gender list' },
]

function resolveIssuesView(param: string | undefined): IssuesView | null {
  if (!param) return 'list'
  if (
    param === 'list' ||
    param === 'create' ||
    param === 'categories' ||
    param === 'articles' ||
    param === 'years' ||
    param === 'genders'
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
  const refreshLookups = useCallback(async () => {
    const [conv, cat, art, years, genders] = await Promise.all([
      adminFetchConventions(),
      adminFetchIssueCategories(),
      adminFetchArticles(),
      adminFetchCollectionYears(),
      adminFetchCollectionGenders(),
    ])
    setConventions(conv)
    setCategories(cat)
    setArticles(art)
    setCollectionYears(years)
    setCollectionGenders(genders)
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
        user={user}
        error={error}
        setError={setError}
      />
    )
  }

  if (editIssueId != null) {
    return (
      <IssuesEditPage
        issueId={editIssueId}
        user={user}
        conventions={conventions}
        categories={categories}
        articles={articles}
        collectionYears={collectionYears}
        collectionGenders={collectionGenders}
        busy={busy}
        setBusy={setBusy}
        setError={setError}
        error={error}
        onRefreshIssues={refreshIssues}
        onRefreshLookups={refreshLookups}
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

      <nav className="issues-admin-tabs compiled-record-modal-tabs" aria-label="Issues and mappings sections">
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
            categories={categories}
            articles={articles}
            collectionYears={collectionYears}
            collectionGenders={collectionGenders}
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
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onRefresh={refreshLookups}
        />
      )}

      {view === 'articles' && (
        <IssuesArticlesSection
          articles={articles}
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
    </div>
  )
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
  const { search, setSearch, page, setPage, pageSize } = useClientTableState({ pageSize: ISSUES_PAGE_SIZE })

  const sortedIssues = useMemo(() => [...issues].sort((a, b) => b.id - a.id), [issues])

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sortedIssues
    return sortedIssues.filter((i) => {
      const convCode = (i.convention?.code ?? '').toLowerCase()
      const convName = (i.convention?.name ?? '').toLowerCase()
      const arts = i.articles.map((a) => a.article_name).join(' ').toLowerCase()
      const cat = (i.category?.name ?? String(i.category_id)).toLowerCase()
      return (
        String(i.id).includes(q) ||
        i.issue_title.toLowerCase().includes(q) ||
        convCode.includes(q) ||
        convName.includes(q) ||
        arts.includes(q) ||
        cat.includes(q)
      )
    })
  }, [sortedIssues, search])

  const { pageRows } = derivePaginatedRows(processed, page, pageSize)

  return (
    <>

      <TableToolbar className="issues-list-toolbar">
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
                <th>Convention</th>
                <th>Articles</th>
                <th>Category</th>
                <th className="issues-mapping-table__issue-col">
                  <span className="issues-mapping-table__issue-col-title">{issueEntryTitleColumnLabel()}</span>
                  <span className="issues-mapping-table__kind-legend">
                    <span className="issues-mapping-table__kind-legend-item issues-mapping-table__kind-legend-item--issue">
                      Issue
                    </span>
                    <span className="issues-mapping-table__kind-legend-item issues-mapping-table__kind-legend-item--recommendation">
                      Recommendation
                    </span>
                  </span>
                </th>
                <th className="issues-mapping-table__actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <EmptyStateRow
                  colSpan={5}
                  message={
                    search.trim()
                      ? 'No entries match your search.'
                      : issuesEmptyListHint()
                  }
                />
              ) : (
                pageRows.map((i) => {
                  const entryKind = coerceIssueEntryKind(i.entry_kind ?? 'issue')
                  return (
                  <tr
                    key={i.id}
                    className={`issues-mapping-table__row issues-mapping-table__row--${entryKind}`}
                    title={issueEntryKindBadgeLabel(entryKind)}
                  >
                    <td className="text-compact issues-mapping-table__convention">{issueConventionLabel(i)}</td>
                    <td className="text-compact issues-mapping-table__articles">
                      {i.articles.map((a) => a.article_name).join(', ') || 'None'}
                    </td>
                    <td className="issues-mapping-table__category">{i.category?.name ?? i.category_id}</td>
                    <td
                      className="issues-mapping-table__issue"
                      aria-label={`${issueEntryKindBadgeLabel(entryKind)}: ${i.issue_title}`}
                    >
                      {i.issue_title}
                    </td>
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
                          dangerLink
                          onClick={() => {
                            void (async () => {
                              try {
                                await adminDeleteIssue(i.id)
                                await onRefreshIssues()
                              } catch (e: unknown) {
                                setError(isApiError(e) ? e.message : 'Delete failed')
                              }
                            })()
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
  busy,
  setBusy,
  setError,
  onRefresh,
}: {
  categories: AdminIssueCategory[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onRefresh: () => Promise<void>
}) {
  const [newCategory, setNewCategory] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')
  const { search, setSearch, page, setPage, pageSize } = useClientTableState({ pageSize: ISSUES_PAGE_SIZE })

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => b.id - a.id), [categories])

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sortedCategories
    return sortedCategories.filter(
      (c) => c.name.toLowerCase().includes(q) || String(c.id).includes(q),
    )
  }, [sortedCategories, search])

  const { pageRows } = derivePaginatedRows(processed, page, pageSize)

  return (
    <div className="issues-catalog-page">
      <div style={{ marginBottom: 16 }}>
        <TableCard padded>
          <div className="issues-catalog-add-form">
            <FormField label="Category name">
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g. Thematic"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </FormField>
            <div className="issues-catalog-add-form__actions">
              <Button
                variant="primary"
                compact
                disabled={busy || !newCategory.trim()}
                onClick={() => {
                  void (async () => {
                    setBusy(true)
                    setError(null)
                    try {
                      await adminCreateIssueCategory({ name: newCategory.trim() })
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
        <input
          type="search"
          placeholder="Search ID or category name..."
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
          <IssuesCatalogTableColgroup />
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th className="table-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <EmptyStateRow
                colSpan={3}
                message={search.trim() ? 'No categories match your search.' : 'No categories yet.'}
              />
              ) : (
                pageRows.map((c) => (
                  <tr key={c.id} className={editingCategoryId === c.id ? 'catalog-table-row-editing' : undefined}>
                    <td>{c.id}</td>
                    <td>
                      {editingCategoryId === c.id ? (
                        <input
                          className="catalog-inline-edit-input"
                          value={editCategoryName}
                          onChange={(e) => setEditCategoryName(e.target.value)}
                          aria-label="Category name"
                        />
                      ) : (
                        c.name
                      )}
                    </td>
                    <td className="table-actions">
                      {editingCategoryId === c.id ? (
                        <CatalogInlineEditActions
                          busy={busy}
                          saveDisabled={!editCategoryName.trim()}
                          onCancel={() => setEditingCategoryId(null)}
                          onSave={() => {
                            void (async () => {
                              setBusy(true)
                              setError(null)
                              try {
                                await adminUpdateIssueCategory(c.id, { name: editCategoryName.trim() })
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
                      ) : (
                        <ActionMenu>
                          <Button
                            variant="link"
                            compact
                            disabled={busy}
                            onClick={() => {
                              setEditingCategoryId(c.id)
                              setEditCategoryName(c.name)
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="link"
                            compact
                            dangerLink
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm(`Delete category "${c.name}"?`)) return
                              void (async () => {
                                setBusy(true)
                                setError(null)
                                try {
                                  await adminDeleteIssueCategory(c.id)
                                  await onRefresh()
                                } catch (e: unknown) {
                                  setError(isApiError(e) ? e.message : 'Delete failed')
                                } finally {
                                  setBusy(false)
                                }
                              })()
                            }}
                          >
                            Delete
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


function IssuesArticlesSection({
  articles,
  busy,
  setBusy,
  setError,
  onRefresh,
}: {
  articles: AdminArticleRow[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onRefresh: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [newArticle, setNewArticle] = useState('')
  const [newArticleDescription, setNewArticleDescription] = useState('')
  const [editingArticleId, setEditingArticleId] = useState<number | null>(null)
  const [editArticleName, setEditArticleName] = useState('')
  const [editArticleDescription, setEditArticleDescription] = useState('')
  const { search, setSearch, page, setPage, pageSize } = useClientTableState({ pageSize: ISSUES_PAGE_SIZE })

  const sortedArticles = useMemo(() => [...articles].sort((a, b) => b.id - a.id), [articles])

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sortedArticles
    return sortedArticles.filter(
      (a) =>
        a.article_name.toLowerCase().includes(q) ||
        (a.description ?? '').toLowerCase().includes(q) ||
        String(a.id).includes(q),
    )
  }, [sortedArticles, search])

  const { pageRows } = derivePaginatedRows(processed, page, pageSize)

  return (
    <div className="issues-catalog-page">
      <div style={{ marginBottom: 16 }}>
      <TableCard padded>
        <div className="issues-catalog-add-form">
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
              placeholder="Optional description shown on federal and other portals…"
              disabled={busy}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </FormField>
          <div className="issues-catalog-add-form__actions">
            <Button
              variant="primary"
              compact
              disabled={busy || !newArticle.trim()}
              onClick={() => {
                void (async () => {
                  setBusy(true)
                  setError(null)
                  try {
                    await adminCreateArticle({
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
        <input
          type="search"
          placeholder="Search ID, name, or description..."
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
          <IssuesCatalogTableColgroup />
          <thead>
            <tr>
              <th>ID</th>
              <th>Article name</th>
              <th className="table-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <EmptyStateRow
                colSpan={3}
                message={search.trim() ? 'No articles match your search.' : 'No articles yet.'}
              />
              ) : (
                pageRows.map((a) => {
                  if (editingArticleId === a.id) {
                    return (
                      <tr key={a.id} className="catalog-table-edit-row">
                        <td colSpan={3}>
                          <div className="catalog-inline-edit">
                            <p className="catalog-inline-edit__meta muted small">ID {a.id}</p>
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
                              saveDisabled={!editArticleName.trim()}
                              onCancel={() => setEditingArticleId(null)}
                              onSave={() => {
                                void (async () => {
                                  setBusy(true)
                                  setError(null)
                                  try {
                                    await adminUpdateArticle(a.id, {
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
                    <tr key={a.id}>
                      <td>{a.id}</td>
                      <td>{a.article_name}</td>
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
                              setEditArticleName(a.article_name)
                              setEditArticleDescription(a.description ?? '')
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="link"
                            compact
                            dangerLink
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm(`Delete article "${a.article_name}"?`)) return
                              void (async () => {
                                setBusy(true)
                                setError(null)
                                try {
                                  await adminDeleteArticle(a.id)
                                  await onRefresh()
                                } catch (e: unknown) {
                                  setError(isApiError(e) ? e.message : 'Delete failed')
                                } finally {
                                  setBusy(false)
                                }
                              })()
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
  const { search, setSearch, page, setPage, pageSize } = useClientTableState({ pageSize: ISSUES_PAGE_SIZE })

  const sorted = useMemo(() => [...years].sort((a, b) => b.id - a.id), [years])

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((y) => y.label.toLowerCase().includes(q) || String(y.id).includes(q))
  }, [sorted, search])

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
              <th>ID</th>
              <th>Year</th>
              <th className="table-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <EmptyStateRow
                colSpan={3}
                message={search.trim() ? 'No years match your search.' : 'No years yet.'}
              />
              ) : (
                pageRows.map((y) => (
                  <tr key={y.id} className={editingId === y.id ? 'catalog-table-row-editing' : undefined}>
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
                            dangerLink
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm(`Delete year "${y.label}"?`)) return
                              void (async () => {
                                setBusy(true)
                                setError(null)
                                try {
                                  await adminDeleteCollectionYear(y.id)
                                  await onRefresh()
                                } catch (e: unknown) {
                                  setError(isApiError(e) ? e.message : 'Delete failed')
                                } finally {
                                  setBusy(false)
                                }
                              })()
                            }}
                          >
                            Delete
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
  const { search, setSearch, page, setPage, pageSize } = useClientTableState({ pageSize: ISSUES_PAGE_SIZE })

  const sorted = useMemo(() => [...genders].sort((a, b) => b.id - a.id), [genders])

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((g) => g.name.toLowerCase().includes(q) || String(g.id).includes(q))
  }, [sorted, search])

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
              <th>ID</th>
              <th>Gender</th>
              <th className="table-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <EmptyStateRow
                colSpan={3}
                message={search.trim() ? 'No genders match your search.' : 'No genders yet.'}
              />
              ) : (
                pageRows.map((g) => (
                  <tr key={g.id} className={editingId === g.id ? 'catalog-table-row-editing' : undefined}>
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
                            dangerLink
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm(`Delete gender "${g.name}"?`)) return
                              void (async () => {
                                setBusy(true)
                                setError(null)
                                try {
                                  await adminDeleteCollectionGender(g.id)
                                  await onRefresh()
                                } catch (e: unknown) {
                                  setError(isApiError(e) ? e.message : 'Delete failed')
                                } finally {
                                  setBusy(false)
                                }
                              })()
                            }}
                          >
                            Delete
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
  return parts.length > 0 ? parts.join(' · ') : '—'
}

/** Year → gender mapping or free-text disaggregation field. */
function indicatorDisaggregationLabel(ind: AdminIssue['indicators'][number]): string {
  if (ind.collects_by_year && (ind.collection_by_year?.length ?? 0) > 0) {
    if (!ind.collects_by_gender) {
      return ind.collection_by_year.map((y) => y.label).join('; ')
    }
    return ind.collection_by_year
      .map((y) => {
        const genders = (y.genders ?? []).map((g) => g.name).filter(Boolean)
        return `${y.label}: ${genders.length > 0 ? genders.join(', ') : '—'}`
      })
      .join('; ')
  }
  const text = ind.disaggregation?.trim()
  return text || '—'
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

function IssuesCatalogTableColgroup() {
  return (
    <colgroup>
      <col className="issues-catalog-table__col-id" />
      <col />
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
type IndicatorYearGenderRow = {
  year_id: number
  gender_ids: number[]
}

type IndicatorCollectionMode = 'none' | 'year' | 'year_gender'

type IndicatorDraft = {
  indicator_text: string
  collects_quantitative: boolean
  collects_qualitative: boolean
  collection_mode: IndicatorCollectionMode
  year_ids: number[]
  year_gender_rows: IndicatorYearGenderRow[]
}

function emptyIndicator(): IndicatorDraft {
  return {
    indicator_text: '',
    collects_quantitative: false,
    collects_qualitative: true,
    collection_mode: 'none',
    year_ids: [],
    year_gender_rows: [],
  }
}

function indicatorDraftFromApi(
  ind: AdminIssue['indicators'][number],
  issue: AdminIssue,
): IndicatorDraft {
  const legacyRow = !ind.has_quantitative && !ind.has_qualitative
  const collectsByYear = ind.collects_by_year ?? false
  const collectsByGender =
    ind.collects_by_gender ??
    (collectsByYear &&
      (ind.collection_by_year ?? []).some(
        (y) => (y.gender_ids?.length ?? y.genders?.length ?? 0) > 0,
      ))
  let collection_mode: IndicatorCollectionMode = 'none'
  if (collectsByYear) {
    collection_mode = collectsByGender ? 'year_gender' : 'year'
  }
  return {
    indicator_text: ind.indicator_text,
    collects_quantitative: legacyRow ? issue.has_quantitative : ind.has_quantitative,
    collects_qualitative: legacyRow ? issue.has_qualitative : ind.has_qualitative,
    collection_mode,
    year_ids: collectsByYear && !collectsByGender
      ? (ind.collection_by_year ?? []).map((y) => y.year_id)
      : [],
    year_gender_rows: collectsByYear && collectsByGender
      ? (ind.collection_by_year ?? []).map((y) => ({
          year_id: y.year_id,
          gender_ids: [...(y.gender_ids ?? [])],
        }))
      : [],
  }
}

function validateIndicatorDataTypes(rows: IndicatorDraft[]): string | null {
  const filled = rows.filter((x) => x.indicator_text.trim())
  for (const x of filled) {
    if (!x.collects_quantitative && !x.collects_qualitative) {
      return 'Each indicator must have Quantitative and/or Qualitative selected.'
    }
    if (x.collection_mode === 'year' && x.year_ids.length === 0) {
      return 'Add at least one year when collecting by year only.'
    }
    if (x.collection_mode === 'year_gender' && x.year_gender_rows.length === 0) {
      return 'Add at least one year when collecting by year and gender.'
    }
    for (const yRow of x.year_gender_rows) {
      if (yRow.gender_ids.length === 0) {
        return 'Each selected year must have at least one gender.'
      }
    }
  }
  return null
}

function indicatorToPayload(x: IndicatorDraft) {
  const collectsByYear = x.collection_mode !== 'none'
  const collectsByGender = x.collection_mode === 'year_gender'
  return {
    indicator_text: x.indicator_text.trim(),
    disaggregation: null,
    has_quantitative: x.collects_quantitative,
    has_qualitative: x.collects_qualitative,
    collects_by_year: collectsByYear,
    collects_by_gender: collectsByGender,
    collection_by_year: collectsByYear
      ? x.collection_mode === 'year'
        ? x.year_ids.map((yearId) => ({
            collection_year_id: yearId,
            collection_gender_ids: [] as number[],
          }))
        : x.year_gender_rows.map((row) => ({
            collection_year_id: row.year_id,
            collection_gender_ids: row.gender_ids,
          }))
      : [],
  }
}

function IndicatorYearGenderMapper({
  rows,
  onChange,
  collectionYears,
  collectionGenders,
  disabled,
}: {
  rows: IndicatorYearGenderRow[]
  onChange: (rows: IndicatorYearGenderRow[]) => void
  collectionYears: AdminCollectionYear[]
  collectionGenders: AdminCollectionGender[]
  disabled?: boolean
}) {
  const sortedYears = useMemo(
    () => [...collectionYears].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)),
    [collectionYears],
  )
  const sortedGenders = useMemo(
    () => [...collectionGenders].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [collectionGenders],
  )
  const usedYearIds = new Set(rows.map((r) => r.year_id))
  const availableYears = sortedYears.filter((y) => !usedYearIds.has(y.id))

  const yearLabel = (yearId: number) => sortedYears.find((y) => y.id === yearId)?.label ?? `Year #${yearId}`

  return (
    <div className="issue-indicator-year-gender-map">
      {rows.map((row) => (
        <div key={row.year_id} className="issue-indicator-year-gender-map__year">
          <div className="issue-indicator-year-gender-map__year-head">
            <strong className="text-compact">{yearLabel(row.year_id)}</strong>
            <Button
              variant="link"
              compact
              dangerLink
              disabled={disabled}
              onClick={() => onChange(rows.filter((r) => r.year_id !== row.year_id))}
            >
              Remove year
            </Button>
          </div>
          <CatalogIdCheckboxList
            label={`Genders for ${yearLabel(row.year_id)}`}
            items={sortedGenders}
            labelKey="name"
            selectedIds={row.gender_ids}
            disabled={disabled}
            onChange={(gender_ids) => {
              onChange(rows.map((r) => (r.year_id === row.year_id ? { ...r, gender_ids } : r)))
            }}
          />
        </div>
      ))}
      {availableYears.length > 0 ? (
        <FormControl label="Add year">
          <select
            value=""
            disabled={disabled}
            onChange={(e) => {
              const yearId = Number(e.target.value)
              if (!yearId) return
              onChange([...rows, { year_id: yearId, gender_ids: [] }])
            }}
          >
            <option value="">Select a year to configure genders…</option>
            {availableYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
              </option>
            ))}
          </select>
        </FormControl>
      ) : (
        sortedYears.length === 0 && (
          <p className="text-muted text-compact" style={{ margin: 0 }}>
            No years in catalog — add entries under Year list.
          </p>
        )
      )}
    </div>
  )
}

function IndicatorYearOnlyPicker({
  yearIds,
  onChange,
  collectionYears,
  disabled,
}: {
  yearIds: number[]
  onChange: (ids: number[]) => void
  collectionYears: AdminCollectionYear[]
  disabled?: boolean
}) {
  const sortedYears = useMemo(
    () => [...collectionYears].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)),
    [collectionYears],
  )

  if (sortedYears.length === 0) {
    return (
      <p className="text-muted text-compact" style={{ margin: 0 }}>
        No years in catalog — add entries under Year list.
      </p>
    )
  }

  return (
    <CatalogIdCheckboxList
      label="Years"
      items={sortedYears}
      labelKey="label"
      selectedIds={yearIds}
      disabled={disabled}
      onChange={onChange}
    />
  )
}

function CatalogIdCheckboxList({
  label,
  items,
  labelKey,
  selectedIds,
  onChange,
  disabled,
}: {
  label: string
  items: { id: number; label?: string; name?: string }[]
  labelKey: 'label' | 'name'
  selectedIds: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
}) {
  if (items.length === 0) {
    return (
      <p className="text-muted text-compact" style={{ margin: '4px 0 0' }}>
        No {label.toLowerCase()} in catalog — add entries under {label} list.
      </p>
    )
  }
  return (
    <div className="issue-indicator-catalog-checks" role="group" aria-label={label}>
      {items.map((item) => {
        const text = labelKey === 'label' ? item.label : item.name
        const checked = selectedIds.includes(item.id)
        return (
          <label key={item.id} className="checkbox-label issue-indicator-catalog-checks__item">
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => {
                onChange(
                  checked ? selectedIds.filter((id) => id !== item.id) : [...selectedIds, item.id],
                )
              }}
            />
            <span>{text}</span>
          </label>
        )
      })}
    </div>
  )
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
  collectionYears,
  collectionGenders,
  disabled,
}: {
  rows: IndicatorDraft[]
  onChange: (rows: IndicatorDraft[]) => void
  collectionYears: AdminCollectionYear[]
  collectionGenders: AdminCollectionGender[]
  disabled?: boolean
}) {
  const sortedYears = useMemo(
    () => [...collectionYears].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)),
    [collectionYears],
  )
  const sortedGenders = useMemo(
    () => [...collectionGenders].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [collectionGenders],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.length === 0 && (
        <p className="text-muted text-compact" style={{ margin: 0 }}>
          No indicators for this issue yet. Add one or leave empty.
        </p>
      )}
      {rows.map((row, idx) => (
        <div key={idx} className="issue-indicator-card">
          <FormRow twoCol>
            <FormControl label="Indicator text">
              <input
                placeholder="Indicator text"
                value={row.indicator_text}
                disabled={disabled}
                onChange={(e) => {
                  const next = [...rows]
                  next[idx] = { ...row, indicator_text: e.target.value }
                  onChange(next)
                }}
              />
            </FormControl>
            <FormControl label="Response data type (Q/L)">
              <div className="issue-indicator-type-checks">
                <label className="checkbox-label issue-indicator-type-checks__item">
                  <input
                    type="checkbox"
                    checked={row.collects_quantitative}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...rows]
                      next[idx] = { ...row, collects_quantitative: e.target.checked }
                      onChange(next)
                    }}
                  />
                  Quantitative
                </label>
                <label className="checkbox-label issue-indicator-type-checks__item">
                  <input
                    type="checkbox"
                    checked={row.collects_qualitative}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...rows]
                      next[idx] = { ...row, collects_qualitative: e.target.checked }
                      onChange(next)
                    }}
                  />
                  Qualitative
                </label>
              </div>
            </FormControl>
          </FormRow>
          <div className="issue-indicator-collection-checks">
            <label className="checkbox-label issue-indicator-collection-checks__item">
              <input
                type="checkbox"
                checked={row.collection_mode === 'year'}
                disabled={disabled}
                onChange={(e) => {
                  const next = [...rows]
                  next[idx] = {
                    ...row,
                    collection_mode: e.target.checked ? 'year' : 'none',
                    year_ids: e.target.checked ? row.year_ids : [],
                    year_gender_rows: [],
                  }
                  onChange(next)
                }}
              />
              Collect by year only
            </label>
            <label className="checkbox-label issue-indicator-collection-checks__item">
              <input
                type="checkbox"
                checked={row.collection_mode === 'year_gender'}
                disabled={disabled}
                onChange={(e) => {
                  const next = [...rows]
                  next[idx] = {
                    ...row,
                    collection_mode: e.target.checked ? 'year_gender' : 'none',
                    year_ids: [],
                    year_gender_rows: e.target.checked ? row.year_gender_rows : [],
                  }
                  onChange(next)
                }}
              />
              Collect by year and gender
            </label>
          </div>
          {row.collection_mode === 'year' ? (
            <IndicatorYearOnlyPicker
              yearIds={row.year_ids}
              collectionYears={sortedYears}
              disabled={disabled}
              onChange={(year_ids) => {
                const next = [...rows]
                next[idx] = { ...row, year_ids }
                onChange(next)
              }}
            />
          ) : null}
          {row.collection_mode === 'year_gender' ? (
            <IndicatorYearGenderMapper
              rows={row.year_gender_rows}
              collectionYears={sortedYears}
              collectionGenders={sortedGenders}
              disabled={disabled}
              onChange={(year_gender_rows) => {
                const next = [...rows]
                next[idx] = { ...row, year_gender_rows }
                onChange(next)
              }}
            />
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="link" compact dangerLink disabled={disabled} onClick={() => onChange(rows.filter((_, i) => i !== idx))}>
              Remove indicator
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
  onDone,
  onCancel,
}: {
  conventions: AdminConvention[]
  categories: AdminIssueCategory[]
  articles: AdminArticleRow[]
  collectionYears: AdminCollectionYear[]
  collectionGenders: AdminCollectionGender[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onDone: () => Promise<void>
  onCancel: () => void
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

  return (
    <div className="issues-create-form">
      <div className="issues-create-form__kind">
        <IssueEntryKindToggle value={entryKind} onChange={setEntryKind} disabled={busy} />
      </div>
      <FormGrid>
        <div className="issues-form-top-grid">
          <FormControl label="Convention">
            <select value={conventionId} onChange={(e) => setConventionId(e.target.value)}>
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
              articles={sortedArticles}
              selectedIds={selectedArticleIds}
              onChange={setSelectedArticleIds}
              disabled={busy}
            />
          </FormControl>
          <FormControl label="Category">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormControl>
        </div>
        <FormField label={issueEntryTitleFieldLabel(entryKind)}>
          <input
            placeholder={issueEntryTitleFieldLabel(entryKind)}
            value={issueTitle}
            onChange={(e) => setIssueTitle(e.target.value)}
          />
        </FormField>
        <FormField label="Description">
          <textarea
            className="issues-description-field"
            placeholder={`Optional longer description for this ${entryKind}...`}
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            disabled={busy}
            rows={10}
          />
        </FormField>
      </FormGrid>
      <strong className="font-semibold text-compact" style={{ display: 'block', marginTop: 16 }}>
        Indicators (linked to this {entryKind})
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
          disabled={busy || !conventionId || !categoryId || !issueTitle.trim() || selectedArticleIds.length === 0}
          onClick={() => {
            void (async () => {
              setBusy(true)
              setError(null)
              try {
                const typeErr = validateIndicatorDataTypes(indicators)
                if (typeErr) {
                  setError(typeErr)
                  return
                }
                const filled = indicators.filter((x) => x.indicator_text.trim())
                const indPayload = filled.map((x) => indicatorToPayload(x))
                const hasQuantitative = filled.some((x) => x.collects_quantitative)
                const hasQualitative = filled.some((x) => x.collects_qualitative)
                await adminCreateIssue({
                  convention_id: Number(conventionId),
                  category_id: Number(categoryId),
                  entry_kind: entryKind,
                  issue_title: issueTitle.trim(),
                  description: issueDescription.trim() || null,
                  has_quantitative: hasQuantitative,
                  has_qualitative: hasQualitative,
                  articles: selectedArticleIds.map((articleId) => ({ article_id: articleId })),
                  indicators: indPayload.length ? indPayload : undefined,
                })
                setEntryKind('issue')
                setConventionId('')
                setCategoryId('')
                setIssueTitle('')
                setIssueDescription('')
                setSelectedArticleIds([])
                setIndicators([])
                await onDone()
              } catch (e: unknown) {
                setError(isApiError(e) ? e.message : 'Save failed')
              } finally {
                setBusy(false)
              }
            })()
          }}
        >
          Save {issueEntryKindBadgeLabel(entryKind)}
        </Button>
      </div>
    </div>
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
        Issue
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
        Recommendation
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
      {loading && <p className="muted">Loading…</p>}
      {!loading && !issue && <p className="login-error">Entry not found.</p>}
      {issue && (
        <TableCard padded>
          <IssueDetailReadOnlyPanel issue={issue} />
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" compact onClick={() => navigate('/admin/issues')}>
              Back to list
            </Button>
            <Button variant="primary" compact onClick={() => navigate(`/admin/issues/edit/${issue.id}`)}>
              Edit
            </Button>
            <Button
              variant="link"
              dangerLink
              compact
              onClick={() => {
                if (!window.confirm(`Delete this ${kind}?`)) return
                void (async () => {
                  try {
                    await adminDeleteIssue(issue.id)
                    await onRefreshIssues()
                    navigate('/admin/issues')
                  } catch (e: unknown) {
                    setError(isApiError(e) ? e.message : 'Delete failed')
                  }
                })()
              }}
            >
              Delete
            </Button>
          </div>
        </TableCard>
      )}
    </PageSection>
  )
}

function IssueDetailReadOnlyPanel({ issue }: { issue: AdminIssue }) {
  const kind = coerceIssueEntryKind(issue.entry_kind)
  return (
    <div className="issue-detail-readonly">
      <dl className="issue-detail-readonly__grid">
        <div>
          <dt>Type</dt>
          <dd>{issueEntryKindBadgeLabel(kind)}</dd>
        </div>
        <div>
          <dt>Convention</dt>
          <dd>{issueConventionLabel(issue)}</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>{issue.category?.name ?? issue.category_id}</dd>
        </div>
        <div className="issue-detail-readonly__full">
          <dt>{issueEntryTitleFieldLabel(kind)}</dt>
          <dd>{issue.issue_title}</dd>
        </div>
        <div className="issue-detail-readonly__full">
          <dt>Description</dt>
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
      {issue.indicators.length === 0 ? (
        <p className="muted text-compact">None</p>
      ) : (
        <table className="data-table issue-detail-indicators-table">
          <thead>
            <tr>
              <th>Indicator</th>
              <th>Data types</th>
              <th>Disaggregation</th>
            </tr>
          </thead>
          <tbody>
            {issue.indicators.map((ind) => (
              <tr key={ind.id}>
                <td>{ind.indicator_text}</td>
                <td>{indicatorDataTypeLabel(ind, issue)}</td>
                <td>{indicatorDisaggregationLabel(ind)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function IssuesArticleViewPage({
  articleId,
  articles,
  user,
  error,
  setError,
}: {
  articleId: number
  articles: AdminArticleRow[]
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
              <span className="issue-detail-readonly__label">Description</span>
              <p className="issue-detail-readonly__prose" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {article.description?.trim() || '—'}
              </p>
            </div>
          </div>
        </TableCard>
      )}
    </PageSection>
  )
}

function IssuesEditPage({
  issueId,
  user,
  conventions,
  categories,
  articles,
  collectionYears,
  collectionGenders,
  busy,
  setBusy,
  setError,
  error,
  onRefreshIssues,
  onRefreshLookups,
}: {
  issueId: number
  user: AuthUser | null
  conventions: AdminConvention[]
  categories: AdminIssueCategory[]
  articles: AdminArticleRow[]
  collectionYears: AdminCollectionYear[]
  collectionGenders: AdminCollectionGender[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  error: string | null
  onRefreshIssues: () => Promise<void>
  onRefreshLookups: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [issue, setIssue] = useState<AdminIssue | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
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

  return (
    <PageSection
      title={
        issue
          ? `Edit ${issueEntryKindBadgeLabel(coerceIssueEntryKind(issue.entry_kind))} #${issueId}`
          : `Edit entry #${issueId}`
      }
      leading={
        <WorkflowPageBack to="/admin/issues" label={workflowBackLabel('/admin/issues')} placement="header" />
      }
    >
      {error && (
        <Alert variant="error" title="Error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {loading && <p className="muted">Loading issue…</p>}
      {issue && (
        <TableCard padded>
          <IssuesEditPanel
            issue={issue}
            conventions={conventions}
            categories={categories}
            articles={articles}
            collectionYears={collectionYears}
            collectionGenders={collectionGenders}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            onClose={() => navigate('/admin/issues')}
            onSaved={async () => {
              await Promise.all([onRefreshIssues(), onRefreshLookups()])
              navigate('/admin/issues')
            }}
          />
        </TableCard>
      )}
    </PageSection>
  )
}

function IssuesEditPanel({
  issue,
  conventions,
  categories,
  articles,
  collectionYears,
  collectionGenders,
  busy,
  setBusy,
  setError,
  onClose,
  onSaved,
}: {
  issue: AdminIssue
  conventions: AdminConvention[]
  categories: AdminIssueCategory[]
  articles: AdminArticleRow[]
  collectionYears: AdminCollectionYear[]
  collectionGenders: AdminCollectionGender[]
  busy: boolean
  setBusy: (v: boolean) => void
  setError: (s: string | null) => void
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const sortedArticles = [...articles].sort((a, b) =>
    a.article_name.localeCompare(b.article_name, undefined, { numeric: true, sensitivity: 'base' }),
  )
  const [entryKind, setEntryKind] = useState<IssueEntryKind>(coerceIssueEntryKind(issue.entry_kind))
  const [conventionId, setConventionId] = useState(String(issue.convention_id))
  const [categoryId, setCategoryId] = useState(String(issue.category_id))
  const [issueTitle, setIssueTitle] = useState(issue.issue_title)
  const [issueDescription, setIssueDescription] = useState(issue.description ?? '')
  const [selectedArticleIds, setSelectedArticleIds] = useState<number[]>(issue.article_ids)
  const [indicators, setIndicators] = useState<IndicatorDraft[]>(
    issue.indicators.map((ind) => indicatorDraftFromApi(ind, issue)),
  )

  return (
    <div className="issue-edit-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h4 style={{ margin: 0 }}>
          Edit {issueEntryKindBadgeLabel(entryKind)} #{issue.id}
        </h4>
        <Button variant="link" compact onClick={onClose}>
          Close
        </Button>
      </div>
      <FormControl label="Type">
        <IssueEntryKindToggle value={entryKind} onChange={setEntryKind} disabled={busy} />
      </FormControl>
      <FormGrid>
        <div className="issues-form-top-grid">
          <FormControl label="Convention">
            <select value={conventionId} onChange={(e) => setConventionId(e.target.value)}>
              {conventions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </FormControl>
          <FormControl label="Articles">
            <ArticleMultiSelectDropdown
              articles={sortedArticles}
              selectedIds={selectedArticleIds}
              onChange={setSelectedArticleIds}
              disabled={busy}
            />
          </FormControl>
          <FormControl label="Category">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormControl>
        </div>
        <FormField label={issueEntryTitleFieldLabel(entryKind)}>
          <input
            placeholder={issueEntryTitleFieldLabel(entryKind)}
            value={issueTitle}
            onChange={(e) => setIssueTitle(e.target.value)}
          />
        </FormField>
        <FormField label="Description">
          <textarea
            className="issues-description-field"
            placeholder={`Optional longer description for this ${entryKind}...`}
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            disabled={busy}
            rows={10}
          />
        </FormField>
      </FormGrid>
      <strong className="font-semibold text-compact" style={{ display: 'block', marginTop: 16 }}>
        Indicators (linked to this {entryKind})
      </strong>
      <IssueIndicatorsEditor
        rows={indicators}
        onChange={setIndicators}
        collectionYears={collectionYears}
        collectionGenders={collectionGenders}
        disabled={busy}
      />
      <Button
        variant="primary"
        compact
        style={{ marginTop: 12 }}
        disabled={busy || !conventionId || !categoryId || !issueTitle.trim() || selectedArticleIds.length === 0}
        onClick={() => {
          void (async () => {
            setBusy(true)
            setError(null)
            try {
              const typeErr = validateIndicatorDataTypes(indicators)
              if (typeErr) {
                setError(typeErr)
                return
              }
              const filled = indicators.filter((x) => x.indicator_text.trim())
              const indPayload = filled.map((x) => indicatorToPayload(x))
              const hasQuantitative = filled.some((x) => x.collects_quantitative)
              const hasQualitative = filled.some((x) => x.collects_qualitative)
              await adminUpdateIssue(issue.id, {
                convention_id: Number(conventionId),
                category_id: Number(categoryId),
                entry_kind: entryKind,
                issue_title: issueTitle.trim(),
                description: issueDescription.trim() || null,
                has_quantitative: hasQuantitative,
                has_qualitative: hasQualitative,
                articles: selectedArticleIds.map((articleId) => ({ article_id: articleId })),
                indicators: indPayload,
              })
              await onSaved()
            } catch (e: unknown) {
              setError(isApiError(e) ? e.message : 'Save failed')
            } finally {
              setBusy(false)
            }
          })()
        }}
      >
        Save changes
      </Button>
    </div>
  )
}
