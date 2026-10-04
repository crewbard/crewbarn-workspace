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
  const form = new FormData()
  form.append('document', file)
  if (options.title) form.append('title', options.title)
  form.append('shareable', options.shareable ? '1' : '0')

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}${base(cardId)}`)
    xhr.setRequestHeader('Accept', 'application/json')

    const token = getStoredToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    const acting = getActingTenant()
    if (acting) xhr.setRequestHeader('X-Act-As-Tenant', acting)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) options.onProgress?.(e.loaded / e.total)
    }

    xhr.onload = () => {
      let body: { document?: ReferenceCardDocument; message?: string } = {}
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        // Not JSON: a proxy refused the upload before Laravel saw it.
      }

      if (xhr.status === 201 && body.document) {
        resolve(body.document)
        return
      }

      // 413 comes from the web server, not the API, so it has no message.
      reject(new Error(
        body.message
          ?? (xhr.status === 413
            ? 'That file is bigger than the server accepts.'
            : `The upload did not go through (HTTP ${xhr.status}).`),
      ))
    }

    xhr.onerror = () => reject(new Error('The upload lost its connection. Nothing was saved.'))
    xhr.send(form)
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

  const bytes = await downloadDocument(cardId, documentId, options)
  keepBook(key, bytes)
  return bytes
}

async function downloadDocument(
  cardId: string,
  documentId: string,
  options: { onProgress?: (progress: DownloadProgress) => void; signal?: AbortSignal; expectedBytes?: number },
): Promise<ArrayBuffer> {
  const path = `${base(cardId)}/${documentId}/file`
  const headers: Record<string, string> = { Accept: 'application/pdf, application/json' }
  const token = getStoredToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const acting = getActingTenant()
  if (acting) headers['X-Act-As-Tenant'] = acting
  const franchise = getFranchiseActAs()
  if (franchise) headers['X-Franchise-Act-As'] = franchise.id

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
