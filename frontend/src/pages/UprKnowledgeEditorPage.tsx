import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  adminCreateKnowledgeUprEntry,
  adminDeleteKnowledgeUprFile,
  adminFetchKnowledgeUprEntry,
  adminFetchUprCycles,
  adminUpdateKnowledgeUprEntry,
  adminUploadKnowledgeUprFiles,
  type AdminUprCycle,
} from '../api/admin'
import { isApiError } from '../api/apiError'
import { useAuth } from '../auth/AuthContext'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { FormControl } from '../components/ui/FormControl'
import { FormField } from '../components/ui/FormField'
import { FormGrid } from '../components/ui/FormGrid'
import { PageSection } from '../components/ui/PageSection'
import { TableCard } from '../components/ui/TableCard'
import { WorkflowPageBack } from '../components/WorkflowPageBack'
import {
  emptyKnowledgeUprRepositories,
  KNOWLEDGE_UPR_MAX_FILE_BYTES,
  KNOWLEDGE_UPR_REPOSITORY_KEYS,
  KNOWLEDGE_UPR_REPOSITORY_LABELS,
  knowledgeUprFileTooLargeMessage,
  normalizeKnowledgeUprAnalysisFiles,
  normalizeKnowledgeUprRepositories,
  type KnowledgeUprDocument,
  type KnowledgeUprRepositoryKey,
} from '../lib/knowledgeUprContent'
import { isSuperAdmin } from '../lib/roles'
import { SUPER_ADMIN_UPR_RECOMMENDATIONS } from '../lib/superAdminRoutes'

type EditorTab = 'overview' | 'repositories' | 'analysis'

type FormState = {
  upr_cycle_id: string
  introduction: string
  repositories: Record<KnowledgeUprRepositoryKey, KnowledgeUprDocument | null>
  analysis_files: KnowledgeUprDocument[]
  sort_order: string
}

const EMPTY_FORM: FormState = {
  upr_cycle_id: '',
  introduction: '',
  repositories: emptyKnowledgeUprRepositories(),
  analysis_files: [],
  sort_order: '0',
}

const REPO_ACCEPT =
  '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const ANALYSIS_ACCEPT = '.html,.htm,text/html'

export function UprKnowledgeEditorPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { entryId } = useParams<{ entryId: string }>()
  const isEdit = Boolean(entryId)
  const numericId = entryId && !Number.isNaN(Number(entryId)) ? Number(entryId) : null

  const [tab, setTab] = useState<EditorTab>('overview')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [cycles, setCycles] = useState<AdminUprCycle[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    void adminFetchUprCycles()
      .then((cycleRows) => {
        setCycles(cycleRows.filter((c) => c.is_active !== false))
      })
      .catch(() => {
        setCycles([])
      })
  }, [])

  useEffect(() => {
    if (!entryId) {
      setForm(EMPTY_FORM)
      setLoading(false)
      return
    }
    const id = Number(entryId)
    if (!Number.isFinite(id)) {
      setError('Invalid UPR entry.')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void adminFetchKnowledgeUprEntry(id)
      .then((row) => {
        if (cancelled) return
        setForm({
          upr_cycle_id: row.upr_cycle_id != null ? String(row.upr_cycle_id) : '',
          introduction: row.introduction ?? '',
          repositories: normalizeKnowledgeUprRepositories(row.repositories),
          analysis_files: normalizeKnowledgeUprAnalysisFiles(row.analysis_files),
          sort_order: String(row.sort_order ?? 0),
        })
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(isApiError(e) ? e.message : 'Could not load UPR entry')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [entryId])

  if (!user || !isSuperAdmin(user)) {
    return <Navigate to="/" replace />
  }

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const selectedCycleName = useMemo(
    () => cycles.find((c) => String(c.id) === form.upr_cycle_id)?.name?.trim() || 'UPR',
    [cycles, form.upr_cycle_id],
  )

  async function uploadRepository(key: KnowledgeUprRepositoryKey, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const file = fileList[0]
    if (file.size > KNOWLEDGE_UPR_MAX_FILE_BYTES) {
      setError(knowledgeUprFileTooLargeMessage(file.name))
      return
    }
    const name = file.name.toLowerCase()
    if (!(name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx'))) {
      setError(`"${file.name}" is not allowed. Upload PDF, DOC, or DOCX only.`)
      return
    }
    setUploadingKey(key)
    setError(null)
    try {
      const uploaded = await adminUploadKnowledgeUprFiles([file], 'repository', numericId)
      if (uploaded[0]) {
        patch('repositories', { ...form.repositories, [key]: uploaded[0] })
      }
    } catch (e: unknown) {
      setError(isApiError(e) ? e.message : 'File upload failed')
    } finally {
      setUploadingKey(null)
      const input = fileInputRefs.current[key]
      if (input) input.value = ''
    }
  }

  async function removeRepository(key: KnowledgeUprRepositoryKey) {
    const doc = form.repositories[key]
    if (!doc) return
    setError(null)
    try {
      await adminDeleteKnowledgeUprFile(doc, numericId)
    } catch {
      // still clear from form
    }
    const nextRepos = { ...form.repositories, [key]: null }
    patch('repositories', nextRepos)
    // Persist immediately for existing entries so Knowledge Hub does not keep a dead link.
    if (numericId != null) {
      try {
        await adminUpdateKnowledgeUprEntry(numericId, { repositories: nextRepos })
      } catch (e: unknown) {
        setError(isApiError(e) ? e.message : 'File removed, but saving the entry failed')
      }
    }
  }

  async function uploadAnalysis(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    const tooLarge = files.find((f) => f.size > KNOWLEDGE_UPR_MAX_FILE_BYTES)
    if (tooLarge) {
      setError(knowledgeUprFileTooLargeMessage(tooLarge.name))
      return
    }
    const bad = files.find((f) => {
      const n = f.name.toLowerCase()
      return !(n.endsWith('.html') || n.endsWith('.htm'))
    })
    if (bad) {
      setError(`"${bad.name}" is not allowed. Upload HTML only.`)
      return
    }
    setUploadingKey('analysis')
    setError(null)
    try {
      const uploaded = await adminUploadKnowledgeUprFiles(files, 'analysis', numericId)
      patch('analysis_files', [...form.analysis_files, ...uploaded])
    } catch (e: unknown) {
      setError(isApiError(e) ? e.message : 'File upload failed')
    } finally {
      setUploadingKey(null)
      const input = fileInputRefs.current.analysis
      if (input) input.value = ''
    }
  }

  async function removeAnalysis(doc: KnowledgeUprDocument) {
    setError(null)
    try {
      await adminDeleteKnowledgeUprFile(doc, numericId)
    } catch {
      // still clear
    }
    const nextFiles = form.analysis_files.filter(
      (f) => f.id !== doc.id && f.path !== doc.path && f.href !== doc.href,
    )
    patch('analysis_files', nextFiles)
    // Persist immediately for existing entries so Knowledge Hub does not keep a dead link.
    if (numericId != null) {
      try {
        await adminUpdateKnowledgeUprEntry(numericId, { analysis_files: nextFiles })
      } catch (e: unknown) {
        setError(isApiError(e) ? e.message : 'File removed, but saving the entry failed')
      }
    }
  }

  async function save() {
    if (!form.upr_cycle_id) {
      setError('Select a UPR cycle.')
      setTab('overview')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        title: null,
        upr_cycle_id: Number(form.upr_cycle_id),
        introduction: form.introduction.trim() || null,
        repositories: form.repositories,
        analysis_files: form.analysis_files,
        sort_order: Number(form.sort_order) || 0,
      }
      if (isEdit && numericId != null) {
        await adminUpdateKnowledgeUprEntry(numericId, payload)
      } else {
        await adminCreateKnowledgeUprEntry(payload)
      }
      navigate(SUPER_ADMIN_UPR_RECOMMENDATIONS)
    } catch (e: unknown) {
      setError(isApiError(e) ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const tabs: { id: EditorTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'repositories', label: 'Repositories' },
    { id: 'analysis', label: 'Analysis' },
  ]

  return (
    <PageSection
      title={isEdit ? `Edit UPR — ${selectedCycleName}` : 'Create UPR for Knowledge Hub'}
      leading={
        <WorkflowPageBack
          placement="header"
          label="Back to UPR list"
          to={SUPER_ADMIN_UPR_RECOMMENDATIONS}
        />
      }
    >
      {error ? (
        <Alert variant="error" title="Error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      {loading ? <p className="muted">Loading…</p> : null}

      {!loading ? (
        <>
          <nav className="issues-admin-tabs compiled-record-modal-tabs" aria-label="UPR Knowledge Hub sections">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={
                  'compiled-record-modal-tab issues-admin-tab' +
                  (tab === t.id ? ' compiled-record-modal-tab--active' : '')
                }
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <TableCard padded>
            {tab === 'overview' ? (
              <FormGrid>
                <FormControl label="Cycle">
                  <select
                    value={form.upr_cycle_id}
                    onChange={(e) => patch('upr_cycle_id', e.target.value)}
                    disabled={saving}
                  >
                    <option value="">Select cycle</option>
                    {cycles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormField label="Introduction">
                  <textarea
                    className="issues-description-field"
                    rows={12}
                    value={form.introduction}
                    onChange={(e) => patch('introduction', e.target.value)}
                    disabled={saving}
                  />
                </FormField>
                <FormControl label="Sort order">
                  <input
                    type="number"
                    min={0}
                    value={form.sort_order}
                    onChange={(e) => patch('sort_order', e.target.value)}
                    disabled={saving}
                  />
                </FormControl>
              </FormGrid>
            ) : null}

            {tab === 'repositories' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {KNOWLEDGE_UPR_REPOSITORY_KEYS.map((key) => {
                  const doc = form.repositories[key]
                  return (
                    <div key={key} className="issue-indicator-card">
                      <strong className="font-semibold text-compact">
                        {KNOWLEDGE_UPR_REPOSITORY_LABELS[key]}
                      </strong>
                      {doc ? (
                        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <a href={doc.href} target="_blank" rel="noreferrer" className="text-compact">
                            {doc.file_name || doc.title || 'Open file'}
                          </a>
                          <Button
                            variant="link"
                            compact
                            dangerLink
                            disabled={saving || uploadingKey != null}
                            onClick={() => void removeRepository(key)}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div style={{ marginTop: 8 }}>
                          <input
                            ref={(el) => {
                              fileInputRefs.current[key] = el
                            }}
                            type="file"
                            accept={REPO_ACCEPT}
                            disabled={saving || uploadingKey != null}
                            onChange={(e) => void uploadRepository(key, e.target.files)}
                          />
                          {uploadingKey === key ? (
                            <p className="muted text-compact" style={{ margin: '6px 0 0' }}>
                              Uploading…
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : null}

            {tab === 'analysis' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  ref={(el) => {
                    fileInputRefs.current.analysis = el
                  }}
                  type="file"
                  accept={ANALYSIS_ACCEPT}
                  multiple
                  disabled={saving || uploadingKey != null}
                  onChange={(e) => void uploadAnalysis(e.target.files)}
                />
                {uploadingKey === 'analysis' ? (
                  <p className="muted text-compact" style={{ margin: 0 }}>
                    Uploading…
                  </p>
                ) : null}
                {form.analysis_files.length === 0 ? (
                  <p className="muted text-compact" style={{ margin: 0 }}>
                    No analysis files yet.
                  </p>
                ) : (
                  <ul className="issues-mapping-indicator-list" style={{ margin: 0 }}>
                    {form.analysis_files.map((doc) => (
                      <li key={doc.id || doc.path || doc.file_name}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <a href={doc.href} target="_blank" rel="noreferrer">
                            {doc.file_name || doc.title || 'HTML file'}
                          </a>
                          <Button
                            variant="link"
                            compact
                            dangerLink
                            disabled={saving || uploadingKey != null}
                            onClick={() => void removeAnalysis(doc)}
                          >
                            Remove
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button
                variant="secondary"
                compact
                disabled={saving}
                onClick={() => navigate(SUPER_ADMIN_UPR_RECOMMENDATIONS)}
              >
                Cancel
              </Button>
              <Button variant="primary" compact disabled={saving} onClick={() => void save()}>
                {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create UPR'}
              </Button>
            </div>
          </TableCard>
        </>
      ) : null}
    </PageSection>
  )
}
