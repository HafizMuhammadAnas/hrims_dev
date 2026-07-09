import { useCallback, useEffect, useState } from 'react'
import { fetchKnowledgeUprHighlights, type KnowledgeStatCard } from '../../api/knowledgeHub'
import {
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

const UPR_TABS = ['Breakdown', 'Response', 'Action Plan'] as const
type UprTab = (typeof UPR_TABS)[number]

function UprDetail({ data, onBack }: { data: KnowledgeStatCard; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<UprTab>('Breakdown')

  return (
    <KnowledgeHubPage>
      <KnowledgeHubDetailHeader
        title={data.title}
        subtitle="Universal Periodic Review — thematic area (4th cycle)"
        icon={data.icon}
        fallback="📋"
        onBack={onBack}
      />

      <KnowledgeHubTabs tabs={[...UPR_TABS]} activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab as UprTab)} />

      {activeTab === 'Breakdown' && (
        <KnowledgeHubPanel title="Thematic breakdown">
          <KnowledgeHubProse>{data.summary?.trim() || data.title}</KnowledgeHubProse>
          {data.body?.trim() ? (
            <KnowledgeHubProse>{data.body.trim()}</KnowledgeHubProse>
          ) : (
            <KnowledgeHubMutedProse>
              Recommendation counts and category-level statistics will be listed here when sourced from the official UPR
              outcome documents for the relevant cycle.
            </KnowledgeHubMutedProse>
          )}
        </KnowledgeHubPanel>
      )}

      {activeTab === 'Response' && (
        <KnowledgeHubPanel title="State Response">
          <KnowledgeHubProse>
            Pakistan has accepted the majority of recommendations received during the 4th UPR cycle, demonstrating its
            commitment to international human rights obligations.
          </KnowledgeHubProse>
          <div className="state-response-box">
            <h4>Official Statement</h4>
            <p>
              &ldquo;We are committed to implementing the accepted recommendations through a coordinated effort involving
              federal and provincial stakeholders.&rdquo;
            </p>
          </div>
        </KnowledgeHubPanel>
      )}

      {activeTab === 'Action Plan' && (
        <KnowledgeHubPanel title="Action Plan Steps">
          <KnowledgeHubRecList
            items={[
              {
                key: 'step-1',
                title: 'Phase 1: Dissemination',
                details: 'Sharing recommendations with all provincial departments and stakeholders.',
              },
              {
                key: 'step-2',
                title: 'Phase 2: Implementation Matrix',
                details: 'Developing a tracking matrix to monitor progress on accepted recommendations.',
              },
            ]}
          />
        </KnowledgeHubPanel>
      )}
    </KnowledgeHubPage>
  )
}

export function UprInfoPage() {
  const [cards, setCards] = useState<KnowledgeStatCard[]>([])
  const [selected, setSelected] = useState<KnowledgeStatCard | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoadError(null)
    setLoading(true)
    try {
      setCards(await fetchKnowledgeUprHighlights())
    } catch {
      setCards([])
      setLoadError('Could not load UPR highlights from the server.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (selected) {
    return <UprDetail data={selected} onBack={() => setSelected(null)} />
  }

  return (
    <KnowledgeHubPage>
      <KnowledgeHubListSection title="Universal Periodic Review - Pakistan (4th Cycle)">
        <KnowledgeHubStateMessage error={loadError} loading={loading} empty={!loading && cards.length === 0} />
        {!loading && cards.length > 0 ? (
          <KnowledgeHubCardsGrid>
            {cards.map((item) => (
              <KnowledgeHubCard
                key={item.id}
                icon={item.icon}
                fallback="📋"
                title={item.title}
                description={item.summary}
                stat1Value={item.stat_1_value}
                stat1Label={item.stat_1_label}
                stat2Value={item.stat_2_value}
                stat2Label={item.stat_2_label}
                onClick={() => setSelected(item)}
              />
            ))}
          </KnowledgeHubCardsGrid>
        ) : null}
      </KnowledgeHubListSection>
    </KnowledgeHubPage>
  )
}
