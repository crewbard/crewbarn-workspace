import { useEffect, useRef, useState } from 'react'
import { CopyValueBox, type StepProps } from '@/components/onboarding/steps/shared'
import {
  ConnectCloudflare,
  useCloudflareDomain,
  useCloudflareStorageReady,
} from '@/components/onboarding/steps/ConnectCloudflare'

/**
 * Where your photos and maps come from.
 *
 * The step whose copy Patrick pointed at: a forty-word sentence containing
 * Cloudflare R2, free-tier credits and a provider bill, before a new shop had
 * done anything. Underneath it, nine input boxes in two grey panels.
 *
 * The decision is actually simple — use your own accounts, or let CrewBarn
 * handle it — so that is one question with two cards, and the nine boxes only
 * exist once the answer needs them. They are also not nine equal boxes any
 * more: storage and maps are separate jobs, each with the clicks to make on
 * somebody else's website written out in order, because "create an API key
 * and restrict it by website" is not a sentence you can act on without
 * knowing where to click.
 *
 * The storage half no longer asks for four values at all in the normal case.
 * CrewBarn already had a flow that makes the bucket and writes the keys from
 * one pasted Cloudflare token — provisionR2() — and this step was asking
 * people to do that job by hand beside it. Connecting is now the way in;
 * typing the values is folded away for an existing bucket, or an IT
 * department that will not hand out a token.
 *
 * The payloads are otherwise what they were, with one deliberate difference:
 * when Cloudflare provisioned the storage, the credential fields are left OUT
 * of the payload rather than sent empty. The onboarding endpoint only writes
 * a field that is present, so omitting them keeps what was provisioned —
 * sending them blank would wipe the bucket CrewBarn had just made.
 */
export function DataOwnershipStep({ complete, onMarkStep, onboarding, saving }: StepProps) {
  const [ownershipMode, setOwnershipMode] = useState<'byo' | 'crewbarn_managed'>('byo')
  const [r2AccountId, setR2AccountId] = useState('')
  const [r2Bucket, setR2Bucket] = useState('')
  const [r2Endpoint, setR2Endpoint] = useState('')
  const [r2AccessKeyId, setR2AccessKeyId] = useState('')
  const [r2SecretAccessKey, setR2SecretAccessKey] = useState('')
  const [r2PublicBaseUrl, setR2PublicBaseUrl] = useState('')
  const [googleMapsKey, setGoogleMapsKey] = useState('')
  const [mapsDomain, setMapsDomain] = useState('')
  const [ownershipError, setOwnershipError] = useState<string | null>(null)

  const byoOnly = Boolean(onboarding.beta_agreement?.byo_only)
  // Cloudflare may already have made the bucket and written the keys, in
  // which case asking for them again is asking somebody to copy out values
  // CrewBarn put there itself.
  const storageDone = useCloudflareStorageReady()

  /*
   * Fill the domain in from Cloudflare rather than asking for it again.
   *
   * Once, and only while the box is untouched: somebody who clears it or
   * types a different one — a shop whose customer-facing site is not the zone
   * they connected — must not have it put back under them.
   */
  const knownDomain = useCloudflareDomain()
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || !knownDomain || mapsDomain !== '') return
    prefilled.current = true
    setMapsDomain(knownDomain)
  }, [knownDomain, mapsDomain])
  const computedR2Endpoint =
    r2Endpoint.trim() || (r2AccountId.trim() ? `https://${r2AccountId.trim()}.r2.cloudflarestorage.com` : '')
  /*
   * Where the map key is actually USED — which is not where this screen is.
   *
   * This was window.location.origin, and on connect.crewbarn.com that is the
   * settings console. Maps never load there: they load in the work app, and
   * on a self-hosted copy, and on the customer-facing website. Restricting
   * the key to the list this screen produced would have switched maps off
   * everywhere they are wanted, with a Google error nobody would trace back
   * to a setup screen.
   */
  const here = typeof window === 'undefined' ? '' : window.location.origin
  const crewbarnReferrers = Array.from(
    new Set([
      'https://app.crewbarn.com/*',
      // A self-hosted workspace on its own domain, or a preview host.
      ...(here && !here.includes('connect.crewbarn.com') && !here.includes('app.crewbarn.com')
        ? [`${here}/*`]
        : []),
    ]),
  )
  const normalizedMapsDomain = normalizeDomainForReferrer(mapsDomain)
  const customerDomainReferrers = normalizedMapsDomain
    ? [`https://${normalizedMapsDomain}/*`, `https://*.${normalizedMapsDomain}/*`]
    : []

  function saveDataOwnership() {
    setOwnershipError(null)

    if (ownershipMode === 'crewbarn_managed') {
      onMarkStep({
        choice: 'crewbarn_managed',
        storage_mode: 'crewbarn_managed',
        storage_provider: 'crewbarn',
        maps_mode: 'crewbarn_managed',
      })
      return
    }

    // Named one at a time. "Add the account ID, bucket, access key ID and
    // secret" makes somebody re-read four boxes to find the empty one. And
    // none of them are asked for at all when Cloudflare filled them in.
    const missingStorage = storageDone
      ? null
      : !r2AccountId.trim()
        ? 'The account ID from Cloudflare is still empty.'
        : !r2Bucket.trim()
          ? 'The bucket name is still empty — that is what you called the place your photos go.'
          : !r2AccessKeyId.trim()
            ? 'The access key ID is still empty.'
            : !r2SecretAccessKey.trim()
              ? 'The secret key is still empty. Cloudflare only shows it once, so if it has gone, make another token.'
              : null
    const missing =
      missingStorage ??
      (!googleMapsKey.trim()
        ? 'The Google Maps key is still empty. Without it, addresses will not turn into map pins.'
        : null)
    if (missing) {
      setOwnershipError(missing)
      return
    }

    /*
     * The credentials are only sent when this screen collected them. The
     * onboarding endpoint writes a field only if it is present in the
     * payload, so leaving them out keeps exactly what provisionR2() wrote —
     * whereas sending them empty would wipe the bucket CrewBarn just made.
     */
    const storage = storageDone
      ? {}
      : {
          cloudflare_r2_account_id: r2AccountId.trim(),
          cloudflare_r2_bucket: r2Bucket.trim(),
          cloudflare_r2_endpoint: computedR2Endpoint,
          cloudflare_r2_access_key_id: r2AccessKeyId.trim(),
          cloudflare_r2_secret_access_key: r2SecretAccessKey.trim(),
          cloudflare_r2_public_base_url: r2PublicBaseUrl.trim() || undefined,
        }

    onMarkStep({
      choice: 'byo_recommended',
      storage_mode: 'byo',
      storage_provider: 'cloudflare_r2',
      maps_mode: 'byo',
      ...storage,
      google_maps_api_key: googleMapsKey.trim(),
    })
  }

  return (
    <div className="space-y-6">
      <CloudflareOnboardingGuide />
      {complete && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900">
          <span className="font-bold">Saved.</span> You can change this and save again whenever you like.
        </p>
      )}

      <div className="space-y-2">
        <Choice
          picked={ownershipMode === 'byo'}
          onPick={() => setOwnershipMode('byo')}
          disabled={saving}
          label="Use my own accounts"
          detail="What we recommend. You open a Cloudflare account for the photos and a Google one for the maps. They are free to start, the bills come to you, and if you ever leave CrewBarn the files are already yours."
        />
        {!byoOnly && (
          <Choice
            picked={ownershipMode === 'crewbarn_managed'}
            onPick={() => setOwnershipMode('crewbarn_managed')}
            disabled={saving}
            label="Let CrewBarn handle it"
            detail="Quicker to start — nothing to sign up for. CrewBarn keeps the photos and runs the maps, and bills you for what you use. You can move to your own accounts later."
          />
        )}
      </div>

      {byoOnly && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
          Beta accounts bring their own — that is the free-for-life deal. The photos live in your Cloudflare and the
          maps run on your Google account, and CrewBarn never bills you for either.
        </p>
      )}

      {ownershipMode === 'crewbarn_managed' ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[15px] font-bold text-navy-900">Nothing to set up</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            CrewBarn will keep your photos and run the maps. You will see what it is costing before anything is
            charged, and moving to your own accounts later does not lose anything.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <Guide
            n={1}
            title="Somewhere to keep photos"
            where="cloudflare.com"
            steps={[
              'Make a free Cloudflare account, or sign in to the one you have.',
              'Connect it below. CrewBarn makes the bucket and fills in the keys.',
            ]}
          >
            <ConnectCloudflare onProvisioned={() => setOwnershipError(null)} />

            {!storageDone && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-600 hover:text-navy-900">
                  Or type the values in yourself
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  For a bucket you already have, or if your IT team would rather not hand out a token. In Cloudflare:
                  R2 → Create bucket, then Manage API tokens → Create token with Object Read &amp; Write.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Account ID" hint="On the R2 page, right-hand side." value={r2AccountId} onChange={setR2AccountId} mono />
              <Field label="Bucket name" hint="What you called it." value={r2Bucket} onChange={setR2Bucket} mono />
              <Field label="Access key ID" hint="From the token you just made." value={r2AccessKeyId} onChange={setR2AccessKeyId} mono />
              <Field
                label="Secret key"
                hint="Shown once. Stored encrypted here."
                value={r2SecretAccessKey}
                onChange={setR2SecretAccessKey}
                secret
                mono
              />
            </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Endpoint"
                  hint="Worked out from your account ID. Only change it if Cloudflare gave you a different one."
                  value={r2Endpoint}
                  onChange={setR2Endpoint}
                  placeholder={computedR2Endpoint || 'https://<account id>.r2.cloudflarestorage.com'}
                  mono
                />
                  <Field
                    label="Public address"
                    hint="If you have put a custom domain in front of the bucket."
                    value={r2PublicBaseUrl}
                    onChange={setR2PublicBaseUrl}
                    mono
                  />
                </div>
              </details>
            )}
          </Guide>

          <Guide
            n={2}
            title="Maps and address lookup"
            where="console.cloud.google.com"
            steps={[
              'Create or pick a project, and turn billing on. Google gives a monthly free allowance that most shops stay inside.',
              'Enable three things: Maps JavaScript API, Places API (New) and Geocoding API.',
              'Create an API key, then restrict it — by website, using the addresses below, and to those three APIs only.',
              'Paste the key here.',
            ]}
          >
            <p className="text-sm leading-relaxed text-slate-600">
              Restricting the key by website is what stops anyone else using it and running up your bill. Copy every
              one of these into Google exactly as it is — a missing one means maps stop working in that place.
            </p>
            <div className="mt-3 space-y-3">
              {crewbarnReferrers.map((value) => (
                <CopyValueBox key={value} label="CrewBarn" value={value} />
              ))}
              <Field
                label="Your own website address"
                hint={
                  knownDomain && mapsDomain === knownDomain
                    ? `Filled in from the Cloudflare account you connected. Change it if your customers use a different address.`
                    : 'Only the domain — example.com. Leave it blank if you have not got one yet.'
                }
                value={mapsDomain}
                onChange={setMapsDomain}
                placeholder="example.com"
                mono
              />
              {customerDomainReferrers.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <CopyValueBox label="Your site" value={customerDomainReferrers[0]} />
                  <CopyValueBox label="And anything under it" value={customerDomainReferrers[1]} />
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600">
                  Put your domain in above and the exact two lines to copy into Google appear here.
                </p>
              )}
              <Field
                label="Google Maps key"
                hint="Stored encrypted. Nobody else can see it."
                value={googleMapsKey}
                onChange={setGoogleMapsKey}
                secret
                mono
              />
            </div>
          </Guide>
        </div>
      )}

      {ownershipError && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-relaxed text-rose-800">
          {ownershipError}
        </p>
      )}

      <div>
        <button
          type="button"
          onClick={saveDataOwnership}
          disabled={saving}
          className="rounded-lg bg-amber-500 px-5 py-3 text-base font-bold text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500"
        >
          {saving ? 'Saving…' : 'Save and carry on'}
        </button>
      </div>
    </div>
  )
}

function Choice({
  picked,
  onPick,
  disabled,
  label,
  detail,
}: {
  picked: boolean
  onPick: () => void
  disabled?: boolean
  label: string
  detail: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={picked}
      onClick={onPick}
      disabled={disabled}
      className={`flex w-full items-start gap-3 rounded-xl border-[1.5px] p-4 text-left transition disabled:opacity-50 ${
        picked ? 'border-amber-500 bg-amber-50/60' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
          picked ? 'border-amber-500' : 'border-slate-300'
        }`}
      >
        {picked && <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-bold text-navy-900">{label}</span>
        <span className="mt-1 block text-sm leading-relaxed text-slate-600">{detail}</span>
      </span>
    </button>
  )
}

/** One job on somebody else's website: the clicks first, then the boxes. */
function Guide({
  n,
  title,
  where,
  steps,
  children,
}: {
  n: number
  title: string
  where: string
  steps: string[]
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-white">
          {n}
        </span>
        <h3 className="text-[15px] font-bold text-navy-900">{title}</h3>
        <span className="ml-auto font-mono text-xs text-slate-400">{where}</span>
      </div>
      <ol className="mt-4 space-y-2">
        {steps.map((s, i) => (
          <li key={s} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
            <span className="font-semibold tabular-nums text-slate-400">{i + 1}.</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <div className="mt-5 border-t border-slate-100 pt-5">{children}</div>
    </section>
  )
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  secret,
  mono,
}: {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  secret?: boolean
  mono?: boolean
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-navy-900">{label}</span>
      <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">{hint}</span>
      <input
        type={secret ? 'password' : 'text'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        data-lpignore="true"
        data-1p-ignore="true"
        className={`mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 ${
          mono ? 'font-mono' : ''
        }`}
      />
    </label>
  )
}

function normalizeDomainForReferrer(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^\*\./, '')
    .replace(/^\./, '')
    .toLowerCase()
}
import { CloudflareOnboardingGuide } from './CloudflareOnboardingGuide'
