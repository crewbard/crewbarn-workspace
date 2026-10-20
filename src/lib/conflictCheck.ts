import { ApiError } from './api'

/**
 * What to do when a time-off or scheduling conflict lookup fails.
 *
 * A 403 means this person isn't allowed to see what the check needs (staff
 * time off, say), so the warning can't be shown and the action carries on,
 * as before.
 *
 * Anything else (no connection, a server error, a timeout) means the check
 * didn't run. Carrying on without a word would look exactly like "no
 * conflicts", so they're told and asked instead.
 *
 * True to carry on, false to stop.
 */
export function continueAfterFailedConflictCheck(error: unknown, checkName: string): boolean {
  if (error instanceof ApiError && error.status === 403) return true

  const reason = error instanceof Error && error.message ? ` (${error.message})` : ''
  return window.confirm(
    `Couldn't check for ${checkName}${reason}.\n\n` +
      "There may be a conflict that isn't shown. Continue anyway?",
  )
}
