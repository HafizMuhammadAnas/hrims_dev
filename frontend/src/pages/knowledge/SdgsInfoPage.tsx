import { useCallback, useEffect, useState } from 'react'
import { fetchKnowledgeSdgGoals, type KnowledgeSdgGoal } from '../../api/knowledgeHub'
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
  KnowledgeHubTargetList,
} from '../../components/knowledge/KnowledgeHubUi'
import { knowledgeSdgIcon } from '../../lib/knowledgeSdgIcons'

const SDG_TABS = ['Targets', 'Progress', 'Initiatives'] as const
type SdgTab = (typeof SDG_TABS)[number]

function splitBodyLines(body: string | null | undefined): string[] {
  if (!body?.trim()) return []
  return body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function SdgDetail({ data, onBack }: { data: KnowledgeSdgGoal; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<SdgTab>('Targets')
  const targetLines = splitBodyLines(data.body)

  return (
    <KnowledgeHubPage>
      <KnowledgeHubDetailHeader
        title={data.title}
        subtitle="Sustainable Development Goal"
        icon={data.knowledge_icon}
        fallback="🎯"
        fallbackIcon={knowledgeSdgIcon(data.goal_number, data.code)}
        onBack={onBack}
      />

      <KnowledgeHubTabs tabs={[...SDG_TABS]} activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab as SdgTab)} />

      {activeTab === 'Targets' && (
        <KnowledgeHubPanel title="SDG Targets">
          {targetLines.length > 0 ? (
            <KnowledgeHubTargetList items={targetLines} />
          ) : (
            <>
              <KnowledgeHubProse>{data.summary?.trim() || 'Targets for this goal will be published here.'}</KnowledgeHubProse>
              <KnowledgeHubTargetList
                items={[
                  'Target 1: By 2030, ensure equal rights to economic resources.',
                  'Target 2: Implement national social protection systems.',
                  'Target 3: Build resilience of the poor and vulnerable.',
                ]}
              />
            </>
          )}
        </KnowledgeHubPanel>
      )}

      {activeTab === 'Progress' && (
        <div className="impl-status">
          <h2 className="section-title">Progress</h2>
          <KnowledgeHubMutedProse>
            Aggregated progress metrics and charts for this goal will be displayed here once official SDG monitoring
            data is connected to HRIMS.
          </KnowledgeHubMutedProse>
          {(data.stat_1_value || data.stat_2_value) && (
            <div className="card-stats" style={{ marginTop: 20, maxWidth: 360 }}>
              <div className="stat">
                <div className="stat-value">{data.stat_1_value ?? '—'}</div>
                <div className="stat-label">{data.stat_1_label ?? ''}</div>
              </div>
              <div className="stat">
                <div className="stat-value">{data.stat_2_value ?? '—'}</div>
                <div className="stat-label">{data.stat_2_label ?? ''}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'Initiatives' && (
        <KnowledgeHubPanel title="Key Initiatives">
          <KnowledgeHubRecList
            items={[
              {
                key: 'init-1',
                title: 'Benazir Income Support Programme',
                details: 'Social safety net program providing financial assistance to low-income families.',
              },
              {
                key: 'init-2',
                title: 'Ehsaas Programme',
                details: 'Poverty alleviation initiative targeting the most vulnerable segments of society.',
              },
            ]}
          />
        </KnowledgeHubPanel>
      )}
    </KnowledgeHubPage>
  )
}

export function SdgsInfoPage() {
  const [goals, setGoals] = useState<KnowledgeSdgGoal[]>([])
  const [selected, setSelected] = useState<KnowledgeSdgGoal | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoadError(null)
    setLoading(true)
    try {
      setGoals(await fetchKnowledgeSdgGoals())
    } catch {
      setGoals([])
      setLoadError('Could not load SDG goals from the server.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (selected) {
    return <SdgDetail data={selected} onBack={() => setSelected(null)} />
  }

  return (
    <KnowledgeHubPage>
      <KnowledgeHubListSection title="Sustainable Development Goals - Pakistan">
        <KnowledgeHubStateMessage error={loadError} loading={loading} empty={!loading && goals.length === 0} />
        {!loading && goals.length > 0 ? (
          <KnowledgeHubCardsGrid>
            {goals.map((goal) => (
              <KnowledgeHubCard
                key={goal.id}
                icon={goal.knowledge_icon}
                fallback="🎯"
                fallbackIcon={knowledgeSdgIcon(goal.goal_number, goal.code)}
                title={goal.title}
                description={goal.summary}
                stat1Value={goal.stat_1_value}
                stat1Label={goal.stat_1_label}
                stat2Value={goal.stat_2_value}
                stat2Label={goal.stat_2_label}
                onClick={() => setSelected(goal)}
              />
            ))}
          </KnowledgeHubCardsGrid>
        ) : null}
      </KnowledgeHubListSection>
    </KnowledgeHubPage>
  )
}
