import { ApiError } from "@/lib/api"

/** API error text for the Inventory modals (422 field errors joined). Moved with the modal helpers; in lib/ so the component file only exports components. */
export function extractError(err: unknown): string {
  if (err instanceof ApiError) {
    // Surface field-level validation errors (422) — Laravel returns
    // them under details.errors.{field}: ["message", ...]. The default
    // err.message is the generic "The given data was invalid"; the
    // useful info is one level deeper.
    const details = err.details as
      | { errors?: Record<string, string[]> }
      | undefined
    const errors = details?.errors
    if (errors && Object.keys(errors).length > 0) {
      const lines: string[] = []
      for (const [field, msgs] of Object.entries(errors)) {
        const label = field.replace(/_/g, ' ')
        for (const m of msgs) {
          lines.push(`${label}: ${m}`)
        }
      }
      return lines.join(' · ')
    }
    return err.message
  }
  if (err instanceof Error) return err.message
  return String(err)
}
