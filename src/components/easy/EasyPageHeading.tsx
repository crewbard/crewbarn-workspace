import type { ReactNode } from 'react'

/**
 * Presentational only: callers retain their permission checks and actions.
 * Colours come from the Easy kit (--easy-heading-*), which follows the
 * tenant's chrome colour from Settings > Appearance. No fixed colours here.
 */
export function EasyPageHeading({ title, description, actions, kicker }: { title: string; description: string; actions?: ReactNode; kicker?: string }) {
  return <header data-easy-heading className="mb-6 flex w-full min-w-0 flex-wrap items-center justify-between gap-4 rounded-2xl bg-[var(--easy-heading-bg,var(--chrome-bg))] px-5 py-6 text-[var(--easy-heading-text)] sm:px-7 sm:py-8">
    <div className="min-w-0 flex-1">
      {kicker && <p data-easy-heading-kicker className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--easy-heading-muted)]">{kicker}</p>}
      <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p data-easy-heading-description className="mt-3 max-w-2xl text-sm text-[var(--easy-heading-muted)]">{description}</p>
    </div>
    {actions && <div data-easy-heading-actions className="flex flex-wrap items-center gap-2">{actions}</div>}
  </header>
}
