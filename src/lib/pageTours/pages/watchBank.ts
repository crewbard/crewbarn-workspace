import type { PageTour } from '../types'

/**
 * Money → Watch your bank for payments (/tool-shed/payments/watch-bank).
 *
 * States: watch-bank-off (not switched on for the account), or
 * watch-bank-status data-feed = connected | dropped | none;
 * watch-bank-expected only when customers have said they've sent money.
 */
const t = (id: string) => `[data-tour="${id}"]`
const STATUS = t('watch-bank-status')

export const PAGE_TOUR: PageTour = {
  id: 'watch-bank',
  route: '^/tool-shed/payments/watch-bank/?$',
  intro: {
    page: 'Watch your bank',
    purpose: 'Connect your business checking and CrewBarn spots each deposit, works out which invoice it was for, and marks it paid.',
    covers: ['How the connection works', 'Your bank', 'Money you’re expecting'],
  },
  steps: [
    { id: 'header', selector: t('watch-bank-header'), title: 'Watch your bank', say: 'Instead of checking the bank and ticking invoices off, let CrewBarn do it.' },
    { id: 'read-only', selector: t('settings-read-only'), title: 'View only', say: 'You can see this page but not change it. An owner or admin can.' },
    { id: 'stripe-note', selector: t('watch-bank-stripe-note'), title: 'Read-only', say: 'Stripe makes the connection and nothing else. No money moves through them, and CrewBarn can only read your deposits.' },
    { id: 'off', selector: t('watch-bank-off'), title: 'Not switched on', say: 'Bank watching isn’t switched on for your account yet. Contact CrewBarn support to turn it on.' },
    {
      id: 'status', selector: STATUS, title: 'Your bank', say: '',
      variants: [
        { when: `${STATUS}[data-feed="connected"]`, title: 'Watching', say: 'Your bank is connected. Check now looks for new deposits straight away; otherwise it checks on its own.' },
        { when: `${STATUS}[data-feed="dropped"]`, title: 'Connection dropped', say: 'Your bank stopped talking to us, usually after a password change. Reconnect takes a moment and loses nothing.' },
        { when: `${STATUS}[data-feed="none"]`, title: 'Not connected', say: 'Nothing is connected yet. Connect your bank opens a secure window to pick your checking account.' },
      ],
    },
    {
      id: 'actions', selector: t('watch-bank-actions'), when: `${STATUS}[data-feed="connected"]`,
      title: 'Check or stop', say: 'Stop watching disconnects the account. Payments would then be matched by hand.',
    },
    { id: 'expected', selector: t('watch-bank-expected'), title: 'Money on its way', say: 'These customers said they’ve sent a transfer. Each invoice stays unpaid until the money turns up.' },
  ],
}
