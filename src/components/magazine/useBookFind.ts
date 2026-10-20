import { useEffect, useRef, useState } from 'react'
import type { Book, SearchHit } from './pdfBook'

export type FindState = {
  hits: SearchHit[]
  /** The last page read so far. */
  readTo: number
  running: boolean
  /** What the hits are for: the text as it was when the search started. */
  query: string
}

/**
 * Searching the book as somebody types: Find uses it, and so does the box
 * in the parts cart. Waits for a pause in the typing, reads the pages a
 * few at a time so the typing stays quick, and drops a search the moment
 * the text changes.
 *
 * `onFound` hears every batch of hits (and an empty list once the text is
 * cleared), so the page can light them up.
 */
export function useBookFind(
  book: Book | null,
  query: string,
  {
    max,
    delay = 300,
    onFound,
  }: {
    max?: number
    delay?: number
    onFound?: (hits: SearchHit[], done: boolean) => void
  } = {},
): FindState {
  const [state, setState] = useState<FindState>({ hits: [], readTo: 0, running: false, query: '' })
  const run = useRef(0)
  const found = useRef(onFound)
  const reported = useRef(false)

  useEffect(() => {
    found.current = onFound
  })

  // Each search supersedes the last; a stale one stops at its next page.
  useEffect(() => {
    const id = ++run.current
    const q = query.trim()

    const timer = window.setTimeout(() => {
      if (!book || q.length < 2) {
        setState({ hits: [], readTo: 0, running: false, query: q })
        if (reported.current) {
          reported.current = false
          found.current?.([], true)
        }
        return
      }

      setState((was) => ({ ...was, running: true, readTo: 0 }))
      void book
        .search(
          q,
          (hits, page) => {
            if (run.current !== id) return
            const done = page >= book.pageCount
            setState({ hits, readTo: page, running: !done, query: q })
            reported.current = true
            found.current?.(hits, done)
          },
          () => run.current !== id,
          max,
        )
        .finally(() => {
          if (run.current === id) setState((was) => ({ ...was, running: false }))
        })
    }, q.length < 2 ? 0 : delay)

    return () => window.clearTimeout(timer)
  }, [query, book, max, delay])

  return state
}
