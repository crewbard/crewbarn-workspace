/**
 * Line icons for the reports front door.
 *
 * Emoji were quicker but they carry a vendor's illustration style into a
 * financial screen — glossy, inconsistent in weight, and different on every
 * platform the app runs on. These are one stroke weight, one grid, and they
 * inherit colour, so a card can tint its icon to its group without the mark
 * itself changing.
 */

import type { ReactElement } from 'react'

export type IconName =
  | 'clock'
  | 'inbox'
  | 'trend'
  | 'card'
  | 'outbox'
  | 'building'
  | 'package'
  | 'users'
  | 'chart'
  | 'toolbox'
  | 'tag'
  | 'scales'
  | 'bank'
  | 'clipboard'
  | 'pin'
  | 'close'

/** 24×24 grid, stroked, no fills — see the note above on why not emoji. */
const PATHS: Record<IconName, ReactElement> = {
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 13.5h4l1.2 2.2h5.6L16 13.5h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 13.5 6.2 5.6A1.5 1.5 0 0 1 7.6 4.5h8.8a1.5 1.5 0 0 1 1.4 1.1L20 13.5v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" strokeLinejoin="round" />
    </>
  ),
  trend: (
    <>
      <path d="M4 16.5 9.5 11l3.5 3.5L20 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.5 7.5H20V12" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" strokeLinecap="round" />
      <path d="M6.5 14.5h3.5" strokeLinecap="round" />
    </>
  ),
  outbox: (
    <>
      <path d="M4 13.5h4l1.2 2.2h5.6L16 13.5h4v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" strokeLinejoin="round" />
      <path d="M12 10.5V3.5m0 0L9.5 6M12 3.5 14.5 6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  building: (
    <>
      <path d="M4 20V6.5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 14 6.5V20" strokeLinejoin="round" />
      <path d="M14 20V10h4.5A1.5 1.5 0 0 1 20 11.5V20" strokeLinejoin="round" />
      <path d="M3 20h18M7 8.5h1.5M7 12h1.5M7 15.5h1.5M10.5 8.5H12M10.5 12H12M10.5 15.5H12M17 13.5h.01M17 16.5h.01" strokeLinecap="round" />
    </>
  ),
  package: (
    <>
      <path d="M20 8.4v7.2a1.5 1.5 0 0 1-.8 1.3l-6.5 3.5a1.5 1.5 0 0 1-1.4 0l-6.5-3.5a1.5 1.5 0 0 1-.8-1.3V8.4" strokeLinejoin="round" />
      <path d="m4.4 7.6 6.9-3.4a1.5 1.5 0 0 1 1.4 0l6.9 3.4-7.6 3.9z" strokeLinejoin="round" />
      <path d="M12 11.5V20" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" strokeLinecap="round" />
      <path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-2-4.2" strokeLinecap="round" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20h16" strokeLinecap="round" />
      <path d="M7 20v-5.5M12 20V7M17 20v-8.5" strokeLinecap="round" />
    </>
  ),
  toolbox: (
    <>
      <rect x="3" y="8.5" width="18" height="11" rx="2" />
      <path d="M8.5 8.5v-2A1.5 1.5 0 0 1 10 5h4a1.5 1.5 0 0 1 1.5 1.5v2" strokeLinejoin="round" />
      <path d="M3 13h18M10 13v2.5h4V13" strokeLinejoin="round" />
    </>
  ),
  tag: (
    <>
      <path d="M11.6 3.5H19a1.5 1.5 0 0 1 1.5 1.5v7.4a1.5 1.5 0 0 1-.44 1.06l-6.6 6.6a1.5 1.5 0 0 1-2.12 0l-7.4-7.4a1.5 1.5 0 0 1 0-2.12l6.6-6.6a1.5 1.5 0 0 1 1.06-.44z" strokeLinejoin="round" />
      <circle cx="16" cy="8" r="1.4" />
    </>
  ),
  scales: (
    <>
      <path d="M12 4.5V20M8 20h8" strokeLinecap="round" />
      <path d="M5 7.5h14M6.5 7.5 4 13.5h5zM17.5 7.5 15 13.5h5z" strokeLinejoin="round" />
      <path d="M4 13.5a2.5 2.5 0 0 0 5 0M15 13.5a2.5 2.5 0 0 0 5 0" strokeLinecap="round" />
    </>
  ),
  bank: (
    <>
      <path d="m3.5 9.5 8.5-5 8.5 5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M6 9.5V17M10 9.5V17M14 9.5V17M18 9.5V17" strokeLinecap="round" />
      <path d="M3.5 19.5h17" strokeLinecap="round" />
    </>
  ),
  pin: (
    <>
      <path d="M9 3.5h6l-.7 5.2 3.2 2.6v1.4H6.5v-1.4l3.2-2.6z" strokeLinejoin="round" />
      <path d="M12 12.7V20" strokeLinecap="round" />
    </>
  ),
  close: (
    <>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" strokeLinecap="round" />
    </>
  ),
  clipboard: (
    <>
      <path d="M9 4.5H7.5A1.5 1.5 0 0 0 6 6v13a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V6a1.5 1.5 0 0 0-1.5-1.5H15" strokeLinejoin="round" />
      <rect x="9" y="3" width="6" height="3.2" rx="1" />
      <path d="M9 11h6M9 14.5h4" strokeLinecap="round" />
    </>
  ),
}

export function ReportIcon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
