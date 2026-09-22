import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'crewbarn_tool_shed_layout_v1'

export interface ToolShedLayout {
  cards: string[]
  addCard: (id: string) => void
  removeCard: (id: string) => void
  setOrder: (ids: string[]) => void
  reset: () => void
}

function read(defaults: string[]): string[] {
  if (typeof window === 'undefined') return defaults
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      return parsed
    }
    return defaults
  } catch {
    return defaults
  }
}

export function useToolShedLayout(defaults: string[], validIds: string[]): ToolShedLayout {
  const validSet = new Set(validIds)
  const normalize = useCallback(
    (ids: string[]) => {
      const filtered = ids.filter((id) => validSet.has(id))
      if (ids.length > 0 && filtered.length === 0 && defaults.length > 0) return defaults
      return filtered
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [defaults.join('|'), validIds.join('|')],
  )
  const [cards, setCards] = useState<string[]>(() => normalize(read(defaults)))

  const persist = useCallback((next: string[]) => {
    setCards(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* private mode: keep the in-memory state */
    }
  }, [])

  const addCard = useCallback((id: string) => {
    setCards((current) => {
      if (current.includes(id)) return current
      const next = [...current, id]
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const removeCard = useCallback((id: string) => {
    setCards((current) => {
      const next = current.filter((card) => card !== id)
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const reset = useCallback(() => persist(defaults), [defaults, persist])

  useEffect(() => {
    setCards(normalize(read(defaults)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults.join('|'), validIds.join('|'), normalize])

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) {
        setCards(normalize(read(defaults)))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { cards, addCard, removeCard, setOrder: persist, reset }
}
