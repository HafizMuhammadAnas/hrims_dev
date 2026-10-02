import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchKnowledgeConventionIndicatorCatalog,
  fetchKnowledgeConventions,
  type KnowledgeConventionIndicatorCatalog,
  type KnowledgeConventionListItem,
  type KnowledgeIndicatorCatalogRow,
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
  KnowledgeHubTabs,
} from '../../components/knowledge/KnowledgeHubUi'
import { TableCard } from '../../components/ui/TableCard'
import {
  CONCLUDING_OBSERVATIONS_LABEL,
  LOI_LABEL,
  coerceIssueEntryKind,
  type IssueEntryKind,
} from '../../lib/issueEntryKind'
import { LABEL_HUMAN_RIGHTS_INDICATORS } from '../../lib/uiLabels'
import { knowledgeConventionIcon } from '../../lib/knowledgeConventionIcons'

const INDICATOR_KIND_TABS = [LOI_LABEL, CONCLUDING_OBSERVATIONS_LABEL] as const

function rowsForKind(rows: KnowledgeIndicatorCatalogRow[], kind: IssueEntryKind): KnowledgeIndicatorCatalogRow[] {
  return rows.filter((row) => coerceIssueEntryKind(row.entry_kind) === kind)
}

function IndicatorCatalogTable({ rows }: { rows: KnowledgeIndicatorCatalogRow[] }) {
  if (rows.length === 0) {
    return (
      <KnowledgeHubMutedProse>
        No active indicators are linked for this type yet.
      </KnowledgeHubMutedProse>
    )
  }

  return (
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
            <tr key={`${row.entry_kind}-${row.indicator_id}`}>
              <td>{row.category_name}</td>
              <td>{row.indicator_text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  )
}

function ConventionIndicatorsDetail({
  data,
  onBack,
}: {
  data: KnowledgeConventionIndicatorCatalog
  onBack: () => void
}) {
  const {
    convention,
    rows,
    loi_categories_count,
    co_categories_count,
    loi_indicators_count,
    co_indicators_count,
  } = data
  const [activeTab, setActiveTab] = useState<string>(LOI_LABEL)

  const activeKind: IssueEntryKind =
    activeTab === CONCLUDING_OBSERVATIONS_LABEL ? 'recommendation' : 'issue'
  const filteredRows = useMemo(() => rowsForKind(rows, activeKind), [rows, activeKind])

  const panelTitle =
    activeKind === 'recommendation'
      ? `${CONCLUDING_OBSERVATIONS_LABEL} indicators by category`
      : `${LOI_LABEL} indicators by category`

  return (
    <KnowledgeHubPage>
      <KnowledgeHubDetailHeader
        title={convention.code}
        subtitle={convention.name}
        icon={convention.knowledge_icon}
        fallback="📜"
        fallbackIcon={knowledgeConventionIcon(convention.code)}
        metaLines={[
          `LOI categories ${loi_categories_count ?? 0}`,
          `CO categories ${co_categories_count ?? 0}`,
          `LOI indicators ${loi_indicators_count ?? 0}`,
          `CO indicators ${co_indicators_count ?? 0}`,
        ]}
        onBack={onBack}
      />

      <KnowledgeHubTabs
        tabs={[...INDICATOR_KIND_TABS]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <KnowledgeHubPanel title={panelTitle}>
        <IndicatorCatalogTable rows={filteredRows} />
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
