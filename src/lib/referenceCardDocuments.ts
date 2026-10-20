import { sendApiUpload } from '@/lib/api'
import { API_URL, apiRequest, getActingTenant, getFranchiseActAs, getStoredToken, handleUnauthorized } from '@/lib/api'
import type { DocumentTab, ReferenceCardDocument } from '@/lib/referenceCards'
import { cachedBook, keepBook } from '@/components/magazine/bookCache'

/**
 * Files on a reference card: upload, change, remove, read.
 *
 * Reading goes through the API with the session's token and comes back
 * as bytes. There is no URL to a file anywhere in the client, because
 * the storage behind it has a public domain and a catalogue is usually
 * somebody else's copyright.
 */

const base = (cardId: string) => `/v1/reference-cards/${cardId}/documents`

/**
 * Upload one PDF, reporting progress.
 *
 * XMLHttpRequest rather than fetch, because fetch cannot say how far an
 * upload has got -- and a price book runs to sixty megabytes or more,
 * which on a phone hotspot is long enough to look broken without a bar.
 */
export function uploadReferenceCardDocument(
  cardId: string,
  file: File,
  options: { title?: string; shareable?: boolean; onProgress?: (fraction: number) => void } = {},
): Promise<ReferenceCardDocument> {
  return uploadPdf<ReferenceCardDocument>(base(cardId), 'document', file, options)
}

/**
 * A PDF straight into the catalog library, no card needed. Same upload,
 * same progress bar; the answer is the catalog.
 */
export function uploadCatalogPdf<T>(
  file: File,
  options: { title?: string; vendor?: string; vendor_id?: string; shareable?: boolean; onProgress?: (fraction: number) => void } = {},
): Promise<T> {
  return uploadPdf<T>('/v1/catalogs', 'catalog', file, options)
}

type UploadOptions = { title?: string; vendor?: string; vendor_id?: string; shareable?: boolean; onProgress?: (fraction: number) => void }

/**
 * A PDF up to 150 MB goes straight to storage when it can: the API hands a
 * signed link to one path in the company's bucket, the browser sends the
 * file there (past the 100 MB Cloudflare lets through to the API), and the
 * API checks and takes it. Not set up for it, or the send to storage
 * failing, the file goes through the API as it always has.
 */
async function uploadPdf<T>(path: string, answerKey: string, file: File, options: UploadOptions): Promise<T> {
  const link = await apiRequest<{ data: { direct: boolean; token?: string; url?: string; headers?: Record<string, string> } }>(
    `${path}/upload-link`,
    { method: 'POST', body: { filename: file.name, size: file.size } },
  )
  if (link.data.direct && link.data.url && link.data.token) {
    const sent = await sendToStorage(link.data.url, link.data.headers ?? {}, file, options.onProgress).then(() => true, () => false)
    if (sent) {
      const res = await apiRequest<Record<string, unknown>>(path, {
        method: 'POST',
        body: { upload_token: link.data.token, title: options.title, vendor: options.vendor, vendor_id: options.vendor_id, shareable: !!options.shareable },
      })
      return res[answerKey] as T
    }
  }

  return uploadThroughApi<T>(path, answerKey, file, options)
}

/** The file to the signed link, reporting progress. */
function sendToStorage(url: string, headers: Record<string, string>, file: File, onProgress?: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage refused the file (HTTP ${xhr.status}).`)))
    xhr.onerror = () => reject(new Error('The upload lost its connection.'))
    xhr.send(file)
  })
}

function uploadThroughApi<T>(path: string, answerKey: string, file: File, options: UploadOptions): Promise<T> {
  const form = new FormData()
  form.append('document', file)
  if (options.title) form.append('title', options.title)
  if (options.vendor) form.append('vendor', options.vendor)
  if (options.vendor_id) form.append('vendor_id', options.vendor_id)
  form.append('shareable', options.shareable ? '1' : '0')

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}${path}`)
    xhr.setRequestHeader('Accept', 'application/json')

    const token = getStoredToken()

    const acting = getActingTenant()
    if (acting) xhr.setRequestHeader('X-Act-As-Tenant', acting)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) options.onProgress?.(e.loaded / e.total)
    }

    const complete = (status: number, responseText: string) => {
      let body: Record<string, unknown> & { message?: string } = {}
      try {
        body = JSON.parse(responseText)
      } catch {
        // Not JSON: a proxy refused the upload before Laravel saw it.
      }

      if (status === 201 && body[answerKey]) {
        resolve(body[answerKey] as T)
        return
      }

      // 413 comes from the web server, not the API, so it has no message.
      reject(new Error(
        body.message
          ?? (status === 413
            ? 'That file is bigger than the server accepts.'
            : `The upload did not go through (HTTP ${status}).`),
      ))
    }

    xhr.onload = () => complete(xhr.status, xhr.responseText)
    xhr.onerror = () => reject(new Error('The upload lost its connection. Nothing was saved.'))
    void sendApiUpload(xhr, `${API_URL}${path}`, token, form, complete).catch(reject)
  })
}

export async function updateReferenceCardDocument(
  cardId: string,
  documentId: string,
  patch: { title?: string; shareable?: boolean; tabs?: DocumentTab[] },
): Promise<ReferenceCardDocument> {
  const res = await apiRequest<{ document: ReferenceCardDocument }>(`${base(cardId)}/${documentId}`, {
    method: 'PATCH',
    body: patch,
  })
  return res.document
}

/** Let the shop's customers read this file in the portal, or stop them. */
export async function showToCustomers(cardId: string, documentId: string, on: boolean): Promise<ReferenceCardDocument> {
  const res = await apiRequest<{ document: ReferenceCardDocument }>(`${base(cardId)}/${documentId}/customers`, {
    method: 'PATCH',
    body: { customer_visible: on },
  })
  return res.document
}

export async function removeReferenceCardDocument(cardId: string, documentId: string): Promise<void> {
  await apiRequest(`${base(cardId)}/${documentId}`, { method: 'DELETE' })
}

/** How far a download has got. `total` is null when the size is not known. */
export type DownloadProgress = { loaded: number; total: number | null }

/**
 * The file's bytes, read with the session rather than by URL, saying how
 * far it has got as it goes.
 *
 * A price book runs to 60 MB and more; over a phone hotspot that is a
 * minute or two of a blank screen that looks broken without a bar. The
 * size comes from the response, or failing that the size recorded at
 * upload. Aborting -- closing the book -- stops the download rather than
 * letting 150 MB carry on arriving for nobody.
 */
export async function readReferenceCardDocument(
  cardId: string,
  documentId: string,
  options: { onProgress?: (progress: DownloadProgress) => void; signal?: AbortSignal; expectedBytes?: number } = {},
): Promise<ArrayBuffer> {
  // Kept on this device after the first time: a file on a card never changes.
  const key = `staff:${documentId}:${options.expectedBytes ?? ''}`
  const kept = await cachedBook(key)
  if (kept) return kept

  const bytes = await downloadDocument(`${base(cardId)}/${documentId}/file`, options)
  keepBook(key, bytes)
  return bytes
}

/**
 * A catalog's bytes from the library, by its own id. The same device
 * cache as before: a catalog opened from a card is the same file.
 */
export async function readCatalogFile(
  documentId: string,
  options: { onProgress?: (progress: DownloadProgress) => void; signal?: AbortSignal; expectedBytes?: number } = {},
): Promise<ArrayBuffer> {
  const key = `staff:${documentId}:${options.expectedBytes ?? ''}`
  const kept = await cachedBook(key)
  if (kept) return kept

  const bytes = await downloadDocument(`/v1/catalogs/${documentId}/file`, options)
  keepBook(key, bytes)
  return bytes
}

/** The session's headers for a request made with fetch rather than apiRequest. */
export function authHeaders(accept: string): Record<string, string> {
  const headers: Record<string, string> = { Accept: accept }
  const token = getStoredToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const acting = getActingTenant()
  if (acting) headers['X-Act-As-Tenant'] = acting
  const franchise = getFranchiseActAs()
  if (franchise) headers['X-Franchise-Act-As'] = franchise.id
  return headers
}

/** An image the API streams (a cover, a card picture), as a blob. Null when there is none. */
export async function readImage(path: string, signal?: AbortSignal): Promise<Blob | null> {
  const response = await fetch(`${API_URL}${path}`, { headers: authHeaders('image/*, application/json'), signal })
  if (response.status === 401) handleUnauthorized(path)
  return response.ok ? response.blob() : null
}

/** A picture sent to the API as a multipart upload. */
export async function sendImage(path: string, field: string, image: Blob, extra: Record<string, string> = {}): Promise<void> {
  const form = new FormData()
  form.append(field, image, `${field}.jpg`)
  for (const [key, value] of Object.entries(extra)) form.append(key, value)
  const response = await fetch(`${API_URL}${path}`, { method: 'POST', headers: authHeaders('application/json'), body: form })
  if (response.status === 401) handleUnauthorized(path)
  if (!response.ok) {
    let message: string | undefined
    try {
      const body = (await response.json()) as { message?: unknown }
      if (typeof body.message === 'string') message = body.message
    } catch {
      // Not JSON.
    }
    throw new Error(message ?? 'The picture did not save.')
  }
}

async function downloadDocument(
  path: string,
  options: { onProgress?: (progress: DownloadProgress) => void; signal?: AbortSignal; expectedBytes?: number },
): Promise<ArrayBuffer> {
  const headers = authHeaders('application/pdf, application/json')

  const response = await fetch(`${API_URL}${path}`, { headers, signal: options.signal })

  if (!response.ok) {
    if (response.status === 401) handleUnauthorized(path)
    let message: string | undefined
    try {
      const body = (await response.json()) as { message?: unknown }
      if (typeof body.message === 'string') message = body.message
    } catch {
      // Not JSON.
    }
    throw new Error(message ?? `The file could not be opened (HTTP ${response.status}).`)
  }

  const header = Number(response.headers.get('Content-Length'))
  const total = header > 0 ? header : (options.expectedBytes && options.expectedBytes > 0 ? options.expectedBytes : null)

  // No stream to read from (an old browser): all at once, with no bar.
  if (!response.body || !options.onProgress) return response.arrayBuffer()

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  let reported = 0

  options.onProgress({ loaded: 0, total })
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.byteLength

    // Often enough to move smoothly, not once per network packet.
    const now = performance.now()
    if (now - reported > 100) {
      reported = now
      options.onProgress({ loaded, total })
    }
  }
  options.onProgress({ loaded, total: total ?? loaded })

  const bytes = new Uint8Array(loaded)
  let at = 0
  for (const chunk of chunks) {
    bytes.set(chunk, at)
    at += chunk.byteLength
  }
  return bytes.buffer
}

export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} bytes`
}
