import { useCallback, useEffect, useState } from 'react'
import { fetchKnowledgeSdgGoals, type KnowledgeSdgGoal } from '../../api/knowledgeHub'
import { KnowledgeHubIcon } from '../../components/KnowledgeHubIcon'

export function SdgsInfoPage() {
  const [goals, setGoals] = useState<KnowledgeSdgGoal[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      setGoals(await fetchKnowledgeSdgGoals())
    } catch {
      setGoals([])
      setLoadError('Could not load SDG goals from the server.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loadError) {
    return (
      <div>
        <h2>Sustainable Development Goals</h2>
        <p className="login-error">{loadError}</p>
      </div>
    )
  }

  if (goals.length === 0) {
    return (
      <div>
        <h2>Sustainable Development Goals</h2>
        <p className="muted">
          Goals are loaded from the database only. Seed SDG nodes under Super admin when you are ready to publish.
        </p>
        <p className="empty-state">No SDG goals are published yet.</p>
      </div>
    )
  }

  return (
    <div>
      <h2>Sustainable Development Goals</h2>
      <p className="muted">Goals from the SDG catalog. Click a card to read extended notes where provided.</p>
      <div className="knowledge-grid knowledge-grid-dense">
        {goals.map((g) => {
          const open = expandedId === g.id
          const s1v = g.stat_1_value ?? '—'
          const s1l = g.stat_1_label ?? ''
          const s2v = g.stat_2_value ?? '—'
          const s2l = g.stat_2_label ?? ''
          return (
            <button
              key={g.id}
              type="button"
              className="knowledge-card"
              style={{ textAlign: 'left' }}
              onClick={() => setExpandedId(open ? null : g.id)}
            >
              <KnowledgeHubIcon value={g.knowledge_icon} fallback="🎯" />
              <h3>{g.title}</h3>
              <p>{g.summary ?? '—'}</p>
              <div className="knowledge-stat-pair">
                <span>
                  <strong>{s1v}</strong> {s1l}
                </span>
                <span>
                  <strong>{s2v}</strong> {s2l}
                </span>
              </div>
              {open && g.body?.trim() ? (
                <p className="text-muted" style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>
                  {g.body.trim()}
                </p>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
