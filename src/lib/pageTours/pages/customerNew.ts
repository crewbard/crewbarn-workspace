import type { PageTour } from '../types'

/**
 * Daily work → Customers → New customer (/customers/new).
 *
 * The form top to bottom. What it says follows the form as it is: a
 * person's name for a residential customer, a business or agency name
 * otherwise; the gate code once Gated property is ticked; the statement
 * parts only for business and government customers. Create customer sits
 * in the save bar at the bottom. The tour fills in nothing and saves
 * nothing.
 *
 * Two layouts, in every look (customer-new-layout): Tabbed workspace (the
 * default) shows one part at a time under tabs (customer-new-tab-account /
 * -contacts / -locations / -billing / -review, aria-selected), with an
 * account preview beside it; Grouped canvas shows every part at once. Each
 * step presses its part's tab first, which does nothing on the canvas.
 */
const t = (id: string) => `[data-tour="${id}"]`
const tab = (id: 'account' | 'contacts' | 'locations' | 'billing' | 'review') => t(`customer-new-tab-${id}`)

export const PAGE_TOUR: PageTour = {
  id: 'customer-new',
  route: '^/customers/new/?$',
  intro: {
    page: 'New customer',
    purpose: 'Add a customer once, with their people, their places and how you bill them. Only the name is required; fill in the rest whenever you like.',
    covers: ['Tabs or one page', 'Type and name', 'Contacts', 'Places you work', 'Billing and notes', 'Review and save'],
  },
  steps: [
    {
      id: 'header', selector: t('customer-new-header'),
      title: 'One record for everything',
      say: 'One customer holds their people, their places, billing and notes. Jobs, estimates and invoices hang off it later.',
    },
    {
      id: 'layout', selector: t('customer-new-layout'),
      title: 'Choose how to work',
      say: 'Tabbed workspace takes the customer one part at a time. Grouped canvas shows every part on one page. Switch whenever you like; nothing you typed is lost.',
    },
    {
      id: 'tabs', selector: t('customer-new-tabs'),
      title: 'The parts',
      say: 'Account, Contacts, Locations, Billing and notes, then Review. The numbers show how many people and places you’ve added.',
    },
    {
      id: 'preview', selector: t('customer-new-preview'),
      title: 'Account preview',
      say: 'The account builds up here as you go, so you can see what you’ve got from any tab.',
    },
    {
      id: 'type', click: tab('account'), selector: t('customer-type-picker'),
      title: 'Customer type',
      say: 'First, the type. Residential asks for a first and last name. Commercial and government ask for a business or agency name.',
    },
    {
      id: 'name', click: tab('account'), title: 'Their name', say: '',
      variants: [
        {
          when: t('customer-person-name'), selector: t('customer-person-name'),
          title: 'Their name',
          say: 'Their first and last name. It’s how they show up on jobs, quotes and invoices.',
        },
        {
          when: t('customer-business-name'), selector: t('customer-business-name'),
          title: 'Business name',
          say: 'The business or agency name. It’s how they show up on jobs, quotes and invoices.',
        },
      ],
    },
    {
      id: 'flags', click: tab('account'), selector: t('customer-flags'),
      title: 'VIP and active',
      say: 'VIP adds a badge and an amber stripe in the list. Untick Active for someone you no longer work with.',
    },
    {
      id: 'parent', click: tab('account'), selector: t('customer-account-parent'),
      title: 'Account and parent',
      say: 'The account number fills itself in. A parent customer puts this account under another one, like a property manager, so the parent sees what’s billed to it.',
    },

    // ── People ──
    {
      id: 'roles', click: tab('contacts'), selector: t('customer-contact-roles'),
      title: 'What each person is for',
      say: 'Contacts are the people you deal with. These ticks say what each is for: Main gets job updates, Billing gets the invoices, and Service is who to call about the visit.',
    },
    {
      id: 'contact-fields', click: tab('contacts'), selector: t('customer-contact-fields'),
      title: 'Their details',
      say: 'Name, email and phone. Add what you have now and the rest later.',
    },
    {
      id: 'contact-more', click: tab('contacts'), selector: t('customer-contact-advanced'),
      title: 'More about them',
      say: 'Show mailing address and Show advanced open extra details, like a separate mailing address or their okay to get texts.',
    },
    {
      id: 'add-contact', click: tab('contacts'), selector: t('customer-add-contact-row'),
      title: 'Another person',
      say: 'Add another contact for one more person.',
    },

    // ── Places ──
    {
      id: 'locations', click: tab('locations'), selector: t('customer-locations'),
      title: 'Service locations',
      say: 'Service locations are where your crew goes. The primary one is the default for new jobs.',
    },
    {
      id: 'address', click: tab('locations'), selector: t('customer-location-address'),
      title: 'The address',
      say: 'Start typing the street and pick it from the list. City, state, zip and the map spot fill in for you.',
    },
    {
      id: 'location-flags', click: tab('locations'), selector: t('customer-location-flags'),
      title: 'Primary and gated',
      say: 'Primary marks the main place. Tick Gated property when there’s a gate or a code to get in.',
    },
    {
      id: 'gate', click: tab('locations'), selector: t('customer-location-gate'),
      title: 'Gate code',
      say: 'The gate code and how to get in. Only your team and crew see it.',
    },
    {
      id: 'add-location', click: tab('locations'), selector: t('customer-add-location-row'),
      title: 'More than one place',
      say: 'Add another location for customers with more than one place, like a landlord or a chain of shops.',
    },

    // ── Notes and tags ──
    {
      id: 'notes', click: tab('billing'), selector: t('customer-notes'),
      title: 'Notes',
      say: 'Internal notes are for your team. Public notes print on invoices and work orders.',
    },
    {
      id: 'tags', click: tab('billing'), selector: t('customer-tags'),
      title: 'Tags',
      say: 'Tags label a customer. Some, like do not call, also color their stripe in the list.',
    },
    {
      id: 'custom', click: tab('billing'), selector: t('customer-custom-fields'),
      title: 'Your own fields',
      say: 'These are your company’s own customer fields, set up in Connect.',
    },

    // ── Tax and billing ──
    {
      id: 'taxable', click: tab('billing'), selector: t('customer-taxable'),
      title: 'Tax and billing',
      say: 'Leave these alone and your company’s defaults apply. Untick Taxable for a customer who doesn’t pay tax.',
    },
    {
      id: 'terms', click: tab('billing'), selector: t('customer-payment-terms'),
      title: 'Payment terms',
      say: 'Payment terms set when their invoices are due, like thirty days.',
    },
    {
      id: 'statement', click: tab('billing'), selector: t('customer-statement-day'),
      title: 'Monthly statement',
      say: 'For a business, pick the day each month their statement goes out. Picking a day doesn’t start sending by itself.',
    },
    {
      id: 'subject', click: tab('billing'), selector: t('customer-invoice-subject'),
      title: 'Their invoice subject',
      say: 'Give them their own invoice email subject, say with their PO number. Leave it blank for your usual one.',
    },
    {
      id: 'advanced', click: tab('billing'), selector: t('customer-advanced'),
      title: 'Advanced',
      say: 'Advanced is optional: industry, how they found you, key dates and more.',
    },

    // ── Review and save ──
    {
      id: 'review', click: tab('review'), selector: t('customer-new-review'),
      title: 'Review before creating',
      say: 'Review shows the account, contacts, places and billing at a glance. Pick any tab to change something.',
    },
    {
      id: 'save', selector: t('customer-save'),
      title: 'Create customer',
      say: 'When you’re ready, Create customer, down in this bar, saves it all. Cancel leaves without saving.',
      variants: [
        { when: `${t('customer-new-tabs')} [aria-selected="true"]:not(${tab('review')})`, title: 'Next', say: 'Down in this bar, Next moves to the next part, and Review & create takes you to the review. Create customer, on Review, saves it all. Cancel leaves without saving.' },
      ],
    },
  ],
}
