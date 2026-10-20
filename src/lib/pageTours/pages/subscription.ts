import type { PageTour } from '../types'

/**
 * Account & billing → Subscription (/tool-shed/subscription).
 *
 * The page marks its state for the tour:
 *   subscription-plan data-plan-state = active | grace | read_only | off | free
 *                     data-subscribed = yes | no, data-can-manage = yes | no
 */
const t = (id: string) => `[data-tour="${id}"]`
const plan = (s: string) => `${t('subscription-plan')}[data-plan-state="${s}"]`
const SUBSCRIBED = `${t('subscription-plan')}[data-subscribed="yes"]`

export const PAGE_TOUR: PageTour = {
  id: 'subscription',
  route: '^/tool-shed/subscription/?$',
  intro: {
    page: 'Subscription',
    purpose: 'What you pay CrewBarn each month. One price covers your company and one admin, then a seat for each extra person who signs in.',
    covers: ['Self-hosted or Hosted', 'Your plan and seats', 'Paying and managing billing'],
  },
  steps: [
    {
      id: 'header', selector: t('subscription-header'),
      title: 'Subscription',
      say: 'Here’s how pricing works: one monthly price for your company and first admin, then a seat for each extra person who signs in.',
    },
    {
      id: 'tier', selector: t('subscription-tier'), title: 'Self-hosted or Hosted',
      say: 'Pick how you run CrewBarn. Self-hosted is Connect, the phone app and your own site. Hosted adds the full CrewBarn web app for scheduling, dispatch and invoicing.',
      variants: [
        {
          when: SUBSCRIBED,
          say: 'The one marked Current is what you’re on. Pick the other to switch, and you’ll see the new price before anything changes.',
        },
      ],
    },
    {
      id: 'plan', selector: t('subscription-plan'), title: 'Your plan',
      say: 'Your plan adds up the base price and your seats into one monthly total.',
      variants: [
        {
          when: plan('active'),
          say: 'Your plan is active. It adds up the base price and your seats into one monthly total, and shows when your next bill is due.',
        },
        {
          when: plan('grace'),
          title: 'Payment needed',
          say: 'Your last payment didn’t go through. Everything keeps working until the date shown above. After that the account goes read-only until it’s fixed. Nothing is ever deleted.',
        },
        {
          when: plan('read_only'),
          title: 'Read-only',
          say: 'Your account is read-only, so you can see everything but not change it. Fix the payment method below, and it comes straight back.',
        },
        {
          when: plan('free'),
          title: 'Free plan',
          say: 'You’re on the free plan, so you can see everything but not change it. Subscribe to unlock editing for your whole team.',
        },
        {
          when: plan('off'),
          title: 'Not subscribed yet',
          say: 'You’re not subscribed yet, and nothing changes today. This is what it would cost, starting from the people who already sign in.',
        },
      ],
    },
    {
      id: 'seats', selector: t('subscription-plan'), title: 'Seats',
      say: 'A seat is anyone with a login who isn’t switched off. These three boxes show seats bought, in use, and still free.',
      variants: [
        {
          when: `${t('subscription-plan')}[data-subscribed="yes"][data-can-manage="yes"]`,
          say: 'A seat is anyone with a login who isn’t switched off. Use plus and minus to change how many you pay for, then save. You can’t go below the people already using one.',
        },
      ],
    },
    {
      id: 'actions', selector: t('subscription-actions'), title: 'Billing',
      say: 'Manage staff shows who holds a seat.',
      variants: [
        {
          when: SUBSCRIBED,
          say: 'Manage billing opens a secure page for your card, past invoices and cancelling. Manage staff shows who holds a seat.',
        },
        {
          when: `!${SUBSCRIBED}`,
          say: 'Subscribe opens a secure payment page with the total shown. Manage staff shows who holds a seat.',
        },
      ],
    },
  ],
}
