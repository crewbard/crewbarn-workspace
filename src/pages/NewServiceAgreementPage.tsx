import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { API_URL, apiRequest, getActingTenant, getStoredToken } from '@/lib/api'
import { useTheme } from '@/hooks/useTheme'
import { CustomerPicker } from '@/components/CustomerPicker'
import { InlineQuickAddCustomer } from '@/components/InlineQuickAddCustomer'
import { ContractSummary } from '@/components/contracts/ContractSummary'
import type { Customer as PickedCustomer } from '@/types/customer'

/**
 * Starting a service agreement.
 *
 * There was a create form, but it lived inline on the contracts list and
 * asked for four fields — no property, no service and no paperwork. A
 * contract with no service line has no rhythm, generates no visits and
 * books no jobs, so what it produced was an agreement that looked signed
 * and did nothing.
 *
 * `customer` and `location` in the query string prefill it, so the places
 * somebody actually thinks of an agreement from — a property on a
 * customer's record, a job, an estimate — can send them here with the
 * answer already filled in.
 *
 * The paperwork is drafted here too rather than on a separate page,
 * because "write the agreement" and "write down what the agreement says"
 * are one job to the person doing them.
 */

/** The address comes back NESTED under `address`, not flat. */
interface ServiceLocation {
  id: string
  nickname?: string | null
  is_primary?: boolean
  address?: {
    street_address?: string | null
    apt_unit?: string | null
    city?: string | null
    state?: string | null
    postal_code?: string | null
    formatted?: string | null
  } | null
}

interface JobType {
  id: string
  name: string
}

interface DocTemplate {
  id: string
  name: string
  active?: boolean
}

/** Not a string: the server sends a kind of place and why you'd pick it. */
interface ReviewPlace {
  label: string
  detail: string
}

interface Terms {
  version: string
  heading: string
  points: string[]
  document_notice: string
  where_to_get_it_reviewed: ReviewPlace[]
  accepted: boolean
  reaccept_required: boolean
}

/** The street, the way somebody would read it off an envelope. */
function addressOf(place: ServiceLocation): string {
  const a = place.address
  if (!a) return ''
  if (a.formatted) return a.formatted
  const line = [a.street_address, a.apt_unit].filter(Boolean).join(' ')
  const town = [a.city, a.state].filter(Boolean).join(', ')
  return [line, town, a.postal_code].filter(Boolean).join(' · ')
}

/**
 * How often, as whole phrases.
 *
 * "every [1] [month]" reads as a number with no unit — a 1 sitting
 * between "every" and "month" could be a day, and people asked. These
 * are the cadences shops actually sell, said the way they say them.
 * Custom is there for the rest, and only then does a number appear.
 */
const CADENCES: { label: string; count: string; unit: string }[] = [
  { label: 'Every week', count: '1', unit: 'week' },
  { label: 'Every 2 weeks', count: '2', unit: 'week' },
  { label: 'Every 4 weeks', count: '4', unit: 'week' },
  { label: 'Every month', count: '1', unit: 'month' },
  { label: 'Every 2 months', count: '2', unit: 'month' },
  { label: 'Every 3 months (quarterly)', count: '3', unit: 'month' },
  { label: 'Every 6 months', count: '6', unit: 'month' },
  { label: 'Once a year', count: '1', unit: 'year' },
]

/** The preset a rhythm matches, or '' when it needs the custom fields. */
function cadenceKey(count: string, unit: string): string {
  const hit = CADENCES.find((c) => c.count === count && c.unit === unit)
  return hit ? hit.label : ''
}

const STEP_NAMES = ['Customer', "What's covered", 'Price and term', 'Contract and send']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** One cadence, optionally only for part of the year. '' means all year. */
interface Rhythm {
  count: string
  unit: string
  fromMonth: string
  toMonth: string
}

const FULL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "week" or "weeks", so the row never reads "every 1 months". */
function unitWord(unit: string, count: string): string {
  return Number(count) === 1 ? unit : `${unit}s`
}

/** "every week", "every 2 weeks" — the 1 is noise and reads badly. */
function cadence(count: string, unit: string): string {
  const n = Number(count) || 1
  return n === 1 ? `every ${unit}` : `every ${n} ${unit}s`
}

/**
 * The whole schedule as one sentence.
 *
 * Two rows of dropdowns say what was configured, not what will happen.
 * Somebody signing a customer up wants to read the thing they are about
 * to promise, so it is written out: the seasons first, because they are
 * the exceptions, then what the rest of the year gets.
 */
function describeRhythms(rhythms: Rhythm[]): string {
  const [base, ...seasons] = rhythms
  const valid = seasons.filter((r) => r.fromMonth !== '' && r.toMonth !== '')

  const parts = valid.map(
    (r) =>
      `${cadence(r.count, r.unit)} from ${FULL_MONTHS[Number(r.fromMonth) - 1]} ` +
      `to ${FULL_MONTHS[Number(r.toMonth) - 1]}`,
  )

  if (parts.length === 0) {
    return `${cadence(base.count, base.unit)}, all year.`
  }

  // "the rest of the year" only means something once an exception exists.
  return `${parts.join(', ')}, and ${cadence(base.count, base.unit)} the rest of the year.`
}

/**
 * One service on the agreement, with its own rhythms.
 *
 * An agreement is rarely one service. "Service the locks quarterly and
 * cut the grass weekly in summer, fortnightly in winter" is ONE contract
 * with TWO services, and each carries its own cadence and its own
 * seasons — which is exactly the shape the backend stores.
 */
/**
 * What reading an existing contract proposed.
 *
 * Every field is nullable on purpose. The reader is told never to guess,
 * so anything the document did not say arrives blank and is named in
 * `uncertain` instead — which is the list the shop actually needs to read.
 */
interface ReadProposal {
  title: string | null
  customer_name: string | null
  properties: string[]
  services: {
    name: string
    description: string | null
    rhythms: {
      interval_count: number
      interval_unit: string
      season_start_month: number | null
      season_end_month: number | null
    }[]
  }[]
  fee_cents: number | null
  bill_every_count: number | null
  bill_every_unit: string | null
  starts_on: string | null
  ends_on: string | null
  included: string[]
  excluded: string[]
  uncertain: string[]
}

/** A thing standing at one of the customer's properties. */
interface CoverableAsset {
  id: string
  name: string | null
  asset_code?: string | null
  customer_service_location_id: string
  asset_type?: { name?: string | null } | null
}

interface ServiceDraft {
  name: string
  /** What the visit actually involves. The drafted contract reads this. */
  description: string
  jobTypeId: string
  /** The equipment this line covers, so a visit's record names what it saw. */
  assetIds: string[]
  rhythms: Rhythm[]
}

const blankService = (jobTypeId = ''): ServiceDraft => ({
  name: '',
  description: '',
  jobTypeId,
  assetIds: [],
  rhythms: [{ count: '1', unit: 'month', fromMonth: '', toMonth: '' }],
})

const SECTION = 'bg-white rounded-lg border border-navy-100 p-4 sm:p-6'
const HEADING = 'text-sm font-semibold text-navy-800 uppercase tracking-wider'
const SUB = 'text-xs text-navy-500 mt-1'
const LABEL = 'block text-xs font-semibold text-navy-600 uppercase tracking-wide mb-1'
const FIELD =
  'w-full px-3 py-2 text-sm bg-white border border-navy-200 rounded-md text-navy-800 placeholder:text-navy-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-navy-800'

export function NewServiceAgreementPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  // The same shell New Job uses: full width, and a dark banner in the
  // Easy layouts. A form that asks for as much as this one does should
  // not sit in a narrow column when the one beside it does not.
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'

  const today = new Date().toISOString().slice(0, 10)
  const inAYear = new Date(Date.now() + 364 * 86400000).toISOString().slice(0, 10)

  // The picker hands back a whole customer; the id is derived. Held
  // this way so arriving with ?customer= still works — that id is all
  // a link from a property can carry.
  const [picked, setPicked] = useState<PickedCustomer | null>(null)
  const [customerId, setCustomerId] = useState(params.get('customer') ?? '')
  const [addingCustomer, setAddingCustomer] = useState(false)
  const [locationIds, setLocationIds] = useState<string[]>(
    params.get('location') ? [params.get('location') as string] : [],
  )
  const [title, setTitle] = useState('')
  const [startsOn, setStartsOn] = useState(today)
  const [endsOn, setEndsOn] = useState(inAYear)
  const [amount, setAmount] = useState('')
  const [billEvery, setBillEvery] = useState('month')

  const [services, setServices] = useState<ServiceDraft[]>([blankService()])
  const [supervisorId, setSupervisorId] = useState('')

  const setService = (si: number, patch: Partial<ServiceDraft>) =>
    setServices((current) => current.map((sv, x) => (x === si ? { ...sv, ...patch } : sv)))

  const setRhythm = (si: number, ri: number, patch: Partial<Rhythm>) =>
    setServices((current) =>
      current.map((sv, x) =>
        x === si
          ? { ...sv, rhythms: sv.rhythms.map((r, y) => (y === ri ? { ...r, ...patch } : r)) }
          : sv,
      ),
    )

  const [documentId, setDocumentId] = useState('')
  const [draftOpen, setDraftOpen] = useState(false)
  const [readOpen, setReadOpen] = useState(false)

  /*
   * What was read out of an uploaded contract, kept after it is applied.
   *
   * The customer and the properties are NOT filled in from it — those have
   * to be real records in this workspace, and a name off a scan is not one.
   * So the reader's answers stay here and are shown beside those fields as
   * what the contract said, for the person to match up themselves.
   */
  const [readFrom, setReadFrom] = useState<ReadProposal | null>(null)
  const [step, setStep] = useState(0)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const jobTypes = useQuery({
    queryKey: ['job-types'],
    queryFn: () => apiRequest<{ data: JobType[] }>('/v1/job-types'),
  })

  const locations = useQuery({
    queryKey: ['customer-service-locations', customerId],
    enabled: Boolean(customerId),
    queryFn: () =>
      apiRequest<{ data: ServiceLocation[] }>(`/v1/customers/${customerId}/service-locations`),
  })

  // Arriving from a property carries an id and nothing else. Fetch the
  // one customer so the box shows their name rather than sitting empty
  // over a selection that is really there.
  const prefilled = useQuery({
    queryKey: ['contract-customer', params.get('customer')],
    enabled: Boolean(params.get('customer')),
    queryFn: () =>
      apiRequest<{ data: PickedCustomer }>(`/v1/customers/${params.get('customer')}`),
  })

  useEffect(() => {
    if (!picked && prefilled.data?.data) setPicked(prefilled.data.data)
  }, [prefilled.data, picked])

  /*
   * Everything this customer owns, across all of their properties. Loaded
   * once here rather than per service line: a line covers every property on
   * the agreement, and re-fetching the same list under each card would ask
   * the same question four times over.
   */
  const assets = useQuery({
    queryKey: ['assets', 'for-contract', customerId],
    enabled: Boolean(customerId),
    queryFn: () =>
      apiRequest<{ data: CoverableAsset[] }>(
        `/v1/assets?customer_id=${customerId}&per_page=200`,
      ),
  })

  const staff = useQuery({
    queryKey: ['staff', 'for-contracts'],
    queryFn: () => apiRequest<{ data: { id: string; name: string }[] }>('/v1/staff?per_page=200'),
  })

  const contractDocs = useQuery({
    queryKey: ['contract-documents'],
    queryFn: () => apiRequest<{ data: DocTemplate[] }>('/v1/document-templates?type=contract'),
  })

  // Picking a different customer invalidates a property chosen for the
  // previous one, which would otherwise be sent with the new contract.
  const arrivedWithLocation = Boolean(params.get('location'))
  useEffect(() => {
    if (arrivedWithLocation) return
    setLocationIds([])
  }, [customerId, arrivedWithLocation])

  // Only fills a service that has not been given one. Picking the first
  // job type for every new service is how every line ends up booking
  // "Lockout" because nobody noticed the default.
  useEffect(() => {
    const first = jobTypes.data?.data[0]?.id
    if (!first) return
    setServices((current) =>
      current.some((sv) => !sv.jobTypeId)
        ? current.map((sv) => (sv.jobTypeId ? sv : { ...sv, jobTypeId: first }))
        : current,
    )
  }, [jobTypes.data])

  const places = useMemo(() => locations.data?.data ?? [], [locations.data])

  /*
   * Equipment under the property it stands at, and only for the properties
   * this agreement covers. An asset belongs to one location, which is what
   * lets the sweep put the right doors on the right visit — so the picker
   * has to show it the same way, or somebody ticks a door and wonders why
   * it never appears on a job at the other block.
   */
  const assetsByPlace = useMemo(() => {
    const all = assets.data?.data ?? []
    return places
      .filter((place) => locationIds.includes(place.id))
      .map((place) => ({
        place,
        items: all.filter((a) => a.customer_service_location_id === place.id),
      }))
      .filter((group) => group.items.length > 0)
  }, [assets.data, places, locationIds])

  // A property dropped from the agreement takes its equipment with it,
  // or the contract is saved covering doors at a place it does not visit.
  useEffect(() => {
    const live = new Set(
      (assets.data?.data ?? [])
        .filter((a) => locationIds.includes(a.customer_service_location_id))
        .map((a) => a.id),
    )
    setServices((current) => {
      let changed = false
      const next = current.map((sv) => {
        const kept = sv.assetIds.filter((id) => live.has(id))
        if (kept.length === sv.assetIds.length) return sv
        changed = true
        return { ...sv, assetIds: kept }
      })
      return changed ? next : current
    })
  }, [locationIds, assets.data])
  const docs = useMemo(() => contractDocs.data?.data ?? [], [contractDocs.data])

  const toggleLocation = (id: string) =>
    setLocationIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )

  /*
   * Take what was read and put it on the form.
   *
   * Only the fields that can be right on their own: the wording, the
   * money, the term, the services. Never the customer and never the
   * properties — those are rows in this workspace, and matching a name off
   * a scan to one of them is a decision, not a lookup.
   *
   * A service whose rhythm could not be read arrives with the blank
   * monthly default, the same as one added by hand. That is deliberate:
   * it is visible and wrong rather than invisible and missing.
   */
  const applyProposal = (p: ReadProposal) => {
    setReadFrom(p)
    if (p.title) setTitle(p.title)
    if (p.starts_on) setStartsOn(p.starts_on)
    if (p.ends_on) setEndsOn(p.ends_on)
    // Cents to the dollars the field holds. Exact: 45000 is 450.00, and
    // this is the number somebody will be billed.
    if (p.fee_cents !== null) setAmount((p.fee_cents / 100).toFixed(2))
    if (p.bill_every_unit) setBillEvery(p.bill_every_unit)

    if (p.services.length) {
      const firstType = jobTypes.data?.data[0]?.id ?? ''
      setServices(
        p.services.map((sv) => ({
          name: sv.name,
          description: sv.description ?? '',
          // The kind of job is a choice about this workspace's board, not
          // something a contract says. It gets the same default a new
          // line gets, and step 2 is where it is chosen.
          jobTypeId: firstType,
          assetIds: [],
          rhythms: sv.rhythms.length
            ? sv.rhythms.map((r) => ({
                count: String(r.interval_count),
                unit: r.interval_unit,
                fromMonth: r.season_start_month ? String(r.season_start_month) : '',
                toMonth: r.season_end_month ? String(r.season_end_month) : '',
              }))
            : blankService().rhythms,
        })),
      )
    }

    setReadOpen(false)
    // Back to the start: the whole point is that they walk through it.
    setStep(0)
  }

  const ready = Boolean(
    customerId &&
      title.trim() &&
      locationIds.length &&
      services.length > 0 &&
      services.every((sv) => sv.name.trim() && sv.jobTypeId),
  )

  const submit = async (start: boolean) => {
    setBusy(true)
    setError(null)
    try {
      const contract = await apiRequest<{ data: { id: string } }>('/v1/maintenance-contracts', {
        method: 'POST',
        body: {
          customer_id: customerId,
          title: title.trim(),
          starts_on: startsOn,
          ends_on: endsOn || null,
          // Exact cents. Money never travels as a float.
          billing_amount_cents: Math.round(Number(amount.replace(/[^0-9.]/g, '') || 0) * 100),
          billing_interval_unit: billEvery,
          billing_interval_count: 1,
          document_template_id: documentId || null,
          supervisor_account_id: supervisorId || null,
          /*
           * A draft agreement does nothing at all: the planner, the
           * sweep and the biller every one of them look only at
           * `active`. Created as a draft and left there, it books no
           * visits and bills nothing, which is not obvious from
           * looking at it.
           */
          status: start ? 'active' : 'draft',
        },
      })

      /*
       * Each service, then its rhythms.
       *
       * A new line always comes back with exactly one rhythm on it,
       * monthly. The first one asked for REPLACES that; the rest are
       * added. Editing rather than adding matters — a leftover monthly
       * rule would sit underneath every season and book visits nobody
       * asked for.
       */
      for (const [si, sv] of services.entries()) {
        const line = await apiRequest<{ data: { id: string; rules: { id: string }[] } }>(
          `/v1/maintenance-contracts/${contract.data.id}/services`,
          {
            method: 'POST',
            body: {
              name: sv.name.trim(),
              description: sv.description.trim() || null,
              job_type_id: sv.jobTypeId,
              service_location_ids: locationIds,
              asset_ids: sv.assetIds,
              sort_order: si,
            },
          },
        )

        const base = `/v1/maintenance-contracts/${contract.data.id}/services/${line.data.id}/rules`
        const defaultRule = line.data.rules?.[0]

        for (const [ri, r] of sv.rhythms.entries()) {
          const seasonal = r.fromMonth !== '' && r.toMonth !== ''
          const body = {
            interval_count: Number(r.count),
            interval_unit: r.unit,
            season_start_month: seasonal ? Number(r.fromMonth) : null,
            season_start_day: seasonal ? 1 : null,
            season_end_month: seasonal ? Number(r.toMonth) : null,
            // The last day of the closing month, so a season runs to the
            // end of it. 31 is clamped where the month is shorter.
            season_end_day: seasonal ? 31 : null,
            label: seasonal
              ? `${MONTHS[Number(r.fromMonth) - 1]}–${MONTHS[Number(r.toMonth) - 1]}`
              : null,
            // A season beats the all-year rule where they overlap, which
            // is the whole reason for setting one.
            priority: seasonal ? 1 : 0,
          }

          if (ri === 0 && defaultRule) {
            await apiRequest(`${base}/${defaultRule.id}`, { method: 'PATCH', body })
          } else {
            await apiRequest(base, { method: 'POST', body })
          }
        }
      }

      // Place the dates straight away, so an agreement that is live
      // shows its schedule instead of an empty page until the nightly
      // run. Writes visit rows only — no jobs, no invoices.
      if (start) {
        await apiRequest(`/v1/maintenance-contracts/${contract.data.id}/plan-visits`, {
          method: 'POST',
          body: {},
        }).catch(() => null)
      }

      navigate(`/maintenance-contracts/${contract.data.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create that agreement.')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1640px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div
        className={
          easy
            ? 'mb-5 rounded-2xl border border-emerald-900 bg-emerald-950 px-5 py-6 shadow-sm sm:px-7'
            : 'mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5'
        }
      >
        <Link
          to="/maintenance-contracts"
          className={`mb-1 inline-flex items-center gap-1 text-sm font-medium hover:underline ${
            easy ? 'text-emerald-200' : 'text-amber-700'
          }`}
        >
          ← Back to service agreements
        </Link>
        <div className="flex flex-wrap items-end gap-3">
          <h1
            className={
              easy
                ? 'text-3xl font-semibold tracking-tight text-white sm:text-4xl'
                : 'text-2xl font-semibold tracking-tight text-slate-950'
            }
          >
            New service agreement
          </h1>
          <span
            className={`mb-1 text-xs font-medium uppercase tracking-[0.18em] ${
              easy ? 'text-emerald-200' : 'text-slate-400'
            }`}
          >
            Scheduled work
          </span>
        </div>
        <p className={`mt-2 max-w-3xl text-sm ${easy ? 'text-emerald-100' : 'text-slate-500'}`}>
          Work you have agreed to do on a schedule, for a fee. CrewBarn places the visit dates, puts them on the
          board as jobs when they come due, and invoices the fee each period.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {/*
            Four steps, because the whole thing at once is a wall and the
            answers arrive in this order anyway: who, what, how much,
            and the paperwork.
          */}
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-navy-100 bg-white px-4 py-3">
            {STEP_NAMES.map((name, i) => (
              <li key={name} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${
                    i === step ? 'text-navy-900' : 'text-navy-400 hover:text-navy-600'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      i < step
                        ? 'bg-emerald-500 text-white'
                        : i === step
                          ? 'bg-amber-500 text-white'
                          : 'bg-navy-100 text-navy-500'
                    }`}
                  >
                    {i < step ? '✓' : i + 1}
                  </span>
                  {name}
                </button>
                {i < STEP_NAMES.length - 1 && <span className="text-navy-200">·</span>}
              </li>
            ))}
          </ol>

          {step === 0 && (
        <section className={SECTION}>
          {/*
            Most shops arrive with the work already sold. The alternative
            to reading the contract they already have is typing all of it
            in again from the paper, which is the job nobody does — so the
            agreement stays in the cabinet and CrewBarn schedules none of
            it. Offered before the empty form, not after it.
          */}
          {!readFrom && (
            <button
              type="button"
              onClick={() => setReadOpen(true)}
              className="mb-4 flex w-full items-start gap-3 rounded-lg border border-dashed border-navy-300 px-4 py-3 text-left transition-colors hover:border-amber-400 hover:bg-amber-50/40 sm:mb-5"
            >
              <span className="mt-0.5 text-lg leading-none">📄</span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-navy-800">
                  Already have this agreement on paper?
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-navy-500">
                  Upload the signed contract and CrewBarn will read the services, the rhythms,
                  the fee and the term off it — then you check every step before anything is
                  saved.
                </span>
              </span>
            </button>
          )}

          {readFrom && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50/60 px-4 py-3 sm:mb-5">
              <p className="text-sm font-medium text-navy-800">Filled in from the contract you uploaded</p>
              <p className="mt-1 text-xs leading-relaxed text-navy-600">
                Read by a machine off a document, so go through all four steps and correct
                anything that is wrong. Nothing has been saved yet.
              </p>

              {/* The customer and the properties were deliberately NOT
                  filled in — they have to be records in this workspace.
                  What the contract said is shown instead, to match up. */}
              {(readFrom.customer_name || readFrom.properties.length > 0) && (
                <div className="mt-2 border-t border-amber-200 pt-2 text-xs leading-relaxed text-navy-600">
                  <p className="font-medium text-navy-700">You still have to pick these yourself:</p>
                  {readFrom.customer_name && (
                    <p className="mt-0.5">
                      The contract names <span className="font-medium">{readFrom.customer_name}</span>.
                    </p>
                  )}
                  {readFrom.properties.length > 0 && (
                    <p className="mt-0.5">
                      Properties on it: {readFrom.properties.join(' · ')}
                    </p>
                  )}
                </div>
              )}

              {readFrom.uncertain.length > 0 && (
                <div className="mt-2 border-t border-amber-200 pt-2">
                  <p className="text-xs font-medium text-navy-700">
                    Not in the document — check {readFrom.uncertain.length === 1 ? 'this' : 'these'}:
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {readFrom.uncertain.map((u, i) => (
                      <li key={i} className="text-xs leading-relaxed text-navy-600">
                        · {u}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="mb-4 sm:mb-5">
            <h2 className={HEADING}>Who it is for</h2>
            <p className={SUB}>The customer, and which of their properties this covers.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Two columns of the three. A name plus the "new customer"
                button in a single narrow cell left barely half a field for
                the name itself, and everything past it was cut. */}
            <div className="lg:col-span-2">
              <span className={LABEL}>Customer</span>
              {/* A typeahead, not a list. A dropdown of every customer is
                  unusable past the first hundred, and the shop knows the
                  name — they should be able to type it. */}
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <CustomerPicker
                    value={picked}
                    onChange={(c) => {
                      setPicked(c)
                      setCustomerId(c?.id ?? '')
                    }}
                    disabled={addingCustomer}
                  />
                </div>
                {!picked && !addingCustomer && (
                  <button
                    type="button"
                    onClick={() => setAddingCustomer(true)}
                    className="whitespace-nowrap rounded-md border border-amber-500 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50"
                  >
                    + New customer
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className={LABEL} htmlFor="sa-title">What to call it</label>
              <input
                id="sa-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Quarterly service plan"
                className={FIELD}
              />
            </div>
          </div>

          {addingCustomer && (
            <div className="mt-3">
              <InlineQuickAddCustomer
                onCreated={(c) => {
                  setPicked(c)
                  setCustomerId(c.id)
                  setAddingCustomer(false)
                  // Their first property should be there to tick without a
                  // reload: the agreement is about to cover it.
                  locations.refetch()
                }}
                onCancel={() => setAddingCustomer(false)}
              />
            </div>
          )}

          <div className="mt-4">
            <p className={LABEL}>Which properties</p>

            {!customerId && <p className="text-sm text-navy-400">Pick a customer first.</p>}
            {customerId && locations.isLoading && (
              <p className="text-sm text-navy-400">Loading properties…</p>
            )}
            {customerId && !locations.isLoading && places.length === 0 && (
              <p className="text-sm text-navy-500">
                This customer has no service locations yet. Add one on their record first.
              </p>
            )}

            <div className="space-y-2">
              {places.map((place) => {
                const picked = locationIds.includes(place.id)
                const street = addressOf(place)
                return (
                  <label
                    key={place.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                      picked ? 'border-amber-400 bg-amber-50/60' : 'border-navy-200 hover:border-navy-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={picked}
                      onChange={() => toggleLocation(place.id)}
                      className="mt-0.5 rounded border-navy-300"
                    />
                    <span className="min-w-0">
                      {/* The street first: it is what a person recognises.
                          A nickname is a label they gave it, not the place. */}
                      <span className="block text-sm font-medium text-navy-800">
                        {street || 'No address on this property'}
                      </span>
                      {(place.nickname || place.is_primary) && (
                        <span className="mt-0.5 block text-xs text-navy-500">
                          {place.nickname}
                          {place.nickname && place.is_primary ? ' · ' : ''}
                          {place.is_primary ? 'Primary' : ''}
                        </span>
                      )}
                    </span>
                  </label>
                )
              })}
            </div>

            {locationIds.length > 1 && (
              <p className="mt-2 text-xs text-navy-500">
                {locationIds.length} properties — each one gets its own visit and its own job.
              </p>
            )}
          </div>
        </section>
          )}

          {step === 1 && (
        <section className={SECTION}>
          <div className="mb-4 sm:mb-5">
            <h2 className={HEADING}>What you will do</h2>
            <p className={SUB}>
              One card per service. Two different trades on one agreement is two services, each with its own
              rhythm — not two agreements.
            </p>
          </div>

          <div className="space-y-3">
            {services.map((sv, si) => (
              <div key={si} className="rounded-md border border-navy-200 bg-white p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <div>
                    <label className={LABEL} htmlFor={`sa-svc-${si}`}>The service</label>
                    <input
                      id={`sa-svc-${si}`}
                      value={sv.name}
                      onChange={(e) => setService(si, { name: e.target.value })}
                      placeholder={si === 0 ? 'Lock service' : 'Grounds care'}
                      className={FIELD}
                    />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor={`sa-jt-${si}`}>Books this kind of job</label>
                    <select
                      id={`sa-jt-${si}`}
                      value={sv.jobTypeId}
                      onChange={(e) => setService(si, { jobTypeId: e.target.value })}
                      className={FIELD}
                    >
                      {(jobTypes.data?.data ?? []).map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  {services.length > 1 && (
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => setServices(services.filter((_, x) => x !== si))}
                        className="mb-1 text-xs font-medium text-danger hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <label className={LABEL} htmlFor={`sa-desc-${si}`}>
                    What this involves
                  </label>
                  <textarea
                    id={`sa-desc-${si}`}
                    value={sv.description}
                    onChange={(e) => setService(si, { description: e.target.value })}
                    rows={2}
                    placeholder="e.g. Check and lubricate all door hardware, test every lock, adjust closers, replace worn parts under $50"
                    className={FIELD}
                  />
                  {/* The drafted contract describes the work from this. A
                      name alone gives it nothing to describe, which is why
                      the wording came out thin. */}
                  <p className="mt-1 text-xs leading-relaxed text-navy-500">
                    Written into the agreement, so the customer knows what they are buying.
                  </p>
                </div>

                {/*
                  The equipment this line covers.

                  Only shown once properties are chosen, because equipment
                  is listed under the property it stands at and there is
                  nothing to list it under before then.
                */}
                {locationIds.length > 0 && (
                  <div className="mt-3">
                    <p className={LABEL}>What this covers</p>

                    {assets.isLoading && (
                      <p className="text-sm text-navy-400">Loading equipment…</p>
                    )}

                    {!assets.isLoading && assetsByPlace.length === 0 && (
                      <p className="text-sm leading-relaxed text-navy-500">
                        No equipment on record at{' '}
                        {locationIds.length > 1 ? 'these properties' : 'this property'}. You can
                        add it later — the agreement works either way, it just will not name
                        what was serviced.
                      </p>
                    )}

                    {assetsByPlace.map(({ place, items }) => (
                      <div key={place.id} className="mt-2">
                        {/* The property only earns a heading when there is
                            more than one; on a single-property agreement it
                            is a label for something nobody is choosing
                            between. */}
                        {assetsByPlace.length > 1 && (
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-navy-500">
                            {addressOf(place) || 'This property'}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          {items.map((asset) => {
                            const on = sv.assetIds.includes(asset.id)
                            return (
                              <label
                                key={asset.id}
                                className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors ${
                                  on
                                    ? 'border-amber-400 bg-amber-50/60 text-navy-800'
                                    : 'border-navy-200 text-navy-600 hover:border-navy-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() =>
                                    setService(si, {
                                      assetIds: on
                                        ? sv.assetIds.filter((x) => x !== asset.id)
                                        : [...sv.assetIds, asset.id],
                                    })
                                  }
                                  className="rounded border-navy-300"
                                />
                                <span>{asset.name || asset.asset_code || 'Unnamed'}</span>
                                {asset.asset_type?.name && (
                                  <span className="text-xs text-navy-400">
                                    {asset.asset_type.name}
                                  </span>
                                )}
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    ))}

                    {sv.assetIds.length > 0 && (
                      <p className="mt-1.5 text-xs leading-relaxed text-navy-500">
                        {sv.assetIds.length} covered. Each visit arrives carrying the ones at the
                        property it is for, so the job's record says which were seen.
                      </p>
                    )}
                  </div>
                )}

                {/*
                  How often, per service, as "normally, except".
                  Two rows that look identical do not say which applies
                  when, and letting the all-year one be deleted leaves a
                  service that only runs in winter.
                */}
                <div className="mt-3 rounded-md border border-navy-200 bg-navy-50/40 p-3">
                  <span className={LABEL}>How often</span>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-20 shrink-0 text-sm font-semibold text-navy-700">Normally</span>
                    <>
                      <select
                        value={cadenceKey(sv.rhythms[0].count, sv.rhythms[0].unit)}
                        onChange={(e) => {
                          const hit = CADENCES.find((c) => c.label === e.target.value)
                          // "Custom" keeps whatever is there and shows the
                          // number, rather than resetting what they chose.
                          if (hit) setRhythm(si, 0, { count: hit.count, unit: hit.unit })
                          else setRhythm(si, 0, { count: sv.rhythms[0].count, unit: sv.rhythms[0].unit })
                        }}
                        aria-label="How often"
                        className="min-w-[13rem] rounded-md border border-navy-200 bg-white px-2 py-1.5 text-sm text-navy-800"
                      >
                        {CADENCES.map((c) => (
                          <option key={c.label} value={c.label}>{c.label}</option>
                        ))}
                        <option value="">Custom…</option>
                      </select>

                      {cadenceKey(sv.rhythms[0].count, sv.rhythms[0].unit) === '' && (
                        <>
                          <span className="text-sm text-navy-600">every</span>
                          <input
                            value={sv.rhythms[0].count}
                            onChange={(e) => setRhythm(si, 0, { count: e.target.value.replace(/\D/g, '') || '1' })}
                            inputMode="numeric"
                            aria-label="How many"
                            className="w-14 rounded-md border border-navy-200 bg-white px-2 py-1.5 text-sm text-navy-800"
                          />
                          <select
                            value={sv.rhythms[0].unit}
                            onChange={(e) => setRhythm(si, 0, { unit: e.target.value })}
                            aria-label="Weeks, months or years"
                            className="min-w-[7.5rem] rounded-md border border-navy-200 bg-white px-2 py-1.5 text-sm text-navy-800"
                          >
                            <option value="week">{unitWord('week', sv.rhythms[0].count)}</option>
                            <option value="month">{unitWord('month', sv.rhythms[0].count)}</option>
                            <option value="year">{unitWord('year', sv.rhythms[0].count)}</option>
                          </select>
                        </>
                      )}
                    </>
                  </div>

                  {sv.rhythms.slice(1).map((r, idx) => {
                    const ri = idx + 1
                    return (
                      <div key={ri} className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="w-20 shrink-0 text-sm font-semibold text-navy-700">But from</span>
                        <select
                          value={r.fromMonth}
                          onChange={(e) => setRhythm(si, ri, { fromMonth: e.target.value })}
                          aria-label="From month"
                          className="min-w-[6.5rem] rounded-md border border-navy-200 bg-white px-2 py-1.5 text-sm text-navy-800"
                        >
                          {MONTHS.map((m, x) => (
                            <option key={m} value={String(x + 1)}>{m}</option>
                          ))}
                        </select>
                        <span className="text-sm text-navy-600">to</span>
                        <select
                          value={r.toMonth}
                          onChange={(e) => setRhythm(si, ri, { toMonth: e.target.value })}
                          aria-label="To month"
                          className="min-w-[6.5rem] rounded-md border border-navy-200 bg-white px-2 py-1.5 text-sm text-navy-800"
                        >
                          {MONTHS.map((m, x) => (
                            <option key={m} value={String(x + 1)}>{m}</option>
                          ))}
                        </select>
                        <>
                      <select
                        value={cadenceKey(r.count, r.unit)}
                        onChange={(e) => {
                          const hit = CADENCES.find((c) => c.label === e.target.value)
                          // "Custom" keeps whatever is there and shows the
                          // number, rather than resetting what they chose.
                          if (hit) setRhythm(si, ri, { count: hit.count, unit: hit.unit })
                          else setRhythm(si, ri, { count: r.count, unit: r.unit })
                        }}
                        aria-label="How often"
                        className="min-w-[13rem] rounded-md border border-navy-200 bg-white px-2 py-1.5 text-sm text-navy-800"
                      >
                        {CADENCES.map((c) => (
                          <option key={c.label} value={c.label}>{c.label}</option>
                        ))}
                        <option value="">Custom…</option>
                      </select>

                      {cadenceKey(r.count, r.unit) === '' && (
                        <>
                          <span className="text-sm text-navy-600">every</span>
                          <input
                            value={r.count}
                            onChange={(e) => setRhythm(si, ri, { count: e.target.value.replace(/\D/g, '') || '1' })}
                            inputMode="numeric"
                            aria-label="How many"
                            className="w-14 rounded-md border border-navy-200 bg-white px-2 py-1.5 text-sm text-navy-800"
                          />
                          <select
                            value={r.unit}
                            onChange={(e) => setRhythm(si, ri, { unit: e.target.value })}
                            aria-label="Weeks, months or years"
                            className="min-w-[7.5rem] rounded-md border border-navy-200 bg-white px-2 py-1.5 text-sm text-navy-800"
                          >
                            <option value="week">{unitWord('week', r.count)}</option>
                            <option value="month">{unitWord('month', r.count)}</option>
                            <option value="year">{unitWord('year', r.count)}</option>
                          </select>
                        </>
                      )}
                    </>
                        <button
                          type="button"
                          onClick={() =>
                            setService(si, { rhythms: sv.rhythms.filter((_, x) => x !== ri) })
                          }
                          className="ml-auto text-xs font-medium text-danger hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    )
                  })}

                  <button
                    type="button"
                    onClick={() =>
                      setService(si, {
                        rhythms: [...sv.rhythms, { count: '2', unit: 'week', fromMonth: '11', toMonth: '3' }],
                      })
                    }
                    className="mt-3 rounded-md border-2 border-dashed border-navy-200 bg-white px-3 py-1.5 text-sm font-medium text-navy-600 transition-colors hover:border-amber-400 hover:text-amber-600"
                  >
                    + Different for part of the year
                  </button>

                  {/* The schedule said back, in a sentence. Dropdowns say
                      what was configured, not what will happen. */}
                  <p className="mt-3 border-t border-navy-200 pt-2.5 text-sm leading-relaxed text-navy-700">
                    <span className="font-semibold">So:</span>{' '}
                    {sv.name.trim() ? `${sv.name.trim()} — ` : ''}
                    {describeRhythms(sv.rhythms)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setServices([...services, blankService(jobTypes.data?.data[0]?.id ?? '')])}
            className="mt-3 rounded-md border-2 border-dashed border-navy-200 px-4 py-2 text-sm font-medium text-navy-600 transition-colors hover:border-amber-400 hover:text-amber-600"
          >
            + Add another service
          </button>

          <p className="mt-2 text-xs leading-relaxed text-navy-500">
            Every service runs at every property picked above, and each visit becomes its own job.
          </p>
        </section>
          )}

          {step === 2 && (
        <section className={SECTION}>
          <div className="mb-4 sm:mb-5">
            <h2 className={HEADING}>The money and the term</h2>
            <p className={SUB}>The fee covers the visits — they are never invoiced separately.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={LABEL} htmlFor="sa-fee">Fee</label>
              <input
                id="sa-fee"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="450.00"
                className={FIELD}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="sa-cadence">Billed every</label>
              <select id="sa-cadence" value={billEvery} onChange={(e) => setBillEvery(e.target.value)} className={FIELD}>
                <option value="week">week</option>
                <option value="month">month</option>
                <option value="year">year</option>
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="sa-starts">Starts</label>
              <input id="sa-starts" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="sa-ends">Ends</label>
              <input id="sa-ends" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className={FIELD} />
            </div>
          </div>

          <div className="mt-4 max-w-sm">
            <label className={LABEL} htmlFor="sa-supervisor">Who looks after it</label>
            <select
              id="sa-supervisor"
              value={supervisorId}
              onChange={(e) => setSupervisorId(e.target.value)}
              className={FIELD}
            >
              <option value="">Nobody in particular</option>
              {(staff.data?.data ?? []).map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </select>
            {/* The supervisor is not decoration: the contract's reminders
                land on them, "whose agreement is this?" resolves to them,
                and they are the fallback lead on every job it books. */}
            <p className="mt-1 text-xs leading-relaxed text-navy-500">
              They get the renewal reminders, and they are the lead on any job this books that has no tech of its
              own.
            </p>
          </div>
        </section>
          )}

          {step === 3 && (
        <section className={SECTION}>
          <div className="mb-4 sm:mb-5">
            <h2 className={HEADING}>The contract itself</h2>
            <p className={SUB}>The wording the customer signs. Optional — you can attach it later.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label className={LABEL} htmlFor="sa-doc">Attach a contract</label>
              <select id="sa-doc" value={documentId} onChange={(e) => setDocumentId(e.target.value)} className={FIELD}>
                <option value="">No contract attached</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {/* The generated one is already called "…(draft)";
                        appending another read "(draft) (draft)". */}
                    {d.name}{d.active === false && !/draft/i.test(d.name) ? ' (draft)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setDraftOpen(true)}
              className="rounded-md border-2 border-dashed border-navy-200 px-4 py-2 text-sm font-medium text-navy-600 transition-colors hover:border-amber-400 hover:text-amber-600"
            >
              Draft one for me
            </button>
          </div>

          {documentId && (
            <p className="mt-3 text-xs text-navy-500">
              Attached. Edit the wording any time in{' '}
              <Link to={`/custom-documents/document/${documentId}`} className="text-amber-600 hover:underline">
                Templates &amp; Forms
              </Link>
              .
            </p>
          )}
        </section>
          )}

        </div>

        <ContractSummary
          customer={picked?.display_name ?? ''}
          title={title}
          properties={locationIds.length}
          services={services}
          amount={amount}
          billEvery={billEvery}
          startsOn={startsOn}
          endsOn={endsOn}
        />
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {step === STEP_NAMES.length - 1 && (
        <p className="mt-5 text-right text-xs leading-relaxed text-navy-500">
          Starting it places the visit dates now. A draft sits there doing nothing until you start it — no visits,
          no jobs, no invoices.
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        {step === 0 ? (
          <Link
            to="/maintenance-contracts"
            className="rounded-md border border-navy-200 bg-white px-4 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50"
          >
            Cancel
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="rounded-md border border-navy-200 bg-white px-4 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50"
          >
            Back
          </button>
        )}

        {step < STEP_NAMES.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Next: {STEP_NAMES[step + 1]}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={!ready || busy}
              onClick={() => submit(false)}
              className="rounded-md border border-navy-200 bg-white px-4 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50 disabled:opacity-50"
            >
              Save as a draft
            </button>
            <button
              type="button"
              disabled={!ready || busy}
              onClick={() => submit(true)}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {busy ? 'Starting…' : 'Start the agreement'}
            </button>
          </>
        )}
      </div>

      {/* Said on the last step, where the buttons are, rather than as a
          disabled button somebody has to guess the reason for. */}
      {step === STEP_NAMES.length - 1 && !ready && (
        <p className="mt-2 text-right text-xs text-navy-500">
          Still needed: a customer, a name, at least one property, and a service with a name and a job type.
        </p>
      )}

      {/* Its own `open` prop rather than a conditional, so the file
          picker's state is thrown away when it closes. */}
      <ReadContractOverlay
        open={readOpen}
        onClose={() => setReadOpen(false)}
        onRead={applyProposal}
      />

      {draftOpen && (
        <ContractDraftOverlay
          facts={{
            customer: picked?.display_name ?? '',
            properties: places
              .filter((pl) => locationIds.includes(pl.id))
              .map((pl) => addressOf(pl))
              .filter(Boolean)
              .join('; '),
            // Each service with its rhythm in words, so the draft can put
            // the real schedule in the document instead of a placeholder.
            services: services
              .filter((sv) => sv.name.trim())
              .map((sv) => {
                const what = sv.description.trim()
                return `${sv.name.trim()} — ${describeRhythms(sv.rhythms)}${what ? ` Involves: ${what}` : ''}`
              })
              .join(' '),
            fee: amount.trim() ? `${amount.trim()} every ${billEvery}` : '',
            term: `${startsOn} to ${endsOn || 'no end date'}`,
          }}
          onClose={() => setDraftOpen(false)}
          onDrafted={(id) => {
            setDocumentId(id)
            setDraftOpen(false)
            contractDocs.refetch()
          }}
        />
      )}
    </div>
  )
}

/**
 * The document without its HTML wrapper, for reading.
 *
 * The body carries the not-a-law-firm notice as a styled div and the rest
 * as markdown. Stripping tags leaves something a person can actually read
 * in a preview pane.
 */
function plainBody(body: string): string {
  return body
    // Whole elements first. Stripping only the tags would leave the
    // stylesheet's rules sitting in the preview as if they were part of
    // the contract, which is what it did.
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Drafting the wording, without leaving the agreement.
 *
 * The acknowledgement is not a formality and is not skippable: it is what
 * makes the shop, rather than CrewBarn, the one who decided this contract
 * was fit to send. It is typed rather than ticked, because a box is
 * clicked past, and the record of who accepted and when is the point. The
 * server enforces the same gate, so closing this dialog is not a way
 * around it.
 */
/**
 * Reading a contract the shop already has.
 *
 * Two things this must not do. It must not save anything — the result is
 * a starting point for a form, and the shop is the one who commits it. And
 * it must not close the moment the file comes back: pressing a button and
 * watching a dialog vanish tells you nothing about what was read, and what
 * was read here decides when crews turn up for a year.
 *
 * So the proposal is shown in full first, with what could NOT be found
 * given as much room as what could. A field the reader left blank is the
 * one worth looking at.
 */
function ReadContractOverlay({
  open,
  onClose,
  onRead,
}: {
  open: boolean
  onClose: () => void
  onRead: (p: ReadProposal) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proposal, setProposal] = useState<ReadProposal | null>(null)
  const [fileName, setFileName] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  if (!open) return null

  const upload = async (file: File) => {
    setBusy(true)
    setError(null)
    setProposal(null)
    setFileName(file.name)
    try {
      // Raw fetch, not apiRequest: that helper JSON-stringifies every
      // body, which would post "{}" and upload nothing at all. Same
      // pattern as every other upload in the app.
      const fd = new FormData()
      fd.append('file', file)
      const token = getStoredToken()
      const actingTenant = getActingTenant()
      const resp = await fetch(`${API_URL}/v1/maintenance-contracts/read-document`, {
        method: 'POST',
        body: fd,
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(actingTenant ? { 'X-Act-As-Tenant': actingTenant } : {}),
        },
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok || !body?.data) {
        throw new Error(body?.message ?? 'The contract could not be read.')
      }
      setProposal(body.data as ReadProposal)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The contract could not be read.')
    } finally {
      setBusy(false)
    }
  }

  const counts = proposal
    ? [
        `${proposal.services.length} ${proposal.services.length === 1 ? 'service' : 'services'}`,
        proposal.properties.length ? `${proposal.properties.length} properties` : null,
        proposal.fee_cents !== null
          ? `$${(proposal.fee_cents / 100).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}${proposal.bill_every_unit ? ` every ${proposal.bill_every_count ?? 1} ${proposal.bill_every_unit}` : ''}`
          : null,
      ].filter(Boolean)
    : []

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-900/50 p-4 sm:p-8">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-navy-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-navy-900">Read a contract you already have</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-navy-500">
              A PDF or a photo of the pages. Nothing is saved — what comes back fills in the
              form for you to check.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded p-1 text-navy-400 hover:bg-navy-50 hover:text-navy-700 disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          {!proposal && (
            <>
              <label
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
                  busy ? 'border-navy-200 bg-navy-50' : 'border-navy-300 hover:border-amber-400 hover:bg-amber-50/40'
                }`}
              >
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                  disabled={busy}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) upload(f)
                  }}
                />
                {busy ? (
                  <>
                    <span className="text-sm font-medium text-navy-700">Reading {fileName}…</span>
                    <span className="text-xs text-navy-500">
                      A long agreement takes a while. Leave this open.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl leading-none">📄</span>
                    <span className="text-sm font-medium text-navy-700">Choose the signed contract</span>
                    <span className="text-xs text-navy-500">PDF, or a photo of the pages · up to 20MB</span>
                  </>
                )}
              </label>

              {error && (
                <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm leading-relaxed text-red-700">
                  {error}
                </p>
              )}
            </>
          )}

          {proposal && (
            <>
              <p className="text-sm text-navy-700">
                Read from <span className="font-medium">{fileName}</span>
                {counts.length > 0 && <> — {counts.join(', ')}.</>}
              </p>

              {/* What could NOT be found gets the top of the dialog and a
                  border, because it is the part that decides whether this
                  is safe to use. A blank field nobody looks at is how a
                  wrong schedule gets agreed to. */}
              {proposal.uncertain.length > 0 && (
                <div className="mt-3 rounded-md border border-amber-300 bg-amber-50/70 px-3 py-2.5">
                  <p className="text-sm font-medium text-navy-800">
                    Not in the document. You will have to fill {proposal.uncertain.length === 1 ? 'this' : 'these'} in:
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {proposal.uncertain.map((u, i) => (
                      <li key={i} className="text-sm leading-relaxed text-navy-700">· {u}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-3 space-y-2">
                {proposal.services.map((sv, i) => (
                  <div key={i} className="rounded-md border border-navy-200 px-3 py-2">
                    <p className="text-sm font-medium text-navy-800">{sv.name}</p>
                    {sv.description && (
                      <p className="mt-0.5 text-xs leading-relaxed text-navy-600">{sv.description}</p>
                    )}
                    <p className="mt-1 text-xs text-navy-500">
                      {sv.rhythms.length === 0
                        ? 'How often is not stated — you will pick it.'
                        : sv.rhythms
                            .map((r) => {
                              const every = `every ${r.interval_count} ${r.interval_unit}${
                                r.interval_count === 1 ? '' : 's'
                              }`
                              return r.season_start_month && r.season_end_month
                                ? `${every}, ${MONTHS[r.season_start_month - 1]}–${MONTHS[r.season_end_month - 1]}`
                                : `${every}, all year`
                            })
                            .join(' · ')}
                    </p>
                  </div>
                ))}
              </div>

              {(proposal.customer_name || proposal.properties.length > 0) && (
                <div className="mt-3 rounded-md bg-navy-50 px-3 py-2">
                  <p className="text-xs font-medium text-navy-700">
                    These are read off the page, not matched to your records — you pick them:
                  </p>
                  {proposal.customer_name && (
                    <p className="mt-0.5 text-xs text-navy-600">Customer: {proposal.customer_name}</p>
                  )}
                  {proposal.properties.length > 0 && (
                    <p className="mt-0.5 text-xs leading-relaxed text-navy-600">
                      Properties: {proposal.properties.join(' · ')}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setProposal(null); setFileName('') }}
                  className="rounded-md border border-navy-200 px-3 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50"
                >
                  Try another file
                </button>
                <button
                  type="button"
                  onClick={() => onRead(proposal)}
                  className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Fill the form in with this
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ContractDraftOverlay({
  facts,
  onClose,
  onDrafted,
}: {
  facts: { customer: string; properties: string; services: string; fee: string; term: string }
  onClose: () => void
  onDrafted: (templateId: string) => void
}) {
  const [terms, setTerms] = useState<Terms | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // What was written. Held here rather than closing on success: pressing
  // a button and watching a dialog vanish tells you nothing about the
  // document it just produced, and this one is a contract.
  const [drafted, setDrafted] = useState<{ id: string; name: string; body: string } | null>(null)

  // The two lists every service agreement argument is really about.
  // Seeded with what follows from any agreement, so the draft is never
  // blank here — the shop edits rather than starts from nothing.
  const [covers, setCovers] = useState('The scheduled visits listed above\nLabour on those visits')
  const [excludes, setExcludes] = useState(
    'Parts and materials\nWork outside the services listed above\nAfter-hours and emergency callouts',
  )

  useEffect(() => {
    apiRequest<{ data: Terms }>('/v1/legal/contract-terms')
      .then((res) => setTerms(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the terms.'))
  }, [])

  // Escape closes it, as every other overlay in the app does.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const needsAcceptance = !terms?.accepted || terms.reaccept_required

  const accept = async () => {
    if (!terms) return
    setBusy(true)
    setError(null)
    try {
      const res = await apiRequest<{ data: Terms }>('/v1/legal/contract-terms/accept', {
        method: 'POST',
        body: { confirm: true, version: terms.version },
      })
      setTerms(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record that.')
    } finally {
      setBusy(false)
    }
  }

  const generate = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await apiRequest<{ data: { id: string } }>('/v1/legal/contract-generate', {
        method: 'POST',
        body: {
          details: {
            ...facts,
            covers: covers.trim(),
            excludes: excludes.trim(),
          },
        },
      })

      // Read it back so there is something to show. If that fails the
      // document still exists and is still attachable — the preview is
      // the part that failed, not the drafting.
      const full = await apiRequest<{ data: { id: string; name: string; body: string } }>(
        `/v1/document-templates/${res.data.id}`,
      ).catch(() => null)

      setDrafted({
        id: res.data.id,
        name: full?.data.name ?? 'Service agreement (draft)',
        body: full?.data.body ?? '',
      })
      setBusy(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not draft the contract.')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Draft a service contract"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-[640px] rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-navy-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-navy-900">Draft a service contract</h2>
            <p className="mt-0.5 text-xs text-navy-500">
              You get an editable draft, switched off until you turn it on.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-navy-400 hover:bg-navy-50 hover:text-navy-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {!terms && !drafted && <p className="text-sm text-navy-500">{error ?? 'Loading…'}</p>}

          {drafted && (
            <>
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Written, and switched off. Read it before you use it — a lawyer should see it first.
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-navy-500">
                {drafted.name}
              </p>
              {/* Plain text on purpose. The body is the tenant's own
                  markup, and rendering it as HTML inside the app would be
                  an injection path for the sake of a prettier preview —
                  the editor is where it gets rendered properly. */}
              <pre className="mt-1.5 max-h-[42vh] overflow-auto whitespace-pre-wrap rounded-md border border-navy-100 bg-navy-50/40 p-3 font-sans text-[13px] leading-relaxed text-navy-700">
                {plainBody(drafted.body)}
              </pre>
            </>
          )}

          {terms && !drafted && (
            <>
              <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
                <h3 className="text-sm font-bold text-amber-900">{terms.heading}</h3>
                <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-amber-900">
                  {terms.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span aria-hidden>•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {!needsAcceptance && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={LABEL}>Included in the fee</span>
                    <textarea
                      value={covers}
                      onChange={(e) => setCovers(e.target.value)}
                      rows={4}
                      className={FIELD}
                    />
                  </label>
                  <label className="block">
                    <span className={LABEL}>Charged separately</span>
                    <textarea
                      value={excludes}
                      onChange={(e) => setExcludes(e.target.value)}
                      rows={4}
                      className={FIELD}
                    />
                  </label>
                  <p className="text-xs leading-relaxed text-navy-500 sm:col-span-2">
                    One per line. These become the two lists in the agreement — the ones every argument about a
                    service plan is really about. The services and rhythms you set are written in as well.
                  </p>
                </div>
              )}

              {needsAcceptance ? (
                <div className="mt-4">
                  {terms.reaccept_required && (
                    <p className="mb-2 text-sm font-semibold text-amber-900">
                      This wording has changed since you last read it. Please read it again.
                    </p>
                  )}
                  <label className={LABEL} htmlFor="sa-ack">
                    Type <span className="font-mono normal-case">I understand</span> to continue
                  </label>
                  <input
                    id="sa-ack"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="I understand"
                    className={`${FIELD} sm:w-64`}
                  />
                </div>
              ) : (
                <div className="mt-4 rounded-md border border-navy-100 bg-navy-50/50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">
                    Where to have it read
                  </p>
                  <ul className="mt-1.5 space-y-2 text-sm leading-relaxed text-navy-600">
                    {terms.where_to_get_it_reviewed.map((place) => (
                      <li key={place.label}>
                        <span className="font-semibold text-navy-800">{place.label}</span>
                        <span className="block">{place.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {error && (
                <p className="mt-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm font-semibold text-danger">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-navy-100 px-5 py-4">
          {drafted ? (
            <>
              <Link
                to={`/custom-documents/document/${drafted.id}`}
                className="rounded-md border border-navy-200 bg-white px-4 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50"
              >
                Open and edit
              </Link>
              <button
                type="button"
                onClick={() => onDrafted(drafted.id)}
                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
              >
                Attach it
              </button>
            </>
          ) : (
            <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-navy-200 bg-white px-4 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50"
          >
            Cancel
          </button>
          {needsAcceptance ? (
            <button
              type="button"
              onClick={accept}
              disabled={typed.trim().toLowerCase() !== 'i understand' || busy || !terms}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              Record this
            </button>
          ) : (
            <button
              type="button"
              onClick={generate}
              disabled={busy}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {busy ? 'Drafting…' : 'Draft the contract'}
            </button>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
