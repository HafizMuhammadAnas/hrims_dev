import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  fetchKnowledgeConvention,
  fetchKnowledgeConventions,
  type KnowledgeConventionDetail,
  type KnowledgeConventionListItem,
} from '../../api/knowledgeHub'
import { isApiError } from '../../api/apiError'
import { KnowledgeHubIcon } from '../../components/KnowledgeHubIcon'

function ConventionDetail({
  data,
  onBack,
}: {
  data: KnowledgeConventionDetail
  onBack: () => void
}) {
  const adopted = data.knowledge_adopted?.trim() || '—'
  const ratified = data.knowledge_ratified?.trim() || '—'
  const articles = data.knowledge_articles?.trim() || '—'
  const impl = data.knowledge_implementation?.trim() || '—'

  return (
    <div>
      <button type="button" className="btn btn-secondary btn-compact knowledge-back" onClick={onBack}>
        <ArrowLeft size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
        All conventions
      </button>
      <div className="knowledge-hero">
        <KnowledgeHubIcon value={data.knowledge_icon} fallback="📜" variant="hero" />
        <div>
          <h2 className="knowledge-hero-title">{data.code}</h2>
          <p className="muted">{data.name}</p>
          <p className="knowledge-meta">
            Adopted {adopted} · Ratified {ratified} · Articles tracked: {articles} · Implementation (reference): {impl}
          </p>
        </div>
      </div>
      <div className="knowledge-body">
        {data.description?.trim() ? (
          <p style={{ whiteSpace: 'pre-wrap' }}>{data.description.trim()}</p>
        ) : (
          <p className="muted">
            No narrative has been added yet. A super administrator can publish overview text from Super admin →
            Conventions & components.
          </p>
        )}
        {data.components.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: '1.1rem' }}>Treaty structure</h3>
            <ul style={{ margin: '12px 0 0', paddingLeft: '1.25rem' }}>
              {data.components.map((c) => (
                <li key={c.id}>
                  <strong>
                    {c.type} {c.code}
                  </strong>
                  : {c.title}
                  {c.body?.trim() ? (
                    <div className="text-muted" style={{ marginTop: 6, fontSize: 14, whiteSpace: 'pre-wrap' }}>
                      {c.body.trim()}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
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
    return <ConventionDetail data={selected} onBack={() => setSelected(null)} />
  }

  return (
    <div>
      <h2>Conventions</h2>
      <p className="muted">Core UN human rights conventions configured for HRIMS. Content is maintained by super administrators.</p>
      {loadError && <p className="text-error">{loadError}</p>}
      {loading && <p className="muted">Loading…</p>}
      {!loading && rows.length === 0 && !loadError && (
        <p className="muted">No active conventions are published yet.</p>
      )}
      <div className="knowledge-grid">
        {rows.map((c) => (
          <button
            key={c.id}
            type="button"
            className="knowledge-card"
            onClick={() => {
              void openDetail(c.id)
            }}
          >
            <KnowledgeHubIcon value={c.knowledge_icon} fallback="📜" />
            <h3>{c.code}</h3>
            <p>{c.name}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
