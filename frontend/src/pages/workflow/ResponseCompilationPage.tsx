import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchHrRequests } from '../../api/hrRequests'
import { fetchDepartmentTasks, type DepartmentTaskRow } from '../../api/lists'
import { createRegionalResponse } from '../../api/workflows'
import { Button } from '../../components/ui/Button'
import { PageSection } from '../../components/ui/PageSection'
import { StatsCards } from '../../components/ui/StatsCards'
import { TableCard } from '../../components/ui/TableCard'
import type { HrRequestRow } from '../../types/hrRequest'

type Props = {
  title: string
  nextPath: string
}

export function ResponseCompilationPage({ title, nextPath }: Props) {
  const navigate = useNavigate()
  const [requests, setRequests] = useState<HrRequestRow[]>([])
  const [tasks, setTasks] = useState<DepartmentTaskRow[]>([])
  const [selectedReqId, setSelectedReqId] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void Promise.all([fetchHrRequests(), fetchDepartmentTasks()])
      .then(([reqs, taskRows]) => {
        setRequests(reqs)
        setTasks(taskRows)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  const selectedReq = useMemo(
    () => requests.find((r) => r.id === selectedReqId) ?? null,
    [requests, selectedReqId],
  )
  const selectedTasks = useMemo(
    () => tasks.filter((t) => t.req_id === selectedReqId),
    [tasks, selectedReqId],
  )
  const prefill = useMemo(() => {
    if (!selectedTasks.length) return ''
    return selectedTasks
      .map(
        (t) =>
          `[${t.department_name ?? t.department_id}]` +
          `\nStatus: ${t.status}` +
          `\n${t.response_data ?? 'No response data yet.'}`,
      )
      .join('\n\n')
  }, [selectedTasks])

  async function submit() {
    if (!selectedReq) {
      setError('Select a request first.')
      return
    }
    if (!content.trim()) {
      setError('Compiled response content is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createRegionalResponse({
        hr_request_id: selectedReq.id,
        title: `${selectedReq.title} - consolidated response`,
        federal_group_id: selectedReq.federal_group_id ?? null,
        content: content.trim(),
      })
      navigate(nextPath)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageSection
      title={title}
      subtitle="Compile department inputs into one consolidated regional response."
    >
      {error && <p className="login-error">{error}</p>}
      <div style={{ marginTop: 16 }}>
        <StatsCards
          items={[
            { label: 'Requests available', value: requests.length },
            { label: 'Tasks linked to selection', value: selectedTasks.length },
          ]}
        />
      </div>

      <TableCard padded>
        <label className="muted">Select request ID</label>
        <select
          style={{ width: '100%', marginTop: 6, marginBottom: 12 }}
          value={selectedReqId}
          onChange={(e) => setSelectedReqId(e.target.value)}
        >
          <option value="">-- choose --</option>
          {requests.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id} — {r.title}
            </option>
          ))}
        </select>

        {selectedReq && (
          <div style={{ marginBottom: 10 }}>
            <p className="muted">
              Linked department tasks: <strong>{selectedTasks.length}</strong>
            </p>
            {selectedTasks.length > 0 && !content && (
              <Button variant="secondary" compact onClick={() => setContent(prefill)}>
                Prefill from department task notes
              </Button>
            )}
          </div>
        )}

        <label className="muted">Compiled response content</label>
        <textarea
          rows={8}
          style={{ width: '100%', marginTop: 6 }}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Summarize department submissions, issues, and final response narrative."
        />
        <div style={{ marginTop: 12 }}>
          <Button variant="primary" compact disabled={saving} onClick={() => void submit()}>
            {saving ? 'Submitting...' : 'Submit compiled response'}
          </Button>
        </div>
      </TableCard>
    </PageSection>
  )
}
