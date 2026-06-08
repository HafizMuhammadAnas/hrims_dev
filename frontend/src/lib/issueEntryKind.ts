export type IssueEntryKind = 'issue' | 'recommendation'

export function coerceIssueEntryKind(raw: string | undefined | null): IssueEntryKind {
  return raw === 'recommendation' ? 'recommendation' : 'issue'
}

export function issueEntryKindBadgeLabel(kind: IssueEntryKind): string {
  return kind === 'recommendation' ? 'Recommendation' : 'Issue'
}

/** Label for the title field on create/edit forms (only field that changes with kind). */
export function issueEntryTitleFieldLabel(kind: IssueEntryKind): string {
  return kind === 'recommendation' ? 'Recommendation' : 'Issue'
}

export function issueEntryTitleColumnLabel(): string {
  return 'Issue / Recommendation'
}

export function issuesNavLabel(): string {
  return 'Issues / Recommendation'
}

export function issuesListTabLabel(): string {
  return 'Issues / Recommendation list'
}

export function issuesCreateTabLabel(): string {
  return 'Create issue / Recommendation'
}

export function issuesEmptyListHint(): string {
  return 'No issues or recommendations yet. Use Create issue / Recommendation to add one.'
}

export function issueEntryKindToggleAriaLabel(): string {
  return 'Issue or Recommendation'
}

export function issueEntryViewPageTitle(kind: IssueEntryKind, id: number): string {
  return `${issueEntryKindBadgeLabel(kind)} #${id}`
}

export function hrViewIssueTitleLabel(kind: IssueEntryKind | undefined | null): string {
  return coerceIssueEntryKind(kind) === 'recommendation' ? 'Recommendation' : 'Issue'
}

export function hrViewIssueDescriptionLabel(kind: IssueEntryKind | undefined | null): string {
  return coerceIssueEntryKind(kind) === 'recommendation' ? 'Recommendation description' : 'Issue description'
}
