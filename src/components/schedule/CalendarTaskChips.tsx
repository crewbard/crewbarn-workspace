import { type Task } from '@/lib/tasks'
import { CalendarTaskCard } from './CalendarTaskCard'

/**
 * Per-day stack of task cards for a calendar day cell/column. Each card is a
 * richer job-card-style tile (title, due time, assignee, priority, anchor) with
 * a right-click quick-action menu — see CalendarTaskCard.
 */
export function CalendarTaskChips({ tasks }: { tasks: Task[] }) {
  if (!tasks.length) return null

  return (
    <div className="space-y-0.5 mb-1">
      {tasks.map((t) => (
        <CalendarTaskCard key={t.id} task={t} />
      ))}
    </div>
  )
}

export default CalendarTaskChips
