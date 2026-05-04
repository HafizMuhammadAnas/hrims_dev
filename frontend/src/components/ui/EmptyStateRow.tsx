type EmptyStateRowProps = {
  colSpan: number
  message: string
}

export function EmptyStateRow({ colSpan, message }: EmptyStateRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="empty-state">
        {message}
      </td>
    </tr>
  )
}
