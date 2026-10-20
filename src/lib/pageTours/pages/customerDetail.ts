import { FOCUS } from '../theme'
import type { PageTour, PageTourStep } from '../types'

/**
 * Daily work → Customers → one customer (/customers/:id).
 *
 * Walks the account top to bottom, then each tab. The tabs sit in groups
 * (Overview, Details, Records, Files, Log; the Easy look groups them
 * differently), so a tab step presses the tab, and when the tab isn't
 * showing, first presses whichever group holds it. Opening a tab only
 * changes the page address: nothing on the customer changes.
 *
 * The page marks:
 *   customer-header       data-service-agreement = yes | no
 *   customer-group-*      data-tabs = the tabs that group holds, for this person
 *   customer-keys-tab     data-keys-portal = on | off
 */
const t = (id: string) => `[data-tour="${id}"]`
/** The group button that holds this tab (only there when the person can open the tab). */
const group = (tab: string) => `[data-tour^="customer-group-"][data-tabs~="${tab}"]`
/** Press this tab, opening its group first when it isn't showing. */
const tab = (key: string): Pick<PageTourStep, 'click' | 'open' | 'when'> => ({
  click: t(`customer-subtab-${key}`),
  open: `click:${group(key)}`,
  when: group(key),
})
const KEYS_ON = `${t('customer-keys-tab')}[data-keys-portal="on"]`
const KEYS_OFF = `${t('customer-keys-tab')}[data-keys-portal="off"]`

export const PAGE_TOUR: PageTour = {
  id: 'customer-detail',
  route: '^/customers/(?!new/?$|search/?$)[^/]+/?$',
  intro: {
    page: 'Customer',
    purpose: 'One customer’s whole account: who they are, their places and people, the work you’ve done, what they owe, and their files.',
    covers: ['Who they are and what they owe', 'Places and people', 'Service agreements', 'Jobs, estimates and invoices', 'Equipment and keys', 'Files and messages'],
  },
  // The intro film, before the walk-through (see ../film.ts).
  film: [
    { id: 'name', say: 'This is a customer’s account. Everything about them, in one place.', visual: { kind: 'title', title: 'Customer', subtitle: 'One whole account' } },
    { id: 'account', title: 'Who they are', say: 'Up top, who they are and what they owe. Below that, the places you work at and the people you deal with.', visual: { kind: 'account' } },
    {
      id: 'work', title: 'The work and the money', say: 'Every job, estimate and invoice for them is here, with where each one stands.',
      visual: { kind: 'list', rows: [
        { title: 'Repair visit', meta: 'Job · Thursday', chip: 'Scheduled', tone: 'blue' },
        { title: 'New install', meta: 'Estimate · Sent Monday', chip: 'Waiting', tone: 'amber' },
        { title: 'Invoice 1042', meta: 'Due in ten days', chip: 'Unpaid', tone: 'red' },
        { title: 'Invoice 1031', meta: 'Last month', chip: 'Paid', tone: 'green' },
      ] },
    },
    {
      id: 'agreement', title: 'Work that repeats', say: 'Set up a service agreement for work that repeats, and keep their equipment, files and messages with them too.',
      visual: { kind: 'signature', doc: 'Service agreement', lines: ['Four visits a year', 'Parts at a set price', 'Billed each quarter'], total: '$600 a year' },
    },
    { id: 'go', say: 'Let’s walk through the account.', visual: { kind: 'go' } },
  ],
  steps: [
    // ── Up top ──
    {
      id: 'header', selector: t('customer-header'),
      title: 'Who this is',
      say: 'Up top is who this is: their name, type, account number and tags. VIP and Inactive show here too.',
      variants: [
        {
          when: `${t('customer-header')}[data-service-agreement="yes"]`,
          title: 'Who this is',
          say: 'Up top is who this is: their name, type, account number and tags. This one is a service agreement customer, so work on a schedule comes from their plan.',
        },
      ],
    },
    {
      id: 'messages-btn', selector: t('customer-messages-btn'),
      title: 'Messages',
      say: 'Messages opens your texts and emails with them in a side panel, so you never leave the page.',
    },
    {
      id: 'new-job', selector: t('customer-new-job'),
      title: 'New job',
      say: 'New job starts a job with this customer already filled in. Their main address is picked for you.',
    },
    {
      id: 'agreement', selector: t('customer-build-agreement'),
      title: 'Service agreement',
      say: 'Service agreement builds a plan of regular visits for them. Pick their places, and everything at each one is ticked to cover.',
      variants: [
        {
          when: `${t('customer-header')}[data-service-agreement="yes"]`,
          title: 'Another agreement',
          say: 'They already have a plan. Service agreement builds another one, say for a new place or more equipment.',
        },
      ],
    },
    {
      id: 'more', selector: t('customer-more-actions'),
      title: 'More actions',
      say: 'The three dots hold Merge duplicate, for when someone was added twice, and Delete customer.',
    },
    {
      id: 'money', selector: t('customer-money'),
      title: 'The money',
      say: 'This strip is the money: everything billed, everything paid, what’s due now and open invoices. Their main contact and when you last talked sit here too.',
    },
    {
      id: 'groups', selector: t('customer-tabs'),
      title: 'Tabs',
      say: 'Everything else sits in these tabs. Pick one, then the smaller tabs under it.',
    },

    // ── Overview ──
    {
      id: 'identity', click: t('customer-group-overview'), selector: t('customer-overview-identity'),
      title: 'Overview',
      say: 'Overview starts with the basics. Edit info opens the full form.',
      variants: [
        { when: FOCUS, title: 'Account details', say: 'Overview starts with the account details: the type of account, the last contact and the industry. View all details shows the rest, and Edit info opens the full form.' },
      ],
    },
    {
      id: 'portal', click: t('customer-group-overview'), selector: t('customer-portal'),
      title: 'Customer portal',
      say: 'The customer portal lets them sign in to see their jobs and invoices and pay online. Nothing is shared until you send the invite.',
    },
    {
      id: 'field-rules', click: t('customer-group-overview'), selector: t('customer-field-requirements'),
      title: 'Field requirements',
      say: 'Field requirements are this customer’s rules for your crew, like a signature when done or before and after photos. New jobs for them follow these.',
    },
    {
      id: 'ov-contacts', click: t('customer-group-overview'), selector: t('customer-overview-contacts'),
      title: 'Contacts at a glance',
      say: 'Their people, with who gets job updates and who gets the bills.',
      variants: [
        { when: FOCUS, say: 'Their first two people, with who gets job updates and who gets the bills. View all opens the full list when there are more.' },
      ],
    },
    {
      id: 'ov-locations', click: t('customer-group-overview'), selector: t('customer-overview-locations'),
      title: 'Places at a glance',
      say: 'Their places, with the main one marked, and the gate code when there is one.',
      variants: [
        { when: FOCUS, say: 'Their first two places, with the main one marked and the gate code when there is one. View all opens the full list when there are more.' },
      ],
    },
    {
      id: 'ov-notes', click: t('customer-group-overview'), selector: t('customer-overview-notes'),
      title: 'Notes',
      say: 'Notes about them. Internal notes are just for your team. Public notes print on their paperwork.',
    },
    {
      id: 'ov-billing', click: t('customer-group-overview'), selector: t('customer-overview-billing'),
      title: 'Tax and billing',
      say: 'Whether they’re taxed, their tax ID and how they usually pay.',
    },

    // ── Places and people ──
    {
      id: 'contacts', ...tab('contacts'), selector: t('customer-contacts-tab'),
      title: 'Contacts',
      say: 'Contacts is everyone you deal with there, each with their roles. Add contact adds another person.',
    },
    {
      id: 'locations', ...tab('locations'), selector: t('customer-locations-tab'),
      title: 'Locations',
      say: 'Locations is every place you work for them, with the gate code and how to get in. Add location adds another.',
      variants: [
        {
          when: `!${t('customer-location-card')}`,
          title: 'No places yet',
          say: 'No places saved yet. Add location adds the first address, so jobs know where to go.',
        },
      ],
    },
    {
      id: 'location-card', ...tab('locations'), selector: t('customer-location-card'),
      title: 'One property',
      say: 'Each property gets its own card. Edit changes its address, gate code or notes.',
    },
    {
      id: 'location-agreement', ...tab('locations'), selector: t('customer-location-build-agreement'),
      title: 'Build service agreement',
      say: 'Build service agreement on a property starts a plan for just that place, with everything there already ticked.',
    },

    // ── Work and money ──
    {
      id: 'jobs', ...tab('jobs'), selector: t('customer-jobs-tab'),
      title: 'Jobs',
      say: 'Jobs is every job you’ve done or booked for them, with its status, date and who’s on it.',
    },
    {
      id: 'jobs-filters', ...tab('jobs'), selector: t('customer-jobs-filters'),
      title: 'Billed or not',
      say: 'All, Uninvoiced and Invoiced split them up. A dot on Uninvoiced means there’s work still to bill.',
    },
    {
      id: 'estimates', ...tab('estimates'), selector: t('customer-estimates-tab'),
      title: 'Estimates',
      say: 'Estimates are the quotes you’ve given them, with where each one stands. New Estimate starts one for them.',
    },
    {
      id: 'invoices', ...tab('invoices'), selector: t('customer-invoices-tab'),
      title: 'Invoices',
      say: 'Invoices shows each bill and what’s still owed.',
    },
    {
      id: 'invoice-actions', ...tab('invoices'), selector: t('customer-invoices-actions'),
      title: 'Payments and statements',
      say: 'Receive payment puts one payment across several bills. Preview statement shows what they owe on one page, without sending anything. New invoice starts a bill.',
    },
    {
      id: 'credits', ...tab('invoices'), selector: t('customer-credits'),
      title: 'Credits',
      say: 'Credits are down payments and overpayments not used yet. Put one toward a bill from here.',
    },
    {
      id: 'invoice-filters', ...tab('invoices'), selector: t('customer-invoices-filters'),
      title: 'Unpaid and paid',
      say: 'All, Unpaid and Paid split the bills up. Unpaid is the one to check at month end.',
    },

    // ── Equipment and keys ──
    {
      id: 'assets', ...tab('assets'), selector: t('customer-assets-tab'),
      title: 'Assets',
      say: 'Assets is the equipment you look after at their places, grouped by property. New Asset adds one.',
    },
    {
      id: 'keys', ...tab('keys'), selector: t('customer-keys-tab'), title: 'Keys', say: '',
      variants: [
        {
          when: KEYS_ON, selector: t('customer-keys-portal'),
          title: 'Keys, in their portal',
          say: 'Keys is their key list. It’s showing in their portal, so their managers can ask for keys and see who holds them.',
        },
        {
          when: KEYS_OFF, selector: t('customer-keys-portal'),
          title: 'Keys',
          say: 'Keys is their key list: which doors there are and who holds a key. Tick Show keys in their portal to let their managers see it too.',
        },
      ],
    },
    {
      id: 'keys-waiting', ...tab('keys'), selector: t('customer-keys-waiting'),
      title: 'Waiting for you',
      say: 'They’ve asked for something here, like more keys or a lost one. Answer Done or Decline, with a note if you like.',
    },
    {
      id: 'keys-doors', ...tab('keys'), selector: t('customer-keys-doors'),
      title: 'Door schedule',
      say: 'The door schedule lists each door, its area, and how many keys are out.',
    },
    {
      id: 'keys-holders', ...tab('keys'), selector: t('customer-keys-holders'),
      title: 'Who holds keys',
      say: 'And who holds a key right now. When one comes back, press Returned.',
    },

    // ── Files and messages ──
    {
      id: 'documents', ...tab('documents'), selector: t('customer-documents-tab'),
      title: 'Documents',
      say: 'Documents keeps their paperwork: contracts, certificates, tax forms and signed papers.',
    },
    {
      id: 'upload', ...tab('documents'), selector: t('customer-documents-upload'),
      title: 'Upload',
      say: 'Upload adds a file. A PDF or photo can then be read and made signable.',
    },
    {
      id: 'messages', ...tab('messages'), selector: t('customer-messages-tab'),
      title: 'Messages',
      say: 'And Messages is every text and email with them, in one thread. You can reply right here.',
    },
  ],
}
