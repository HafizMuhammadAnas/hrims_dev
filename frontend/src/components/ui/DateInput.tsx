import type { InputHTMLAttributes, MouseEvent } from 'react'

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

function openNativeDatePicker(e: MouseEvent<HTMLInputElement>) {
  const el = e.currentTarget
  if (el.disabled || el.readOnly) return
  try {
    // Opens the calendar when clicking the field body, not only the icon.
    el.showPicker?.()
  } catch {
    // Unsupported browsers / NotAllowedError — native input still works.
  }
}

/** `<input type="date">` that opens the picker on click anywhere in the field. */
export function DateInput({ onClick, ...props }: DateInputProps) {
  return (
    <input
      {...props}
      type="date"
      onClick={(e) => {
        onClick?.(e)
        if (!e.defaultPrevented) openNativeDatePicker(e)
      }}
    />
  )
}
