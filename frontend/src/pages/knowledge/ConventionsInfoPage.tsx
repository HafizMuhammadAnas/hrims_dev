import { useCallback, useEffect, useState } from 'react'
import {
  fetchKnowledgeConvention,
  fetchKnowledgeConventions,
  type KnowledgeConventionDetail,
  type KnowledgeConventionListItem,
} from '../../api/knowledgeHub'
import { isApiError } from '../../api/apiError'
import {
  KnowledgeHubArticleGrid,
  KnowledgeHubCardsGrid,
  KnowledgeHubCard,
  KnowledgeHubDetailHeader,
  KnowledgeHubListSection,
  KnowledgeHubMutedProse,
  KnowledgeHubPage,
  KnowledgeHubPanel,
  KnowledgeHubProse,
  KnowledgeHubRecList,
  KnowledgeHubStateMessage,
  KnowledgeHubTabs,
} from '../../components/knowledge/KnowledgeHubUi'
import { KnowledgeConventionCatDetail } from '../../components/knowledge/KnowledgeConventionCatDetail'

const CONVENTION_TABS = ['Overview', 'Recommendations', 'Implementation', 'Challenges', 'Resources'] as const
type ConventionTab = (typeof CONVENTION_TABS)[number]

function ConventionDetail({
  data,
  onBack,
}: {
  data: KnowledgeConventionDetail
  onBack: () => void
}) {
  const [activeTab, setActiveTab] = useState<ConventionTab>('Overview')
  const adopted = data.knowledge_adopted?.trim() || '—'
  const ratified = data.knowledge_ratified?.trim() || '—'
  const articles = data.components.map((c) => ({
    key: c.id,
    num: `${c.type} ${c.code}`.trim(),
    title: c.title,
    desc: c.body?.trim() || 'No description provided.',
  }))

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
        tabs={[...CONVENTION_TABS]}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as ConventionTab)}
      />

      {activeTab === 'Overview' && (
        <KnowledgeHubPanel title="Convention Overview">
          {data.description?.trim() ? (
            <KnowledgeHubProse>{data.description.trim()}</KnowledgeHubProse>
          ) : (
            <KnowledgeHubMutedProse>
              No narrative has been added yet. A super administrator can publish overview text from Super admin →
              Conventions & components.
            </KnowledgeHubMutedProse>
          )}
          {articles.length > 0 ? (
            <>
              <h3 style={{ marginTop: '30px', marginBottom: '20px', color: 'var(--pk-green)', fontWeight: 600, fontSize: '18px' }}>
                Key Articles
              </h3>
              <KnowledgeHubArticleGrid items={articles} />
            </>
          ) : null}
        </KnowledgeHubPanel>
      )}

      {activeTab === 'Recommendations' && (
        <KnowledgeHubPanel title="Pakistan-Specific Recommendations">
          {data.components.some((c) => c.body?.trim()) ? (
            <KnowledgeHubRecList
              items={data.components
                .filter((c) => c.body?.trim())
                .map((c) => ({
                  key: c.id,
                  title: `${c.type} ${c.code}: ${c.title}`,
                  details: c.body?.trim() ?? '',
                }))}
            />
          ) : (
            <KnowledgeHubMutedProse>
              Recommendations for this convention will appear here once published in the knowledge catalog.
            </KnowledgeHubMutedProse>
          )}
        </KnowledgeHubPanel>
      )}

      {activeTab === 'Implementation' && (
        <div className="impl-status">
          <h2 className="section-title">Implementation Status</h2>
          <KnowledgeHubProse>
            {data.knowledge_implementation?.trim() ||
              'Quantitative implementation tracking for this convention will be shown here once verified national data and reporting cycles are integrated into HRIMS.'}
          </KnowledgeHubProse>
        </div>
      )}

      {activeTab === 'Challenges' && (
        <KnowledgeHubPanel title="Key Challenges">
          <div className="challenge-grid">
            <div className="challenge-item">
              <div className="challenge-icon">⚠️</div>
              <div className="challenge-content">
                <div className="challenge-title">Legislative Gaps</div>
                <div className="challenge-desc">
                  Absence of comprehensive legislation addressing all aspects of the convention.
                </div>
              </div>
            </div>
            <div className="challenge-item">
              <div className="challenge-icon">⚠️</div>
              <div className="challenge-content">
                <div className="challenge-title">Resource Constraints</div>
                <div className="challenge-desc">
                  Insufficient allocation of resources for implementation and monitoring.
                </div>
              </div>
            </div>
          </div>
        </KnowledgeHubPanel>
      )}

      {activeTab === 'Resources' && (
        <KnowledgeHubPanel title="Resources & Documents">
          <div className="resources-grid">
            <a href="#" className="resource-link" onClick={(e) => e.preventDefault()}>
              <span className="resource-icon">📄</span>
              <div className="resource-text">
                <div className="resource-title">{data.code} Full Text</div>
                <div className="resource-type">Official Document</div>
              </div>
            </a>
            <a href="#" className="resource-link" onClick={(e) => e.preventDefault()}>
              <span className="resource-icon">📊</span>
              <div className="resource-text">
                <div className="resource-title">Pakistan&apos;s State Report</div>
                <div className="resource-type">PDF Report</div>
              </div>
            </a>
            <a href="#" className="resource-link" onClick={(e) => e.preventDefault()}>
              <span className="resource-icon">📑</span>
              <div className="resource-text">
                <div className="resource-title">Committee Observations</div>
                <div className="resource-type">UN Document</div>
              </div>
            </a>
          </div>
        </KnowledgeHubPanel>
      )}
    </KnowledgeHubPage>
  )
}

export function ConventionsInfoPage() {
  const [rows, setRows] = useState<KnowledgeConventionListItem[]>([])
  const [selected, setSelected] = useState<KnowledgeConventionDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadList = useCallback(async () => {
    setLoadError(null)
    setLoading(true)
    try {
      setRows(await fetchKnowledgeConventions())
    } catch (e: unknown) {
      setLoadError(isApiError(e) ? e.message : 'Could not load conventions')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  async function openDetail(id: number) {
    setLoadError(null)
    try {
      setSelected(await fetchKnowledgeConvention(id))
    } catch (e: unknown) {
      setLoadError(isApiError(e) ? e.message : 'Could not load convention')
    }
  }

  if (selected) {
    if (selected.code.trim().toUpperCase() === 'CAT') {
      return <KnowledgeConventionCatDetail data={selected} onBack={() => setSelected(null)} />
    }
    return <ConventionDetail data={selected} onBack={() => setSelected(null)} />
  }

  return (
    <KnowledgeHubPage>
      <KnowledgeHubListSection title="Seven Core Human Rights Conventions">
        <KnowledgeHubStateMessage error={loadError} loading={loading} empty={!loading && rows.length === 0} />
        {!loading && rows.length > 0 ? (
          <KnowledgeHubCardsGrid>
            {rows.map((c) => (
              <KnowledgeHubCard
                key={c.id}
                icon={c.knowledge_icon}
                fallback="📜"
                title={c.code}
                description={c.name}
                onClick={() => {
                  void openDetail(c.id)
                }}
              />
            ))}
          </KnowledgeHubCardsGrid>
        ) : null}
      </KnowledgeHubListSection>
    </KnowledgeHubPage>
  )
}
