import { useCallback, useState } from 'react'

/**
 * useFormDrafts — local, multi-draft autosave so in-progress forms survive a
 * dropped connection, a reload, or an accidental navigation, and you can hold
 * several drafts at once (start a NEW job without losing one already drafted).
 *
 * Purely client-side (localStorage) — no server round-trip, works offline. Each
 * form keeps its own draft id; call saveDraft on change (debounce upstream),
 * deleteDraft on a successful save, and read `drafts` to offer "resume".
 */
export interface FormDraft<T> {
  id: string
  data: T
  label: string
  updatedAt: number
}

const MAX_DRAFTS = 15
const keyFor = (ns: string) => `crewbarn:drafts:${ns}`

function readAll<T>(ns: string): FormDraft<T>[] {
  try {
    const raw = localStorage.getItem(keyFor(ns))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as FormDraft<T>[]) : []
  } catch {
    return []
  }
}

function writeAll<T>(ns: string, drafts: FormDraft<T>[]): void {
  try {
    localStorage.setItem(keyFor(ns), JSON.stringify(drafts))
  } catch {
    // storage full / disabled — drafts are best-effort
  }
}

export function newDraftId(): string {
  return `d_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export function useFormDrafts<T>(namespace: string) {
  const [drafts, setDrafts] = useState<FormDraft<T>[]>(() => readAll<T>(namespace))

  const saveDraft = useCallback(
    (id: string, data: T, label: string) => {
      const all = readAll<T>(namespace).filter((d) => d.id !== id)
      all.unshift({ id, data, label, updatedAt: Date.now() })
      all.sort((a, b) => b.updatedAt - a.updatedAt)
      const capped = all.slice(0, MAX_DRAFTS)
      writeAll(namespace, capped)
      setDrafts(capped)
    },
    [namespace],
  )

  const deleteDraft = useCallback(
    (id: string) => {
      const all = readAll<T>(namespace).filter((d) => d.id !== id)
      writeAll(namespace, all)
      setDrafts(all)
    },
    [namespace],
  )

  return { drafts, saveDraft, deleteDraft }
}
