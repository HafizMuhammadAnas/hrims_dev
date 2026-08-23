import { useCallback, useEffect, useState } from 'react'
import {
  fetchKnowledgeConvention,
  fetchKnowledgeConventions,
  type KnowledgeConventionDetail,
  type KnowledgeConventionListItem,
} from '../../api/knowledgeHub'
import { isApiError } from '../../api/apiError'
import {
  KnowledgeHubCardsGrid,
  KnowledgeHubCard,
  KnowledgeHubListSection,
  KnowledgeHubPage,
  KnowledgeHubStateMessage,
} from '../../components/knowledge/KnowledgeHubUi'
import { KnowledgeConventionCatDetail } from '../../components/knowledge/KnowledgeConventionCatDetail'
import { LABEL_SEVEN_CORE_CONVENTIONS } from '../../lib/uiLabels'
import { knowledgeConventionIcon } from '../../lib/knowledgeConventionIcons'

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
    return <KnowledgeConventionCatDetail key={selected.id} data={selected} onBack={() => setSelected(null)} />
  }

  return (
    <KnowledgeHubPage>
      <KnowledgeHubListSection title={LABEL_SEVEN_CORE_CONVENTIONS}>
        <KnowledgeHubStateMessage error={loadError} loading={loading} empty={!loading && rows.length === 0} />
        {!loading && rows.length > 0 ? (
          <KnowledgeHubCardsGrid>
            {rows.map((c) => (
              <KnowledgeHubCard
                key={c.id}
                icon={c.knowledge_icon}
                fallback="📜"
                fallbackIcon={knowledgeConventionIcon(c.code)}
                title={c.code}
                description={c.name}
                stat1Value={c.knowledge_adopted}
                stat1Label="Adopted"
                stat2Value={c.knowledge_ratified}
                stat2Label="Ratified"
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
