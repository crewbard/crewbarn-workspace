/**
 * A last-resort surface for writes that fail with nobody listening.
 *
 * 354 of the app's 450 useMutation blocks declare no onError. Most are fine —
 * hooks whose callers pass their own handler, or mutateAsync inside a
 * try/catch. But the ones that aren't fail in complete silence: the button
 * appears to do nothing, the row doesn't change, and the only trace is a red
 * line in a console nobody has open. Every "it's not letting me save" this week
 * looked exactly like that.
 *
 * Rather than edit 354 call sites — most of which don't need it, and any of
 * which could regress tomorrow — this catches what React Query already knows:
 * a mutation rejected and its own options had no onError. Anything declaring a
 * handler in useMutation is left alone; a handler passed at the CALL site is
 * invisible to React Query's cache callback, so those flows show this as well
 * as their own message — duplication being much the lesser problem.
 */

export interface MutationErrorNotice {
  id: number
  message: string
}

type Listener = (notices: MutationErrorNotice[]) => void

let notices: MutationErrorNotice[] = []
let nextId = 1
const listeners = new Set<Listener>()

function emit(): void {
  for (const l of listeners) l(notices)
}

export function subscribeMutationErrors(listener: Listener): () => void {
  listeners.add(listener)
  listener(notices)
  return () => {
    listeners.delete(listener)
  }
}

export function pushMutationError(message: string): void {
  // Collapse repeats. A failing save pressed three times is one problem, and
  // three identical banners read as three different ones.
  if (notices.some((n) => n.message === message)) return

  notices = [...notices, { id: nextId++, message }].slice(-3)
  emit()
}

export function dismissMutationError(id: number): void {
  notices = notices.filter((n) => n.id !== id)
  emit()
}
