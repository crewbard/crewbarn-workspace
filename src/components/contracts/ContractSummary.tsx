import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'

/**
 * What this customer is about to agree to.
 *
 * The numbers a shop is really deciding on are how many jobs they have
 * just promised and how much they will invoice for them, and until now
 * the first they saw of either was after pressing Create. "Every 2 weeks
 * at four properties" is 104 jobs — worth knowing while the number can
 * still be changed.
 *
 * The figures come from the server running the REAL planner walk and the
 * REAL billing schedule against the unsaved answers. Working them out
 * here in the browser would be a second copy of that arithmetic, wrong
 * the first time either changed, and wrong in the direction of looking
 * right.
 */

interface Rhythm {
  count: string
  unit: string
  fromMonth: string
  toMonth: string
}

interface ServiceDraft {
  name: string
  jobTypeId: string
  rhythms: Rhythm[]
}

interface Preview {
  properties: number
  visits_per_property: number
  jobs_first_year: number
  first_visits: { date: string; service: string }[]
  periods_first_year: number
  billed_first_year_cents: number
  services: { name: string; visits: number }[]
}

const money = (cents: number) =>
  (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const day = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

export function ContractSummary({
  customer,
  title,
  properties,
  services,
  amount,
  billEvery,
  startsOn,
  endsOn,
}: {
  customer: string
  title: string
  properties: number
  services: ServiceDraft[]
  amount: string
  billEvery: string
  startsOn: string
  endsOn: string
}) {
  const [preview, setPreview] = useState<Preview | null>(null)

  // Everything the answer depends on, as one string. Re-asking on every
  // keystroke of the title would be a request per character for a number
  // that does not depend on it.
  const answered = services
    .filter((sv) => sv.rhythms.length > 0)
    .map((sv) => `${sv.name}|${sv.rhythms.map((r) => `${r.count}${r.unit}${r.fromMonth}${r.toMonth}`).join(',')}`)
    .join(';')
  const key = `${startsOn}|${endsOn}|${amount}|${billEvery}|${properties}|${answered}`

  useEffect(() => {
    if (!startsOn || services.length === 0) {
      setPreview(null)
      return
    }

    let cancelled = false
    const handle = window.setTimeout(() => {
      apiRequest<{ data: Preview }>('/v1/maintenance-contracts/preview', {
        method: 'POST',
        body: {
          starts_on: startsOn,
          ends_on: endsOn || null,
          billing_interval_unit: billEvery,
          billing_interval_count: 1,
          billing_amount_cents: Math.round(Number(amount.replace(/[^0-9.]/g, '') || 0) * 100),
          properties: Math.max(1, properties),
          services: services.map((sv) => ({
            name: sv.name.trim() || 'Service',
            rhythms: sv.rhythms.map((r) => ({
              interval_count: Number(r.count) || 1,
              interval_unit: r.unit,
              season_start_month: r.fromMonth ? Number(r.fromMonth) : null,
              season_end_month: r.toMonth ? Number(r.toMonth) : null,
            })),
          })),
        },
      })
        .then((res) => {
          if (!cancelled) setPreview(res.data)
        })
        // A preview that cannot be worked out is not worth an error on a
        // form somebody is still filling in. The panel simply says less.
        .catch(() => {
          if (!cancelled) setPreview(null)
        })
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return (
    <aside className="lg:sticky lg:top-4 lg:self-start">
      <div className="rounded-lg border border-navy-100 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">
          {customer ? `What ${customer} agrees to` : 'What they agree to'}
        </p>
        <h2 className="mt-1 text-lg font-bold leading-snug text-navy-900">
          {title.trim() || 'Untitled agreement'}
        </h2>

        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-navy-500">Properties</dt>
            <dd className="font-semibold text-navy-800">{properties || '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-navy-500">Fee</dt>
            <dd className="font-semibold text-navy-800">
              {amount.trim() ? `${money(Math.round(Number(amount.replace(/[^0-9.]/g, '') || 0) * 100))} / ${billEvery}` : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-navy-500">Term</dt>
            <dd className="text-right font-semibold text-navy-800">
              {startsOn ? day(startsOn) : '—'}
              {endsOn ? ` – ${day(endsOn)}` : ''}
            </dd>
          </div>
        </dl>

        {(preview?.services.length ?? 0) > 0 && (
          <ul className="mt-3 space-y-1 border-t border-navy-100 pt-3 text-sm">
            {preview!.services.map((sv) => (
              <li key={sv.name} className="flex justify-between gap-3">
                <span className="truncate text-navy-700">{sv.name}</span>
                <span className="shrink-0 text-navy-500">
                  {sv.visits} visit{sv.visits === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-navy-100 pt-3">
          <div className="rounded-md bg-navy-50/60 px-3 py-2">
            <p className="text-lg font-bold text-navy-900">{preview?.jobs_first_year ?? '—'}</p>
            <p className="text-xs leading-tight text-navy-500">jobs in the first year</p>
          </div>
          <div className="rounded-md bg-navy-50/60 px-3 py-2">
            <p className="text-lg font-bold text-navy-900">
              {preview ? money(preview.billed_first_year_cents) : '—'}
            </p>
            <p className="text-xs leading-tight text-navy-500">billed in the first year</p>
          </div>
        </div>

        {(preview?.first_visits.length ?? 0) > 0 && (
          <div className="mt-3 border-t border-navy-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">First visits</p>
            <ul className="mt-1.5 space-y-1 text-sm">
              {preview!.first_visits.map((v, i) => (
                <li key={`${v.date}-${i}`} className="flex gap-2">
                  <span className="w-14 shrink-0 font-semibold text-navy-800">{day(v.date)}</span>
                  <span className="truncate text-navy-600">{v.service}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!preview && (
          <p className="mt-3 border-t border-navy-100 pt-3 text-xs leading-relaxed text-navy-500">
            Add a service with a rhythm and this fills in — how many jobs it books, what it bills, and when the
            first visits land.
          </p>
        )}
      </div>
    </aside>
  )
}
