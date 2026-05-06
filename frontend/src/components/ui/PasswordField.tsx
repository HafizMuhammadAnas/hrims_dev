import { Eye, EyeOff } from 'lucide-react'
import { useId, useState } from 'react'

type PasswordFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  minLength?: number
  required?: boolean
}

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  minLength,
  required,
}: PasswordFieldProps) {
  const id = useId()
  const [visible, setVisible] = useState(false)

  return (
    <label htmlFor={id}>
      {label}
      <div className="login-password-wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          required={required}
        />
        <button
          type="button"
          className="login-password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      </div>
    </label>
  )
}
