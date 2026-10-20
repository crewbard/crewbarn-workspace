import type { PageTour } from '../types'

/**
 * Team → GPS devices (/tool-shed/gps).
 *
 *   gps-devices  data-state = empty | list
 *   gps-add, gps-device-actions buttons disabled for view-only people
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'gps-devices',
  route: '^/tool-shed/gps/?$',
  intro: {
    page: 'GPS devices',
    purpose: 'The trackers and phones that put your crew on the live map: plug-in dongles, wired trackers and the phone app.',
    covers: ['Your devices', 'Switching one off', 'Testing', 'Hardware feeds'],
  },
  steps: [
    {
      id: 'header', selector: t('gps-header'),
      title: 'GPS devices',
      say: 'Every device that reports where your vans and techs are.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see the devices, but not change them.',
    },
    {
      id: 'devices', selector: t('gps-devices'), title: 'Your devices', say: '',
      variants: [
        { when: `${t('gps-devices')}[data-state="empty"]`, title: 'No devices yet', say: 'No devices yet. Phones add themselves when a tech clocks in with the app. Add a tracker here for a van.' },
        { when: `${t('gps-devices')}[data-state="list"]`, say: 'Each device shows its name, who it’s with, what kind it is, and when it last checked in. Live means right now.' },
      ],
    },
    {
      id: 'actions', selector: t('gps-device-actions'),
      title: 'Switch, test or edit',
      say: 'The switch turns a device off without deleting it. Test checks it’s sending, and Edit changes its name or who it belongs to.',
    },
    {
      id: 'add', selector: t('gps-add'),
      title: 'Add a device',
      say: 'Add a tracker by its make and the ID printed on it.',
    },
    {
      id: 'feeds', selector: t('gps-ingest-tokens'), waitMs: 1200,
      title: 'Hardware feeds',
      say: 'Some trackers send their location straight to CrewBarn. This is where you get the private link they send to.',
    },
  ],
}
