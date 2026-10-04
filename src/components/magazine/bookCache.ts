/**
 * Catalogues kept on this device after the first download.
 *
 * A price book is sixty megabytes. Fetching it every time it is opened is
 * a minute on a phone in a van, for bytes that have not changed: a file on
 * a card never changes -- a new upload is a new file with a new id -- so
 * once a copy is here it is good for as long as it is kept.
 *
 * Kept in the browser's Cache Storage, which is made for large files and
 * survives a restart. Up to LIMIT bytes in all; past that the books opened
 * longest ago go first. Anything that goes wrong here -- no Cache Storage,
 * a full disk, a private window -- only means the book is downloaded, as
 * it always was.
 */

const CACHE = 'crewbarn-books-v1'
const INDEX_KEY = 'crewbarn.books.index'
const LIMIT = 600 * 1024 * 1024

type Entry = { key: string; bytes: number; at: number }

const url = (key: string) => `/__books/${encodeURIComponent(key)}`

function readIndex(): Entry[] {
  try {
    const raw = window.localStorage.getItem(INDEX_KEY)
    const list = raw ? (JSON.parse(raw) as Entry[]) : []
    return Array.isArray(list) ? list.filter((e) => e && typeof e.key === 'string') : []
  } catch {
    return []
  }
}

function writeIndex(list: Entry[]): void {
  try {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(list))
  } catch {
    // The index only orders evictions; the books themselves are still kept.
  }
}

const available = () => typeof window !== 'undefined' && 'caches' in window

/*
 * One write at a time. Two books kept at once would each read the index
 * before the other wrote it, and one would drop out of it.
 */
let queue: Promise<unknown> = Promise.resolve()
const inTurn = (work: () => Promise<void>) => {
  queue = queue.then(work, work)
  return queue
}

/** A kept copy, or null. */
export async function cachedBook(key: string): Promise<ArrayBuffer | null> {
  if (!available()) return null
  try {
    const cache = await caches.open(CACHE)
    const hit = await cache.match(url(key))
    if (!hit) return null
    const bytes = await hit.arrayBuffer()
    // Opened now: last to be evicted.
    writeIndex([{ key, bytes: bytes.byteLength, at: Date.now() }, ...readIndex().filter((e) => e.key !== key)])
    return bytes
  } catch {
    return null
  }
}

/**
 * Keep a copy. The bytes are copied before this returns, so the buffer can
 * be handed to pdf.js -- which takes it over -- straight after.
 */
export function keepBook(key: string, bytes: ArrayBuffer): void {
  if (!available() || bytes.byteLength === 0 || bytes.byteLength > LIMIT) return
  const blob = new Blob([bytes], { type: 'application/pdf' })

  void inTurn(async () => {
    try {
      const cache = await caches.open(CACHE)
      // Room first: the books opened longest ago go.
      let index = readIndex().filter((e) => e.key !== key)
      let total = index.reduce((n, e) => n + e.bytes, 0) + blob.size
      while (total > LIMIT && index.length > 0) {
        const oldest = index.reduce((a, b) => (a.at <= b.at ? a : b))
        await cache.delete(url(oldest.key))
        index = index.filter((e) => e !== oldest)
        total -= oldest.bytes
      }
      await cache.put(url(key), new Response(blob, { headers: { 'Content-Type': 'application/pdf' } }))
      writeIndex([{ key, bytes: blob.size, at: Date.now() }, ...index])
    } catch {
      // Not kept: next time it downloads.
    }
  })
}

/**
 * Let go of every kept book under `prefix` but these: a catalogue no
 * longer shared should not stay on the device that was shown it.
 */
export async function keepOnly(prefix: string, keys: string[]): Promise<void> {
  if (!available()) return
  await inTurn(async () => {
    try {
      const cache = await caches.open(CACHE)
      const keep = new Set(keys)
      // What is actually there, not only what the index remembers.
      for (const request of await cache.keys()) {
        const key = decodeURIComponent(new URL(request.url).pathname.replace(/^\/__books\//, ''))
        if (key.startsWith(prefix) && !keep.has(key)) await cache.delete(url(key))
      }
      writeIndex(readIndex().filter((e) => !e.key.startsWith(prefix) || keep.has(e.key)))
    } catch {
      // Left for the size limit to clear.
    }
  })
}
