export type IssueEntryKind = 'issue' | 'recommendation'

export const LOI_LABEL = 'LOI'
export const CONCLUDING_OBSERVATIONS_LABEL = 'Concluding observations'

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
  return `No ${LOI_LABEL} or concluding observations yet. Use Create ${LOI_LABEL} / ${CONCLUDING_OBSERVATIONS_LABEL} to add one.`
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
  return `UPR ${CONCLUDING_OBSERVATIONS_LABEL.toLowerCase()}`
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

export function resolveIssueTitleForSave(
  kind: IssueEntryKind,
  issueTitle: string,
  issueDescription: string,
): string {
  if (kind === 'issue') {
    return issueTitle.trim()
  }
  const fromDescription = issueDescription.trim().split(/\r?\n/)[0]?.trim() ?? ''
  return fromDescription
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
