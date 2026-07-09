type SortColumnHeaderProps = {
  label: string
  active: boolean
  direction: 'asc' | 'desc'
  onSort: () => void
}

export function SortColumnHeader({ label, active, direction, onSort }: SortColumnHeaderProps) {
  const ariaSort = active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
  return (
    <th aria-sort={ariaSort} className="sort-column-header">
      <button type="button" className="sort-button" onClick={onSort}>
        <span className="sort-button__label">{label}</span>
        {active ? (
          <span className="sort-button__indicator" aria-hidden>
            {direction === 'asc' ? '\u25B2' : '\u25BC'}
          </span>
        ) : null}
      </button>
    </th>
  )
}
