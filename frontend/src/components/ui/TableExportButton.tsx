import { Download } from 'lucide-react'
import { Button } from './Button'
import { downloadTableExcel, type TableExportColumn } from '../../lib/tableExcelExport'

type TableExportButtonProps<T> = {
  fileBaseName: string
  columns: TableExportColumn<T>[]
  rows: T[]
  disabled?: boolean
  className?: string
  worksheetName?: string
  label?: string
}

export function TableExportButton<T>({
  fileBaseName,
  columns,
  rows,
  disabled = false,
  className = 'table-toolbar__export',
  worksheetName,
  label = 'Export Excel',
}: TableExportButtonProps<T>) {
  return (
    <Button
      variant="secondary"
      compact
      type="button"
      className={className}
      disabled={disabled || rows.length === 0}
      title={rows.length === 0 ? 'No rows to export' : 'Download filtered data as Excel'}
      onClick={() => downloadTableExcel(columns, rows, fileBaseName, worksheetName)}
    >
      <Download size={16} aria-hidden />
      {label}
    </Button>
  )
}
