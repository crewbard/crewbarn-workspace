import type { PageTour } from '../types'

/**
 * Team → Clock in and out by GPS (/tool-shed/preferences#clock), inside the
 * Field rules tab of Shop rules.
 *
 *   shop-rule-geofence_auto_clock_enabled  data-on = yes | no
 */
const t = (id: string) => `[data-tour="${id}"]`
const ROW = t('shop-rule-geofence_auto_clock_enabled')

export const PAGE_TOUR: PageTour = {
  id: 'shop-rules-clock',
  route: '^/tool-shed/preferences/?$',
  hash: 'clock',
  intro: {
    page: 'Clock in and out by GPS',
    purpose: 'Clock a tech in when their phone reaches a scheduled job, and out when they leave, so hours add up on their own.',
    covers: ['On or off', 'Turning it off for one person', 'Where the hours go'],
  },
  steps: [
    {
      id: 'switch', selector: ROW, title: 'Auto clock by location',
      say: 'One switch for the whole crew. It saves the moment you flip it.',
      variants: [
        { when: `${ROW}[data-on="yes"]`, title: 'It’s on', say: 'It’s on. Techs clock in when they reach a scheduled job and out when they leave. This is separate from checking in to the job.' },
        { when: `${ROW}[data-on="no"]`, title: 'It’s off', say: 'It’s off, so hours are only what people log themselves. Turn it on to clock techs in and out by where their phone is.' },
      ],
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see this rule, but not change it.',
    },
    {
      id: 'one-person',
      title: 'One person at a time',
      say: 'Turning it on covers everyone. To leave someone out, switch off Auto-clock on their row in Staff and crews.',
    },
    {
      id: 'hours',
      title: 'Where the hours go',
      say: 'The hours show on the Timesheet tab in Staff and crews, job by job.',
    },
  ],
}
