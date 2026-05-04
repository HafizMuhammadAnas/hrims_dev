import { Button } from './Button'
import { TableToolbar } from './TableToolbar'

type PaginationBarProps = {
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  className?: string
}

export function PaginationBar({ page, pageSize, totalItems, onPageChange, className }: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = Math.min(safePage * pageSize, totalItems)

  return (
    <TableToolbar compact className={className} style={{ justifyContent: 'space-between' }}>
      <span className="muted">
        Showing {start}-{end} of {totalItems}
      </span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="muted">
          Page {safePage} / {totalPages}
        </span>
        <Button variant="secondary" compact disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>
          Prev
        </Button>
        <Button
          variant="secondary"
          compact
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          Next
        </Button>
      </div>
    </TableToolbar>
  )
}
