import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '@/lib/googleMaps'

/**
 * Address-input with Google Places autocomplete.
 *
 * Uses the **new** `PlaceAutocompleteElement` web component (backed by
 * Places API (New) on the GCP project). Replaces the deprecated
 * `google.maps.places.Autocomplete` constructor that drove the older
 * implementation.
 *
 * Behaviour:
 *   - Renders the Google web component inside a wrapper div.
 *   - On suggestion select: fetches place details and emits a parsed
 *     `AddressComponents` payload via onPlaceSelected.
 *   - Initial value (e.g. editing an existing customer) is pushed onto
 *     the element's internal input on mount.
 *   - Falls back to a plain `<input>` if Google Maps isn't configured
 *     for this tenant.
 */
export interface AddressComponents {
  formatted_address: string
  street_number: string | null
  route: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  lat: number | null
  lng: number | null
}

interface PlaceAutocompleteSelectEvent extends Event {
  placePrediction?: {
    toPlace(): {
      fetchFields(opts: { fields: string[] }): Promise<unknown>
      formattedAddress?: string
      addressComponents?: Array<{ types: string[]; longText?: string | null; shortText?: string | null }>
      location?: { lat(): number; lng(): number }
    }
  }
}

export function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder,
  className,
  disabled,
}: {
  value: string
  onChange: (text: string) => void
  onPlaceSelected?: (parsed: AddressComponents) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const fallbackInputRef = useRef<HTMLInputElement>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    let element: HTMLElement | null = null

    loadGoogleMaps()
      .then(async (g) => {
        if (cancelled || !wrapperRef.current) return

        const lib = (await g.maps.importLibrary('places')) as unknown as {
          PlaceAutocompleteElement?: new (opts?: Record<string, unknown>) => HTMLElement
        }
        const Ctor = lib.PlaceAutocompleteElement
        if (!Ctor) {
          // SDK loaded but the new element isn't available — this happens
          // when "Places API (New)" isn't enabled on the GCP project.
          if (!cancelled) setUnavailable(true)
          return
        }

        if (cancelled || !wrapperRef.current) return

        const el = new Ctor()
        element = el
        if (placeholder) el.setAttribute('placeholder', placeholder)
        if (disabled) el.setAttribute('disabled', '')
        if (className) el.setAttribute('class', className)
        // Initial value (edit flows). The element coerces this into the
        // visible input on mount.
        try {
          ;(el as unknown as { value?: string }).value = value ?? ''
        } catch { /* ignore */ }

        wrapperRef.current.replaceChildren(el)
        setReady(true)

        el.addEventListener('gmp-select', async (rawEvent: Event) => {
          const event = rawEvent as PlaceAutocompleteSelectEvent
          const prediction = event.placePrediction
          if (!prediction) return
          const place = prediction.toPlace()
          try {
            await place.fetchFields({
              fields: ['displayName', 'formattedAddress', 'addressComponents', 'location'],
            })
          } catch {
            return
          }

          const components = place.addressComponents ?? []
          const get = (type: string) =>
            components.find((c) => c.types.includes(type))?.longText ?? null
          const getShort = (type: string) =>
            components.find((c) => c.types.includes(type))?.shortText ?? null

          const parsed: AddressComponents = {
            formatted_address: place.formattedAddress ?? '',
            street_number: get('street_number'),
            route: get('route'),
            city: get('locality') ?? get('sublocality') ?? null,
            state: getShort('administrative_area_level_1'),
            postal_code: get('postal_code'),
            country: getShort('country'),
            lat: place.location?.lat() ?? null,
            lng: place.location?.lng() ?? null,
          }

          // Selecting a suggestion + the resulting form state updates can
          // make the page jump to the top (focus/DOM churn from the Google
          // web component). Pin the scroll position across the update.
          const scrollY = window.scrollY
          onChange(place.formattedAddress ?? '')
          onPlaceSelected?.(parsed)
          requestAnimationFrame(() => window.scrollTo(window.scrollX, scrollY))
        })
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true)
      })

    return () => {
      cancelled = true
      // Detach the element from the wrapper so React doesn't fight with
      // Google's DOM ownership on remount.
      if (element?.parentNode === wrapperRef.current) {
        wrapperRef.current?.removeChild(element)
      }
      element = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync the element's value if the parent updates `value` externally
  // (e.g. resetForm, edit-mode load). We deliberately skip syncing back
  // mid-typing to avoid fighting the user's keystrokes.
  useEffect(() => {
    if (!ready || !wrapperRef.current) return
    const el = wrapperRef.current.firstElementChild as HTMLElement | null
    if (!el) return
    const current = (el as unknown as { value?: string }).value ?? ''
    if (current === value) return
    try {
      ;(el as unknown as { value?: string }).value = value
    } catch { /* ignore */ }
  }, [value, ready])

  // Fallback: plain input when Maps isn't configured / API not enabled.
  if (unavailable) {
    return (
      <div className="relative">
        <input
          ref={fallbackInputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'Street address'}
          disabled={disabled}
          className={className}
        />
        <p className="text-[10px] text-slate-400 mt-0.5">
          Autocomplete unavailable — enable Places API (New) on the GCP key
          (Settings → Integrations).
        </p>
      </div>
    )
  }

  return <div ref={wrapperRef} className="relative" />
}
