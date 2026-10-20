/**
 * A job sent to a sub company, as the calendar and dispatch board show it:
 * in the sub company's lane, "Sub company · their tech", with where the sub
 * is at (App\Services\SubNetwork\SubLane on the server).
 */
export interface JobSub {
  subcontractor_id: string | null
  name: string
  tech_name: string | null
  state: 'sent' | 'accepted' | 'declined' | 'on_site' | 'done' | 'paid'
  label: string
}

/** "Test Glass Co · Dana Glass" -- the sub company, and its tech once it has named one. */
export function subLine(sub: JobSub): string {
  return sub.tech_name ? `${sub.name} · ${sub.tech_name}` : sub.name
}

/** The calendar lane a sub company's jobs share. */
export const SUB_LANE_PREFIX = 'sub:'

export function subLaneId(sub: JobSub): string {
  return SUB_LANE_PREFIX + (sub.subcontractor_id ?? sub.name)
}

export const SUB_STATE_CLASS: Record<JobSub['state'], string> = {
  sent: 'bg-sky-50 text-sky-800',
  accepted: 'bg-emerald-50 text-emerald-700',
  declined: 'bg-red-50 text-red-700',
  on_site: 'bg-amber-50 text-amber-800',
  done: 'bg-slate-100 text-slate-700',
  paid: 'bg-slate-100 text-slate-700',
}
