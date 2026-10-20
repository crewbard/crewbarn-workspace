import type { PageTour } from '../types'

/**
 * Jobs & workflow → When a job counts as stalled
 * (/tool-shed/preferences/stalled-jobs). A focused setting page with a number.
 *
 *   setting-control  data-setting-value = the number of days
 *   settings-read-only, setting-savebar  as on every focused setting page
 */
const t = (id: string) => `[data-tour="${id}"]`
const days = (page: { find: (s: string) => HTMLElement | null }) =>
  Number(page.find(t('setting-control'))?.dataset.settingValue ?? NaN)

export const PAGE_TOUR: PageTour = {
  id: 'stalled-jobs',
  route: '^/tool-shed/preferences/stalled-jobs/?$',
  intro: {
    page: 'When a job counts as stalled',
    purpose: 'Choose how long a job can sit untouched before it’s flagged, so nothing gets forgotten.',
    covers: ['Days untouched', 'What happens', 'Only a flag', 'Where stalled jobs show up'],
  },
  steps: [
    {
      id: 'title', selector: t('setting-title'),
      title: 'Stalled jobs',
      say: 'A job nobody has touched for a while gets flagged, so it doesn’t sit forgotten.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see this setting, but not change it. Ask an owner or admin if it needs to change.',
    },
    {
      id: 'control', selector: t('setting-control'), title: 'Days untouched',
      say: 'Choose how long a while is for your shop, from one day up to a year. Use the minus and plus, or type a number.',
      variants: [
        { when: (page) => days(page) <= 3, say: 'Right now a job is flagged after just a few quiet days. That’s tight, which suits fast work. Use the plus to give jobs longer.' },
        { when: (page) => days(page) >= 30, say: 'Right now a job can sit quiet for a month or more before it’s flagged. Bring the number down if things slip through.' },
      ],
    },
    {
      id: 'what', selector: t('setting-consequences'),
      title: 'What happens',
      say: 'A stalled job shows up for the office to chase. Nothing is sent to the customer.',
    },
    {
      id: 'scope', selector: t('setting-scope'),
      title: 'Only a flag',
      say: 'It only changes what gets flagged. No job is closed, cancelled or reassigned.',
    },
    {
      id: 'save', selector: t('setting-savebar'),
      title: 'Save or cancel',
      say: 'Nothing changes until you press Save change. Cancel puts it back the way it was.',
    },
    {
      id: 'where',
      title: 'Where stalled jobs show up',
      say: 'On the dashboard, the Needs attention card counts your stalled jobs, and on the schedule a stalled job gets a Dormant badge.',
    },
  ],
}
