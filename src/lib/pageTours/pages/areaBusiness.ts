import type { PageTour } from '../types'

/**
 * Your business, the area page (/connect/business).
 *
 * Groups a person can't open are left off the page, and the filter box can
 * hide the rest; steps for a missing group are skipped.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'area-business',
  route: '^/connect/business/?$',
  intro: {
    page: 'Your business',
    purpose: 'Who you are and how you look to customers: your details, your logo and colours, your website, app and reviews, and which parts of CrewBarn are switched on.',
    covers: ['Jumping and searching', 'Company profile', 'Online presence', 'Features'],
  },
  steps: [
    {
      id: 'header', selector: t('connect-area-header'),
      title: 'Your business',
      say: 'This area is about your company itself. The number on the right is how many settings are in it.',
    },
    {
      id: 'filter', selector: t('connect-area-filter'), title: 'Jump or search',
      say: 'The chips jump to a group, and the box finds a setting in this area by name.',
      variants: [
        {
          when: t('connect-area-nomatch'),
          say: 'Nothing matches what’s in the search box. Press Clear search to see every setting again.',
        },
      ],
    },
    {
      id: 'profile', selector: t('connect-group-company-profile'),
      title: 'Company profile',
      say: 'Company profile is your name, address, logo and colour. It’s what makes every quote, invoice and email look like yours.',
    },
    {
      id: 'company-info', selector: t('connect-setting-company-info'),
      title: 'Start here',
      say: 'New here? Start with Company info. It takes a couple of minutes, and everything you send uses it.',
    },
    {
      id: 'presence', selector: t('connect-group-online-presence'),
      title: 'Online presence',
      say: 'Online presence is how customers find you: your website, your own phone app, your Google reviews and your marketplace listing.',
    },
    {
      id: 'features', selector: t('connect-group-features'),
      title: 'Features',
      say: 'Features switches whole parts of CrewBarn on or off for everyone, so your crew only sees what you use.',
    },
  ],
}
