import { deviceUpload, isDeviceUploadResponse } from './deviceUpload'
export { isDeviceUploadResponse }
/** Browser proof key: IndexedDB structured-clones the nonextractable private key. */
export interface DeviceBinding { version: number; jkt: string; nonce?: string; hardware: string }
export interface BoundSession { token_type?: string; device_binding?: DeviceBinding }
export class StorageUnavailableError extends Error {
  constructor(message = 'Browser storage is unavailable. Allow storage for this site, then try signing in again.') {
    super(message)
    this.name = 'StorageUnavailableError'
  }
}
export function readSessionToken(key: string): string | null {
  try { return localStorage.getItem(key) } catch { throw new StorageUnavailableError() }
}
function writableStorage(key: string): void {
  try { localStorage.getItem(key); localStorage.setItem(key + '_probe', '1'); localStorage.removeItem(key + '_probe') }
  catch { throw new StorageUnavailableError() }
}
export function storeSession(key: string, token: string, binding?: BoundSession): void {
  writableStorage(key)
  saveBinding(key, binding)
  try { localStorage.setItem(key, token) } catch { throw new StorageUnavailableError() }
  void enrollBrowserSession(key).catch(() => undefined)
}
// Enrollment follows a saved login, never a credential request. The browser
// handles the registration header itself; a pending offer is not hardware proof.
const browserEnrollments = new Map<string, (token: string) => Promise<void>>()
const enrollmentAttempts = new Map<string, { token: string; promise: Promise<void> }>()
export async function enrollBrowserSession(key: string): Promise<void> {
  const enroll = browserEnrollments.get(key)
  if (!enroll) return Promise.resolve()
  const token = readSessionToken(key)
  if (!token) return Promise.resolve()
  const previous = enrollmentAttempts.get(key)
  if (previous?.token === token) return previous.promise
  const promise = Promise.resolve().then(() => enroll(token))
  enrollmentAttempts.set(key, { token, promise })
  return promise
}
export function clearSession(key: string): void {
  for (const name of [key, key + '_binding']) { try { localStorage.removeItem(name) } catch { /* Storage may be blocked during sign-out. */ } }
}
function issuanceRequest(request: Request): boolean {
  return request.method === 'POST' && /\/auth\/(login|signup|register|verify-email|email-code\/verify|google\/exchange|accept-invite)$/.test(new URL(request.url).pathname)
}
/** Clock failures keep the saved session intact; they are not key loss. */
export class ClockSyncError extends Error {
  constructor() {
    super('Could not synchronize this device with the server. Check your connection and device clock, then try again.')
    this.name = 'ClockSyncError'
  }
}
type ServerClock = () => Promise<number>
const serverClocks = new Map<string, ServerClock>()
/** Only an uncached HTTPS response from the configured API may set proof time. */
export function serverClock(api: string, rawFetch?: typeof fetch): ServerClock {
  let base: URL
  try {
    base = new URL(api, location.href)
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new ClockSyncError()
  } catch { return async () => { throw new ClockSyncError() } }
  const scope = base.href.replace(/\/$/, '')
  const existing = serverClocks.get(scope)
  if (existing) return existing
  const get = rawFetch ?? window.fetch.bind(window)
  const health = scope + '/v1/health'
  let anchor: { server: number; monotonic: number } | undefined
  let inFlight: Promise<number> | undefined
  const clock: ServerClock = async () => {
    const elapsed = anchor ? performance.now() - anchor.monotonic : Infinity
    // Elapsed monotonic time, not a second wall-clock reading, advances a grant.
    if (anchor && elapsed >= 0 && elapsed < 60000) return anchor.server + elapsed
    if (inFlight) return inFlight
    inFlight = (async () => {
      const controller = new AbortController()
      const start = performance.now(), wall = Date.now()
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const value = await Promise.race([
          (async () => {
            const response = await get(new Request(health, {
              method: 'GET', headers: { Accept: 'application/json' }, credentials: 'omit',
              redirect: 'error', cache: 'no-store', signal: controller.signal,
            }))
            const cache = response.headers.get('Cache-Control') ?? ''
            const age = response.headers.get('Age')
            if (!response.ok || response.redirected || response.url !== health
              || !/\bno-store\b/i.test(cache) || (age !== null && (!/^0+$/.test(age.trim())))
              || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('Content-Type') ?? '')
              || Number(response.headers.get('Content-Length') ?? 0) > 4096 || !response.body) throw new ClockSyncError()
            const reader = response.body.getReader()
            const chunks: Uint8Array[] = []
            let size = 0
            try {
              for (;;) {
                const { done, value: chunk } = await reader.read()
                if (done) break
                size += chunk.byteLength
                if (size > 4096) throw new ClockSyncError()
                chunks.push(chunk)
              }
            } catch (error) { void reader.cancel().catch(() => undefined); throw error }
            finally { reader.releaseLock() }
            const bytes = new Uint8Array(size)
            let offset = 0
            for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
            const payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as { timestamp?: unknown }
            const timestamp = payload?.timestamp
            if (typeof timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(timestamp)) throw new ClockSyncError()
            const server = Date.parse(timestamp)
            const calendar = new Date(timestamp.slice(0, 10) + 'T00:00:00Z')
            if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== timestamp.slice(0, 10)) throw new ClockSyncError()
            const end = performance.now(), duration = end - start
            const date = response.headers.get('Date')
            if (controller.signal.aborted || !Number.isFinite(server) || !Number.isFinite(duration) || duration < 0 || duration > 5000
              || Math.abs(server - wall) > 86400000
              || (date !== null && (!Number.isFinite(Date.parse(date)) || Math.abs(Date.parse(date) - server) > 5000))) throw new ClockSyncError()
            anchor = { server, monotonic: start + duration / 2 }
            return server + duration / 2
          })(),
          new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new ClockSyncError()) }, 5000) }),
        ])
        return value
      } catch { controller.abort(); anchor = undefined; throw new ClockSyncError() }
      finally { if (timer !== undefined) clearTimeout(timer) }
    })().finally(() => { inFlight = undefined })
    return inFlight
  }
  serverClocks.set(scope, clock)
  return clock
}
type KeyRecord = { privateKey: CryptoKey; publicJwk: JsonWebKey; jkt: string }
const encoder = new TextEncoder()
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
const json = (value: unknown) => b64(encoder.encode(JSON.stringify(value)))
const digest = async (value: string) => b64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))))
let pending: Promise<KeyRecord> | undefined
/** The key is really gone (storage cleared): the session can't continue here. */
class LostKeyError extends Error {
  constructor() { super('This browser no longer has the information needed for this sign-in. Please sign in again.') }
}
// The key this page last read. When IndexedDB itself fails (an iOS WebView
// can lose its connection while the app is in the background), signing goes
// on with it instead of looking like a lost key and signing the person out.
// A key that's really gone is still lost.
let remembered: KeyRecord | undefined
async function key(create: boolean): Promise<KeyRecord> {
  try {
    remembered = await readOrCreateKey(create)
    return remembered
  } catch (error) {
    if (error instanceof LostKeyError) remembered = undefined
    else if (remembered) return remembered
    throw error
  }
}
async function readOrCreateKey(create: boolean): Promise<KeyRecord> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('crewbarn-device-proof-v1', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('keys')
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
  try {
    const stored = await new Promise<KeyRecord | undefined>((resolve, reject) => {
      const r = db.transaction('keys').objectStore('keys').get('p256')
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
    if (stored) return stored
    if (!create) throw new LostKeyError()
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])
    const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
    const jkt = await digest(JSON.stringify({ crv: publicJwk.crv, kty: publicJwk.kty, x: publicJwk.x, y: publicJwk.y }))
    const record = { privateKey: pair.privateKey, publicJwk, jkt }
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('keys', 'readwrite')
      // add prevents simultaneous tabs from overwriting an existing session key.
      tx.objectStore('keys').add(record, 'p256')
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error)
    }).catch(async () => { /* A competing tab may have installed the key. */ })
    return await new Promise<KeyRecord>((resolve, reject) => {
      const r = db.transaction('keys').objectStore('keys').get('p256')
      r.onsuccess = () => r.result ? resolve(r.result) : reject(new Error('This browser could not save your sign-in. Allow storage for this site, then try again.'))
      r.onerror = () => reject(r.error)
    })
  } finally { db.close() }
}
export function isApiUrl(value: string, api: string): boolean {
  const url = new URL(value, location.href), base = new URL(api, location.href)
  const path = base.pathname.replace(/\/$/, '')
  return url.origin === base.origin && (url.pathname === path || url.pathname.startsWith(path + '/'))
}
type NativeBridgeWindow = Window & { __CB_DEVICE_BINDING__?: { version: number }; ReactNativeWebView?: { postMessage: (message: string) => void } }
async function nativeProof(method: string, url: string, token?: string, operation: 'proof' | 'login_key' = 'proof'): Promise<{ proof?: string; jkt: string }> {
  const host = window as NativeBridgeWindow
  if (!host.ReactNativeWebView) throw new Error('This device could not confirm your sign-in. Please sign in again.')
  const id = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('crewbarn:device-binding-response', receive) }
    const receive = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (detail?.id !== id) return
      cleanup()
      if (detail.errorCode === 'clock_sync_unavailable') { reject(new ClockSyncError()); return }
      if (detail.errorCode === 'device_signing_unavailable' || detail.errorCode === 'device_binding_storage_unavailable') {
        reject(new StorageUnavailableError('This device cannot confirm your sign-in right now. Unlock it and try again.')); return
      }
      if (detail.error || (operation === 'proof' ? typeof detail.result?.proof !== 'string' : typeof detail.result?.publicJwk !== 'object' || !detail.result.publicJwk) || typeof detail.result?.jkt !== 'string') reject(new Error(detail.error || 'This device could not confirm your sign-in. Please sign in again.'))
      else resolve(detail.result)
    }
    const timer = setTimeout(() => { cleanup(); reject(new Error('This device did not respond in time. Please try signing in again.')) }, 15000)
    window.addEventListener('crewbarn:device-binding-response', receive)
    host.ReactNativeWebView!.postMessage(JSON.stringify({ type: 'CB_DEVICE_BINDING_REQUEST', id, operation, method: method.toUpperCase(), url, ...(token ? { token } : {}) }))
  })
}
export async function createProof(method: string, value: string, token?: string, binding?: DeviceBinding, clock?: ServerClock, api?: string): Promise<string> {
  if (typeof window !== 'undefined' && (window as NativeBridgeWindow).__CB_DEVICE_BINDING__?.version === 1) {
    let loginKey: { jkt: string } | undefined
    if (!token && api && method.toUpperCase() === 'POST') {
      const target = new URL(value), base = new URL(api)
      if (target.protocol === 'https:' && target.origin === base.origin && !target.search && !target.hash
        && !target.username && !target.password && base.pathname.replace(/\/$/, '') === ''
        && /^\/v1\/portal\/auth\/(login|signup|verify-email|email-code\/verify|google\/exchange)$/.test(target.pathname)) {
        loginKey = await nativeProof(method, value, undefined, 'login_key')
      }
    }
    const result = await nativeProof(method, value, token)
    if (loginKey && loginKey.jkt !== result.jkt) throw new Error('This device could not finish signing in. Please try again.')
    if (binding && result.jkt !== binding.jkt) throw new Error('This sign-in is no longer available on this device. Please sign in again.')
    return result.proof!
  }
  const record = token ? await key(false) : await (pending ??= key(true).finally(() => { pending = undefined }))
  if (binding && binding.jkt !== record.jkt) throw new Error('This sign-in is no longer available in this browser. Please sign in again.')
  const url = new URL(value, location.href); url.search = ''; url.hash = ''
  const claims = { htm: method.toUpperCase(), htu: url.href, iat: Math.floor((clock ? await clock() : Date.now()) / 1000), jti: crypto.randomUUID(), ...(token ? { ath: await digest(token) } : {}), ...(binding?.nonce ? { nonce: binding.nonce } : {}) }
  const input = json({ typ: 'dpop+jwt', alg: 'ES256', jwk: record.publicJwk }) + '.' + json(claims)
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, record.privateKey, encoder.encode(input))
  return input + '.' + b64(new Uint8Array(signature))
}
const uploadFetchers = new Map<string, (request: Request, progress?: (loaded: number, total: number) => void, form?: FormData) => Promise<Response>>()
export function installDeviceTransport(api: string, storageKey: string, expired: (token: string | null) => void, attachToWindow = true): typeof fetch {
  const original = window.fetch.bind(window)
  const clock = serverClock(api, original)
  // optional: a request the app can do without (browser enrollment). A grant
  // rejection there gives up quietly; it never signs anyone out.
  const send = async (request: Request, allowRefresh = true, current?: () => void, optional = false): Promise<Response> => {
    if (!isApiUrl(request.url, api)) {
      // Never forward a CrewBarn credential to a presigned upload or another host.
      const headers = new Headers(request.headers)
      const authorization = headers.get('Authorization')
      const token = authorization ? readSessionToken(storageKey) : null
      if (token && /^(Bearer|DPoP) /i.test(headers.get('Authorization') ?? '') && headers.get('Authorization')?.endsWith(' ' + token)) headers.delete('Authorization')
      headers.delete('DPoP')
      return original(new Request(request, { headers }))
    }
    const headers = new Headers(request.headers)
    const supplied = headers.get('Authorization')
    const issuance = issuanceRequest(request)
    if (!supplied && !issuance) return original(request)
    if (issuance) writableStorage(storageKey)
    const token = readSessionToken(storageKey)
    const session = readBinding(storageKey)
    const bound = !!token && session?.token_type === 'DPoP' && (supplied === `Bearer ${token}` || supplied === `DPoP ${token}`)
    if (bound || issuance) {
      try {
        headers.set('DPoP', await createProof(request.method, request.url, bound ? token! : undefined, bound ? session?.device_binding : undefined, clock, api))
        if (bound) headers.set('Authorization', `DPoP ${token}`)
      } catch (error) {
        // Signing in: go without a proof and let the server decide (it gives a
        // plain session unless proofs are required). This is also what lets a
        // new web build sign in against an API that predates binding.
        if (!bound) headers.delete('DPoP')
        else {
          if (!(error instanceof ClockSyncError) && !(error instanceof StorageUnavailableError)) expired(token)
          throw error
        }
      }
    }
    // Retain a readable body before dispatch: this retry is permitted only for
    // the server's pre-handler DBSC grant rejection, never general write errors.
    const retry = bound ? request.clone() : null
    current?.()
    // Cookies go only with bound requests. A sign-in carries none: only DBSC
    // enrollment needs them there, DBSC stays off until a real-browser test,
    // and an API without credentialed CORS would drop the sign-in's reply.
    const response = await original(new Request(request, { headers, ...(bound ? { credentials: 'include' as const, redirect: 'error' as const } : issuance ? { redirect: 'error' as const } : {}) }))
    const grantMissing = async (reply: Response) => reply.status === 403
      && (await reply.clone().json().catch(() => null))?.error === 'device_binding_refresh_required'
    if (bound && response.status === 403 && readSessionToken(storageKey) === token && await grantMissing(response)) {
      if (!allowRefresh || !retry || request.signal.aborted) { if (!optional) expired(token); return response }
      // A grant rejection occurs before business execution. Retry once only.
      try { headers.set('DPoP', await createProof(request.method, request.url, token!, session?.device_binding, clock, api)) }
      catch (error) {
        if (!(error instanceof ClockSyncError) && !(error instanceof StorageUnavailableError)) expired(token)
        throw error
      }
      current?.()
      const refreshed = await original(new Request(retry, { headers, credentials: 'include', redirect: 'error' }))
      if (!optional && refreshed.status === 403 && readSessionToken(storageKey) === token && await grantMissing(refreshed)) expired(token)
      return refreshed
    }
    return response
  }
  const intercept = async (request: Request, progress?: (loaded: number, total: number) => void, form?: FormData): Promise<Response> => {
    const authorization = request.headers.get('Authorization')
    if (!isApiUrl(request.url, api) || !authorization) return send(request)
    const token = readSessionToken(storageKey), binding = readBinding(storageKey)
    if (isApiUrl(request.url, api) && token && binding?.token_type === 'DPoP'
      && (authorization === `Bearer ${token}` || authorization === `DPoP ${token}`)) {
      const sessionCurrent = () => {
        if (readSessionToken(storageKey) !== token || readBinding(storageKey)?.device_binding?.jkt !== binding.device_binding?.jkt) {
          throw new DOMException('The sign-in changed during upload.', 'AbortError')
        }
      }
      const current = () => {
        sessionCurrent()
        if (request.signal.aborted) throw new DOMException('The upload was cancelled.', 'AbortError')
      }
      const controller = new AbortController()
      const cancel = () => controller.abort()
      request.signal.addEventListener('abort', cancel, { once: true })
      const watch = setInterval(() => { try { current() } catch { controller.abort() } }, 250)
      try {
        if (request.signal.aborted) controller.abort()
        const tracked = new Request(request.clone(), { signal: controller.signal })
        const uploaded = await deviceUpload(tracked, api, async (next, final, cleanup) => {
          const response = await send(next, !final && !cleanup, cleanup ? sessionCurrent : current)
          if (!final && response.status === 401) expired(token)
          return response
        }, current, progress, form, sessionCurrent)
        if (uploaded) return uploaded
      } finally { clearInterval(watch); request.signal.removeEventListener('abort', cancel) }
    }
    return send(request)
  }
  browserEnrollments.set(storageKey, async (expectedToken) => {
    const host = window as NativeBridgeWindow
    if (host.__CB_DEVICE_BINDING__?.version === 1) return
    const base = new URL(api, location.href)
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname.replace(/\/$/, '') !== '') return
    const token = readSessionToken(storageKey), session = readBinding(storageKey)
    if (!token || token !== expectedToken || session?.token_type !== 'DPoP') return
    const current = () => {
      if (readSessionToken(storageKey) !== token || readBinding(storageKey)?.device_binding?.jkt !== session.device_binding?.jkt) throw new DOMException('The sign-in changed.', 'AbortError')
    }
    const portal = storageKey === 'crewbarn_portal_token' || storageKey === 'crewbarn_asset_owner_token'
    const endpoint = base.origin + (portal ? '/v1/portal/auth/device-binding' : '/v1/auth/device-binding')
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 5000)
    try {
      current()
      const headers = { Authorization: `DPoP ${token}`, Accept: 'application/json' }
      // Optional: retried once like any request, and a grant rejection here never signs out.
      const response = await send(new Request(endpoint, { headers, signal: controller.signal, cache: 'no-store' }), true, current, true)
      if (response.status === 401) { current(); expired(token); return }
      if (!response.ok) return
      const offer = await response.json().catch(() => null)
      current()
      if (offer?.enabled !== true || offer?.eligible !== true || !['offered', 'pending'].includes(offer?.status)) return
      const enrolled = await send(new Request(endpoint + '/enroll', { method: 'POST', headers, signal: controller.signal, cache: 'no-store' }), true, current, true)
      if (enrolled.status === 401) { current(); expired(token) }
    } finally { clearTimeout(timeout) }
  })
  uploadFetchers.set(storageKey, intercept)
  const wrapped: typeof fetch = (input, init) => intercept(new Request(input, init), undefined, init?.body instanceof FormData ? init.body : undefined)
  if (attachToWindow) window.fetch = wrapped
  return wrapped
}
export async function sendProgressUpload(
  xhr: XMLHttpRequest, url: string, api: string, storageKey: string, token: string | null,
  body: FormData, headers: HeadersInit, complete: (status: number, text: string) => void,
): Promise<void> {
  if (!isApiUrl(url, api) || !token) { xhr.send(body); return }
  const binding = readBinding(storageKey)
  const upload = uploadFetchers.get(storageKey)
  if (!isApiUrl(url, api) || !token || binding?.token_type !== 'DPoP' || !upload) {
    await signUpload(xhr, url, api, storageKey, token); xhr.send(body); return
  }
  const controller = new AbortController(), originalAbort = xhr.abort.bind(xhr)
  xhr.abort = () => { controller.abort(); originalAbort() }
  const next = new Headers(headers); next.set('Authorization', `Bearer ${token}`)
  try {
    const response = await upload(new Request(url, { method: 'POST', body, headers: next, signal: controller.signal }), (loaded, total) => {
      xhr.upload.dispatchEvent(new ProgressEvent('progress', { lengthComputable: total > 0, loaded, total }))
    }, body)
    complete(response.status, await response.text())
  } finally { xhr.abort = originalAbort }
}
export function readBinding(storageKey: string): BoundSession | null {
  const raw = readSessionToken(storageKey + '_binding')
  if (!raw) return null
  try {
    const binding = JSON.parse(raw) as BoundSession
    if (!binding || binding.token_type !== 'DPoP' || binding.device_binding?.version !== 1 || typeof binding.device_binding.jkt !== 'string' || !binding.device_binding.jkt) throw new Error()
    return binding
  } catch { throw new Error('This saved sign-in could not be read. Please sign in again.') }
}
export function saveBinding(storageKey: string, session?: BoundSession): void {
  if (session?.token_type === 'DPoP' && (!session.device_binding?.jkt || session.device_binding.version !== 1)) throw new Error('The server could not confirm this sign-in. Please try again.')
  try {
    if (session?.token_type === 'DPoP') localStorage.setItem(storageKey + '_binding', JSON.stringify({ token_type: session.token_type, device_binding: session.device_binding }))
    else localStorage.removeItem(storageKey + '_binding')
  } catch { throw new StorageUnavailableError() }
}
export async function signUpload(xhr: XMLHttpRequest, url: string, api: string, storageKey: string, token: string | null): Promise<void> {
  if (!isApiUrl(url, api) || !token) return
  const session = readBinding(storageKey)
  if (token && session?.token_type === 'DPoP') {
    xhr.setRequestHeader('Authorization', `DPoP ${token}`)
    xhr.setRequestHeader('DPoP', await createProof('POST', url, token, session.device_binding, serverClock(api), api))
    xhr.withCredentials = true
  } else if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
}
