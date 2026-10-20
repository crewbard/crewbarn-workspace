import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { useModuleVisibility } from '@/hooks/useModuleVisibility'
import {
  DEFAULT_PREFS,
  cleanPrefs,
  describeKeys,
  effectiveKeys,
  firstOpenRoute,
  type RecordKind,
  type ShortcutDef,
  type ShortcutPrefs,
  type ShortcutRoute,
} from '@/lib/shortcuts'
import { pushRecordHandlers, rememberRecordList, type RecordHandlers } from '@/lib/shortcutBus'

/*
 * A person's keyboard shortcuts: on or off, and the keys they changed.
 *
 * Saved on their account (GET/PUT /v1/me/keyboard-shortcuts), so the keys
 * they set up at the shop are the keys on the laptop at home. A copy is
 * kept in this browser too, so the keys work from the first key press
 * after a reload instead of after the request comes back.
 */

const QUERY_KEY = ['me', 'keyboard-shortcuts'] as const
const cacheKey = (accountId: string | undefined) => `cb.shortcuts.${accountId ?? 'signed-out'}`

function readCache(accountId: string | undefined): ShortcutPrefs | undefined {
  try {
    const raw = window.localStorage.getItem(cacheKey(accountId))
    return raw ? cleanPrefs(JSON.parse(raw)) : undefined
  } catch {
    return undefined
  }
}

function writeCache(accountId: string | undefined, prefs: ShortcutPrefs): void {
  try {
    window.localStorage.setItem(cacheKey(accountId), JSON.stringify(prefs))
  } catch {
    // Storage full or blocked: the server copy still holds it.
  }
}

export function useShortcutPrefs() {
  const { account } = useAuth()
  const accountId = account?.id
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: [...QUERY_KEY, accountId],
    enabled: !!accountId,
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    placeholderData: () => readCache(accountId),
    queryFn: async () => {
      const res = await apiRequest<{ data: unknown }>('/v1/me/keyboard-shortcuts')
      const prefs = cleanPrefs(res.data)
      writeCache(accountId, prefs)
      return prefs
    },
  })

  const save = useMutation({
    mutationFn: (next: ShortcutPrefs) =>
      apiRequest<{ data: unknown }>('/v1/me/keyboard-shortcuts', { method: 'PUT', body: next }),
    onMutate: (next) => {
      // Takes effect at once; the browser copy keeps it even if the save fails.
      qc.setQueryData([...QUERY_KEY, accountId], next)
      writeCache(accountId, next)
    },
    onSuccess: (res) => {
      const prefs = cleanPrefs(res.data)
      qc.setQueryData([...QUERY_KEY, accountId], prefs)
      writeCache(accountId, prefs)
    },
  })

  const prefs = query.data ?? DEFAULT_PREFS
  const keys = useMemo(() => effectiveKeys(prefs), [prefs])

  return {
    prefs,
    keys,
    isLoading: query.isLoading,
    save: save.mutateAsync,
    saving: save.isPending,
    saveFailed: save.isError,
  }
}

/** "Ctrl K" for a shortcut as this person has it, or null when it is off. */
export function useShortcutLabel(id: string): string | null {
  const { prefs, keys } = useShortcutPrefs()
  if (!prefs.enabled || !keys[id]) return null
  return describeKeys(keys[id])
}

/** Whether this person can use a shortcut at all (its page, or what it needs). */
export function useShortcutAccess(): (def: ShortcutDef) => boolean {
  const { hasAny } = usePermissions()
  const { isRouteVisibleInWork } = useModuleVisibility()
  return useCallback((def: ShortcutDef) => {
    if (def.routes) {
      return firstOpenRoute(def, (r: ShortcutRoute) =>
        (!r.anyOf || r.anyOf.length === 0 || hasAny(r.anyOf)) && isRouteVisibleInWork(r.to.split('?')[0]),
      ) !== null
    }
    return !def.anyOf || def.anyOf.length === 0 || hasAny(def.anyOf)
  }, [hasAny, isRouteVisibleInWork])
}

/**
 * What E, M and Ctrl/⌘ Enter do on this record page. Pass `false` to leave
 * them alone (a record shown inside another page, not on its own).
 */
export function useRecordShortcuts(handlers: RecordHandlers, enabled = true): void {
  const latest = useRef(handlers)
  useEffect(() => {
    latest.current = handlers
  })
  useEffect(() => {
    if (!enabled) return
    return pushRecordHandlers(() => latest.current)
  }, [enabled])
}

/** Remember the records a list shows, in order, so [ and ] can step through them. */
export function useRememberRecordList(kind: RecordKind, rows: ReadonlyArray<{ id: string | number }>): void {
  const ids = rows.map((r) => String(r.id)).join('\n')
  useEffect(() => {
    if (ids) rememberRecordList(kind, ids.split('\n'))
  }, [kind, ids])
}
