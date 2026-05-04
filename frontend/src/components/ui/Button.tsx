import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'link'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  compact?: boolean
  /** Only when variant is "link" — applies destructive link styling */
  dangerLink?: boolean
}

export function Button({
  variant = 'primary',
  compact = false,
  dangerLink = false,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  let built = ''
  if (variant === 'link') {
    built = dangerLink ? 'link-button danger' : 'link-button'
  } else {
    built = ['btn', `btn-${variant}`, compact ? 'btn-compact' : ''].filter(Boolean).join(' ')
  }
  return <button type={type} className={`${built} ${className}`.trim()} {...rest} />
}
