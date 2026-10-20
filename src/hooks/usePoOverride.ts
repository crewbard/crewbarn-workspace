import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  endPoOverride, getPoOverrideStatus, getStaffPoOverride, overrideBody, overrideNeed, overrideReady,
  sendPoOverrideCode, setStaffPoOverride, stockInChoices, verifyPoOverrideCode, type OverrideChannel, type OverrideNeed, type PoOverrideStatus,
} from '@/lib/poOverride'
import { useInventorySettings } from '@/hooks/useInventorySettings'
import { PERM, usePermissions } from '@/hooks/usePermissions'

export const poOverrideKey = ['inventory', 'po-override'] as const

export function usePoOverrideStatus(enabled = true) {
  return useQuery({ queryKey: poOverrideKey, queryFn: getPoOverrideStatus, enabled, staleTime: 15_000 })
}

export function useSendPoOverrideCode() {
  return useMutation({ mutationFn: (channel?: OverrideChannel) => sendPoOverrideCode(channel) })
}

export function useVerifyPoOverrideCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => verifyPoOverrideCode(code),
    onSuccess: (r) => {
      qc.setQueryData<PoOverrideStatus>(poOverrideKey, (prev) => (prev ? { ...prev, session: r.session } : prev))
    },
  })
}

export function useEndPoOverride() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: endPoOverride, onSuccess: () => void qc.invalidateQueries({ queryKey: poOverrideKey }) })
}

export function useStaffPoOverride(staffId: string | null | undefined) {
  return useQuery({ queryKey: ['staff', staffId, 'po-override'], queryFn: () => getStaffPoOverride(staffId!), enabled: !!staffId })
}

export function useSetStaffPoOverride(staffId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (on: boolean) => setStaffPoOverride(staffId, on),
    onSuccess: (data) => qc.setQueryData(['staff', staffId, 'po-override'], data),
  })
}

export interface PoOverrideGate {
  need: OverrideNeed
  reason: string
  setReason: (v: string) => void
  ready: boolean
  /** Spread into the request body. */
  body: { override_reason?: string }
  status: PoOverrideStatus | undefined
}

/**
 * One form's view of the rule: what it needs for this save, the reason typed
 * so far, and whether it may save. The box (PoOverrideBox) shows it.
 */
export function usePoOverrideGate(increase: boolean, countCorrection = false): PoOverrideGate {
  const { data: status } = usePoOverrideStatus()
  const [reason, setReason] = useState('')
  const need = overrideNeed(status, increase, countCorrection)
  return { need, reason, setReason, ready: overrideReady(need, reason), body: overrideBody(need, reason), status }
}

/**
 * The one PO-only answer for every stock-in door (header, Stock Levels, Bins).
 * The server's PoOnlyGate answers through the override status; until that has
 * loaded (or for someone who may not edit stock) the shop setting stands in.
 */
export function useStockInRules() {
  const canEdit = usePermissions().has(PERM.INVENTORY_EDIT)
  const { data: settings } = useInventorySettings()
  const { data: status } = usePoOverrideStatus(canEdit)
  const poRequired = status ? status.po_required : !!settings?.inventory_require_po_for_stock_add
  const rule = status ?? { po_required: poRequired, can_override: false, count_corrections_allowed: !!settings?.inventory_allow_count_corrections }
  return { canEdit, poRequired, canOverride: !!status?.can_override, choices: stockInChoices(rule, canEdit) }
}
