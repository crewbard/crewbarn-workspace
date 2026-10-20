import type { PageTour } from '../types'

/**
 * Jobs & workflow → New job & estimate intake (/tool-shed/preferences#intake).
 * Each switch saves the moment it is changed.
 *
 *   shop-rule-intake-<key>  data-on = yes | no
 */
const t = (id: string) => `[data-tour="${id}"]`
const on = (key: string) => `${t(`shop-rule-intake-${key}`)}[data-on="yes"]`

export const PAGE_TOUR: PageTour = {
  id: 'shop-rules-intake',
  route: '^/tool-shed/preferences/?$',
  hash: 'intake',
  intro: {
    page: 'New job & estimate intake',
    purpose: 'Choose what must be filled in before a new job or estimate can be saved. Fewer rules means faster booking; more means fewer gaps later.',
    covers: ['Step by step or one page', 'Site on estimates', 'Schedule and crew', 'Description'],
  },
  steps: [
    {
      id: 'header', selector: t('prefs-header'),
      title: 'Shop rules',
      say: 'This is one part of your shop rules: what the new job and estimate form asks for.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see these rules, but not change them. Ask an owner or admin if something needs updating.',
    },
    {
      id: 'section', selector: t('prefs-intake'),
      title: 'Always asked',
      say: 'The customer, a title, the job type and its starting status are always asked. The switches below add more. Each one saves the moment you flip it.',
    },
    {
      id: 'guided', selector: t('shop-rule-intake-guided_default'), title: 'Step by step',
      say: 'On, and new people book jobs one step at a time. Each person can still switch to the full page.',
      variants: [
        { when: on('guided_default'), say: 'It’s on, so new people book jobs one step at a time. Each person can still switch to the full page.' },
      ],
    },
    {
      id: 'estimate-location', selector: t('shop-rule-intake-estimate_location'), title: 'A site on estimates',
      say: 'Estimates can be a phone quote with no address. Turn this on to always ask for the site.',
      variants: [
        { when: on('estimate_location'), say: 'It’s on, so every estimate needs a site. Turn it off to allow quick phone quotes.' },
      ],
    },
    {
      id: 'schedule', selector: t('shop-rule-intake-schedule'),
      title: 'A date and time',
      say: 'Turn this on and every new job or estimate needs a date and time, instead of waiting unscheduled.',
    },
    {
      id: 'crew', selector: t('shop-rule-intake-lead_tech'),
      title: 'A crew or tech',
      say: 'Turn this on and someone must be assigned as the job is made.',
    },
    {
      id: 'description', selector: t('shop-rule-intake-description'),
      title: 'A description',
      say: 'Turn this on to always ask what the work is, so your crew knows before they arrive.',
    },
  ],
}
