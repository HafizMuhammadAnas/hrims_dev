import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  adminCreateConvention,
  adminFetchConventions,
  adminUpdateConvention,
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
  emptyRepositoryCycle,
  emptyRepositoryDocument,
  normalizeRepositoryCycles,
  type ConventionRepositoryCycle,
} from '../lib/conventionKnowledgeContent'
import { isSuperAdmin } from '../lib/roles'
import { LABEL_CONVENTIONS_AND_COMPONENTS, LABEL_OPTIONAL_PROTOCOL } from '../lib/uiLabels'

type FormState = {
  code: string
  name: string
  knowledge_icon: string
  knowledge_adopted: string
  knowledge_ratified: string
  knowledge_articles: string
  knowledge_implementation: string
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
  knowledge_articles: '',
  knowledge_implementation: '',
  description: '',
  repositories: [],
  optional_protocol_body: '',
  sort_order: '0',
}

function formFromConvention(row: AdminConvention): FormState {
  return {
    code: row.code,
    name: row.name,
    knowledge_icon: row.knowledge_icon ?? '',
    knowledge_adopted: row.knowledge_adopted ?? '',
    knowledge_ratified: row.knowledge_ratified ?? '',
    knowledge_articles: row.knowledge_articles ?? '',
    knowledge_implementation: row.knowledge_implementation ?? '',
    description: row.description ?? '',
    repositories: normalizeRepositoryCycles(row.repositories ?? []).map((cycle) => ({
      ...cycle,
      documents: cycle.documents.length > 0 ? cycle.documents : [emptyRepositoryDocument()],
    })),
    optional_protocol_body: row.optional_protocol_body ?? '',
    sort_order: String(row.sort_order ?? 0),
  }
}

export function ConventionEditorPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { conventionId } = useParams<{ conventionId: string }>()
  const isEdit = Boolean(conventionId)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

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

  function updateDocument(
    cycleId: string,
    docId: string,
    next: Partial<ConventionRepositoryCycle['documents'][number]>,
  ) {
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
      knowledge_articles: form.knowledge_articles.trim() || null,
      knowledge_implementation: form.knowledge_implementation.trim() || null,
      description: form.description.trim() || null,
      repositories: form.repositories
        .map((cycle) => ({
          ...cycle,
          title: cycle.title.trim(),
          documents: cycle.documents.filter((doc) => doc.title.trim() || doc.href.trim()),
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
              <FormRow twoCol>
                <FormControl label="Articles (short label)">
                  <input
                    value={form.knowledge_articles}
                    onChange={(e) => patch('knowledge_articles', e.target.value)}
                    placeholder="e.g. 33"
                  />
                </FormControl>
                <FormControl label="Implementation %">
                  <input
                    value={form.knowledge_implementation}
                    onChange={(e) => patch('knowledge_implementation', e.target.value)}
                    placeholder="e.g. 72%"
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
              Reporting cycles and downloadable files for the Repositories tab. Use a full URL or a path such as
              /knowledge/cat/repository/….
            </p>
            {form.repositories.length === 0 ? (
              <p className="muted">No cycles yet. Add a reporting cycle to attach documents.</p>
            ) : null}
            {form.repositories.map((cycle, cycleIndex) => (
              <div key={cycle.id} className="convention-editor__cycle">
                <FormRow twoCol>
                  <FormControl label={`Cycle ${cycleIndex + 1} title`}>
                    <input
                      value={cycle.title}
                      onChange={(e) => updateCycle(cycle.id, { title: e.target.value })}
                      placeholder="e.g. First cycle"
                    />
                  </FormControl>
                  <div className="convention-editor__cycle-actions">
                    <Button
                      variant="link"
                      compact
                      dangerLink
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          repositories: prev.repositories.filter((row) => row.id !== cycle.id),
                        }))
                      }
                    >
                      Remove cycle
                    </Button>
                  </div>
                </FormRow>
                {cycle.documents.map((doc, docIndex) => (
                  <div key={doc.id} className="convention-editor__document">
                    <FormRow twoCol>
                      <FormControl label={`Document ${docIndex + 1} title`}>
                        <input
                          value={doc.title}
                          onChange={(e) => updateDocument(cycle.id, doc.id, { title: e.target.value })}
                          placeholder="Document title"
                        />
                      </FormControl>
                      <FormControl label="Type label">
                        <input
                          value={doc.type_label}
                          onChange={(e) => updateDocument(cycle.id, doc.id, { type_label: e.target.value })}
                          placeholder="PDF document"
                        />
                      </FormControl>
                    </FormRow>
                    <FormRow twoCol>
                      <FormControl label="Link or file path">
                        <input
                          value={doc.href}
                          onChange={(e) => updateDocument(cycle.id, doc.id, { href: e.target.value })}
                          placeholder="https://… or /knowledge/…"
                        />
                      </FormControl>
                  <div className="convention-editor__document-actions">
                        <Button
                          variant="link"
                          compact
                          dangerLink
                          type="button"
                          onClick={() =>
                            updateCycle(cycle.id, {
                              documents: cycle.documents.filter((row) => row.id !== doc.id),
                            })
                          }
                        >
                          Remove document
                        </Button>
                      </div>
                    </FormRow>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  compact
                  type="button"
                  onClick={() =>
                    updateCycle(cycle.id, { documents: [...cycle.documents, emptyRepositoryDocument()] })
                  }
                >
                  Add document
                </Button>
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              <Button
                variant="secondary"
                compact
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    repositories: [...prev.repositories, emptyRepositoryCycle()],
                  }))
                }
              >
                Add reporting cycle
              </Button>
            </div>
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
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save convention' : 'Create convention'}
            </Button>
          </div>
        </form>
      ) : null}
    </PageSection>
  )
}
