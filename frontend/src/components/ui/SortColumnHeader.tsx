type SortColumnHeaderProps = {
  label: string
  active: boolean
  direction: 'asc' | 'desc'
  onSort: () => void
}

export function SortColumnHeader({ label, active, direction, onSort }: SortColumnHeaderProps) {
  const ariaSort = active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
  return (
    <th aria-sort={ariaSort}>
      <button type="button" className="sort-button" onClick={onSort}>
        {label}
        {active ? (direction === 'asc' ? ' \u25B2' : ' \u25BC') : null}
      </button>
    </th>
  )
}
