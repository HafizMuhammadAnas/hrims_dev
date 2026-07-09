type Props = {
  enabled: boolean
  disabled?: boolean
  onChange: (enabled: boolean) => void
  label?: string
}

export function MatrixRowEnableToggle({ enabled, disabled, onChange, label = 'Include row' }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      title={enabled ? 'Included — click to mark as N/A' : 'N/A — click to include this row'}
      disabled={disabled}
      className={`matrix-row-toggle${enabled ? ' matrix-row-toggle--on' : ''}`}
      onClick={() => onChange(!enabled)}
    >
      <span className="matrix-row-toggle__track" aria-hidden>
        <span className="matrix-row-toggle__thumb" />
      </span>
      <span className="matrix-row-toggle__label">{enabled ? 'On' : 'N/A'}</span>
    </button>
  )
}
