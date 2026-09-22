import type { ChangeEvent } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'

/**
 * Format a US phone number as the user types: "3212222222" → "(321) 222-2222".
 *
 * Caps at 10 digits (US). Strips any non-digits the user pasted/typed, so
 * it's safe to run on every keystroke. Returns '' for empty input so blank
 * fields stay blank.
 */
export function formatPhoneInput(raw: string): string {
  const digits = (raw ?? '').replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/**
 * Drop-in for react-hook-form phone fields. Spread it in place of
 * `register(name)`:
 *
 *   <Input {...phoneField(register('phone'))} />
 *
 * It wraps register's onChange to format the value before RHF stores it,
 * and sets inputMode="tel" for a numeric mobile keypad.
 */
export function phoneField(registration: UseFormRegisterReturn) {
  return {
    ...registration,
    inputMode: 'tel' as const,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      e.target.value = formatPhoneInput(e.target.value)
      return registration.onChange(e)
    },
  }
}
