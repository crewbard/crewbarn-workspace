import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest, getStoredToken, getActingTenant, API_URL } from '@/lib/api'
import { Avatar, AVATAR_OBJECT_EMOJIS, AVATAR_PLACE_EMOJIS, AVATAR_PRESET_COLORS, AVATAR_STYLES, dicebearUrl } from '@/components/Avatar'
import { AvatarCropModal } from '@/components/AvatarCropModal'
import { customerKeys } from '@/hooks/useCustomers'
import type { Customer } from '@/types/customer'

// Seeds for the "pick from hundreds" gallery — each renders a distinct avatar.
const AVATAR_SEEDS = Array.from({ length: 36 }, (_, i) => String(i + 1))

// Sentinel gallery keys. Prefixed so they can never collide with a real
// DiceBear style name, since both share the one dropdown value.
const GALLERY_OBJECTS = '@things'
const GALLERY_PLACES = '@places'

const EMOJI_GALLERIES: Record<string, readonly string[]> = {
  [GALLERY_OBJECTS]: AVATAR_OBJECT_EMOJIS,
  [GALLERY_PLACES]: AVATAR_PLACE_EMOJIS,
}

/**
 * The customer's avatar + a click-to-open editor: pick a monogram color from
 * the library, or upload a round-cropped photo (which wins over the color).
 */
export function CustomerAvatarPicker({ customer, size = 40 }: { customer: Customer; size?: number }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  // Opens on Things: a customer list is mostly businesses and trades, so the
  // icon sets are the likelier pick and shouldn't need a dropdown trip first.
  const [galleryStyle, setGalleryStyle] = useState<string>(GALLERY_OBJECTS)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Non-null when the dropdown is on an icon set rather than a DiceBear style.
  const emojiGallery = EMOJI_GALLERIES[galleryStyle] ?? null

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: customerKeys.detail(customer.id) })
    qc.invalidateQueries({ queryKey: customerKeys.lists() })
  }

  const savePreset = useMutation({
    mutationFn: (preset: string | null) =>
      apiRequest(`/v1/customers/${customer.id}`, { method: 'PATCH', body: { avatar_preset: preset } }),
    onSuccess: () => {
      setOpen(false)
      invalidate()
    },
  })

  // Photo upload/delete is multipart, so it goes through fetch (apiRequest
  // JSON-encodes bodies). Same flow as the profile-photo card.
  async function sendPhoto(method: 'POST' | 'DELETE', fd?: FormData) {
    setBusy(true)
    setErr(null)
    try {
      const token = getStoredToken()
      const tenant = getActingTenant()
      const headers: Record<string, string> = { Accept: 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      if (tenant) headers['X-Act-As-Tenant'] = tenant
      const res = await fetch(`${API_URL}/v1/customers/${customer.id}/avatar`, { method, headers, body: fd })
      if (!res.ok) {
        let msg = `Upload failed (${res.status})`
        try {
          const j = await res.json()
          if (j?.message) msg = j.message
        } catch {
          /* not JSON */
        }
        throw new Error(msg)
      }
      setOpen(false)
      invalidate()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Change avatar"
        className="rounded-full ring-2 ring-transparent hover:ring-amber-300 transition"
      >
        <Avatar
          name={customer.display_name}
          colorKey={customer.id}
          preset={customer.avatar_preset}
          imageUrl={customer.avatar_url}
          size={size}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 left-0 bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-64">
          {err && <div className="mb-2 text-[11px] text-red-700">✗ {err}</div>}

          {/* One gallery under the dropdown. Things and Places used to be their
              own stacked rows, which made the panel tall enough to run off the
              screen and gave every set its own little scrollbar. They're now
              entries in the same picker, so exactly one grid is ever open. */}
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[11px] text-slate-500 shrink-0">Choose an avatar</span>
            <select
              value={galleryStyle}
              onChange={(e) => setGalleryStyle(e.target.value)}
              className="ml-auto text-[11px] border border-slate-300 rounded px-1 py-0.5 bg-white text-slate-700 capitalize"
            >
              <optgroup label="Icons">
                <option value={GALLERY_OBJECTS}>Things</option>
                <option value={GALLERY_PLACES}>Places</option>
              </optgroup>
              <optgroup label="Illustrated">
                {AVATAR_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/-/g, ' ')}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {emojiGallery ? (
            <div className="grid grid-cols-8 gap-1.5 mb-3 max-h-40 overflow-y-auto pr-1">
              {emojiGallery.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => savePreset.mutate(e)}
                  disabled={savePreset.isPending || busy}
                  title={e}
                  className={`w-7 h-7 rounded-full bg-slate-100 leading-none text-[15px] flex items-center justify-center hover:bg-slate-200 ${
                    customer.avatar_preset === e ? 'ring-2 ring-offset-1 ring-slate-800' : ''
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-2 mb-3 max-h-40 overflow-y-auto pr-1">
              {AVATAR_SEEDS.map((seed) => {
                const key = `db:${galleryStyle}:${seed}`
                return (
                  <button
                    key={seed}
                    type="button"
                    onClick={() => savePreset.mutate(key)}
                    disabled={savePreset.isPending || busy}
                    className={`rounded-full ${customer.avatar_preset === key ? 'ring-2 ring-offset-1 ring-slate-800' : ''}`}
                  >
                    <img src={dicebearUrl(galleryStyle, seed)} alt="" loading="lazy" className="w-8 h-8 rounded-full bg-slate-100" />
                  </button>
                )
              })}
            </div>
          )}

          <div className="text-[11px] text-slate-500 mb-1.5">Or a color</div>
          <div className="grid grid-cols-6 gap-1.5">
            {AVATAR_PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => savePreset.mutate(c)}
                disabled={savePreset.isPending || busy}
                title={c}
                style={{ backgroundColor: c }}
                className={`w-6 h-6 rounded-full ${customer.avatar_preset === c ? 'ring-2 ring-offset-1 ring-slate-800' : 'border border-slate-200'}`}
              />
            ))}
            <label
              title="Custom color"
              className="w-6 h-6 rounded-full border border-slate-300 flex items-center justify-center overflow-hidden cursor-pointer bg-[conic-gradient(from_0deg,red,orange,yellow,lime,cyan,blue,magenta,red)]"
            >
              <input
                type="color"
                onChange={(e) => savePreset.mutate(e.target.value)}
                disabled={savePreset.isPending || busy}
                className="w-8 h-8 opacity-0 cursor-pointer"
              />
            </label>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const reader = new FileReader()
                reader.onload = () => setCropSrc(String(reader.result))
                reader.onerror = () => setErr('Could not read that image.')
                reader.readAsDataURL(f)
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="text-[11px] px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
            >
              {busy ? 'Working…' : customer.avatar_url ? 'Change photo' : 'Upload photo'}
            </button>
            {customer.avatar_url && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void sendPhoto('DELETE')}
                className="text-[11px] px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 text-slate-700"
              >
                Remove photo
              </button>
            )}
            <button
              type="button"
              onClick={() => savePreset.mutate(null)}
              disabled={savePreset.isPending || busy}
              className="text-[11px] text-slate-500 hover:text-slate-800"
            >
              Reset color
            </button>
          </div>
        </div>
      )}

      {cropSrc && (
        <AvatarCropModal
          src={cropSrc}
          onCancel={() => setCropSrc(null)}
          onSave={(blob) => {
            setCropSrc(null)
            const fd = new FormData()
            fd.append('avatar', blob, 'avatar.jpg')
            void sendPhoto('POST', fd)
          }}
        />
      )}
    </div>
  )
}
