export type ConventionRepositoryDocument = {
  id: string
  title: string
  href: string
  type_label: string
  icon: string
  file_name: string
}

export type ConventionRepositoryCycle = {
  id: string
  title: string
  documents: ConventionRepositoryDocument[]
}

export function newConventionContentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function emptyRepositoryCycle(): ConventionRepositoryCycle {
  return { id: newConventionContentId(), title: '', documents: [emptyRepositoryDocument()] }
}

export function emptyRepositoryDocument(): ConventionRepositoryDocument {
  return { id: newConventionContentId(), title: '', href: '', type_label: '', icon: '📄', file_name: '' }
}

export function normalizeRepositoryCycles(raw: unknown): ConventionRepositoryCycle[] {
  if (!Array.isArray(raw)) return []
  return raw.map((cycle, cycleIndex) => {
    const row = cycle && typeof cycle === 'object' ? (cycle as Record<string, unknown>) : {}
    const docsRaw = Array.isArray(row.documents) ? row.documents : []
    return {
      id: String(row.id ?? cycleIndex),
      title: String(row.title ?? ''),
      documents: docsRaw.map((doc, docIndex) => {
        const d = doc && typeof doc === 'object' ? (doc as Record<string, unknown>) : {}
        return {
          id: String(d.id ?? `${cycleIndex}-${docIndex}`),
          title: String(d.title ?? ''),
          href: String(d.href ?? d.url ?? ''),
          type_label: String(d.type_label ?? d.typeLabel ?? ''),
          icon: String(d.icon ?? '📄') || '📄',
          file_name: String(d.file_name ?? d.fileName ?? ''),
        }
      }),
    }
  })
}
