/** Right-side chevron that reinforces a clickable workflow row. */
export function RowChevron() {
  return (
    <svg
      className="w-4 h-4 text-slate-300 group-hover:text-amber-500 shrink-0 transition-colors"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M7 5l6 5-6 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
