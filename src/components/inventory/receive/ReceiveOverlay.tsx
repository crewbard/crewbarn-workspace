/**
 * Receive delivery, the quick way: where it goes, which spot, receive, print.
 *
 *   1. Location: the last one used is already picked; Enter keeps it.
 *   2. Spot: the same tree as the Bins screen, opened on the spot this item
 *      went to last time (or its catalog default). Scan a spot's QR to jump.
 *      "+ Add spot" opens the Bins builder right here, prefilled with a guess
 *      from the shop's own structures; once built, the new places show in the
 *      tree with the first one picked.
 *   3. One button receives everything into that spot (the usual receive call).
 *   4. Done: the full path, and Print QR for the items (and new spots).
 *
 * Only existing endpoints: /inventory-locations, /inventory-bins (+ the
 * builder's own structure-apply), and purchase-orders/{id}/receive via the
 * Receive panel. Adding places is for inventory.edit only.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { InventoryBin } from '@/types/inventoryBin'
import type { InventoryLocation } from '@/types/inventoryLocation'
import { useAllInventoryBins, useBinStockRollup } from '@/hooks/useInventoryBins'
import { useCreateInventoryLocation } from '@/hooks/useInventoryLocations'
import { useHardwareScanner } from '@/hooks/useHardwareScanner'
import { buildBinTree, filterTree, flattenTree } from '@/lib/binTree'
import { binLabelPickUrl } from '@/lib/binLabelPick'
import { BinTreeRows } from '@/components/inventory/bins/BinTreeRows'
import { InventoryStructureBuilder } from '@/components/inventory/InventoryStructureBuilder'
import type { DraftNode } from '@/lib/structureDraft'
import { firstStockSpot, guessStructure, spotPath } from '@/lib/receiveSpot'
import '@/components/inventory/bins/bins.css'

/** done/merged: received (merged = some lines joined stock already elsewhere). */
export type ReceiveOutcome = 'done' | 'merged' | 'conflict' | 'error' | 'cancelled'

export interface ReceiveOverlayLine {
  id: string
  name: string
  qty: number
  catalogItemId: string | null
}

type Step = 'link' | 'location' | 'spot' | 'build' | 'done'

export function ReceiveOverlay({
  poId,
  lines,
  locations,
  canEdit,
  initialBinId,
  initialLocationId,
  error,
  unlinked = [],
  onLink,
  onSkipUnlinked,
  paused = false,
  mode = 'receive',
  onPicked,
  forLabel,
  renderDone,
  notStocked = false,
  onNotStocked,
  jobLink,
  onReceive,
  onClose,
}: {
  poId: string
  lines: ReceiveOverlayLine[]
  locations: InventoryLocation[]
  canEdit: boolean
  initialBinId: string | null
  initialLocationId: string | null
  error: string | null
  /** Free-text lines (no product yet): offered Create product first. */
  unlinked?: Array<{ id: string; name: string; qty: number }>
  onLink?: (lineId: string) => void
  /** Leave the free-text lines for later and receive the rest. */
  onSkipUnlinked?: () => void
  /** A window from the panel (Create product, merge/split) is open on top: keys are its. */
  paused?: boolean
  /** 'pick': just choose a spot for the panel's "Receive into" (no receiving). */
  mode?: 'receive' | 'pick'
  onPicked?: (bin: InventoryBin) => void
  /** What the order is for (job, tech, asset), shown beside the title. */
  forLabel?: ReactNode
  /** Products step: make the new product tracked but not stocked (is_stocked_item = false). */
  notStocked?: boolean
  onNotStocked?: (v: boolean) => void
  /** Products step, when Not stocked: attach the order to a job (or show the job it is for). */
  jobLink?: ReactNode
  /** Extra next steps on Done, e.g. Put on Job # / Send to the tech's van. */
  renderDone?: (ctx: { bin: InventoryBin; lines: ReceiveOverlayLine[] }) => ReactNode
  onReceive: (bin: InventoryBin) => Promise<ReceiveOutcome>
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { data: allBinsData } = useAllInventoryBins({})
  const allBins = useMemo(() => allBinsData?.data ?? [], [allBinsData])
  const initialBin = initialBinId ? allBins.find((b) => b.id === initialBinId) : undefined

  const [chosenStep, setStep] = useState<Step>(mode === 'pick' && initialLocationId ? 'spot' : 'location')
  const [skippedLink, setSkippedLink] = useState(false)
  // Free-text lines come first; once each is a product (or skipped) the flow carries on.
  // Both entries (Put away & receive, Choose spot) start here while any line is still typed in.
  const step: Step = !skippedLink && unlinked.length > 0 && (chosenStep === 'location' || chosenStep === 'spot') ? 'link' : chosenStep
  // Untouched = follow the suggested start (it can arrive late, e.g. the tech's van).
  const [chosenLocationId, setLocationId] = useState('')
  // null = nothing tapped yet: fall back to a just-built spot, then the remembered one.
  const [pickedId, setSelectedId] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [locQuery, setLocQuery] = useState('')
  const [newLoc, setNewLoc] = useState<string | null>(null)
  const [createdIds, setCreatedIds] = useState<string[]>([])
  const [builtIds, setBuiltIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [receivedPath, setReceivedPath] = useState('')
  // What went in and where, kept: the lines prop empties once the order refreshes.
  const [received, setReceived] = useState<{ bin: InventoryBin; lines: ReceiveOverlayLine[] } | null>(null)
  const [merged, setMerged] = useState(false)
  const createLocation = useCreateInventoryLocation()

  // Pre-pick: the remembered spot's location, else the panel's, else the only one.
  const locationId = chosenLocationId || initialLocationId || initialBin?.location_id || (locations.length === 1 ? locations[0].id : '')
  const location = locations.find((l) => l.id === locationId) ?? null
  const bins = useMemo(() => allBins.filter((b) => b.location_id === locationId), [allBins, locationId])
  const { data: rollup } = useBinStockRollup(locationId || undefined)
  const tree = useMemo(
    () => buildBinTree(location ? [location] : [], bins, rollup ?? {}),
    [location, bins, rollup],
  )
  const filter = useMemo(() => filterTree(tree, { query }), [tree, query])


  const builtSpot = useMemo(() => (builtIds.length ? firstStockSpot(allBins, builtIds) : null), [allBins, builtIds])
  const selectedId = pickedId ?? builtSpot?.id ?? initialBinId
  // The way to the chosen spot is always open (the location, then each parent).
  const autoOpen = useMemo(() => {
    const out = new Set<string>(locationId ? [locationId] : [])
    const byId = new Map(allBins.map((b) => [b.id, b]))
    let cur = selectedId ? byId.get(selectedId) : undefined
    while (cur?.parent_bin_id) { out.add(cur.parent_bin_id); cur = byId.get(cur.parent_bin_id) }
    return out
  }, [allBins, locationId, selectedId])
  const effectiveOpen = useMemo(
    () => new Set([...open, ...autoOpen, ...(query.trim() ? filter.expand : [])].filter((id) => !closed.has(id))),
    [open, closed, autoOpen, filter, query],
  )
  const rows = useMemo(() => flattenTree(tree, effectiveOpen, filter.visible), [tree, effectiveOpen, filter.visible])
  const selected = selectedId ? bins.find((b) => b.id === selectedId) ?? null : null
  const selectedPath = selected ? spotPath(allBins, selected.id, location?.name) : ''
  const totalQty = lines.reduce((n, l) => n + l.qty, 0)
  // The header counts typed-in lines too until they are made products or skipped.
  const doneQty = received ? received.lines.reduce((n, l) => n + l.qty, 0) : totalQty
  const countLines = lines.length + (skippedLink ? 0 : unlinked.length)
  const countQty = totalQty + (skippedLink ? 0 : unlinked.reduce((n, u) => n + u.qty, 0))

  const toggleOpen = useCallback((id: string) => {
    const isOpen = effectiveOpen.has(id)
    setOpen((prev) => { const n = new Set(prev); if (isOpen) n.delete(id); else n.add(id); return n })
    setClosed((prev) => { const n = new Set(prev); if (isOpen) n.add(id); else n.delete(id); return n })
  }, [effectiveOpen])
  const pick = useCallback((id: string) => {
    const n = tree.nodes.get(id)
    if (!n) return
    if (n.type !== 'location' && n.holdsStock) setSelectedId(id)
    else toggleOpen(id)
  }, [tree, toggleOpen])

  useHardwareScanner((payload) => {
    if (step !== 'spot') return
    const v = payload.trim().toLowerCase()
    const hit = allBins.find((b) => (b.qr_code_value ?? '').toLowerCase() === v || (b.barcode ?? '').toLowerCase() === v)
      ?? allBins.find((b) => (b.bin_code ?? '').toLowerCase() === v)
    if (!hit) return
    setLocationId(hit.location_id)
    setSelectedId(hit.id)
  })

  const [guess, setGuess] = useState<{ nodes: DraftNode[]; note: string } | null>(null)
  const openBuilder = () => {
    const g = locationId ? guessStructure(allBins, locationId) : null
    setGuess(g ? { nodes: g.nodes, note: `Guessed from ${g.from}: ${g.to}, same layers and names. Change anything, then Create.` } : null)
    setStep('build')
  }

  const doReceive = useCallback(async () => {
    if (!selected || busy) return
    setBusy(true)
    try {
      const path = spotPath(allBins, selected.id, location?.name)
      const snapshot = { bin: selected, lines }
      const outcome = await onReceive(selected)
      if (outcome === 'done' || outcome === 'merged') { setReceivedPath(path); setReceived(snapshot); setMerged(outcome === 'merged'); setStep('done') }
      else if (outcome === 'conflict') onClose()
    } finally {
      setBusy(false)
    }
  }, [selected, busy, allBins, location, onReceive, onClose, lines])

  const primary = useCallback(() => {
    if (step === 'link') { if (unlinked[0]) onLink?.(unlinked[0].id) }
    else if (step === 'location' && locationId) setStep('spot')
    else if (step === 'spot' && mode === 'pick') { if (selected) { onPicked?.(selected); onClose() } }
    else if (step === 'spot') void doReceive()
    else if (step === 'done') navigate(`/purchase-orders/${poId}/labels`)
  }, [step, locationId, doReceive, navigate, poId, unlinked, onLink, mode, selected, onPicked, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused) return
      if (e.key === 'Escape' && step !== 'build') onClose()
      const tag = (e.target as HTMLElement | null)?.tagName
      if (e.key === 'Enter' && step !== 'build' && tag !== 'BUTTON' && !(tag === 'INPUT' && newLoc !== null)) {
        e.preventDefault()
        primary()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [primary, step, onClose, newLoc, paused])

  const addLocation = async () => {
    const name = (newLoc ?? '').trim()
    if (!name) return
    const made = await createLocation.mutateAsync({ name, type: 'warehouse' })
    setNewLoc(null)
    setLocationId(made.id)
    setSelectedId(null)
    setStep('spot')
  }

  const shownLocations = locations.filter((l) => l.name.toLowerCase().includes(locQuery.trim().toLowerCase()))
  const showLinkStep = unlinked.length > 0 || step === 'link'
  const steps: Array<[Step, string]> = [
    ...(showLinkStep ? [['link', 'Products'] as [Step, string]] : []),
    ['location', 'Location'], ['spot', 'Spot'],
    ...(mode === 'receive' ? [['done', 'Done'] as [Step, string]] : []),
  ]
  const stepIndex = step === 'build' ? steps.findIndex(([s]) => s === 'spot') : steps.findIndex(([s]) => s === step)
  const btn = 'min-h-[48px] sm:min-h-[40px] rounded-lg px-4 text-[14px] font-bold transition-colors disabled:opacity-50'
  const primaryCls = `${btn} bg-[var(--bins-accent)] text-white hover:bg-[var(--bins-accent-strong)]`
  const ghostCls = `${btn} border border-[var(--bins-border)] bg-[var(--bins-surface)] text-[var(--bins-text)] hover:bg-[var(--bins-soft)]`

  return (
    <div data-bins-ui className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Receive delivery">
      <div className={`flex w-full flex-col bg-[var(--bins-surface)] text-[var(--bins-text)] shadow-2xl sm:rounded-2xl ${step === 'build' ? 'sm:max-w-[1200px] sm:h-[92vh]' : 'sm:max-w-[760px] sm:max-h-[90vh]'}`}>
        <header className="border-b border-[var(--bins-border-soft)] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <h2 className="text-[16px] font-bold">{mode === 'pick' ? 'Choose a spot' : 'Receive delivery'}</h2>
            <span className="text-[12px] text-[var(--bins-muted)]">{countLines} line{countLines === 1 ? '' : 's'} · {countQty} item{countQty === 1 ? '' : 's'}</span>
            <button type="button" onClick={onClose} aria-label="Close" className="ml-auto h-9 w-9 rounded-lg text-[var(--bins-muted)] hover:bg-[var(--bins-soft)]">✕</button>
          </div>
          {forLabel && <div data-testid="receive-for" className="mt-1.5 inline-block rounded-md bg-[var(--bins-soft)] px-2 py-0.5 text-[12px] font-semibold">{forLabel}</div>}
          <ol className="mt-2 flex gap-1.5">
            {steps.map(([s, label], i) => (
              <li key={s} className={`flex-1 border-t-[3px] pt-1 text-[11.5px] ${i === stepIndex ? 'border-[var(--bins-accent)] font-bold' : i < stepIndex ? 'border-[var(--bins-accent-line)] text-[var(--bins-muted)]' : 'border-[var(--bins-border)] text-[var(--bins-muted)]'}`}>
                {i + 1}. {s === 'spot' && step === 'build' ? 'Build a spot' : label}
              </li>
            ))}
          </ol>
        </header>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3 sm:px-5">
          {step === 'link' && (
            <div className="space-y-2">
              <p className="text-[13px]">
                {unlinked.length === 1 ? 'This line is' : 'These lines are'} typed in, not a product yet. Make {unlinked.length === 1 ? 'it a product' : 'each one a product'} (or link one you have) so it can go on a shelf.
              </p>
              {unlinked.map((u) => (
                <div key={u.id} className="flex min-h-[56px] items-center gap-3 rounded-xl border border-[var(--bins-border)] px-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{u.name}</div>
                    <div className="text-[12px] text-[var(--bins-muted)]">{u.qty} to receive · free-text</div>
                  </div>
                  <button type="button" onClick={() => onLink?.(u.id)} className={primaryCls}>Create product</button>
                </div>
              ))}
              {onNotStocked && (
                <label data-testid="not-stocked" className="flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl border border-[var(--bins-border)] px-3 py-2.5">
                  <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--bins-accent)]" checked={notStocked} onChange={(e) => onNotStocked(e.target.checked)} />
                  <span><span className="font-semibold">Not stocked</span><span className="block text-[12px] text-[var(--bins-muted)]">Tracked (received, labelled, on the job and the asset) but not kept on the shelves or reordered.</span></span>
                </label>
              )}
              {notStocked && jobLink}
              {lines.length > 0 && (
                <p className="text-[12px] text-[var(--bins-muted)]">Or skip {unlinked.length === 1 ? 'it' : 'them'} for now and receive the other {lines.length} line{lines.length === 1 ? '' : 's'}.</p>
              )}
            </div>
          )}

          {step === 'location' && (
            <div className="space-y-2">
              <input value={locQuery} onChange={(e) => setLocQuery(e.target.value)} placeholder="Search locations"
                className="h-11 w-full rounded-lg border border-[var(--bins-border)] bg-[var(--bins-softer)] px-3 text-[14px] focus:border-[var(--bins-accent)] focus:outline-none" />
              {shownLocations.map((l) => {
                const on = l.id === locationId
                return (
                  <button key={l.id} type="button" onClick={() => { setLocationId(l.id); if (l.id !== locationId) setSelectedId(null); setStep('spot') }}
                    className={`flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-3 text-left ${on ? 'border-[var(--bins-accent)] bg-[var(--bins-accent-soft)]' : 'border-[var(--bins-border)] hover:bg-[var(--bins-soft)]'}`}>
                    <span className="font-semibold">{l.display_label || l.name}</span>
                    {on && <span className="ml-auto text-[12px] font-bold text-[var(--bins-accent-ink)]">✓ Selected</span>}
                  </button>
                )
              })}
              {canEdit && (newLoc === null ? (
                <button type="button" onClick={() => setNewLoc(locQuery)} className="min-h-[48px] w-full rounded-xl border border-dashed border-[var(--bins-accent-line)] font-semibold text-[var(--bins-accent-ink)]">
                  + Add location
                </button>
              ) : (
                <div className="flex gap-2">
                  <input autoFocus value={newLoc} onChange={(e) => setNewLoc(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addLocation() } }}
                    placeholder="New location name" className="h-11 min-w-0 flex-1 rounded-lg border border-[var(--bins-border)] bg-[var(--bins-softer)] px-3 text-[14px]" />
                  <button type="button" onClick={() => void addLocation()} disabled={!newLoc.trim() || createLocation.isPending} className={primaryCls}>Add</button>
                </div>
              ))}
            </div>
          )}

          {step === 'spot' && (
            <div className="space-y-2">
              <div className="text-[13px]">
                {selected
                  ? <>Going into <b>{selectedPath}</b></>
                  : <span className="text-[var(--bins-muted)]">Tap the spot these go into, or scan its QR.</span>}
              </div>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search spots, or scan a spot's QR"
                className="h-11 w-full rounded-lg border border-[var(--bins-border)] bg-[var(--bins-softer)] px-3 text-[14px] focus:border-[var(--bins-accent)] focus:outline-none" />
              <div className="overflow-hidden rounded-xl border border-[var(--bins-border-soft)]">
                <BinTreeRows tree={tree} rows={rows} focusId={selectedId} selectedId={selectedId} matches={filter.matches} query={query}
                  selectMode={false} tickOf={() => 'none'} onToggleOpen={toggleOpen} onPick={pick} onTick={() => {}} onMenu={() => {}}
                  canEdit={false} height={Math.min(420, Math.max(260, (typeof window === 'undefined' ? 800 : window.innerHeight) - 330))} />
              </div>
              {canEdit && (
                <button type="button" onClick={openBuilder} className="min-h-[48px] w-full rounded-xl border border-dashed border-[var(--bins-accent-line)] font-semibold text-[var(--bins-accent-ink)]">
                  + Add spot (rack, shelf, bin, drawer, sections…)
                </button>
              )}
              {error && <p className="rounded-lg border border-[var(--color-danger)] px-3 py-2 text-[12.5px] text-[var(--color-danger)]">{error}</p>}
            </div>
          )}

          {step === 'build' && (
            <InventoryStructureBuilder
              locations={locations}
              initialLocationId={locationId}
              initialDraft={guess}
              onClose={() => setStep('spot')}
              onPlacesCreated={(made, builtIn) => {
                setLocationId(builtIn)
                setCreatedIds((p) => [...p, ...made.created_ids])
                setBuiltIds(made.created_ids)
                setSelectedId(null)
                setQuery('')
                setStep('spot')
              }}
            />
          )}

          {step === 'done' && (
            <div className="py-6 text-center">
              <div className="text-[40px] leading-none text-[var(--color-success)]" aria-hidden>✓</div>
              <h3 className="mt-2 text-[18px] font-bold">{doneQty} item{doneQty === 1 ? '' : 's'} received</h3>
              <p className="mt-1 text-[13px] text-[var(--bins-muted)]">into <b className="text-[var(--bins-text)]">{receivedPath}</b></p>
              {merged && <p className="mt-1 text-[12.5px] text-[var(--bins-muted)]">Lines you chose to merge went in with the same item's stock where it already was.</p>}
              {received && renderDone?.(received)}
              {createdIds.length > 0 && (
                <button type="button" onClick={() => navigate(binLabelPickUrl(createdIds))} className={`${ghostCls} mt-4`}>
                  Print QR for the {createdIds.length} new spot{createdIds.length === 1 ? '' : 's'}
                </button>
              )}
            </div>
          )}
        </div>

        {step !== 'build' && (
          <footer className="flex items-center gap-2 border-t border-[var(--bins-border-soft)] px-4 py-3 sm:px-5">
            {step === 'spot' && <button type="button" onClick={() => setStep('location')} className={ghostCls}>Back</button>}
            {(step === 'location' || step === 'link') && <button type="button" onClick={onClose} className={ghostCls}>Cancel</button>}
            {step === 'link' && lines.length > 0 && (
              <button type="button" onClick={() => { onSkipUnlinked?.(); setSkippedLink(true) }} className={ghostCls}>Skip these</button>
            )}
            {step === 'done' && <button type="button" onClick={onClose} className={ghostCls}>Done</button>}
            {step !== 'link' && <button type="button" onClick={primary} disabled={(step === 'location' && !locationId) || (step === 'spot' && (!selected || busy || (mode === 'receive' && lines.length === 0)))}
              className={`${primaryCls} ml-auto flex-1 sm:flex-none`}>
              {step === 'location' && 'Next'}
              {step === 'spot' && mode === 'pick' && (selected ? `Use ${selected.name || selected.bin_code}` : 'Pick a spot')}
              {step === 'spot' && mode === 'receive' && (busy ? 'Receiving…' : selected ? `Receive into ${selected.name || selected.bin_code}` : 'Pick a spot')}
              {step === 'done' && '🖨 Print QR'}
            </button>}
          </footer>
        )}
      </div>
    </div>
  )
}
