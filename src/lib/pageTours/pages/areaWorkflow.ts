import type { PageTour } from '../types'

/**
 * Jobs & workflow, the area page (/connect/workflow).
 *
 * Groups a person can't open are left off the page, and the filter box can
 * hide the rest; steps for a missing group are skipped.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'area-workflow',
  route: '^/connect/workflow/?$',
  intro: {
    page: 'Jobs & workflow',
    purpose: 'How a job runs from start to finish: the kinds of jobs you do, the steps they move through, the rules in the field, and what CrewBarn does for you along the way.',
    covers: ['Jumping and searching', 'Jobs', 'In the field', 'Automations and reminders', 'Documents', 'Warranties'],
  },
  steps: [
    {
      id: 'header', selector: t('connect-area-header'),
      title: 'Jobs & workflow',
      say: 'This area shapes how every job runs. The number on the right is how many settings are in it.',
    },
    {
      id: 'filter', selector: t('connect-area-filter'), title: 'Jump or search',
      say: 'The chips jump to a group, and the box finds a setting in this area by name.',
      variants: [
        { when: t('connect-area-nomatch'), say: 'Nothing matches what’s in the search box. Press Clear search to see every setting again.' },
      ],
    },
    {
      id: 'jobs', selector: t('connect-group-jobs'),
      title: 'Jobs',
      say: 'Jobs is what a job is: your job types, the statuses a job moves through, what the intake form asks, how numbers are made, and any extra fields.',
    },
    {
      id: 'start', selector: t('connect-setting-job-types'),
      title: 'A good place to start',
      say: 'New here? Start with Job types, then Job statuses. Most of the rest builds on those two.',
    },
    {
      id: 'field', selector: t('connect-group-in-the-field'),
      title: 'In the field',
      say: 'In the field is the rules for your crew on a job: checking in when they arrive, closing a job properly, video length, and when a quiet job gets flagged.',
    },
    {
      id: 'automations', selector: t('connect-group-automations-reminders'),
      title: 'Automations & reminders',
      say: 'Automations and reminders are the things CrewBarn does for you, like texting a customer before a visit, each with its own switch.',
    },
    {
      id: 'documents', selector: t('connect-group-documents'),
      title: 'Documents',
      say: 'Documents holds your templates and forms: how your quotes, invoices and work orders look, and your inspection forms.',
    },
    {
      id: 'warranties', selector: t('connect-group-warranties'),
      title: 'Warranties',
      say: 'Warranties sets what a claim does, and how much notice you get before one runs out.',
    },
  ],
}
