import type { PageTour } from '../types'

/**
 * Connections → Connected apps (/tool-shed/connected-apps).
 *
 *   qbo-card            data-qbo = connected | off
 *   connected-apps-row  data-connected = yes | no
 */
const t = (id: string) => `[data-tour="${id}"]`
const QBO_ON = `${t('qbo-card')}[data-qbo="connected"]`

export const PAGE_TOUR: PageTour = {
  id: 'connected-apps',
  route: '^/tool-shed/connected-apps/?$',
  intro: {
    page: 'Connected apps',
    purpose: 'Apps you link to your CrewBarn account, like QuickBooks, plus a quick look at your other connections.',
    covers: ['QuickBooks', 'Bringing records over', 'Your other connections'],
  },
  steps: [
    {
      id: 'header', selector: t('connected-apps-header'),
      title: 'Connected apps',
      say: 'Link an app once, and move records back and forth without spreadsheets.',
    },
    {
      id: 'qbo', selector: t('qbo-card'), title: 'QuickBooks',
      say: 'QuickBooks isn’t connected. Connect it to pull in your customers, products and services, and invoices.',
      variants: [
        { when: QBO_ON, title: 'QuickBooks is connected', say: 'QuickBooks is connected. Choose what to bring over, then import or push.' },
      ],
    },
    {
      id: 'qbo-connect', selector: t('qbo-connect'),
      title: 'Connect QuickBooks',
      say: 'This takes you to QuickBooks to sign in and say yes. No keys to copy.',
    },
    {
      id: 'qbo-entities', selector: t('qbo-entities'),
      title: 'What to bring over',
      say: 'Tick customers, products and services, invoices, or all three.',
    },
    {
      id: 'qbo-sync', selector: t('qbo-sync'),
      title: 'Import or push',
      say: 'Import brings records in from QuickBooks. Push sends CrewBarn records that aren’t in QuickBooks yet. Running it again updates, it doesn’t duplicate.',
    },
    {
      id: 'qbo-manage', selector: t('qbo-manage'),
      title: 'Test or disconnect',
      say: 'Test connection checks the link still works. Disconnect unlinks it, and your records stay.',
    },
    {
      id: 'others', selector: t('connected-apps-others'),
      title: 'Other connections',
      say: 'Texting, email, maps and GPS, each with a green dot when it’s connected. Manage opens its settings.',
    },
    {
      id: 'off-row', selector: `${t('connected-apps-row')}[data-connected="no"]`,
      title: 'Not connected yet',
      say: 'This one isn’t connected yet. Press Manage to set it up.',
    },
  ],
}
