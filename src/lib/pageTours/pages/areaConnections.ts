import type { PageTour } from '../types'

/**
 * Connections, the area page (/connect/connections).
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'area-connections',
  route: '^/connect/connections/?$',
  intro: {
    page: 'Connections',
    purpose: 'How CrewBarn talks to the outside world: your phone number and texting, your email, the apps you link up, storage and maps, and the TV in your shop.',
    covers: ['Phone, text and email', 'Apps and partners', 'Storage, maps and domain', 'Shop devices'],
  },
  steps: [
    {
      id: 'header', selector: t('connect-area-header'),
      title: 'Connections',
      say: 'Everything that links CrewBarn to other services. The number on the right is how many settings are in it.',
    },
    {
      id: 'filter', selector: t('connect-area-filter'), title: 'Jump or search',
      say: 'The chips jump to a group, and the box finds a setting by name.',
      variants: [
        { when: t('connect-area-nomatch'), say: 'Nothing matches what’s in the search box. Press Clear search to see every setting again.' },
      ],
    },
    {
      id: 'phone', selector: t('connect-group-phone-text-email'),
      title: 'Phone, text and email',
      say: 'How calls, texts and emails reach your customers, and what they see in the from line.',
    },
    {
      id: 'comms', selector: t('connect-setting-phone-sms-email'),
      title: 'Start here',
      say: 'Phone, SMS and email is the main page. Most shops set it up once and leave it.',
    },
    {
      id: 'apps', selector: t('connect-group-apps-partners'),
      title: 'Apps and partners',
      say: 'What’s linked up, like QuickBooks, and the partners you let pull your work.',
    },
    {
      id: 'storage', selector: t('connect-group-storage-maps-domain'),
      title: 'Storage, maps and domain',
      say: 'Where your photos and files are kept, the maps behind addresses, and your web address through Cloudflare.',
    },
    {
      id: 'devices', selector: t('connect-group-shop-devices'),
      title: 'Shop devices',
      say: 'Put today’s schedule on a TV in the shop.',
    },
  ],
}
