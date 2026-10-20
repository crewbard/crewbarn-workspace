import { useEffect, useMemo, useState } from 'react'
import { useApplySeedPack } from '@/hooks/useOnboarding'
import type { OnboardingSeedPackSummary, OnboardingStatus, OnboardingTrade } from '@/types/onboarding'

/**
 * The trade starter pack, one way for both the setup overlay and the
 * /onboarding page.
 *
 * The trade is picked (and locked) at sign-up. So when the tenant already has
 * a trade, this shows it as set and only offers to apply its pack. A picker
 * appears only for older accounts that never recorded a trade, and there it is
 * a one-time choice that has to be confirmed.
 *
 * Both callers used to apply the pack differently: the overlay listed packs and
 * sent no trade slug, the page listed trades and sent one. They now share this
 * state, so the same vertical + trade slug go to the server from either.
 */
export function useTradeSeedChoice(onboarding: OnboardingStatus | undefined, packs: OnboardingSeedPackSummary[]) {
  const trades = useMemo(() => onboarding?.trades ?? [], [onboarding?.trades])
  const useTradeMode = trades.length > 0
  const seedVertical = onboarding?.seed_state.vertical || onboarding?.tenant.vertical || ''
  const signupTradeSlug = onboarding?.seed_state.trade || ''

  // The trade set at sign-up, if we can tell what it is.
  const fixedTrade: OnboardingTrade | null = useMemo(() => {
    if (!onboarding) return null
    // Older sign-ups may only have stored the pack. If exactly one trade uses
    // that pack, that is the trade.
    const byPack = !signupTradeSlug && seedVertical && seedVertical !== 'generic'
      ? trades.filter((t) => t.pack_key === seedVertical)
      : []
    if (byPack.length === 1) return byPack[0]
    if (signupTradeSlug) {
      return (
        trades.find((t) => t.slug === signupTradeSlug) ?? {
          slug: signupTradeSlug,
          name: titleCase(signupTradeSlug),
          icon: null,
          pack_key: seedVertical || 'generic',
          pack_label: packs.find((p) => p.key === seedVertical)?.label ?? titleCase(seedVertical || 'generic'),
          linked: !!seedVertical && seedVertical !== 'generic',
        }
      )
    }
    return null
  }, [onboarding, signupTradeSlug, trades, seedVertical, packs])

  // Locked = a trade (or at least a pack) is already recorded for this tenant.
  // ('generic' on its own is the fallback pack, not a trade anybody picked.)
  const tradeFixed =
    !!fixedTrade ||
    !!onboarding?.seed_state.locked_at ||
    (!!seedVertical && seedVertical !== 'generic')

  const [selectedTradeSlug, setSelectedTradeSlug] = useState('')
  const [selectedVertical, setSelectedVertical] = useState('generic')
  const [oneTimeConfirmed, setOneTimeConfirmed] = useState(false)

  useEffect(() => {
    if (!onboarding) return
    if (fixedTrade) {
      setSelectedTradeSlug(fixedTrade.slug)
      setSelectedVertical(fixedTrade.pack_key || seedVertical || 'generic')
    } else if (tradeFixed) {
      // Only the pack is on record: keep it, and send no trade slug.
      setSelectedTradeSlug('')
      setSelectedVertical(seedVertical || 'generic')
    } else if (useTradeMode) {
      const slug = trades.find((t) => seedVertical && t.pack_key === seedVertical)?.slug ?? trades[0]?.slug ?? ''
      setSelectedTradeSlug(slug)
      setSelectedVertical(trades.find((t) => t.slug === slug)?.pack_key ?? (seedVertical || 'generic'))
    } else {
      setSelectedVertical(seedVertical || packs[0]?.key || 'generic')
    }
    setOneTimeConfirmed(Boolean(onboarding.seed_state.locked_at))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarding, fixedTrade?.slug, fixedTrade?.pack_key, tradeFixed, useTradeMode])

  // A pack recorded on the tenant without a trade slug: show the pack itself.
  const fixedPackLabel = !fixedTrade && tradeFixed
    ? packs.find((p) => p.key === seedVertical)?.label ?? titleCase(seedVertical || 'generic')
    : null

  return {
    trades,
    useTradeMode,
    tradeFixed,
    fixedTrade,
    fixedPackLabel,
    selectedTradeSlug,
    selectedVertical,
    selectedTrade: trades.find((t) => t.slug === selectedTradeSlug) ?? fixedTrade ?? undefined,
    oneTimeConfirmed,
    setOneTimeConfirmed,
    selectTrade(slug: string) {
      setSelectedTradeSlug(slug)
      setSelectedVertical(trades.find((t) => t.slug === slug)?.pack_key ?? 'generic')
      setOneTimeConfirmed(false)
    },
    selectPack(key: string) {
      setSelectedVertical(key)
      setOneTimeConfirmed(false)
    },
    /** What goes to the server — the same from the overlay and the page. */
    applyPayload() {
      return {
        vertical: selectedVertical || 'generic',
        trade: fixedTrade?.slug || (!tradeFixed && useTradeMode ? selectedTradeSlug || null : null),
        // A trade set at sign-up was already confirmed there.
        confirmTradeLock: tradeFixed ? true : oneTimeConfirmed,
      }
    },
    canApply: tradeFixed || oneTimeConfirmed,
  }
}

export type TradeSeedChoice = ReturnType<typeof useTradeSeedChoice>

interface TradeSeedPickerProps {
  onboarding: OnboardingStatus
  packs: OnboardingSeedPackSummary[]
  choice: TradeSeedChoice
  /** Stage locked (beta agreement not accepted yet). */
  locked: boolean
  applied: boolean
  /** The page lets an owner apply the pack again; the overlay does not. */
  allowReapply?: boolean
  onApplied?: () => void
  onError?: (message: string) => void
  /** Show the pack's counts under the control (the page does). */
  children?: React.ReactNode
}

export function TradeSeedPicker({
  onboarding,
  packs,
  choice,
  locked,
  applied,
  allowReapply = false,
  onApplied,
  onError,
  children,
}: TradeSeedPickerProps) {
  const applySeed = useApplySeedPack()
  const busy = applySeed.isPending
  const disabled = locked || busy || !choice.canApply || (applied && !allowReapply)

  function apply() {
    applySeed.mutate(choice.applyPayload(), {
      onSuccess: () => onApplied?.(),
      onError: (err) => onError?.(err instanceof Error ? err.message : String(err)),
    })
  }

  const buttonLabel = busy
    ? 'Applying…'
    : applied
      ? allowReapply
        ? 'Apply the pack again'
        : 'Pack applied'
      : 'Apply the starter pack'

  return (
    <div className="space-y-3">
      {choice.tradeFixed ? (
        <div data-tour="onboarding-trade" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your trade</div>
          <div className="mt-1 text-sm font-bold text-navy-900">
            {choice.fixedTrade
              ? `${choice.fixedTrade.icon ? `${choice.fixedTrade.icon} ` : ''}${choice.fixedTrade.name}`
              : choice.fixedPackLabel}
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              Locked
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            You picked this at sign-up, and it can't be changed. You can still edit the job types, stages and
            messages the pack adds.
          </p>
          {choice.fixedTrade && (
            <p className="mt-1 text-xs text-slate-500">
              Applies the <span className="font-semibold text-navy-800">{choice.fixedTrade.pack_label}</span> starter pack
              {choice.fixedTrade.linked ? '.' : ' (the general starter, since this trade has no pack of its own yet).'}
            </p>
          )}
        </div>
      ) : (
        <div data-tour="onboarding-trade">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="trade-seed-select">
            {choice.useTradeMode ? 'Your trade' : 'Trade pack'}
          </label>
          <select
            id="trade-seed-select"
            value={choice.useTradeMode ? choice.selectedTradeSlug : choice.selectedVertical}
            onChange={(e) => (choice.useTradeMode ? choice.selectTrade(e.target.value) : choice.selectPack(e.target.value))}
            disabled={locked || busy || applied}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-navy-900 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            {choice.useTradeMode
              ? choice.trades.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.icon ? `${t.icon} ` : ''}
                    {t.name}
                  </option>
                ))
              : packs.map((pack) => (
                  <option key={pack.key} value={pack.key}>
                    {pack.label}
                  </option>
                ))}
          </select>
          {choice.useTradeMode && choice.selectedTrade && (
            <p className="mt-1 text-xs text-slate-500">
              Applies the <span className="font-semibold text-navy-800">{choice.selectedTrade.pack_label}</span> starter pack
              {choice.selectedTrade.linked ? '.' : ' (the general starter, since this trade has no pack of its own yet).'}
            </p>
          )}
          {!applied && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-bold text-amber-950">This is a one-time choice</div>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                Your account doesn't have a trade yet. Once you apply a pack, your trade is locked and can't be
                changed. It decides your starter templates, stock, automations and how AI matches work to your shop.
              </p>
              <label className="mt-3 flex items-start gap-2 text-sm font-semibold text-amber-950">
                <input
                  type="checkbox"
                  checked={choice.oneTimeConfirmed}
                  onChange={(event) => choice.setOneTimeConfirmed(event.target.checked)}
                  disabled={locked || busy}
                  className="mt-1 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                <span>I understand my trade can't be changed after this.</span>
              </label>
            </div>
          )}
        </div>
      )}

      {children}

      <button
        type="button"
        data-tour="onboarding-apply-pack"
        onClick={apply}
        disabled={disabled}
        className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 sm:w-auto"
      >
        {buttonLabel}
      </button>
      <p className="text-sm text-slate-600">
        This adds starter statuses, job types, catalog rows, stock locations and fields to your account.
      </p>
      {onboarding.seed_state.locked_at && (
        <p className="text-sm font-semibold text-emerald-700">
          Pack applied {new Date(onboarding.seed_state.locked_at).toLocaleString()}.
        </p>
      )}
    </div>
  )
}

function titleCase(value: string): string {
  return value.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
