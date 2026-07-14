import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchKnowledgeConventionArticles,
  fetchKnowledgeConventionIssues,
  fetchKnowledgeIssue,
  type KnowledgeConventionArticle,
  type KnowledgeConventionDetail,
  type KnowledgeConventionIssueDetail,
  type KnowledgeConventionIssueRow,
} from '../../api/knowledgeHub'
import { isApiError } from '../../api/apiError'
import { CAT_CONVENTION_OVERVIEW } from '../../data/catConventionOverview'
import { CAT_REPOSITORY_CYCLES } from '../../data/catRepositoryContent'
import {
  coerceIssueEntryKind,
  issueEntryDescriptionFieldLabel,
  issueEntryFormShowsTitleField,
  issueEntryKindBadgeLabel,
  issueEntryLoiTableCellText,
  issueEntryLoiTableTitleLabel,
  issueEntryListShowsTitleColumn,
  issueEntryTitleFieldLabel,
} from '../../lib/issueEntryKind'
import {
  LABEL_CONVENTION_ARTICLES,
  LABEL_OPTIONAL_PROTOCOL,
} from '../../lib/uiLabels'
import { CatTrackerTab } from './CatTrackerTab'
import { Button } from '../ui/Button'
import { TableCard } from '../ui/TableCard'
import {
  KnowledgeHubDetailHeader,
  KnowledgeHubMutedProse,
  KnowledgeHubPage,
  KnowledgeHubPanel,
  KnowledgeHubProse,
  KnowledgeHubTabs,
} from './KnowledgeHubUi'

const CAT_TABS = [
  'Overview',
  'Articles',
  'LOI',
  'Concluding Observations',
  'Repositories',
  'CAT Tracker',
  'Optional Protocol',
] as const

type CatTab = (typeof CAT_TABS)[number]

function issueStatusLabel(issue: KnowledgeConventionIssueRow): string {
  return issue.is_active ? 'Active' : 'Inactive'
}

function indicatorDataTypeLabel(
  ind: KnowledgeConventionIssueDetail['indicators'][number],
  issue: KnowledgeConventionIssueDetail,
): string {
  const legacy = !ind.has_quantitative && !ind.has_qualitative
  const quantitative = legacy ? issue.has_quantitative : Boolean(ind.has_quantitative)
  const qualitative = legacy ? issue.has_qualitative : Boolean(ind.has_qualitative)
  const parts: string[] = []
  if (quantitative) parts.push('Quantitative')
  if (qualitative) parts.push('Qualitative')
  return parts.length > 0 ? parts.join(' · ') : '—'
}

function indicatorDisaggregationLabel(ind: KnowledgeConventionIssueDetail['indicators'][number]): string {
  const parts: string[] = []
  if (ind.has_quantitative !== false && ind.collects_by_year && (ind.collection_by_year?.length ?? 0) > 0) {
    const years = [...(ind.collection_by_year ?? [])]
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
      .map((y) => y.label)
      .join('; ')
    const dims: string[] = []
    if (ind.collects_by_gender) dims.push('Gender')
    if (ind.collects_by_age) dims.push('Age')
    if (ind.collects_by_location) dims.push('Location')
    if (ind.collects_by_disability) dims.push('Disability')
    if (ind.collects_by_religion) dims.push('Religion')
    if (ind.collects_by_others) dims.push('Others')
    parts.push(dims.length === 0 ? `${years} (Quantitative)` : `${years} (${dims.join(', ')})`)
  }
  const qualYears = ind.qualitative_collection_by_year ?? []
  if (ind.has_qualitative && qualYears.length > 0) {
    const years = [...qualYears]
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
      .map((y) => y.label)
      .join('; ')
    parts.push(`${years} (Qualitative)`)
  }
  if (parts.length > 0) return parts.join(' · ')
  return ind.disaggregation?.trim() || '—'
}

function KnowledgeIssueReadOnlyPanel({ issue }: { issue: KnowledgeConventionIssueDetail }) {
  const kind = coerceIssueEntryKind(issue.entry_kind)
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

function ConventionArticlesTab({ conventionId }: { conventionId: number }) {
  const [articles, setArticles] = useState<KnowledgeConventionArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchKnowledgeConventionArticles(conventionId)
      .then((rows) => {
        if (!cancelled) setArticles(rows)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(isApiError(e) ? e.message : 'Could not load articles')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [conventionId])

  if (loading) return <p className="muted">Loading articles…</p>
  if (error) return <p className="login-error">{error}</p>
  if (articles.length === 0) return <p className="muted">No articles are published for this convention.</p>

  return (
    <KnowledgeHubPanel title={LABEL_CONVENTION_ARTICLES}>
      <div className="knowledge-hub-articles-list">
        {articles.map((article, idx) => (
          <details
            key={article.id}
            className="mapping-article-collapse knowledge-hub-articles-list__item"
            open={idx === 0}
          >
            <summary className="mapping-article-collapse__summary">
              <strong>{article.article_name}</strong>
            </summary>
            <div className="mapping-article-collapse__body">
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {article.description?.trim() || 'No description provided.'}
              </p>
            </div>
          </details>
        ))}
      </div>
    </KnowledgeHubPanel>
  )
}

function ConventionIssuesTab({
  conventionId,
  entryKind,
}: {
  conventionId: number
  entryKind: 'issue' | 'recommendation'
}) {
  const [issues, setIssues] = useState<KnowledgeConventionIssueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [viewIssueId, setViewIssueId] = useState<number | null>(null)
  const [viewIssue, setViewIssue] = useState<KnowledgeConventionIssueDetail | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

  const loadIssues = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setIssues(await fetchKnowledgeConventionIssues(conventionId, entryKind))
    } catch (e: unknown) {
      setIssues([])
      setError(isApiError(e) ? e.message : 'Could not load entries')
    } finally {
      setLoading(false)
    }
  }, [conventionId, entryKind])

  useEffect(() => {
    void loadIssues()
    setViewIssueId(null)
    setViewIssue(null)
  }, [loadIssues])

  useEffect(() => {
    if (viewIssueId == null) {
      setViewIssue(null)
      return
    }
    let cancelled = false
    setViewLoading(true)
    void fetchKnowledgeIssue(viewIssueId)
      .then((row) => {
        if (!cancelled) setViewIssue(row)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(isApiError(e) ? e.message : 'Could not load entry')
      })
      .finally(() => {
        if (!cancelled) setViewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [viewIssueId])

  const showTitleColumn = issueEntryListShowsTitleColumn(entryKind)
  const tableColSpan = showTitleColumn ? 4 : 3

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return issues
    return issues.filter((i) => {
      const arts = i.articles.map((a) => a.article_name).join(' ').toLowerCase()
      const cat = (i.category?.name ?? String(i.category_id)).toLowerCase()
      return (
        String(i.id).includes(q) ||
        (i.issue_title ?? '').toLowerCase().includes(q) ||
        (i.description ?? '').toLowerCase().includes(q) ||
        arts.includes(q) ||
        cat.includes(q)
      )
    })
  }, [issues, search])

  const emptyMessage =
    search.trim() ? 'No entries match your search.' : `No ${issueEntryKindBadgeLabel(entryKind)} published yet.`

  return (
    <>
      <div className="knowledge-hub-issues-toolbar">
        <input
          type="search"
          placeholder="Search ID, category, articles, title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={`Search ${issueEntryKindBadgeLabel(entryKind)}`}
        />
        <Button variant="secondary" compact onClick={() => setSearch('')}>
          Reset search
        </Button>
      </div>

      {loading ? <p className="muted">Loading…</p> : null}
      {error ? <p className="login-error">{error}</p> : null}

      {!loading ? (
        <TableCard className="issues-mapping-list-card knowledge-hub-issues-table-card">
          <table className="data-table issues-mapping-table">
            <thead>
              <tr>
                <th>Articles</th>
                <th>Category</th>
                {showTitleColumn ? (
                  <th className="issues-mapping-table__issue-col">
                    <span className="issues-mapping-table__issue-col-title">
                      {issueEntryLoiTableTitleLabel()}
                    </span>
                  </th>
                ) : null}
                <th className="issues-mapping-table__status-col">Status</th>
                <th className="issues-mapping-table__actions-col">View</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan + 1} className="muted">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                filtered.map((i) => (
                  <tr
                    key={i.id}
                    className={`issues-mapping-table__row issues-mapping-table__row--${entryKind}`}
                  >
                    <td className="text-compact issues-mapping-table__articles">
                      {i.articles.map((a) => a.article_name).join(', ') || 'None'}
                    </td>
                    <td className="issues-mapping-table__category">{i.category?.name ?? i.category_id}</td>
                    {showTitleColumn ? (
                      <td className="issues-mapping-table__issue">{issueEntryLoiTableCellText(i)}</td>
                    ) : null}
                    <td className="issues-mapping-table__status">{issueStatusLabel(i)}</td>
                    <td className="issues-mapping-table__actions">
                      <Button variant="link" compact onClick={() => setViewIssueId(i.id)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableCard>
      ) : null}

      {viewIssueId != null ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="knowledge-hub-issue-view-title"
          onClick={() => setViewIssueId(null)}
        >
          <div
            className="modal-card modal-card-wide knowledge-hub-issue-view-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="knowledge-hub-issue-view-modal__head">
              <h2 id="knowledge-hub-issue-view-title" className="knowledge-hub-issue-view-modal__title">
                {issueEntryKindBadgeLabel(entryKind)} #{viewIssueId}
              </h2>
              <Button variant="secondary" compact onClick={() => setViewIssueId(null)}>
                Close
              </Button>
            </div>
            <div className="knowledge-hub-issue-view-modal__body">
              {viewLoading ? <p className="muted">Loading entry…</p> : null}
              {!viewLoading && viewIssue ? <KnowledgeIssueReadOnlyPanel issue={viewIssue} /> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function ConventionRepositoriesTab() {
  return (
    <>
      {CAT_REPOSITORY_CYCLES.map((cycle) => (
        <KnowledgeHubPanel key={cycle.id} title={cycle.title}>
          <div className="resources-grid">
            {cycle.documents.map((doc) => (
              <a
                key={doc.id}
                href={doc.href}
                className="resource-link"
                target="_blank"
                rel="noopener noreferrer"
                download={doc.fileName}
              >
                <span className="resource-icon" aria-hidden>
                  {doc.icon}
                </span>
                <div className="resource-text">
                  <div className="resource-title">{doc.title}</div>
                  <div className="resource-type">{doc.typeLabel}</div>
                </div>
              </a>
            ))}
          </div>
        </KnowledgeHubPanel>
      ))}
    </>
  )
}

export function KnowledgeConventionCatDetail({
  data,
  onBack,
}: {
  data: KnowledgeConventionDetail
  onBack: () => void
}) {
  const [activeTab, setActiveTab] = useState<CatTab>('Overview')
  const adopted = data.knowledge_adopted?.trim() || '—'
  const ratified = data.knowledge_ratified?.trim() || '—'

  return (
    <KnowledgeHubPage>
      <KnowledgeHubDetailHeader
        title={data.code}
        subtitle={data.name}
        icon={data.knowledge_icon}
        fallback="📜"
        metaLines={[`Adopted: ${adopted}`, `Ratified: ${ratified}`]}
        onBack={onBack}
      />

      <KnowledgeHubTabs
        tabs={[...CAT_TABS]}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as CatTab)}
      />

      {activeTab === 'Overview' && (
        <KnowledgeHubPanel title="Convention Overview">
          <KnowledgeHubProse>{CAT_CONVENTION_OVERVIEW}</KnowledgeHubProse>
        </KnowledgeHubPanel>
      )}

      {activeTab === 'Articles' && <ConventionArticlesTab conventionId={data.id} />}

      {activeTab === 'LOI' && <ConventionIssuesTab conventionId={data.id} entryKind="issue" />}

      {activeTab === 'Concluding Observations' && (
        <ConventionIssuesTab conventionId={data.id} entryKind="recommendation" />
      )}

      {activeTab === 'Repositories' && <ConventionRepositoriesTab />}

      {activeTab === 'CAT Tracker' && <CatTrackerTab />}

      {activeTab === LABEL_OPTIONAL_PROTOCOL && (
        <KnowledgeHubPanel title={LABEL_OPTIONAL_PROTOCOL}>
          <KnowledgeHubMutedProse>No optional protocol content is available yet.</KnowledgeHubMutedProse>
        </KnowledgeHubPanel>
      )}
    </KnowledgeHubPage>
  )
}
