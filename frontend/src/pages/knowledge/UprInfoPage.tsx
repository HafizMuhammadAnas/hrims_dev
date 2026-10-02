import { useCallback, useEffect, useState } from 'react'
import {
  fetchKnowledgeUprEntries,
  type KnowledgeUprDocument,
  type KnowledgeUprEntry,
} from '../../api/knowledgeHub'
import {
  KnowledgeHubCardsGrid,
  KnowledgeHubCard,
  KnowledgeHubDetailHeader,
  KnowledgeHubListSection,
  KnowledgeHubMutedProse,
  KnowledgeHubPage,
  KnowledgeHubPanel,
  KnowledgeHubProse,
  KnowledgeHubStateMessage,
  KnowledgeHubTabs,
} from '../../components/knowledge/KnowledgeHubUi'
import {
  KNOWLEDGE_UPR_REPOSITORY_KEYS,
  KNOWLEDGE_UPR_REPOSITORY_LABELS,
  type KnowledgeUprRepositoryKey,
} from '../../lib/knowledgeUprContent'

const UPR_TABS = ['Overview', 'Repositories', 'Analysis'] as const
type UprTab = (typeof UPR_TABS)[number]

function repositoryEntries(entry: KnowledgeUprEntry): Array<{
  key: KnowledgeUprRepositoryKey
  label: string
  doc: KnowledgeUprDocument | null
}> {
  return KNOWLEDGE_UPR_REPOSITORY_KEYS.map((key) => ({
    key,
    label: entry.repository_labels?.[key] || KNOWLEDGE_UPR_REPOSITORY_LABELS[key],
    doc: entry.repositories?.[key] ?? null,
  }))
}

function UprDetail({ data, onBack }: { data: KnowledgeUprEntry; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<UprTab>('Overview')
  const [activeHtml, setActiveHtml] = useState<KnowledgeUprDocument | null>(
    data.analysis_files[0] ?? null,
  )
  const repos = repositoryEntries(data)
  const cycleLabel = data.cycle?.name?.trim() || 'UPR'

  return (
    <KnowledgeHubPage>
      <KnowledgeHubDetailHeader
        title={data.display_title}
        subtitle={`${data.type?.name || data.display_title} — ${cycleLabel}`}
        icon="📋"
        fallback="📋"
        onBack={onBack}
      />

      <KnowledgeHubTabs
        tabs={[...UPR_TABS]}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as UprTab)}
      />

      {activeTab === 'Overview' && (
        <KnowledgeHubPanel title="Overview">
          {data.introduction?.trim() ? (
            <KnowledgeHubProse>{data.introduction.trim()}</KnowledgeHubProse>
          ) : (
            <KnowledgeHubMutedProse>No introduction has been added for this UPR entry yet.</KnowledgeHubMutedProse>
          )}
        </KnowledgeHubPanel>
      )}

      {activeTab === 'Repositories' && (
        <KnowledgeHubPanel title="Repositories">
          {repos.every((r) => !r.doc) ? (
            <KnowledgeHubMutedProse>No repository documents attached yet.</KnowledgeHubMutedProse>
          ) : (
            <ul className="knowledge-hub-repo-list">
              {repos.map((r) => (
                <li key={r.key} style={{ marginBottom: 12 }}>
                  <strong>{r.label}</strong>
                  {r.doc ? (
                    <div className="text-compact" style={{ marginTop: 4 }}>
                      {r.doc.icon}{' '}
                      {r.doc.href ? (
                        <a href={r.doc.href} target="_blank" rel="noreferrer">
                          {r.doc.file_name || r.doc.title || 'Open document'}
                        </a>
                      ) : (
                        r.doc.file_name || r.doc.title || 'Document'
                      )}
                    </div>
                  ) : (
                    <div className="muted text-compact" style={{ marginTop: 4 }}>
                      Not attached
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </KnowledgeHubPanel>
      )}

      {activeTab === 'Analysis' && (
        <KnowledgeHubPanel title="Analysis">
          {data.analysis_files.length === 0 ? (
            <KnowledgeHubMutedProse>No analysis HTML files attached yet.</KnowledgeHubMutedProse>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {data.analysis_files.map((file) => (
                  <ButtonLikeTab
                    key={file.id}
                    active={activeHtml?.id === file.id}
                    label={file.title || file.file_name || 'HTML'}
                    onClick={() => setActiveHtml(file)}
                  />
                ))}
              </div>
              {activeHtml?.href ? (
                <iframe
                  title={activeHtml.title || activeHtml.file_name || 'Analysis'}
                  src={activeHtml.href}
                  className="knowledge-hub-tracker-frame"
                  style={{ width: '100%', minHeight: 520, border: '1px solid var(--border, #ddd)' }}
                />
              ) : (
                <KnowledgeHubMutedProse>Select an HTML file to preview.</KnowledgeHubMutedProse>
              )}
            </>
          )}
        </KnowledgeHubPanel>
      )}
    </KnowledgeHubPage>
  )
}

function ButtonLikeTab({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={
        'compiled-record-modal-tab issues-admin-tab' +
        (active ? ' compiled-record-modal-tab--active' : '')
      }
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export function UprInfoPage() {
  const [entries, setEntries] = useState<KnowledgeUprEntry[]>([])
  const [selected, setSelected] = useState<KnowledgeUprEntry | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoadError(null)
    setLoading(true)
    try {
      setEntries(await fetchKnowledgeUprEntries())
    } catch {
      setEntries([])
      setLoadError('Could not load UPR entries from the server.')
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
      <KnowledgeHubListSection title="Universal Periodic Review">
        <KnowledgeHubStateMessage error={loadError} loading={loading} empty={!loading && entries.length === 0} />
        {!loading && entries.length > 0 ? (
          <KnowledgeHubCardsGrid>
            {entries.map((item) => (
              <KnowledgeHubCard
                key={item.id}
                icon="📋"
                fallback="📋"
                title={item.display_title}
                description={
                  item.cycle?.name
                    ? `${item.type?.name || item.display_title} · ${item.cycle.name}`
                    : item.type?.name || item.display_title
                }
                onClick={() => setSelected(item)}
              />
            ))}
          </KnowledgeHubCardsGrid>
        ) : null}
      </KnowledgeHubListSection>
    </KnowledgeHubPage>
  )
}
