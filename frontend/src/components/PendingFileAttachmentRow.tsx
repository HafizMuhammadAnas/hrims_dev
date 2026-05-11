import { useEffect, useMemo, type CSSProperties } from 'react'
import { Button } from './ui/Button'

type Props = {
  file: File
  onRemove: () => void
}

/**
 * One row for a local `File` (not yet on the server): View (blob URL) + Remove.
 * Parent supplies `<ul className="hr-request-attachments-list">`.
 */
export function PendingFileAttachmentListItem({ file, onRemove }: Props) {
  const objectUrl = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  return (
    <li className="hr-request-attachments-list__item">
      <span className="hr-request-attachments-list__name">{file.name}</span>
      <span className="hr-request-attachments-list__actions">
        <a href={objectUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-compact">
          View
        </a>
        <Button type="button" variant="danger" compact onClick={onRemove}>
          Remove
        </Button>
      </span>
    </li>
  )
}

/** Single-file convenience: list + one item (e.g. department legacy attachment). */
export function PendingFileAttachmentRow({
  file,
  onRemove,
  listStyle,
}: Props & { listStyle?: CSSProperties }) {
  return (
    <ul className="hr-request-attachments-list" style={listStyle}>
      <PendingFileAttachmentListItem file={file} onRemove={onRemove} />
    </ul>
  )
}
