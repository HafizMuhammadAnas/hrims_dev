export type IssueEntryKind = 'issue' | 'recommendation'

export const LOI_LABEL = 'LOI'
export const CONCLUDING_OBSERVATIONS_LABEL = 'Concluding Observations'
/** Singular label for mapping blocks and short UI headings. */
export const CONCLUDING_OBSERVATION_LABEL = 'Concluding Observation'

export function coerceIssueEntryKind(raw: string | undefined | null): IssueEntryKind {
  return raw === 'recommendation' ? 'recommendation' : 'issue'
}

export function issueEntryKindBadgeLabel(kind: IssueEntryKind): string {
  return kind === 'recommendation' ? CONCLUDING_OBSERVATIONS_LABEL : LOI_LABEL
}

/** Label for the title field on create/edit forms (only field that changes with kind). */
export function issueEntryTitleFieldLabel(kind: IssueEntryKind): string {
  return issueEntryKindBadgeLabel(kind)
}

export function issueEntryTitleColumnLabel(): string {
  return `${LOI_LABEL} / ${CONCLUDING_OBSERVATIONS_LABEL}`
}

export function issuesNavLabel(): string {
  return `${LOI_LABEL} / ${CONCLUDING_OBSERVATIONS_LABEL}`
}

export function issuesListTabLabel(): string {
  return issuesNavLabel()
}

export function issuesCreateTabLabel(): string {
  return `Create ${LOI_LABEL} / ${CONCLUDING_OBSERVATIONS_LABEL}`
}

export function issuesEmptyListHint(): string {
  return `No ${LOI_LABEL} or ${CONCLUDING_OBSERVATIONS_LABEL} yet. Use Create ${LOI_LABEL} / ${CONCLUDING_OBSERVATIONS_LABEL} to add one.`
}

export function issueEntryKindToggleAriaLabel(): string {
  return `${LOI_LABEL} or ${CONCLUDING_OBSERVATIONS_LABEL}`
}

export function issuesAdminSectionsAriaLabel(): string {
  return `${LOI_LABEL} and mappings sections`
}

export function issueEntryViewPageTitle(kind: IssueEntryKind, id: number): string {
  return `${issueEntryKindBadgeLabel(kind)} #${id}`
}

export function hrViewIssueTitleLabel(kind: IssueEntryKind | undefined | null): string {
  return issueEntryKindBadgeLabel(coerceIssueEntryKind(kind))
}

export function hrViewIssueDescriptionLabel(kind: IssueEntryKind | undefined | null): string {
  return coerceIssueEntryKind(kind) === 'recommendation'
    ? `${CONCLUDING_OBSERVATIONS_LABEL} description`
    : `${LOI_LABEL} description`
}

export function loiRequiredMessage(): string {
  return `${LOI_LABEL} is required.`
}

export function loiMetadataLoadErrorMessage(): string {
  return `${LOI_LABEL} metadata could not be loaded for this request.`
}

export function loiMetadataLoadErrorPageMessage(): string {
  return `${LOI_LABEL} metadata for this request could not be loaded.`
}

export function loiMappingLegendLabel(): string {
  return `${LOI_LABEL} mapping (read-only)`
}

/** Mapping block legend for the HR request form, per entry kind (no "read-only"). */
export function issueEntryMappingLegendLabel(kind: IssueEntryKind): string {
  if (kind === 'recommendation') return CONCLUDING_OBSERVATION_LABEL
  return `${LOI_LABEL} mapping`
}

export function loiSearchPlaceholder(): string {
  return `Search or select ${LOI_LABEL}`
}

export function loiLoadingPlaceholder(): string {
  return `Loading ${LOI_LABEL}…`
}

export function loiEmptyFilterMessage(): string {
  return `No ${LOI_LABEL} match your search`
}

export function loiCategoryLabel(): string {
  return `${LOI_LABEL} category`
}

export function uprConcludingObservationsLabel(): string {
  return `UPR ${CONCLUDING_OBSERVATIONS_LABEL}`
}

export function loiMissingDataAlertTitle(): string {
  return `Missing ${LOI_LABEL} data`
}

export function loiLegacyFormatMessage(): string {
  return `This request is not in the current ${LOI_LABEL}-based format, or ${LOI_LABEL} data is missing from the API.`
}

export function selectIndicatorForLoiMessage(): string {
  return `Select at least one indicator for this ${LOI_LABEL}.`
}

export function noIndicatorsForLoiHint(): string {
  return `No indicators for this ${LOI_LABEL} yet. Add one or leave empty.`
}

export function issueEntryDescriptionPlaceholder(kind: IssueEntryKind): string {
  return `Optional longer description for this ${issueEntryKindBadgeLabel(kind)}...`
}

export function issueEntryIndicatorsLinkedLabel(kind: IssueEntryKind): string {
  return `Indicators (linked to this ${issueEntryKindBadgeLabel(kind)})`
}

export function issueEntryDescriptionFieldLabel(kind: IssueEntryKind): string {
  return hrViewIssueDescriptionLabel(kind)
}

/** Concluding observations use description only; LOI keeps a separate title field. */
export function issueEntryFormShowsTitleField(kind: IssueEntryKind): boolean {
  return kind === 'issue'
}

export type IssueEntryTextSource = {
  entry_kind?: IssueEntryKind | string | null
  issue_title?: string | null
  description?: string | null
}

/** Primary text for an entry: LOI title or concluding observation description. */
export function issueEntryPrimaryText(source: IssueEntryTextSource): string {
  const kind = coerceIssueEntryKind(source.entry_kind)
  if (kind === 'recommendation') {
    return source.description?.trim() || source.issue_title?.trim() || ''
  }
  return source.issue_title?.trim() || ''
}

export function issueEntryListPreview(source: IssueEntryTextSource, maxLen = 200): string {
  const text = issueEntryPrimaryText(source)
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen - 1).trimEnd()}…`
}

export function issueEntrySelectLabel(source: IssueEntryTextSource, maxLen = 120): string {
  const text = issueEntryPrimaryText(source)
  if (!text) return issueEntryKindBadgeLabel(coerceIssueEntryKind(source.entry_kind))
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen - 1).trimEnd()}…`
}

/** HR request modal: label for the entry-selection field, based on checked kinds. */
export function hrIssueSelectFieldLabel(filters: {
  issue: boolean
  recommendation: boolean
}): string {
  if (filters.issue && !filters.recommendation) return `${LOI_LABEL} title`
  if (filters.recommendation && !filters.issue) return `${CONCLUDING_OBSERVATIONS_LABEL} category`
  return issueEntryTitleColumnLabel()
}

/** HR request modal: placeholder for the entry-selection field, based on checked kinds. */
export function hrIssueSelectPlaceholder(filters: {
  issue: boolean
  recommendation: boolean
}): string {
  if (filters.recommendation && !filters.issue) return `Search or select category`
  return loiSearchPlaceholder()
}

export function issueEntryListColumnLabel(kind: IssueEntryKind): string {
  return kind === 'recommendation'
    ? issueEntryDescriptionFieldLabel(kind)
    : issueEntryLoiTableTitleLabel()
}

/** List table header when the LOI filter is active. */
export function issueEntryLoiTableTitleLabel(): string {
  return `${LOI_LABEL} title`
}

/** List table cell for LOI rows — title only, never description. */
export function issueEntryLoiTableCellText(source: IssueEntryTextSource, maxLen = 200): string {
  const title = source.issue_title?.trim() || ''
  if (!title) return '—'
  if (title.length <= maxLen) return title
  return `${title.slice(0, maxLen - 1).trimEnd()}…`
}

export function issueEntryListShowsTitleColumn(kind: IssueEntryKind): boolean {
  return kind === 'issue'
}

export function issueEntryPayloadFields(
  kind: IssueEntryKind,
  issueTitle: string,
  issueDescription: string,
): { issue_title: string | null; description: string | null } {
  if (kind === 'recommendation') {
    const description = issueDescription.trim()
    return { issue_title: null, description: description || null }
  }
  const title = issueTitle.trim()
  const description = issueDescription.trim()
  return {
    issue_title: title || null,
    description: description || null,
  }
}

export function resolveIssueTitleForSave(
  kind: IssueEntryKind,
  issueTitle: string,
  issueDescription: string,
): string {
  if (kind === 'issue') {
    return issueTitle.trim()
  }
  return issueDescription.trim()
}

export function issueEntrySaveBlocked(
  kind: IssueEntryKind,
  issueTitle: string,
  issueDescription: string,
  conventionId: string,
  categoryId: string,
  selectedArticleIds: number[],
): boolean {
  if (!conventionId || !categoryId || selectedArticleIds.length === 0) return true
  if (kind === 'issue') return !issueTitle.trim()
  return !issueDescription.trim()
}
