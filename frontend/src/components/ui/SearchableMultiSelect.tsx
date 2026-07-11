import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { SearchableSelectOption } from './SearchableSelect'

type Props = {
  id?: string
  className?: string
  values: string[]
  onChange: (values: string[]) => void
  options: SearchableSelectOption[]
  disabled?: boolean
  placeholder?: string
  emptyFilterMessage?: string
  selectedSummary?: (count: number, firstLabel: string | null) => string
}

export function SearchableMultiSelect({
  id: idProp,
  className = '',
  values,
  onChange,
  options,
  disabled = false,
  placeholder = 'Select…',
  emptyFilterMessage = 'No matches',
  selectedSummary,
}: Props) {
  const autoId = useId()
  const id = idProp ?? autoId
  const wrapRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')

  const selectableOptions = useMemo(
    () => options.filter((o) => o.value !== ''),
    [options],
  )

  const selectedSet = useMemo(() => new Set(values), [values])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return selectableOptions
    return selectableOptions.filter((o) => o.label.toLowerCase().includes(q))
  }, [selectableOptions, filter])

  useEffect(() => {
    if (!open) {
      setFilter('')
      return
    }
    function onDoc(e: MouseEvent) {
      if (!(e.target instanceof Node)) return
      if (wrapRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  function toggle(value: string) {
    const next = new Set(selectedSet)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    onChange([...next])
  }

  const firstLabel =
    values.length === 1
      ? (selectableOptions.find((o) => o.value === values[0])?.label ?? null)
      : null

  const summary =
    values.length === 0
      ? placeholder
      : selectedSummary
        ? selectedSummary(values.length, firstLabel)
        : values.length === 1 && firstLabel
          ? firstLabel
          : `${values.length} selected`

  return (
    <div className={`article-multi-dropdown ${className}`.trim()} ref={wrapRef}>
      <button
        type="button"
        id={id}
        className="article-multi-dropdown__trigger"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="article-multi-dropdown__trigger-text">{summary}</span>
        <span className="article-multi-dropdown__chevron" aria-hidden />
      </button>
      {open && !disabled ? (
        <div className="article-multi-dropdown__panel" role="listbox" aria-multiselectable>
          <input
            type="search"
            className="article-multi-dropdown__filter"
            placeholder="Filter…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
          />
          <div className="article-multi-dropdown__list">
            {filtered.length === 0 ? (
              <div className="article-multi-dropdown__empty">{emptyFilterMessage}</div>
            ) : (
              filtered.map((opt) => (
                <label key={opt.value} className="article-multi-dropdown__item">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(opt.value)}
                    onChange={() => toggle(opt.value)}
                    disabled={disabled}
                  />
                  <span title={opt.label}>{opt.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
