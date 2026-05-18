import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export type SearchableSelectOption = {
  value: string
  label: string
}

type Props = {
  id?: string
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  disabled?: boolean
  placeholder?: string
  emptyFilterMessage?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

export function SearchableSelect({
  id: idProp,
  value,
  onChange,
  options,
  disabled = false,
  placeholder = 'Select…',
  emptyFilterMessage = 'No matches',
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: Props) {
  const autoId = useId()
  const id = idProp ?? autoId
  const listboxId = `${id}-listbox`
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selectableOptions = useMemo(
    () => options.filter((o) => o.value !== ''),
    [options],
  )

  const selected = useMemo(
    () => selectableOptions.find((o) => o.value === value) ?? null,
    [selectableOptions, value],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return selectableOptions
    return selectableOptions.filter((o) => o.label.toLowerCase().includes(q))
  }, [selectableOptions, query])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  function openList() {
    if (disabled) return
    setOpen(true)
    setQuery('')
  }

  function pick(next: string) {
    onChange(next)
    setOpen(false)
    setQuery('')
  }

  const displayValue = open ? query : (selected?.label ?? '')

  return (
    <div className="searchable-select" ref={rootRef}>
      <div className="searchable-select__control">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className="searchable-select__input"
          value={displayValue}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={openList}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              setQuery('')
            }
          }}
        />
        <button
          type="button"
          className="searchable-select__toggle"
          tabIndex={-1}
          disabled={disabled}
          aria-label={open ? 'Close list' : 'Open list'}
          onClick={() => {
            if (open) {
              setOpen(false)
              setQuery('')
            } else {
              openList()
            }
          }}
        >
          <ChevronDown size={18} aria-hidden />
        </button>
      </div>
      {open && !disabled ? (
        <ul id={listboxId} role="listbox" className="searchable-select__list">
          {filtered.length === 0 ? (
            <li className="searchable-select__empty muted">{emptyFilterMessage}</li>
          ) : (
            filtered.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  className="searchable-select__option"
                  title={opt.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(opt.value)}
                >
                  {opt.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}

