import type { PageTour } from '../types'

/**
 * Team, the area page (/connect/team).
 *
 * Groups a person can't open are left off the page, and the find box can
 * hide the rest; steps for a missing group are skipped.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'area-team',
  route: '^/connect/team/?$',
  intro: {
    page: 'Team',
    purpose: 'Everyone who works for you and the rules around them: who they are, what they can open, their time off and pay rules, and the vans and tools they use.',
    covers: ['Jumping and searching', 'People', 'Access and security', 'Time and pay', 'Vans and tools'],
  },
  steps: [
    {
      id: 'header', selector: t('connect-area-header'),
      title: 'Team',
      say: 'This area is about your people. The number on the right is how many settings are in it.',
    },
    {
      id: 'filter', selector: t('connect-area-filter'), title: 'Jump or search',
      say: 'The chips jump straight to a group. The box finds a setting in this area by name.',
      variants: [
        { when: t('connect-area-nomatch'), say: 'Nothing matches what’s in the search box. Press Clear search to see every setting again.' },
      ],
    },
    {
      id: 'people', selector: t('connect-group-people'),
      title: 'People',
      say: 'People is your staff and crews, the outside companies you send work to, and hiring.',
    },
    {
      id: 'staff', selector: t('connect-setting-staff-crews'),
      title: 'Start here',
      say: 'Staff and crews is where you add someone, choose whether they sign in, and set their role and pay.',
    },
    {
      id: 'access', selector: t('connect-group-access-security'),
      title: 'Access and security',
      say: 'Access and security decides what each role can see and change, who may delete records, and how people sign in safely.',
    },
    {
      id: 'time', selector: t('connect-group-time-pay'),
      title: 'Time and pay',
      say: 'Time and pay holds time off requests, when commission is earned, vacation, and clocking in by location.',
    },
    {
      id: 'vans', selector: t('connect-group-vans-tools'),
      title: 'Vans and tools',
      say: 'Vans and tools keeps track of your own gear, and the trackers that put your crew on the live map.',
    },
  ],
}
