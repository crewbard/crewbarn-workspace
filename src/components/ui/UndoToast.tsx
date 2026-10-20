import '@/components/inventory/bins/bins.css'
import type { UndoToastState } from '@/hooks/useUndoToast'

/**
 * The small note at the bottom right after something was done, with Undo when
 * it can be taken back. Moved out of the Bins screen (BinsExplorer) so Order
 * parts uses the same one for "Remove from cart". Colours come from the theme
 * (the bins.css roles), so it reads on every theme.
 */
export function UndoToast({ toast, tour }: { toast: UndoToastState; tour?: string }) {
  if (!toast) return null
  return (
    <div data-bins-ui="" role="status" data-tour={tour} className="fixed bottom-5 right-5 z-[150] flex max-w-[360px] items-center gap-3 rounded-xl border border-[var(--bins-border)] bg-[var(--bins-surface)] px-4 py-2.5 text-[13px] text-[var(--bins-text)] shadow-xl">
      {toast.text}
      {toast.undo && <button type="button" onClick={() => void toast.undo!()} className="rounded-md px-2 py-1 font-semibold text-[var(--bins-accent-ink)] hover:bg-[var(--bins-accent-soft)]">Undo</button>}
    </div>
  )
}
