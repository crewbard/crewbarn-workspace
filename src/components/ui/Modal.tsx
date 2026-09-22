import { useEffect, useRef } from 'react'
import type { ReactNode, KeyboardEvent } from 'react'

/**
 * Generic Modal primitive — used by LocationPickerModal and any future
 * modal that needs the same backdrop / escape-to-close / focus-trap plumbing.
 *
 * Composition:
 *   <Modal isOpen={...} onClose={...} title="..." size="md">
 *     <Modal.Body>...content...</Modal.Body>
 *     <Modal.Footer>...buttons...</Modal.Footer>
 *   </Modal>
 *
 * Sizes:
 *   sm = ~400px, md = ~600px, lg = ~800px, xl = ~1100px
 */

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  /** Optional subtitle below the title in the header */
  subtitle?: string
  /** Modal width. Default: 'md'. */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Disable click-outside-to-close (use for forms with unsaved data). */
  disableBackdropClose?: boolean
  /** Disable Escape-to-close. */
  disableEscapeClose?: boolean
  children: ReactNode
}

// Sizes only apply at sm: and up. On phones every modal is full-width
// with a thin padding strip (handled by the outer wrapper's p-2 sm:p-4),
// because a 600px max-w-md on a 375px phone screen is just "barely on
// screen with awkward gutters." Full-bleed reads better.
const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-2xl',
  lg: 'sm:max-w-4xl',
  xl: 'sm:max-w-6xl',
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  disableBackdropClose = false,
  disableEscapeClose = false,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // ---------- Open/close lifecycle ----------
  useEffect(() => {
    if (!isOpen) return

    // Remember what was focused before we opened, restore on close
    previousFocusRef.current = document.activeElement as HTMLElement | null

    // Lock body scroll
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus first focusable element inside modal (or modal itself)
    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable) {
      focusable.focus()
    } else {
      dialogRef.current?.focus()
    }

    return () => {
      document.body.style.overflow = previousOverflow
      previousFocusRef.current?.focus?.()
    }
  }, [isOpen])

  // ---------- Escape handler ----------
  useEffect(() => {
    if (!isOpen || disableEscapeClose) return
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, disableEscapeClose, onClose])

  // ---------- Focus trap (keep tab within modal) ----------
  function handleKeyDownTrap(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (!focusables || focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement
    if (e.shiftKey && active === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={() => {
          if (!disableBackdropClose) onClose()
        }}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        onKeyDown={handleKeyDownTrap}
        className={`relative w-full ${SIZE_CLASS[size]} max-h-[95vh] sm:max-h-[90vh] flex flex-col bg-white rounded-t-2xl sm:rounded-lg shadow-2xl outline-none`}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 id="modal-title" className="text-lg font-semibold text-slate-900 truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-slate-600 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 flex-shrink-0"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}

/**
 * Body slot — scrollable content area. Pass content here.
 */
function ModalBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 ${className}`}>{children}</div>
}

/**
 * Footer slot — flex row of buttons, right-aligned by default.
 */
function ModalFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`px-4 sm:px-6 py-3 border-t border-slate-200 flex items-center justify-end gap-2 sm:gap-3 flex-shrink-0 flex-wrap ${className}`}
    >
      {children}
    </div>
  )
}

Modal.Body = ModalBody
Modal.Footer = ModalFooter
