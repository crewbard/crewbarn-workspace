import { loadGoogleMaps } from '@/lib/googleMaps'

/**
 * Check a typed-or-transcribed address against Google, once, and return the
 * normalised parts when the answer is unambiguous.
 *
 * One implementation because there were two, and they disagreed. The intake
 * overlay demanded a single result; the job form accepted whatever came back
 * first with no precision check at all. So the same address could be silently
 * accepted in one place and flagged in the other, and the stricter one was
 * rejecting addresses that were fine.
 *
 * The unit is deliberately NOT sent. "8200 Canaveral Boulevard, Unit G" asks
 * Google to find a subpremise it usually has no record of, and it answers with
 * ZERO_RESULTS or a partial match — so a perfectly good street address failed
 * verification because a flat number was appended to it. The building is what
 * gets geocoded; the unit stays on the form untouched, which is also the truth
 * of it, since a pin cannot distinguish Unit G from Unit H.
 */

/** Nullable throughout: these come straight off form state and API payloads. */
export interface AddressParts {
  street?: string | null
  unit?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}

export interface VerifiedAddress {
  street: string
  city: string
  state: string
  zip: string
  country: string
  lat: number
  lng: number
}

export type VerifyOutcome =
  /** Unambiguous — safe to fill in. */
  | { status: 'verified'; address: VerifiedAddress }
  /** Google answered, but not precisely enough to fill in for someone. */
  | { status: 'ambiguous' }
  /** No key, no network, no answer. Says nothing about the address. */
  | { status: 'unavailable' }

function componentOf(
  result: google.maps.GeocoderResult,
  type: string,
  short = false,
): string {
  const hit = result.address_components?.find((c) => c.types.includes(type))
  return (short ? hit?.short_name : hit?.long_name) ?? ''
}

export async function verifyAddress(parts: AddressParts): Promise<VerifyOutcome> {
  const query = [parts.street, parts.city, parts.state, parts.zip]
    .map((v) => (v ?? '').trim())
    .filter(Boolean)
    .join(', ')
  if (!query) return { status: 'unavailable' }

  let results: google.maps.GeocoderResult[]
  try {
    const g = await loadGoogleMaps()
    const { Geocoder } = (await g.maps.importLibrary('geocoding')) as google.maps.GeocodingLibrary
    results = (await new Geocoder().geocode({ address: query })).results ?? []
  } catch {
    // A rejection here is the API, the key or the network — including the
    // common case of a key with Places enabled but not Geocoding. It is not a
    // verdict on the address, so it must not be shown as one.
    return { status: 'unavailable' }
  }

  const hit = results[0]
  if (!hit) return { status: 'ambiguous' }

  // partial_match is Google's own "I had to guess" flag, and location_type
  // says whether it found the building or just the street/city. Requiring both
  // is what makes an automatic fill safe: this address sends someone in a van.
  //
  // Note it does NOT require a single result. Google routinely returns extras
  // for a perfectly exact address — a business at the same rooftop, say — and
  // rejecting on count alone was turning good addresses away.
  const precise =
    hit.geometry?.location_type === 'ROOFTOP' ||
    hit.geometry?.location_type === 'RANGE_INTERPOLATED'
  if (hit.partial_match || !precise) return { status: 'ambiguous' }

  const street = [componentOf(hit, 'street_number'), componentOf(hit, 'route')]
    .filter(Boolean)
    .join(' ')

  return {
    status: 'verified',
    address: {
      street,
      city:
        componentOf(hit, 'locality') ||
        componentOf(hit, 'postal_town') ||
        componentOf(hit, 'sublocality'),
      state: componentOf(hit, 'administrative_area_level_1', true),
      zip: componentOf(hit, 'postal_code'),
      country: componentOf(hit, 'country', true),
      lat: hit.geometry.location.lat(),
      lng: hit.geometry.location.lng(),
    },
  }
}
