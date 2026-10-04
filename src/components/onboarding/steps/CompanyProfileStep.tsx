import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_URL, apiRequest, getStoredToken } from '@/lib/api'
import { type StepProps } from '@/components/onboarding/steps/shared'

/**
 * Make it look like your shop.
 *
 * Rebuilt from the moved version, which was five stacked inputs, a row of
 * colour squares and a file picker in a grey box — correct, and impossible to
 * care about. The point of this step is not data entry: it is the moment
 * somebody's own name and colour appear on something that looks like a real
 * invoice. So the right half of the screen is that invoice, and it changes as
 * they type.
 *
 * Everything the old version saved, this saves, with the same payload:
 * company fields go through onMarkStep, the brand colour through the brand
 * endpoint just before it, and the logo uploads on its own as soon as it is
 * chosen.
 */

interface BrandPayload {
  logo_url: string | null
  brand_primary_color: string | null
}

/** Eight to pick from, so nobody has to know what a hex code is. */
const COLOURS = [
  { hex: '#f59e0b', name: 'Amber' },
  { hex: '#3b82f6', name: 'Blue' },
  { hex: '#10b981', name: 'Green' },
  { hex: '#ef4444', name: 'Red' },
  { hex: '#8b5cf6', name: 'Purple' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#14b8a6', name: 'Teal' },
  { hex: '#0f172a', name: 'Near-black' },
]

export function CompanyProfileStep({ complete, onMarkStep, onboarding, saving }: StepProps) {
  const qc = useQueryClient()
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [companyName, setCompanyName] = useState(onboarding.company.company_name || onboarding.tenant.name || '')
  const [companyPhone, setCompanyPhone] = useState(onboarding.company.company_phone || '')
  const [companyEmail, setCompanyEmail] = useState(onboarding.company.company_email || '')
  const [companyAddress, setCompanyAddress] = useState(onboarding.company.company_address || '')
  const [companyWebsite, setCompanyWebsite] = useState(onboarding.company.company_website || '')
  const [brandColor, setBrandColor] = useState('')
  const [companyError, setCompanyError] = useState<string | null>(null)
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)

  const brandQuery = useQuery({
    queryKey: ['tenant-brand'],
    queryFn: () => apiRequest<{ data: BrandPayload }>('/v1/tenant-settings/brand'),
  })
  const savedBrand = brandQuery.data?.data
  const savedBrandColor = savedBrand?.brand_primary_color ?? ''
  const logoUrl = savedBrand?.logo_url ?? null
  const previewColor = brandColor || savedBrandColor || '#f59e0b'
  const colorDirty = !!brandColor && brandColor.toLowerCase() !== savedBrandColor.toLowerCase()

  const saveBrandColor = useMutation({
    mutationFn: (next: string | null) =>
      apiRequest<{ data: BrandPayload }>('/v1/tenant-settings/brand', {
        method: 'PATCH',
        body: { brand_primary_color: next },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-brand'] }),
  })

  const deleteLogo = useMutation({
    mutationFn: () => apiRequest<{ data: { logo_url: null } }>('/v1/tenant-settings/brand/logo', { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-brand'] }),
  })

  useEffect(() => {
    setBrandColor((current) => current || savedBrandColor || '#f59e0b')
  }, [savedBrandColor])

  async function uploadLogo(file: File) {
    setLogoUploadError(null)
    setLogoUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const token = getStoredToken()
      const response = await fetch(`${API_URL}/v1/tenant-settings/brand/logo`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.message ?? `That did not upload (${response.status}).`)
      }
      await qc.invalidateQueries({ queryKey: ['tenant-brand'] })
    } catch (error) {
      setLogoUploadError(error instanceof Error ? error.message : String(error))
    } finally {
      setLogoUploading(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  function completeCompanyProfile() {
    onMarkStep({
      choice: 'company_profile_saved',
      company_name: companyName.trim(),
      company_phone: companyPhone.trim(),
      company_email: companyEmail.trim(),
      company_address: companyAddress.trim(),
      company_website: companyWebsite.trim() || undefined,
    })
  }

  /**
   * The four that are required are required because they go on documents a
   * customer keeps. The message says which document, so "why do you need
   * this" is answered where it is asked.
   */
  function saveCompanyProfile() {
    const missing =
      !companyName.trim()
        ? 'We need your company name — it is the first thing on every invoice.'
        : !companyPhone.trim()
          ? 'We need a phone number. It goes on everything a customer gets, so they can ring you back.'
          : !companyEmail.trim()
            ? 'We need an email address. Quotes and invoices are sent from it.'
            : !companyAddress.trim()
              ? 'We need your address. It goes on invoices, and it is how Google works out where you work.'
              : null
    if (missing) {
      setCompanyError(missing)
      return
    }
    if (brandColor && !/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
      setCompanyError('That colour code does not look right. It should be a # and six characters, like #f59e0b.')
      return
    }
    setCompanyError(null)

    if (colorDirty) {
      saveBrandColor.mutate(brandColor.toLowerCase(), {
        onSuccess: completeCompanyProfile,
        onError: (error) => setCompanyError(error instanceof Error ? error.message : String(error)),
      })
      return
    }
    completeCompanyProfile()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        {complete && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900">
            <span className="font-bold">Saved.</span> Change anything here and save again whenever you like.
          </p>
        )}

        <div className="space-y-4">
          <Field
            label="Your company name"
            hint="Exactly as you want it printed."
            value={companyName}
            onChange={setCompanyName}
            placeholder="KEL Locksmith"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Phone"
              hint="The number customers should ring."
              value={companyPhone}
              onChange={setCompanyPhone}
              placeholder="(321) 555-0142"
            />
            <Field
              label="Email"
              hint="Where quotes and invoices come from."
              value={companyEmail}
              onChange={setCompanyEmail}
              placeholder="office@yourshop.com"
            />
          </div>
          <Field
            label="Address"
            hint="Your shop or the address you work out of. Add it even if customers never visit — Google uses it."
            value={companyAddress}
            onChange={setCompanyAddress}
            placeholder="1200 Main St, Melbourne, FL 32901"
          />
          <Field
            label="Website"
            hint="Optional. If you already have one, put it here."
            value={companyWebsite}
            onChange={setCompanyWebsite}
            placeholder="https://yourshop.com"
          />
        </div>

        <section>
          <h3 className="text-sm font-bold text-navy-900">Your logo</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Not required to carry on. It goes on your invoices, quotes and website.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {logoUrl ? (
              <>
                <img src={logoUrl} alt="Your logo" className="h-14 max-w-[160px] object-contain" />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Use a different one
                </button>
                <button
                  type="button"
                  onClick={() => deleteLogo.mutate()}
                  disabled={deleteLogo.isPending}
                  className="text-sm font-semibold text-slate-500 hover:text-rose-700 disabled:opacity-50"
                >
                  Remove
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
                className="rounded-xl border-2 border-dashed border-slate-300 bg-white px-5 py-4 text-sm font-semibold text-navy-900 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50"
              >
                {logoUploading ? 'Uploading…' : 'Choose your logo file'}
              </button>
            )}
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void uploadLogo(file)
            }}
          />
          {logoUploadError && <p className="mt-2 text-sm text-rose-700">{logoUploadError}</p>}
        </section>

        <section>
          <h3 className="text-sm font-bold text-navy-900">Your colour</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Used on your invoices, your quotes and your website, so everything a customer sees matches.
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
            {COLOURS.map((c) => (
              <button
                key={c.hex}
                type="button"
                title={c.name}
                aria-label={c.name}
                aria-pressed={previewColor.toLowerCase() === c.hex.toLowerCase()}
                onClick={() => setBrandColor(c.hex)}
                className={`h-11 rounded-lg border-2 ${
                  previewColor.toLowerCase() === c.hex.toLowerCase()
                    ? 'border-navy-900 ring-2 ring-slate-200'
                    : 'border-transparent hover:border-slate-300'
                }`}
                style={{ background: c.hex }}
              />
            ))}
          </div>
        </section>

        {companyError && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-relaxed text-rose-800">
            {companyError}
          </p>
        )}

        <div>
          <button
            type="button"
            onClick={saveCompanyProfile}
            disabled={saving || saveBrandColor.isPending}
            className="rounded-lg bg-amber-500 px-5 py-3 text-base font-bold text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500"
          >
            {saving || saveBrandColor.isPending ? 'Saving…' : 'Save and carry on'}
          </button>
        </div>
      </div>

      <InvoicePreview
        name={companyName}
        phone={companyPhone}
        email={companyEmail}
        address={companyAddress}
        colour={previewColor}
        logoUrl={logoUrl}
      />
    </div>
  )
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-navy-900">{label}</span>
      <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">{hint}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
    </label>
  )
}

/**
 * The reason to fill the form in.
 *
 * A sketch of an invoice, not a real one — enough for somebody to recognise
 * their own shop on a piece of paper a customer will keep. Blanks show as
 * faint placeholder bars rather than empty space, so it reads as "not filled
 * in yet" instead of broken.
 */
function InvoicePreview({
  name,
  phone,
  email,
  address,
  colour,
  logoUrl,
}: {
  name: string
  phone: string
  email: string
  address: string
  colour: string
  logoUrl: string | null
}) {
  const Blank = ({ w }: { w: string }) => (
    <span className={`inline-block h-2 rounded-full bg-slate-200 align-middle ${w}`} />
  )

  return (
    <aside className="lg:sticky lg:top-4 lg:self-start">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">What a customer gets</p>
      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="h-1.5" style={{ background: colour }} />
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="mb-2 h-8 max-w-[120px] object-contain" />
              ) : null}
              <p className="truncate text-[15px] font-bold text-navy-900">{name || <Blank w="w-28" />}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                {phone || <Blank w="w-20" />}
                <br />
                {email || <Blank w="w-24" />}
                <br />
                {address || <Blank w="w-32" />}
              </p>
            </div>
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide" style={{ color: colour }}>
              Invoice
            </span>
          </div>

          <div className="mt-4 space-y-1.5">
            {['Service call', 'Rekey 3 cylinders', 'Parts'].map((line) => (
              <div key={line} className="flex justify-between text-[11px] text-slate-600">
                <span>{line}</span>
                <span className="tabular-nums">—</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-slate-200 pt-2">
            <span className="text-[11px] font-bold text-slate-500">Total</span>
            <span className="text-[11px] font-bold tabular-nums" style={{ color: colour }}>
              $248.00
            </span>
          </div>
          <div
            className="mt-4 rounded-md px-3 py-2 text-center text-[11px] font-bold text-white"
            style={{ background: colour }}
          >
            Pay this invoice
          </div>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        Your quotes, your emails and your website use the same name and colour.
      </p>
    </aside>
  )
}
