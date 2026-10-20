import type { PageTour } from '../types'

/**
 * Team → Responsibilities (/tool-shed/responsibilities).
 * Two tabs (Today, Who owns what); each step presses its tab first.
 *
 *   responsibilities-area   data-area = jobs | estimates | billing | books | parts | people
 *   responsibilities-check-now   only for people who can edit staff
 *
 * Nothing is changed: the tour only looks.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'responsibilities',
  route: '^/tool-shed/responsibilities/?$',
  intro: {
    page: 'Responsibilities',
    purpose: 'Every part of keeping the office on top of things has one owner. Every hour CrewBarn puts what needs doing on that person’s to-do list, one item at a time, and takes it off once it’s done.',
    covers: ['Today’s board', 'Who has what', 'What’s overdue', 'Owners and backups', 'Turning checks on and off'],
  },
  steps: [
    {
      id: 'header', selector: t('responsibilities-header'),
      title: 'Responsibilities',
      say: 'Jobs, estimates, billing, the books, parts and people: each area has an owner, so nothing falls through the cracks.',
    },
    {
      id: 'tabs', selector: t('responsibilities-tabs'),
      title: 'Two tabs',
      say: 'Today is the board for keeping an eye on it all. Who owns what is where you hand each area to someone.',
    },

    // ── Today ──
    {
      id: 'stats', click: t('responsibilities-tab-today'), selector: t('responsibilities-stats'),
      title: 'At a glance',
      say: 'How much is open, how much is overdue, what got done today, and what cleared on its own because the work itself got done.',
    },
    {
      id: 'people', click: t('responsibilities-tab-today'), selector: t('responsibilities-people'),
      title: 'Who has what',
      say: 'Each person, the areas they’re holding, and how they’re doing. Tap a name to see their whole list.',
    },
    {
      id: 'overdue', click: t('responsibilities-tab-today'), selector: t('responsibilities-overdue'),
      title: 'Overdue', say: 'The oldest things past due, and who has them. Tap one to go straight to it.',
      variants: [
        { when: t('responsibilities-overdue-empty'), say: 'Nothing is overdue right now. When something is, it shows here with who has it.' },
      ],
    },

    // ── Who owns what ──
    {
      id: 'area', click: t('responsibilities-tab-owners'), selector: t('responsibilities-area'),
      title: 'One area',
      say: 'Each area says what it covers. Switch it off if your company doesn’t need it.',
    },
    {
      id: 'owners', click: t('responsibilities-tab-owners'), selector: t('responsibilities-people-pickers'),
      title: 'Owner and backup',
      say: 'Pick who owns it, and a backup. On a day the owner is off, it goes to the backup. Below, it says who it lands on today.',
    },
    {
      id: 'checks', click: t('responsibilities-tab-owners'), selector: t('responsibilities-checks'),
      title: 'What it watches for',
      say: 'Each line is one thing CrewBarn checks for, like a job that didn’t get finished or an invoice nobody sent. Turn them on or off, and set how long before it counts.',
    },
    {
      id: 'check-now', selector: t('responsibilities-check-now'), when: t('responsibilities-check-now'),
      title: 'Check now',
      say: 'CrewBarn checks every hour on its own. Press this to check right away.',
    },
  ],
}
