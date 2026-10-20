/** Resumable transport only; the final endpoint still performs business authorization. */
export type UploadSender = (request: Request, final: boolean, cleanup?: boolean) => Promise<Response>
const START = 64 * 1024, MAX = 1024 * 1024, MIN = 4 * 1024, JSON_MAX = 32 * 1024 * 1024
const finalResponses = new WeakSet<Response>()
export const isDeviceUploadResponse = (response: Response): boolean => finalResponses.has(response)
const abort = () => new DOMException('The upload was cancelled or the sign-in changed.', 'AbortError')
async function result(response: Response): Promise<Record<string, unknown>> {
  let body
  try { body = await response.json() } catch (error) {
    if (error instanceof TypeError) throw error
    throw new Error('The upload could not be completed. Please try again.')
  }
  if (!response.ok || !body?.data) throw new Error(body?.message || 'The upload could not be completed. Please try again.')
  return body.data
}
async function boundedBody(request: Request): Promise<Uint8Array> {
  const reader = request.body?.getReader()
  if (!reader) return new Uint8Array()
  const parts: Uint8Array[] = []; let size = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > JSON_MAX) throw new Error('This upload is larger than the 32 MiB limit.')
      parts.push(value)
    }
  } catch (error) { void reader.cancel().catch(() => undefined); throw error }
  finally { reader.releaseLock() }
  const bytes = new Uint8Array(size); let offset = 0
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength }
  return bytes
}
export async function deviceUpload(
  request: Request, api: string, send: UploadSender, current: () => void,
  progress?: (loaded: number, total: number) => void, suppliedForm?: FormData, sessionCurrent: () => void = current,
): Promise<Response | null> {
  const target = new URL(request.url), base = new URL(api)
  const basePath = base.pathname.replace(/\/$/, '')
  if (target.origin !== base.origin || !(target.pathname === basePath || target.pathname.startsWith(basePath + '/'))
    || !['POST', 'PUT', 'PATCH'].includes(request.method) || request.headers.has('X-Device-Upload')) return null
  const prefix = basePath + (target.pathname.startsWith(basePath + '/v1/portal/') ? '/v1/portal/device-uploads' : '/v1/device-uploads')
  if (target.pathname === prefix || target.pathname.startsWith(prefix + '/')) return null
  let method = request.method, kind: 'json' | 'multipart', finalBody: BodyInit
  const files: { field: string; name: string; type: string; blob: Blob }[] = []
  const contentType = request.headers.get('Content-Type') ?? ''
  if (/^multipart\/form-data\b/i.test(contentType)) {
    const form = suppliedForm ?? await request.clone().formData(), text = new URLSearchParams()
    for (const [field, value] of form.entries()) {
      if (typeof value === 'string') {
        if (field === '_method' && request.method === 'POST') {
          const override = value.toUpperCase()
          if (!['POST', 'PUT', 'PATCH'].includes(override) || (method !== 'POST' && method !== override)) throw new Error('This upload could not be sent. Please try again.')
          method = override
        } else text.append(field, value)
      } else files.push({ field, name: value.name || 'upload', type: value.type || 'application/octet-stream', blob: value })
    }
    if (new TextEncoder().encode(text.toString()).byteLength > START) throw new Error('The form contains too much text. Shorten it and try again.')
    if (!files.length) return null
    kind = 'multipart'; finalBody = text
  } else if (/^application\/json(?:\s*;|$)/i.test(contentType)) {
    const bytes = await boundedBody(request.clone())
    if (bytes.byteLength <= START) return null
    let parsed: unknown
    try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
    catch { throw new Error('This upload could not be read. Please try again.') }
    if (!parsed || typeof parsed !== 'object') throw new Error('This upload could not be read. Please try again.')
    files.push({ field: '__json_body', name: 'body.json', type: 'application/json', blob: new Blob([bytes as BlobPart], { type: 'application/json' }) })
    kind = 'json'; finalBody = '{}'
  } else return null
  if (files.length > 20 || files.some(file => file.blob.size > 150 * 1024 * 1024)
    || files.reduce((sum, file) => sum + file.blob.size, 0) > 1024 ** 3) throw new Error('This upload is too large or contains too many files.')
  const check = () => { if (request.signal.aborted) throw abort(); current() }
  const headers = new Headers(request.headers); headers.delete('Content-Type'); headers.delete('Content-Length'); headers.delete('DPoP')
  const stage = (url: string, verb: string, body?: BodyInit) => {
    check()
    const next = new Headers(headers)
    if (body !== undefined) next.set('Content-Type', verb === 'PUT' ? 'application/octet-stream' : 'application/json')
    return send(new Request(url, { method: verb, body, headers: next, signal: request.signal }), false)
  }
  const prepared = await result(await stage(base.origin + prefix, 'POST', JSON.stringify({ method, uri: target.pathname + target.search, kind,
    files: files.map(file => ({ field: file.field, name: file.name, type: file.type, size: file.blob.size })) })))
  const id = prepared.id
  if (typeof id !== 'string' || !/^[a-f0-9]{32}$/.test(id)) throw new Error('The upload could not be started. Please try again.')
  const sessionUrl = base.origin + prefix + '/' + encodeURIComponent(id)
  const positions = (data: Record<string, unknown>): number[] => {
    if (!Array.isArray(data.files) || data.files.length !== files.length || data.files.some(item => !item || typeof item !== 'object')) throw new Error('The upload could not be resumed. Please try again.')
    return files.map((file, index) => {
      const row = (data.files as { index?: unknown; received_bytes?: unknown }[]).find(item => item.index === index)
      const offset = row?.received_bytes
      if (!Number.isSafeInteger(offset) || (offset as number) < 0 || (offset as number) > file.blob.size) throw new Error('The upload could not be resumed. Please try again.')
      return offset as number
    })
  }
  let finalAttempted = false
  try {
    check()
    let received = positions(prepared)
    const total = files.reduce((sum, file) => sum + file.blob.size, 0)
    const notify = () => progress?.(received.reduce((sum, offset) => sum + offset, 0), total)
    notify()
    for (let index = 0; index < files.length; index++) {
      let chunk = START, retries = 0
      while (received[index] < files[index].blob.size) {
        check()
        const offset = received[index], end = Math.min(offset + chunk, files[index].blob.size), started = performance.now()
        let response: Response
        try { response = await stage(`${sessionUrl}/files/${index}?offset=${offset}&length=${end - offset}`, 'PUT', files[index].blob.slice(offset, end)) }
        catch (error) {
          check()
          // An unknown write result must be reconciled before sending bytes again.
          if (!(error instanceof TypeError) || ++retries > 6) throw error
          received = positions(await result(await stage(sessionUrl, 'GET'))); check(); notify(); continue
        }
        check()
        if (response.status === 428) {
          const failure = await response.json().catch(() => null)
          if (failure?.error !== 'upload_proof_expired' || ++retries > 6) throw new Error('The connection is too slow to finish this upload. Try again on a faster connection.')
          chunk = Math.max(MIN, Math.floor(chunk / 2)); continue
        }
        if (response.status === 409 || response.status >= 500) {
          if (++retries > 6) throw new Error('The upload could not be resumed. Please try again.')
          received = positions(await result(await stage(sessionUrl, 'GET'))); check(); notify(); continue
        }
        let committed: Record<string, unknown>
        try { committed = await result(response) } catch (error) {
          check()
          if (!(error instanceof TypeError) || ++retries > 6) throw error
          received = positions(await result(await stage(sessionUrl, 'GET'))); check(); notify(); continue
        }
        const next = committed.received_bytes
        if (committed.index !== index || !Number.isSafeInteger(next) || next !== end) throw new Error('The upload could not be confirmed. Please try again.')
        received[index] = next as number; retries = 0; notify()
        if (performance.now() - started < 2000) chunk = Math.min(MAX, chunk * 2)
      }
    }
    check()
    const finalHeaders = new Headers(headers)
    finalHeaders.set('X-Device-Upload', id)
    finalHeaders.set('Content-Type', kind === 'json' ? 'application/json' : 'application/x-www-form-urlencoded;charset=UTF-8')
    // No retry, even if the business response is lost after server consumption.
    finalAttempted = true
    try {
      const response = await send(new Request(target, { method, headers: finalHeaders, body: finalBody, signal: request.signal }), true)
      finalResponses.add(response); return response
    } catch (error) {
      if (error instanceof TypeError) throw new Error('The final upload response was lost. Check the record before trying again.', { cause: error })
      throw error
    }
  } catch (error) {
    if (!finalAttempted) {
      const cleanup = new AbortController()
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        sessionCurrent()
        await Promise.race([
          send(new Request(sessionUrl, { method: 'DELETE', headers, signal: cleanup.signal }), false, true),
          new Promise<never>((_, reject) => { timer = setTimeout(() => { cleanup.abort(); reject(new Error('Upload cleanup timed out.')) }, 5000) }),
        ])
      } catch { /* Preserve the original failure; expiry also cleans orphans. */ }
      finally { if (timer !== undefined) clearTimeout(timer); cleanup.abort() }
    }
    throw error
  }
}
