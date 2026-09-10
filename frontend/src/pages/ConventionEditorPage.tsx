import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  adminCreateConvention,
  adminDeleteConventionRepositoryFile,
  adminFetchConventions,
  adminUpdateConvention,
  adminUploadConventionRepositoryFiles,
  type AdminConvention,
} from '../api/admin'
import { SUPER_ADMIN_CONVENTIONS } from '../lib/superAdminRoutes'
import { isApiError } from '../api/apiError'
import { useAuth } from '../auth/AuthContext'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { FormControl } from '../components/ui/FormControl'
import { FormField } from '../components/ui/FormField'
import { FormGrid } from '../components/ui/FormGrid'
import { FormRow } from '../components/ui/FormRow'
import { PageSection } from '../components/ui/PageSection'
import {
  CONVENTION_REPOSITORY_MAX_FILE_BYTES,
  conventionRepositoryFileTooLargeMessage,
  emptyRepositoryCycle,
  normalizeRepositoryCycles,
  type ConventionRepositoryCycle,
  type ConventionRepositoryDocument,
} from '../lib/conventionKnowledgeContent'
import { isSuperAdmin } from '../lib/roles'
import { LABEL_CONVENTIONS_AND_COMPONENTS, LABEL_OPTIONAL_PROTOCOL } from '../lib/uiLabels'

type FormState = {
  code: string
  name: string
  knowledge_icon: string
  knowledge_adopted: string
  knowledge_ratified: string
  description: string
  repositories: ConventionRepositoryCycle[]
  optional_protocol_body: string
  sort_order: string
}

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  knowledge_icon: '',
  knowledge_adopted: '',
  knowledge_ratified: '',
  description: '',
  repositories: [],
  optional_protocol_body: '',
  sort_order: '0',
}

const REPOSITORY_ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function formFromConvention(row: AdminConvention): FormState {
  return {
    code: row.code,
    name: row.name,
    knowledge_icon: row.knowledge_icon ?? '',
    knowledge_adopted: row.knowledge_adopted ?? '',
    knowledge_ratified: row.knowledge_ratified ?? '',
    description: row.description ?? '',
    repositories: normalizeRepositoryCycles(row.repositories ?? []),
    optional_protocol_body: row.optional_protocol_body ?? '',
    sort_order: String(row.sort_order ?? 0),
  }
}

export function ConventionEditorPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { conventionId } = useParams<{ conventionId: string }>()
  const isEdit = Boolean(conventionId)
  const numericConventionId =
    conventionId && !Number.isNaN(Number(conventionId)) ? Number(conventionId) : null
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [uploadingCycleId, setUploadingCycleId] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    if (!conventionId) {
      setForm(EMPTY_FORM)
      setLoading(false)
      return
    }
    const id = Number(conventionId)
    if (!Number.isFinite(id)) {
      setError('Invalid convention.')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void adminFetchConventions()
      .then((rows) => {
        if (cancelled) return
        const row = rows.find((c) => c.id === id)
        if (!row) {
          setError('Convention not found.')
          return
        }
        setForm(formFromConvention(row))
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(isApiError(e) ? e.message : 'Could not load convention')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [conventionId])

  if (!user || !isSuperAdmin(user)) {
    return <Navigate to="/" replace />
  }

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateCycle(cycleId: string, next: Partial<ConventionRepositoryCycle>) {
    setForm((prev) => ({
      ...prev,
      repositories: prev.repositories.map((cycle) =>
        cycle.id === cycleId ? { ...cycle, ...next } : cycle,
      ),
    }))
  }

  function updateDocument(cycleId: string, docId: string, next: Partial<ConventionRepositoryDocument>) {
    setForm((prev) => ({
      ...prev,
      repositories: prev.repositories.map((cycle) =>
        cycle.id !== cycleId
          ? cycle
          : {
              ...cycle,
              documents: cycle.documents.map((doc) => (doc.id === docId ? { ...doc, ...next } : doc)),
            },
      ),
    }))
  }

  async function uploadFilesToCycle(cycleId: string, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    const tooLarge = files.find((f) => f.size > CONVENTION_REPOSITORY_MAX_FILE_BYTES)
    if (tooLarge) {
      setError(conventionRepositoryFileTooLargeMessage(tooLarge.name))
      const input = fileInputRefs.current[cycleId]
      if (input) input.value = ''
      return
    }
    const badType = files.find((f) => {
      const name = f.name.toLowerCase()
      return !(name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx'))
    })
    if (badType) {
      setError(`"${badType.name}" is not allowed. Upload PDF, DOC, or DOCX only.`)
      const input = fileInputRefs.current[cycleId]
      if (input) input.value = ''
      return
    }
    setUploadingCycleId(cycleId)
    setError(null)
    try {
      const uploaded = await adminUploadConventionRepositoryFiles(files, numericConventionId)
      if (uploaded.length === 0) {
        setError('No files were uploaded. Use PDF, DOC, or DOCX under 50 MB.')
        return
      }
      setForm((prev) => ({
        ...prev,
        repositories: prev.repositories.map((cycle) =>
          cycle.id !== cycleId
            ? cycle
            : { ...cycle, documents: [...cycle.documents, ...uploaded] },
        ),
      }))
    } catch (e: unknown) {
      const msg = isApiError(e) ? e.message : 'File upload failed'
      setError(
        /content|size|large|post_max|upload_max/i.test(msg)
          ? `${msg} (Server PHP limit may still be too low — ask admin to raise upload_max_filesize / post_max_size.)`
          : msg,
      )
    } finally {
      setUploadingCycleId(null)
      const input = fileInputRefs.current[cycleId]
      if (input) input.value = ''
    }
  }

  async function removeDocument(cycleId: string, doc: ConventionRepositoryDocument) {
    setError(null)
    try {
      await adminDeleteConventionRepositoryFile({ path: doc.path, href: doc.href })
    } catch {
      // Still remove from the form if the file is already gone on disk.
    }
    setForm((prev) => ({
      ...prev,
      repositories: prev.repositories.map((cycle) =>
        cycle.id !== cycleId
          ? cycle
          : { ...cycle, documents: cycle.documents.filter((row) => row.id !== doc.id) },
      ),
    }))
  }

  async function removeCycle(cycleId: string) {
    const cycle = form.repositories.find((row) => row.id === cycleId)
    setError(null)
    if (cycle) {
      for (const doc of cycle.documents) {
        try {
          await adminDeleteConventionRepositoryFile({ path: doc.path, href: doc.href })
        } catch {
          // continue removing remaining files / cycle from the form
        }
      }
    }
    setForm((prev) => ({
      ...prev,
      repositories: prev.repositories.filter((row) => row.id !== cycleId),
    }))
  }

  async function save() {
    const code = form.code.trim()
    const name = form.name.trim()
    if (!code || !name) {
      setError('Code and full name are required.')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      code,
      name,
      knowledge_icon: form.knowledge_icon.trim() || null,
      knowledge_adopted: form.knowledge_adopted.trim() || null,
      knowledge_ratified: form.knowledge_ratified.trim() || null,
      description: form.description.trim() || null,
      repositories: form.repositories
        .map((cycle) => ({
          id: cycle.id,
          title: cycle.title.trim(),
          documents: cycle.documents
            .filter((doc) => doc.href.trim())
            .map((doc) => ({
              id: doc.id,
              title: doc.title.trim() || doc.file_name || 'Document',
              href: doc.href.trim(),
              type_label: doc.type_label.trim(),
              icon: doc.icon || '📄',
              file_name: doc.file_name.trim(),
              path: doc.path?.trim() || '',
            })),
        }))
        .filter((cycle) => cycle.title || cycle.documents.length > 0),
      optional_protocol_body: form.optional_protocol_body.trim() || null,
      sort_order: Number.isFinite(Number(form.sort_order)) ? Number(form.sort_order) : 0,
    }
    try {
      if (isEdit && conventionId) {
        await adminUpdateConvention(Number(conventionId), payload)
      } else {
        await adminCreateConvention(payload)
      }
      navigate(SUPER_ADMIN_CONVENTIONS)
    } catch (e: unknown) {
      setError(isApiError(e) ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageSection
      title={isEdit ? `Edit convention${form.code ? ` — ${form.code}` : ''}` : 'Create convention'}
      subtitle="Fill Overview, Repositories, and Optional Protocol. These sections appear as tabs on Convention Info. Articles, LOI, and Concluding Observations still come from Issues & mappings for this convention."
      leading={
        <Button variant="link" compact onClick={() => navigate(SUPER_ADMIN_CONVENTIONS)}>
          ← {LABEL_CONVENTIONS_AND_COMPONENTS}
        </Button>
      }
    >
      {error ? (
        <Alert variant="error" title="Something went wrong" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      {loading ? <p className="muted">Loading…</p> : null}
      {!loading ? (
        <form
          className="convention-editor"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <section className="convention-editor__section">
            <h3 className="convention-editor__heading">Overview</h3>
            <p className="muted convention-editor__hint">
              Catalog identity and the narrative shown on the Overview tab.
            </p>
            <FormGrid>
              <FormRow twoCol>
                <FormControl label="Code">
                  <input
                    value={form.code}
                    onChange={(e) => patch('code', e.target.value)}
                    placeholder="e.g. CEDAW"
                    required
                  />
                </FormControl>
                <FormControl label="Full name">
                  <input
                    value={form.name}
                    onChange={(e) => patch('name', e.target.value)}
                    placeholder="Convention title"
                    required
                  />
                </FormControl>
              </FormRow>
              <FormRow twoCol>
                <FormControl label="Icon (emoji)">
                  <input
                    value={form.knowledge_icon}
                    onChange={(e) => patch('knowledge_icon', e.target.value)}
                    placeholder="📜"
                  />
                </FormControl>
                <FormControl label="Sort order">
                  <input
                    value={form.sort_order}
                    onChange={(e) => patch('sort_order', e.target.value)}
                    inputMode="numeric"
                  />
                </FormControl>
              </FormRow>
              <FormRow twoCol>
                <FormControl label="Adopted">
                  <input
                    value={form.knowledge_adopted}
                    onChange={(e) => patch('knowledge_adopted', e.target.value)}
                    placeholder="e.g. 10 December 1984"
                  />
                </FormControl>
                <FormControl label="Ratified">
                  <input
                    value={form.knowledge_ratified}
                    onChange={(e) => patch('knowledge_ratified', e.target.value)}
                    placeholder="e.g. 23 June 2010"
                  />
                </FormControl>
              </FormRow>
              <FormField
                label="Overview narrative"
                hint="Shown on Convention Info → Overview. Leave blank to use built-in CAT copy for CAT only."
              >
                <textarea
                  rows={10}
                  value={form.description}
                  onChange={(e) => patch('description', e.target.value)}
                  placeholder="Background, mandate, and how the convention is used in this system…"
                />
              </FormField>
            </FormGrid>
          </section>

          <section className="convention-editor__section">
            <h3 className="convention-editor__heading">Repositories</h3>
            <p className="muted convention-editor__hint">
              Add reporting cycles (e.g. First cycle, Second cycle), then upload one or more PDF or Word files in
              each cycle (max 50 MB each). These appear on Convention Info → Repositories.
            </p>
            <div className="convention-editor__repo-toolbar">
              <Button
                variant="primary"
                compact
                type="button"
                disabled={saving || uploadingCycleId != null}
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    repositories: [...prev.repositories, emptyRepositoryCycle()],
                  }))
                }
              >
                Add cycle
              </Button>
            </div>
            {form.repositories.length === 0 ? (
              <p className="muted">No cycles yet. Use Add cycle above to create the first reporting cycle.</p>
            ) : null}
            {form.repositories.map((cycle, cycleIndex) => {
              const uploading = uploadingCycleId === cycle.id
              return (
                <div key={cycle.id} className="convention-editor__cycle">
                  <FormRow twoCol>
                    <FormControl label={`Cycle ${cycleIndex + 1} name`}>
                      <input
                        value={cycle.title}
                        onChange={(e) => updateCycle(cycle.id, { title: e.target.value })}
                        placeholder="e.g. First cycle"
                        disabled={saving || uploading}
                      />
                    </FormControl>
                    <div className="convention-editor__cycle-actions">
                      <Button
                        variant="secondary"
                        compact
                        type="button"
                        className="convention-editor__btn-danger"
                        disabled={saving || uploading}
                        onClick={() => {
                          void removeCycle(cycle.id)
                        }}
                      >
                        Remove cycle
                      </Button>
                    </div>
                  </FormRow>

                  {cycle.documents.length === 0 ? (
                    <p className="muted convention-editor__files-empty">No files in this cycle yet.</p>
                  ) : (
                    <ul className="convention-editor__file-list">
                      {cycle.documents.map((doc) => (
                        <li key={doc.id} className="convention-editor__file-row">
                          <span className="convention-editor__file-icon" aria-hidden>
                            {doc.icon || '📄'}
                          </span>
                          <div className="convention-editor__file-meta">
                            <input
                              className="convention-editor__file-title"
                              value={doc.title}
                              onChange={(e) => updateDocument(cycle.id, doc.id, { title: e.target.value })}
                              placeholder="Document title"
                              disabled={saving || uploading}
                              aria-label="Document title"
                            />
                            <span className="muted convention-editor__file-sub">
                              {doc.file_name || 'Uploaded file'}
                              {doc.type_label ? ` · ${doc.type_label}` : ''}
                            </span>
                          </div>
                          <div className="convention-editor__file-actions">
                            {doc.href ? (
                              <a
                                className="convention-editor__file-link"
                                href={doc.href}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                View
                              </a>
                            ) : null}
                            <Button
                              variant="secondary"
                              compact
                              type="button"
                              className="convention-editor__btn-danger"
                              disabled={saving || uploading}
                              onClick={() => {
                                void removeDocument(cycle.id, doc)
                              }}
                            >
                              Remove file
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <input
                    ref={(el) => {
                      fileInputRefs.current[cycle.id] = el
                    }}
                    type="file"
                    accept={REPOSITORY_ACCEPT}
                    multiple
                    hidden
                    onChange={(e) => {
                      void uploadFilesToCycle(cycle.id, e.target.files)
                    }}
                  />
                  <Button
                    variant="secondary"
                    compact
                    type="button"
                    disabled={saving || uploading}
                    onClick={() => fileInputRefs.current[cycle.id]?.click()}
                  >
                    {uploading ? 'Uploading…' : 'Upload files'}
                  </Button>
                </div>
              )
            })}
          </section>

          <section className="convention-editor__section">
            <h3 className="convention-editor__heading">{LABEL_OPTIONAL_PROTOCOL}</h3>
            <p className="muted convention-editor__hint">
              Narrative for the Optional Protocol tab. Leave blank if this convention has no optional protocol yet.
            </p>
            <FormField label={`${LABEL_OPTIONAL_PROTOCOL} text`}>
              <textarea
                rows={10}
                value={form.optional_protocol_body}
                onChange={(e) => patch('optional_protocol_body', e.target.value)}
                placeholder="Optional protocol mandate, dates, and national mechanisms…"
              />
            </FormField>
          </section>

          <div className="convention-editor__actions">
            <Button variant="secondary" type="button" onClick={() => navigate(SUPER_ADMIN_CONVENTIONS)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving || uploadingCycleId != null}>
              {saving ? 'Saving…' : isEdit ? 'Save convention' : 'Create convention'}
            </Button>
          </div>
        </form>
      ) : null}
    </PageSection>
  )
}
