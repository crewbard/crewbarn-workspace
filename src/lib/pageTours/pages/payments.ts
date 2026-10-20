import type { PageTour } from '../types'

/**
 * Money → Payments (/tool-shed/payments). Four sections, one shown at a
 * time from the menu on the left: Stripe, GoDaddy Payments, Bank transfers,
 * Watch your bank. The tour presses each section's button in turn (it only
 * switches what's shown) and follows what each one says.
 *
 * States the page marks:
 *   payments-stripe   data-state = checking | off | incomplete | connected | in-use
 *   payments-godaddy  data-state = checking | unavailable | off | connected | in-use
 *   payments-processor-pick  only when both are connected
 *   payments-only-one        only one of them is connected
 *   payments-ach      data-enabled = yes | no
 *   payments-watch    data-feed = unavailable | none | dropped | connected
 */
const t = (id: string) => `[data-tour="${id}"]`
const tab = (id: string) => t(`payments-tabs-${id}`)
const stripe = (s: string) => `${t('payments-stripe')}[data-state="${s}"]`
const godaddy = (s: string) => `${t('payments-godaddy')}[data-state="${s}"]`
const watch = (s: string) => `${t('payments-watch')}[data-feed="${s}"]`

export const PAGE_TOUR: PageTour = {
  id: 'payments',
  route: '^/tool-shed/payments/?$',
  intro: {
    page: 'Payments',
    purpose: 'Take cards through Stripe or GoDaddy, and let customers pay straight into your bank. The money goes to you; CrewBarn never holds it.',
    covers: ['Stripe', 'GoDaddy Payments', 'Which one takes the card', 'Bank transfers', 'Watching your bank'],
  },
  steps: [
    { id: 'header', selector: t('payments-header'), title: 'Payments', say: 'Everything about how customers pay you, in four parts.' },
    { id: 'sections', selector: t('payments-sections'), title: 'Four parts', say: 'Two ways to take cards, Stripe and GoDaddy, and two about bank transfers. A part that’s on says On.' },

    // ── Stripe ──
    {
      id: 'stripe', selector: t('payments-stripe'), click: tab('stripe'), waitMs: 1200,
      title: 'Stripe', say: 'Stripe takes cards in the customer portal and from the office, plus Tap to Pay on a tech’s phone.',
      variants: [
        { when: stripe('off'), say: 'Stripe isn’t connected. It takes cards in the portal and the office, and Tap to Pay on a tech’s phone. Connect Stripe opens their sign-up.' },
        { when: stripe('incomplete'), title: 'Stripe needs a few details', say: 'Stripe setup was started but not finished. Finish Stripe setup takes you back to where you left off.' },
        { when: stripe('in-use'), say: 'Stripe is connected and taking your card payments.' },
        { when: stripe('connected'), say: 'Stripe is connected, but GoDaddy is the one taking card payments right now.' },
      ],
    },
    { id: 'stripe-actions', selector: t('payments-stripe-actions'), title: 'Connect or refresh', say: 'Refresh status checks with Stripe again, handy after you’ve finished their steps.' },
    {
      id: 'pick', selector: t('payments-processor-pick'),
      title: 'Which one takes the card',
      say: 'Both are connected, so pick which one charges your customers. Tap to Pay is Stripe only; the Smart Terminal is GoDaddy only.',
    },
    { id: 'only-one', selector: t('payments-only-one'), title: 'Only one connected', say: 'Only one processor is connected, so it takes every card payment.' },

    // ── GoDaddy ──
    {
      id: 'godaddy', selector: t('payments-godaddy'), click: tab('godaddy'), waitMs: 1200,
      title: 'GoDaddy Payments', say: 'GoDaddy takes cards in the portal and from the office, plus their Smart Terminal for in person.',
      variants: [
        { when: godaddy('unavailable'), say: 'GoDaddy Payments isn’t switched on for your account. Contact CrewBarn support if you want it.' },
        { when: godaddy('off'), say: 'GoDaddy Payments isn’t connected. Connect GoDaddy Payments opens their sign-in.' },
        { when: godaddy('in-use'), say: 'GoDaddy is connected and taking your card payments.' },
        { when: godaddy('connected'), say: 'GoDaddy is connected, but Stripe is the one taking card payments right now.' },
      ],
    },
    { id: 'godaddy-live', selector: t('payments-godaddy-live'), title: 'Live updates', say: 'With live updates on, a charge taken in the GoDaddy app reaches CrewBarn straight away instead of on the hourly check.' },
    { id: 'godaddy-devices', selector: t('payments-godaddy-devices'), title: 'Devices', say: 'Tick your Smart Terminals, and say whose phone each tech’s device is, so their charges land on the right job.' },

    // ── Bank transfers ──
    {
      id: 'ach', selector: t('payments-ach'), click: tab('ach'), waitMs: 1200,
      title: 'Bank transfers', say: 'Customers pick Pay by bank transfer in the portal and see your details. No card fee.',
      variants: [
        { when: `${t('payments-ach')}[data-enabled="yes"]`, say: 'Bank transfer is on: customers can pick it in the portal and see your details.' },
        { when: `${t('payments-ach')}[data-enabled="no"]`, say: 'Bank transfer is off. Tick the box and fill in your details to offer it.' },
      ],
    },
    { id: 'ach-numbers', selector: t('payments-ach-numbers'), title: 'Your account', say: 'Your routing and account numbers. Only the last four are ever shown back.' },
    { id: 'ach-invoice', selector: t('payments-ach-invoice'), title: 'On invoices', say: 'Tick this to print your bank details on invoices too.' },
    { id: 'ach-save', selector: t('payments-ach-save'), title: 'Save', say: 'Save bank details lights up once you’ve changed something.' },

    // ── Watch your bank ──
    {
      id: 'watch', selector: t('payments-watch'), click: tab('watch'), waitMs: 1200,
      title: 'Watch your bank', say: 'Connect your business checking and deposits are matched to invoices and marked paid on their own.',
      variants: [
        { when: watch('unavailable'), say: 'Bank watching isn’t switched on for your account. Contact CrewBarn support to turn it on.' },
        { when: watch('connected'), say: 'Your bank is being watched. New deposits land in Bank match and pay off invoices on their own.' },
        { when: watch('dropped'), say: 'Your bank stopped talking to us. Reconnect bank fixes it and loses nothing.' },
        { when: watch('none'), say: 'Nothing is connected yet. Connect your bank to have deposits matched to invoices on their own.' },
      ],
    },
    { id: 'watch-expected', selector: t('payments-watch-expected'), title: 'Money on its way', say: 'Customers who said they’ve sent a transfer. Each invoice stays unpaid until the money lands.' },
  ],
}
