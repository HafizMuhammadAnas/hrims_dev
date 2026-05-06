import { useCallback, useEffect, useState } from 'react'
import { fetchKnowledgeIndicators, type KnowledgeStatCard } from '../../api/knowledgeHub'
import { KnowledgeHubIcon } from '../../components/KnowledgeHubIcon'

export function IndicatorsInfoPage() {
  const [cards, setCards] = useState<KnowledgeStatCard[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const data = await fetchKnowledgeIndicators()
      setCards(data)
    } catch {
      setCards([])
      setLoadError('Could not load indicators from the server.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <h2>Human rights indicators</h2>
      <p className="muted">
        Indicator tiles are loaded from the database (Super admin → knowledge catalog). No offline reference content is
        shown here.
      </p>
      {loadError && <p className="login-error">{loadError}</p>}
      {cards.length === 0 && !loadError ? (
        <p className="empty-state">No indicator cards are published yet.</p>
      ) : (
        <div className="knowledge-grid">
          {cards.map((k) => (
            <div key={k.id} className="knowledge-card knowledge-card-static">
              <KnowledgeHubIcon value={k.icon} fallback="📊" />
              <h3>{k.title}</h3>
              <p>{k.summary ?? '—'}</p>
              {k.body?.trim() ? (
                <p className="text-muted" style={{ fontSize: 14, marginTop: 8, whiteSpace: 'pre-wrap' }}>
                  {k.body.trim()}
                </p>
              ) : null}
              <div className="knowledge-stat-pair">
                <span>
                  <strong>{k.stat_1_value ?? '—'}</strong> {k.stat_1_label ?? ''}
                </span>
                <span>
                  <strong>{k.stat_2_value ?? '—'}</strong> {k.stat_2_label ?? ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
