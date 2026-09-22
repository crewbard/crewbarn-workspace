import { useCallback, useEffect, useState } from 'react'

/**
 * useDashboardCardSize — how big the dashboard tiles render, persisted
 * per-browser (localStorage). Same instant, no-round-trip pattern as
 * useDashboardLayout / the theme settings.
 *
 *   - large  → the original board (3 cols, tall tiles). Default.
 *   - medium → 4 cols, shorter tiles.
 *   - small  → 5 cols, compact tiles — fits the whole board on one screen.
 */
const STORAGE_KEY = 'crewbarn_dashboard_size_v1'

export type DashCardSize = 'large' | 'medium' | 'small'

const VALID: DashCardSize[] = ['large', 'medium', 'small']
const DEFAULT_SIZE: DashCardSize = 'large'

function read(): DashCardSize {
  if (typeof window === 'undefined') return DEFAULT_SIZE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw && (VALID as string[]).includes(raw)) return raw as DashCardSize
    return DEFAULT_SIZE
  } catch {
    return DEFAULT_SIZE
  }
}

export function useDashboardCardSize(): [DashCardSize, (s: DashCardSize) => void] {
  const [size, setSize] = useState<DashCardSize>(read)

  const update = useCallback((next: DashCardSize) => {
    setSize(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* private mode — state still updates in-memory */
    }
  }, [])

  // Cross-tab sync.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setSize(read())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return [size, update]
}
