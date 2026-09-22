import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { SalesTaxReportView } from '@/pages/SalesTaxReportPage'

/**
 * Sales tax in the same overlay chrome as every other report.
 *
 * It gets its own wrapper instead of a spec in REPORT_SPECS because it isn't
 * only a report — it records the filing payment and tracks whether a period is
 * settled. The generic overlay renders an answer, a chart and rows; this one
 * has a form and a state machine, so it brings its own body and only borrows
 * the frame.
 */
export function SalesTaxOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prior
    }
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex justify-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Sales Tax Report"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="h-fit w-full max-w-[1180px] rounded-[16px] bg-[#F4F6FA] p-6 shadow-2xl">
        <SalesTaxReportView embedded onClose={onClose} />
      </div>
    </div>,
    document.body,
  )
}
