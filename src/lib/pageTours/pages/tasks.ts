import type { PageTour } from '../types'

/**
 * Daily work → Tasks (/tasks).
 * In the Easy layouts the list is grouped (sections labelled Late, Today, …).
 */
const t = (id: string) => `[data-tour="${id}"]`
const LIST = t('tasks-list')

export const PAGE_TOUR: PageTour = {
  id: 'tasks',
  route: '^/tasks/?$',
  intro: {
    page: 'Tasks',
    purpose: 'Everyone’s to-dos and follow-ups, on their own or tied to a job or a customer.',
    covers: ['Adding a task', 'What kind of task', 'Open, done, or yours', 'The list'],
  },
  steps: [
    { id: 'header', selector: t('tasks-header'), title: 'Your to-do list', say: 'To-dos and follow-ups. + Add task makes one on its own; job and customer tasks are added on those pages.' },
    { id: 'anchor', selector: t('tasks-anchor'), title: 'What kind of task', say: 'Show to-dos on their own, tasks on jobs, or tasks on customers.' },
    { id: 'status', selector: t('tasks-status'), title: 'Open, done, or yours', say: 'Active is what’s still open, History is what’s done. Tick Assigned to me to see only yours.' },
    {
      id: 'list', selector: LIST, title: 'The list', say: 'Tap the circle to mark a task done. The tag shows which job or customer it belongs to.',
      variants: [
        { when: `${LIST} section[aria-label="Late"]`, selector: `${LIST} section[aria-label="Late"]`, title: 'Running late', say: 'These are past their due date. Tap the circle when one is done, or open it to change the date.' },
        { when: (page) => /No tasks|No completed tasks/.test(page.text(LIST)), say: 'Nothing here right now. Tasks you add, or that come from jobs and customers, show up in this list.' },
      ],
    },
  ],
}
