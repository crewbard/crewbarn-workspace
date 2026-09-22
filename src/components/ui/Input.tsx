import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = '', ...props }, ref) => {
    const inputId = id || props.name

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-navy-700"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-3 py-2 text-sm
            bg-white border rounded-md
            placeholder:text-navy-300
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
            disabled:bg-navy-50 disabled:cursor-not-allowed
            ${error
              ? 'border-danger focus-visible:ring-danger'
              : 'border-navy-200 focus-visible:ring-navy-800'
            }
            ${className}
          `}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-danger">
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={`${inputId}-hint`} className="text-sm text-navy-500">
            {hint}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
