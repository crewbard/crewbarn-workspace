import { ApiError } from '@/lib/api'

/**
 * A widget whose load failed. Widgets aren't gated by role, so a 403 just
 * means this person can't see that data: a quiet note, not an error. Any
 * other failure says so, rather than showing $0 or "all clear".
 */
export function LoadFailed({ error, what, onRetry }: { error: unknown; what: string; onRetry: () => void }) {
  if (error instanceof ApiError && error.status === 403) {
    return <p className="text-sm text-slate-500 py-4">You don&apos;t have access to this.</p>
  }
  return (
    <p role="alert" className="text-sm text-red-700 py-4">
      Couldn&apos;t load {what}.{' '}
      <button type="button" className="font-semibold underline" onClick={onRetry}>
        Try again
      </button>
    </p>
  )
}
