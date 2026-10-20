import type { PageTour } from '../types'

/**
 * Connections → Storage & maps (/tool-shed/storage-maps). Four sections
 * picked from the side list; the tour opens each one.
 *
 *   storage-maps-plan  data-plan = hosted | byo
 *   storage-maps-maps  data-key = saved | none
 */
const t = (id: string) => `[data-tour="${id}"]`
const tab = (id: string) => t(`storage-maps-tabs-${id}`)
const HOSTED = `${t('storage-maps-plan')}[data-plan="hosted"]`
const KEY = `${t('storage-maps-maps')}[data-key="saved"]`

export const PAGE_TOUR: PageTour = {
  id: 'storage-maps',
  route: '^/tool-shed/storage-maps/?$',
  intro: {
    page: 'Storage & maps',
    purpose: 'Where your photos and files are kept, and the maps behind address search. Bring your own accounts, or let CrewBarn handle it.',
    covers: ['Your plan', 'Storage', 'Google Maps', 'Email and texting'],
  },
  steps: [
    {
      id: 'plan', selector: t('storage-maps-plan'), title: 'Bring your own',
      say: 'You’re on Bring your own, the one we recommend. You use your own accounts and keep your data in your hands, and both have free starting levels.',
      variants: [
        { when: HOSTED, title: 'CrewBarn-managed', say: 'CrewBarn looks after storage and maps for you. Storage is billed by size and maps by use.' },
      ],
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see these settings, but not change them.',
    },
    {
      id: 'sections', selector: t('storage-maps-sections'),
      title: 'Sections',
      say: 'Storage, Google Maps, Email and Texting, one at a time.',
    },
    {
      id: 'storage', selector: t('storage-maps-storage'), click: tab('storage'), waitMs: 1200,
      title: 'Storage',
      say: 'Your photos, videos, recordings and files. Connect Cloudflare keeps them in your own account. Or let CrewBarn handle it, with nothing to set up.',
    },
    {
      id: 'maps', selector: t('storage-maps-maps'), click: tab('maps'), waitMs: 1200, title: 'Google Maps',
      say: 'No Maps key yet, so address search and maps are off. Paste a key here to switch them on.',
      variants: [
        { when: HOSTED, say: 'CrewBarn runs Google Maps for you, so there’s no key to paste.' },
        { when: KEY, say: 'Your Maps key is saved, so address search and maps are working.' },
      ],
    },
    {
      id: 'key', selector: t('storage-maps-key'),
      title: 'Your Maps key',
      say: 'Paste the key from Google and press Save. Remove switches maps off again.',
    },
    {
      id: 'test', selector: t('storage-maps-test'),
      title: 'Test key',
      say: 'Test key checks Google accepts it.',
    },
    {
      id: 'guide', selector: t('storage-maps-guide'),
      title: 'How to get a key',
      say: 'Step by step, how to get a Maps key from Google. It’s a different key from your AI key.',
    },
    {
      id: 'email', selector: t('storage-maps-comms'), click: tab('email'), waitMs: 1200,
      title: 'Email',
      say: 'Who sends your email. Your own email setup lives on Phone, SMS and email.',
    },
    {
      id: 'sms', selector: t('storage-maps-comms'), click: tab('sms'), waitMs: 1200,
      title: 'Texting',
      say: 'Who sends your texts. Your own Twilio or Net2Phone is set up on Phone, SMS and email.',
    },
  ],
}
