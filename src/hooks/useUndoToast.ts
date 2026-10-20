import { useEffect, useState } from 'react'

/** What the UndoToast shows (components/ui/UndoToast.tsx); in hooks/ so the component file only exports components. */
export type UndoToastState = { text: string; undo?: () => void } | null

/** The toast and its setter; it goes by itself after 4 s, or 8 s with Undo. */
export function useUndoToast() {
  const [toast, setToast] = useState<UndoToastState>(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.undo ? 8000 : 4000)
    return () => clearTimeout(t)
  }, [toast])
  return [toast, setToast] as const
}
