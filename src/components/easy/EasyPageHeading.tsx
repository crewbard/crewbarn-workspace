import type { ReactNode } from 'react'

/** Presentational only: callers retain their permission checks and actions. */
export function EasyPageHeading({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return <header data-easy-heading className="mb-6 flex w-full min-w-0 flex-wrap items-center justify-between gap-4 rounded-2xl bg-emerald-950 px-5 py-6 text-white sm:px-7 sm:py-8">
    <div className="min-w-0 flex-1">
      <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p data-easy-heading-description className="mt-3 max-w-2xl text-sm text-emerald-100">{description}</p>
    </div>
    {actions && <div data-easy-heading-actions className="flex flex-wrap items-center gap-2">{actions}</div>}
  </header>
}
