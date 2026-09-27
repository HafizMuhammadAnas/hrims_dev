import { useCallback, useEffect, useState } from 'react'
import {
  fetchKnowledgeConventionIndicatorCatalog,
  fetchKnowledgeConventions,
  type KnowledgeConventionIndicatorCatalog,
  type KnowledgeConventionListItem,
} from '../../api/knowledgeHub'
import { isApiError } from '../../api/apiError'
import {
  KnowledgeHubCardsGrid,
  KnowledgeHubCard,
  KnowledgeHubDetailHeader,
  KnowledgeHubListSection,
  KnowledgeHubMutedProse,
  KnowledgeHubPage,
  KnowledgeHubPanel,
  KnowledgeHubStateMessage,
} from '../../components/knowledge/KnowledgeHubUi'
import { TableCard } from '../../components/ui/TableCard'
import { LABEL_HUMAN_RIGHTS_INDICATORS } from '../../lib/uiLabels'
import { knowledgeConventionIcon } from '../../lib/knowledgeConventionIcons'

function ConventionIndicatorsDetail({
  data,
  onBack,
}: {
  data: KnowledgeConventionIndicatorCatalog
  onBack: () => void
}) {
  const { convention, categories_count, indicators_count, rows } = data

  return (
    <KnowledgeHubPage>
      <KnowledgeHubDetailHeader
        title={convention.code}
        subtitle={convention.name}
        icon={convention.knowledge_icon}
        fallback="📜"
        fallbackIcon={knowledgeConventionIcon(convention.code)}
        metaLines={[`Categories ${categories_count}`, `Indicators ${indicators_count}`]}
        onBack={onBack}
      />

      <KnowledgeHubPanel title="Indicators by category">
        {rows.length === 0 ? (
          <KnowledgeHubMutedProse>
            No active indicators are linked to this convention yet. Categories and indicators are managed under Super
            Admin → Issues & mappings.
          </KnowledgeHubMutedProse>
        ) : (
          <TableCard className="knowledge-hub-indicator-catalog-card">
            <table className="data-table knowledge-hub-indicator-catalog-table">
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Indicator</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.indicator_id}>
                    <td>{row.category_name}</td>
                    <td>{row.indicator_text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        )}
      </KnowledgeHubPanel>
    </KnowledgeHubPage>
  )
}

export function IndicatorsInfoPage() {
  const [rows, setRows] = useState<KnowledgeConventionListItem[]>([])
  const [selected, setSelected] = useState<KnowledgeConventionIndicatorCatalog | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [openingId, setOpeningId] = useState<number | null>(null)

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
    setOpeningId(id)
    try {
      setSelected(await fetchKnowledgeConventionIndicatorCatalog(id))
    } catch (e: unknown) {
      setLoadError(isApiError(e) ? e.message : 'Could not load indicators for this convention')
    } finally {
      setOpeningId(null)
    }
  }

  if (selected) {
    return (
      <ConventionIndicatorsDetail
        key={selected.convention.id}
        data={selected}
        onBack={() => setSelected(null)}
      />
    )
  }

  return (
    <KnowledgeHubPage>
      <KnowledgeHubListSection title={LABEL_HUMAN_RIGHTS_INDICATORS}>
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
                stat1Value={String(c.categories_count ?? 0)}
                stat1Label="Categories"
                stat2Value={String(c.indicators_count ?? 0)}
                stat2Label="Indicators"
                onClick={() => {
                  if (openingId != null) return
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
