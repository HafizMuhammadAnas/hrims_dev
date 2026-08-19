import { useCallback, useEffect, useState } from 'react'
import { fetchKnowledgeIndicators, type KnowledgeStatCard } from '../../api/knowledgeHub'
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
import { knowledgeStatCardIcon } from '../../lib/knowledgeCardIcons'

const INDICATOR_TABS = ['Overview', 'Provincial context', 'Policies'] as const
type IndicatorTab = (typeof INDICATOR_TABS)[number]

function IndicatorDetail({ data, onBack }: { data: KnowledgeStatCard; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<IndicatorTab>('Overview')

  return (
    <KnowledgeHubPage>
      <KnowledgeHubDetailHeader
        title={data.title}
        subtitle={data.summary}
        icon={data.icon}
        fallback="📊"
        fallbackIcon={knowledgeStatCardIcon('indicators', data.title)}
        onBack={onBack}
      />

      <KnowledgeHubTabs
        tabs={[...INDICATOR_TABS]}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as IndicatorTab)}
      />

      {activeTab === 'Overview' && (
        <KnowledgeHubPanel title="About this indicator">
          <KnowledgeHubProse>{data.summary?.trim() || data.title}</KnowledgeHubProse>
          {data.body?.trim() ? (
            <KnowledgeHubProse>{data.body.trim()}</KnowledgeHubProse>
          ) : (
            <KnowledgeHubMutedProse>
              Time series, benchmarks, and comparative figures will appear here only when linked to approved official
              sources in HRIMS.
            </KnowledgeHubMutedProse>
          )}
        </KnowledgeHubPanel>
      )}

      {activeTab === 'Provincial context' && (
        <KnowledgeHubPanel title="Provincial context">
          <KnowledgeHubMutedProse>
            Province-level breakdowns for this indicator are not shown until verified subnational data is provided and
            configured for the knowledge hub.
          </KnowledgeHubMutedProse>
        </KnowledgeHubPanel>
      )}

      {activeTab === 'Policies' && (
        <KnowledgeHubPanel title="Related Policies & Acts">
          <KnowledgeHubRecList
            items={[
              {
                key: 'policy-1',
                title: 'National Policy 2021',
                details: `Framework for improving ${data.title.toLowerCase()} standards across all provinces.`,
              },
              {
                key: 'policy-2',
                title: 'Provincial Implementation Acts',
                details: 'Specific legislative measures adopted by provincial assemblies.',
              },
            ]}
          />
        </KnowledgeHubPanel>
      )}
    </KnowledgeHubPage>
  )
}

export function IndicatorsInfoPage() {
  const [cards, setCards] = useState<KnowledgeStatCard[]>([])
  const [selected, setSelected] = useState<KnowledgeStatCard | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoadError(null)
    setLoading(true)
    try {
      setCards(await fetchKnowledgeIndicators())
    } catch {
      setCards([])
      setLoadError('Could not load indicators from the server.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (selected) {
    return <IndicatorDetail data={selected} onBack={() => setSelected(null)} />
  }

  return (
    <KnowledgeHubPage>
      <KnowledgeHubListSection title="Human Rights Indicators">
        <KnowledgeHubStateMessage error={loadError} loading={loading} empty={!loading && cards.length === 0} />
        {!loading && cards.length > 0 ? (
          <KnowledgeHubCardsGrid>
            {cards.map((item) => (
              <KnowledgeHubCard
                key={item.id}
                icon={item.icon}
                fallback="📊"
                fallbackIcon={knowledgeStatCardIcon('indicators', item.title)}
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
