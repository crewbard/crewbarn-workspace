import type { TutorialData } from './types'

/**
 * Customers, start to finish: the list, adding a customer, the customer's
 * page and every tab on it, their own templates, and customer types.
 *
 * Kept import-free (types aside) so the voice exporter can load it on its own.
 */

const t = (id: string) => `[data-tour=${JSON.stringify(id)}]`

const LIST = '^/customers(/search)?/?$'
const NEW = '^/customers/new/?$'
const DETAIL = '^/customers/(?!new/?$|search/?$)[^/]+/?$'
/** The Focus look (<html data-theme="focus">), for words that differ there. */
const FOCUS = 'html[data-theme="focus"]'
/** New customer's Tabbed workspace: press the part's tab first (it does nothing on Grouped canvas). */
const NEW_TAB = (id: string) => t(`customer-new-tab-${id}`)
const TYPES = '^/tool-shed/customer-types/?$'

export const TUTORIAL: TutorialData = {
  id: 'customers',
  kicker: 'Customers · tutorial',
  title: 'Customers, start to finish',
  film: [
    {
      id: 'account',
      label: 'One account',
      title: 'Each customer is one account',
      narration:
        'Everyone you work for lives in Customers. Each customer is one account: the people you talk to, the places you work, and every job, estimate and invoice you’ve done for them.',
    },
    {
      id: 'types',
      label: 'Three types',
      title: 'Home, business or agency',
      narration:
        'Every customer is one of three types. Residential is a household with a person’s name. Commercial and Government go by a business or agency name, and they can get a monthly statement.',
    },
    {
      id: 'people',
      label: 'Contacts',
      title: 'The right person gets the right thing',
      narration:
        'Contacts are the people at that customer, and a few ticks say what each one is for. The main contact gets job updates. The billing contact gets the invoices. And the service contact is the one to call about the visit.',
    },
    {
      id: 'places',
      label: 'Locations',
      title: 'Every place your techs go',
      narration:
        'Service locations are the addresses your techs go to. One account can have many, like a landlord with three rentals. The primary one is the default for new jobs, and a gated one keeps its gate code safe.',
    },
    {
      id: 'page',
      label: 'Their page',
      title: 'Everything about them, on one page',
      narration:
        'Open a customer and it’s all on one page. The money is up top: what you’ve billed, what they’ve paid, and what’s still owed. Below that, five groups hold their details, records, files and history.',
    },
    {
      id: 'templates',
      label: 'Their own templates',
      title: 'When one customer needs it different',
      narration:
        'Most customers get your normal paperwork. But when one needs something different, like their own invoice layout, you pin it on their account. Only they get it, and everyone else keeps your default.',
    },
    {
      id: 'work',
      label: 'Start work',
      title: 'Start the work from their account',
      narration:
        'Starting from the customer saves typing. New job, new estimate and new invoice all open with the customer already filled in, and everything you make lands back on their account.',
    },
    {
      id: 'yourturn',
      label: 'Your turn',
      title: 'Now let’s do it for real',
      narration:
        'That’s the idea. Now let’s do it for real. I’ll step back into the corner and point at each part of the page. When it’s your turn, you click. If you’d rather watch, press Do it for me.',
    },
  ],
  chapters: [
    { key: 'list', label: 'The customer list' },
    { key: 'new', label: 'Add a customer' },
    { key: 'account', label: 'The customer’s page' },
    { key: 'details', label: 'Info, contacts, locations' },
    { key: 'records', label: 'Records and new work' },
    { key: 'files', label: 'Files' },
    { key: 'templates', label: 'Their own templates' },
    { key: 'log', label: 'Messages and activity' },
    { key: 'more', label: 'Types and where they’re used' },
  ],
  steps: [
    // ---------- The customer list ----------
    {
      id: 'list-header', chapter: 'list', route: LIST, open: 'goto:/customers', selector: t('customers-header'),
      title: 'Customers',
      say: 'This is your customer list: everyone you work for, homes and businesses alike. The number under the title is how many you have.',
    },
    {
      id: 'list-tabs', chapter: 'list', route: LIST, selector: t('customers-type-tabs'),
      title: 'By type',
      say: 'These tabs narrow the list by type: All, Residential, Commercial and Government. Each one shows how many customers it holds.',
    },
    {
      id: 'list-view', chapter: 'list', route: LIST, selector: t('customers-view-switch'),
      title: 'Rows, Cards or Files',
      say: 'Rows is a tight list, Cards shows each customer as a card, and Files sorts them into A to Z folders, like a filing cabinet. Pick whichever reads best for you.',
    },
    {
      id: 'list-last-contact', chapter: 'list', route: LIST, selector: `${t('customers-search')} select:has(option[value="never"])`,
      title: 'Last contact and sort',
      say: 'Last contact shows who on this page you’ve talked to in the past 30 days, or never. Sort, beside it, puts them in order by name or by who you talked to last.',
    },
    {
      id: 'list-peek', chapter: 'list', route: LIST, selector: '[aria-label^="Quick Peek at"]',
      title: 'Quick Peek',
      say: 'Quick Peek shows a customer’s details in a window without leaving the list. Open account takes you all the way in.',
    },
    {
      id: 'list-list', chapter: 'list', route: LIST, selector: t('customers-list'),
      title: 'What each one shows',
      say: 'Each customer shows their type, account number, what they’ve paid you over time, and when you last talked. Small chips count their open jobs, pending quotes and unpaid invoices.',
    },
    {
      id: 'list-stripe', chapter: 'list', route: LIST, selector: t('customers-row'),
      title: 'The colored stripe',
      say: 'The colored stripe is the quickest read. Red means a warning or do not call. Amber is a VIP. Teal is a service agreement or a recurring customer.',
    },
    {
      id: 'list-pager', chapter: 'list', route: LIST, selector: t('customers-pager'),
      title: 'Pages',
      say: 'A big list comes in pages of 25. Previous and Next move through them.',
    },
    {
      id: 'list-search', chapter: 'list', route: LIST, selector: t('customers-search'), hold: true,
      yourTurn: 'Type part of a name, email or phone, then press Next.',
      title: 'Search',
      say: 'Search finds a customer by name, email or phone number, and the list narrows as you type. Give it a try.',
    },

    // ---------- Add a customer ----------
    {
      id: 'new-open', chapter: 'new', route: LIST, open: 'goto:/customers', selector: t('customers-new'),
      wait: { route: NEW }, doIt: t('customers-new'),
      yourTurn: 'Click New customer.',
      title: 'Add a customer',
      say: 'Now let’s add one. Press New customer, up in the top right corner. Nothing is saved until you press Create customer on the form, so feel free to try things.',
    },
    {
      id: 'new-header', chapter: 'new', route: NEW, open: 'goto:/customers/new', selector: t('customer-new-header'),
      title: 'One record for everything',
      say: 'This is the New Customer form. One record holds the customer, their contacts, their service locations, billing defaults and notes.',
    },
    {
      id: 'new-layout', chapter: 'new', route: NEW, selector: t('customer-new-layout'),
      title: 'Choose how to work',
      say: 'Tabbed workspace takes the customer one part at a time, with a preview of the account beside it. Grouped canvas puts every part on one page. Switch whenever you like; nothing you typed is lost.',
    },
    {
      id: 'new-tabs', chapter: 'new', route: NEW, selector: t('customer-new-tabs'),
      title: 'One part at a time',
      say: 'Account, Contacts, Locations, Billing and notes, then Review. Next, in the bar at the bottom, moves you along, and I’ll open each tab as we go.',
    },
    {
      id: 'new-type', click: NEW_TAB('account'), chapter: 'new', route: NEW, selector: t('customer-type-picker'),
      wait: { appear: t('customer-business-name') }, doIt: t('customer-type-commercial'),
      yourTurn: 'Pick Commercial.',
      title: 'Customer type',
      say: 'First, the type. Residential asks for a first and last name. Commercial and Government ask for a business or agency name instead. Pick Commercial.',
    },
    {
      id: 'new-name', click: NEW_TAB('account'), chapter: 'new', route: NEW, selector: t('customer-business-name'), hold: true,
      yourTurn: 'Type a name like Acme Services, then press Next.',
      title: 'Their name',
      say: 'This name is how they show up on jobs, estimates and invoices. Type one in, like Acme Services.',
    },
    {
      id: 'new-flags', click: NEW_TAB('account'), chapter: 'new', route: NEW, selector: t('customer-flags'),
      title: 'VIP, agreement, active',
      say: 'VIP adds a badge and an amber stripe in the list. Service agreement gives them the teal stripe. Untick Active for someone you no longer work with.',
    },
    {
      id: 'new-account', click: NEW_TAB('account'), chapter: 'new', route: NEW, selector: t('customer-account-parent'),
      title: 'Account number and parent',
      say: 'The account number fills itself in when you save. Parent customer puts this account under another one, like a property manager, a franchise or a warranty company, so the parent sees the jobs and invoices billed to it.',
    },
    {
      id: 'new-roles', click: NEW_TAB('contacts'), chapter: 'new', route: NEW, selector: t('customer-contact-roles'),
      title: 'What each person is for',
      say: 'Contacts are the people you deal with here, and these ticks say what each one is for. Main gets scheduling, on-the-way and finished updates. Billing gets the invoices. Service is the person to call about the visit, like a renter when the landlord is the main contact.',
    },
    {
      id: 'new-intake', click: NEW_TAB('contacts'), chapter: 'new', route: NEW, selector: t('customer-contact-roles'),
      title: 'Intake ticks',
      say: 'Intake, bill-to means a call or text from this person’s number is billed to this account. Approves intake means they get a text when work comes in, and replying APPROVED okays it.',
    },
    {
      id: 'new-contact-fields', click: NEW_TAB('contacts'), chapter: 'new', route: NEW, selector: t('customer-contact-fields'),
      title: 'Their details',
      say: 'Then name, email, phone, job title and department. Add whatever you have. You can fill in the rest later.',
    },
    {
      id: 'new-contact-mailing', click: NEW_TAB('contacts'), chapter: 'new', route: NEW, selector: t('customer-contact-mailing'),
      title: 'Mailing address',
      say: 'Show mailing address adds a separate address for this person. A tick inside prints the service address on invoices instead.',
    },
    {
      id: 'new-contact-advanced', click: NEW_TAB('contacts'), chapter: 'new', route: NEW, selector: t('customer-contact-advanced'),
      title: 'Advanced',
      say: 'Show advanced has prefix, suffix, birthday and anniversary, plus SMS consent, for when this person has agreed to get texts.',
    },
    {
      id: 'new-add-contact', click: NEW_TAB('contacts'), chapter: 'new', route: NEW, selector: t('customer-add-contact-row'),
      title: 'Another contact',
      say: '+ Add another contact adds one more person. Each extra one gets a Remove link.',
    },
    {
      id: 'new-locations', click: NEW_TAB('locations'), chapter: 'new', route: NEW, selector: t('customer-locations'),
      title: 'Service locations',
      say: 'Service locations are where your techs go. The primary location is the default for new jobs.',
    },
    {
      id: 'new-address', click: NEW_TAB('locations'), chapter: 'new', route: NEW, selector: t('customer-location-address'), hold: true,
      yourTurn: 'Start typing an address and pick it, then press Next.',
      title: 'The address',
      say: 'Start typing the street address and pick it from the list. The city, state, zip and map spot fill in for you.',
    },
    {
      id: 'new-gated', click: NEW_TAB('locations'), chapter: 'new', route: NEW, selector: t('customer-location-flags'),
      wait: { appear: t('customer-location-gate') }, doIt: t('customer-location-gated'),
      yourTurn: 'Tick Gated property.',
      title: 'Primary and gated',
      say: 'Primary marks the default location. Tick Gated property when there’s a gate or a code to get in.',
    },
    {
      id: 'new-gate', click: NEW_TAB('locations'), chapter: 'new', route: NEW, selector: t('customer-location-gate'),
      title: 'Gate code and entry notes',
      say: 'Now there’s room for the gate code and entry notes, like which side gate to use. The code is encrypted, and only your team and techs see it.',
    },
    {
      id: 'new-add-location', click: NEW_TAB('locations'), chapter: 'new', route: NEW, selector: t('customer-add-location-row'),
      title: 'More than one place',
      say: '+ Add another location is for customers with more than one place, like a landlord or a chain of stores. Show lat/lng coords lets you set an exact map spot if an address lands in the wrong place.',
    },
    {
      id: 'new-notes', click: NEW_TAB('billing'), chapter: 'new', route: NEW, selector: t('customer-notes'),
      title: 'Notes',
      say: 'Internal notes are for your team only. Public notes print on invoices and work orders, like a thank-you.',
    },
    {
      id: 'new-tags', click: NEW_TAB('billing'), chapter: 'new', route: NEW, selector: t('customer-tags'),
      title: 'Tags',
      say: 'Tags label a customer. Click one to turn it on. Some, like warning, do-not-call and recurring, also color the stripe in the list. You keep the list of tags in Tool Shed, Tags.',
    },
    {
      id: 'new-custom', click: NEW_TAB('billing'), chapter: 'new', route: NEW, selector: t('customer-custom-fields'),
      title: 'Your own fields',
      say: 'These are your company’s own customer fields, set up in Tool Shed, Custom Fields. Each one is also a merge tag you can use in templates.',
    },
    {
      id: 'new-taxable', click: NEW_TAB('billing'), chapter: 'new', route: NEW, selector: t('customer-taxable'),
      title: 'Taxable',
      say: 'Next, tax and billing. Leave these alone and your company defaults apply. Taxable starts ticked; untick it for a tax-exempt customer, and add their tax ID.',
    },
    {
      id: 'new-tax-class', click: NEW_TAB('billing'), chapter: 'new', route: NEW, selector: t('customer-tax-class'),
      title: 'Tax class',
      say: 'Default tax class picks the tax rate on their invoices. Left on the first choice, they get your company’s default rate.',
    },
    {
      id: 'new-terms', click: NEW_TAB('billing'), chapter: 'new', route: NEW, selector: t('customer-payment-terms'),
      title: 'Payment terms',
      say: 'Payment terms set when their invoices are due, like net 30. Left on the first choice, your default terms apply, or due on receipt if you haven’t set any.',
    },
    {
      id: 'new-statement', click: NEW_TAB('billing'), chapter: 'new', route: NEW, selector: t('customer-statement-day'),
      title: 'Statement day',
      say: 'Because this is a business customer, you can pick the day each month their statement goes out. Days 29 to 31 use the last day in shorter months. Saving a day doesn’t start sending by itself.',
    },
    {
      id: 'new-pack', click: NEW_TAB('billing'), chapter: 'new', route: NEW, selector: t('customer-statement-pack'),
      title: 'Monthly statement pack',
      say: 'The statement pack holds who it’s sent to and the email subject, and it includes every unpaid invoice. Later, you turn delivery on or pause it from Preview statement, on their Invoices tab.',
    },
    {
      id: 'new-subject', click: NEW_TAB('billing'), chapter: 'new', route: NEW, selector: t('customer-invoice-subject'),
      title: 'Their invoice subject',
      say: 'This gives the customer their own invoice email subject, say with their PO number in it. Leave it blank to use your normal subject. If a tag in it has nothing to fill in, the invoice won’t send, so nothing goes out half-filled.',
    },
    {
      id: 'new-exempt', click: NEW_TAB('billing'), chapter: 'new', route: NEW, selector: t('customer-tax-exempt'),
      title: 'Tax exempt certificate',
      say: 'Their tax exempt certificate goes here once the customer is saved. You can upload one, or pick a document already on their account.',
    },
    {
      id: 'new-advanced', click: NEW_TAB('billing'), chapter: 'new', route: NEW, selector: t('customer-advanced'),
      title: 'Advanced',
      say: 'Advanced is optional: industry, referral source, key dates, an assigned agent and their commission, and a catch-all SMS consent.',
    },
    {
      id: 'new-review', chapter: 'new', route: NEW, click: NEW_TAB('review'), selector: t('customer-new-review'),
      title: 'Review before creating',
      say: 'Review shows the account, its contacts, places and billing at a glance. Pick any tab to change something.',
    },
    {
      id: 'new-save', chapter: 'new', route: NEW, selector: t('customer-save'),
      title: 'Create customer',
      say: 'Create customer saves it all and takes you back to the list. This is just practice, so let’s leave it.',
    },
    {
      id: 'new-cancel', chapter: 'new', route: NEW, selector: t('customer-cancel'),
      wait: { route: LIST }, doIt: t('customer-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Cancel leaves without saving. Nothing gets made.',
    },

    // ---------- The customer's page ----------
    {
      id: 'acct-open', chapter: 'account', route: LIST, open: 'goto:/customers', selector: t('customers-row'),
      wait: { route: DETAIL }, doIt: `first:${t('customers-row')}`,
      yourTurn: 'Click a customer.',
      title: 'Open a customer',
      say: 'Now let’s open a customer. We’re only looking, so nothing changes. Click any customer.',
    },
    {
      id: 'acct-header', chapter: 'account', route: DETAIL, selector: t('customer-header'),
      title: 'Who this is',
      say: 'Up top is who this is: their name, type, account number and tags. VIP, Inactive and Service agreement customer show here too.',
    },
    {
      id: 'acct-messages', chapter: 'account', route: DETAIL, selector: t('customer-messages-btn'),
      title: 'Messages',
      say: 'Messages opens their conversations in a side panel, so you can text or email them without leaving the page.',
    },
    {
      id: 'acct-agreement', chapter: 'account', route: DETAIL, selector: t('customer-build-agreement'), when: t('customer-build-agreement'),
      title: 'Service agreement',
      say: 'Service agreement builds a service agreement for this customer. Pick their properties first, and everything at them is ticked to cover.',
    },
    {
      id: 'acct-more', chapter: 'account', route: DETAIL, selector: t('customer-more-actions'),
      wait: { appear: t('customer-actions-menu') }, doIt: t('customer-more-actions'),
      yourTurn: 'Click the three dots.',
      title: 'More actions',
      say: 'The three dots hold the bigger actions. Click them.',
    },
    {
      id: 'acct-menu', chapter: 'account', route: DETAIL, selector: t('customer-actions-menu'),
      title: 'Merge or delete',
      say: 'Merge duplicate moves a second account for the same customer into this one, then archives the copy. Delete customer removes it after a password check, and it’s blocked when they have invoices or payments. We’ll leave both alone.',
    },
    {
      id: 'acct-menu-close', chapter: 'account', route: DETAIL, selector: t('customer-more-actions'),
      wait: { gone: t('customer-actions-menu') }, doIt: t('customer-more-actions'),
      yourTurn: 'Click the dots again to close it.',
      title: 'Close it',
      say: 'Click the dots again to close the menu.',
    },
    {
      id: 'acct-money', chapter: 'account', route: DETAIL, selector: t('customer-money'),
      title: 'The money',
      say: 'This strip is the money: total billed, lifetime paid, the balance due and open invoices, counted over everything they’ve ever had. Their main contact’s phone and email sit here too, with when you last talked.',
    },
    {
      id: 'acct-tabs', chapter: 'account', route: DETAIL, selector: t('customer-tabs'),
      title: 'Five groups',
      say: 'Everything else sits in these groups: Overview, Details, Records, Files and Log. Pick a group, then a sub-tab under it. The small number is how many sub-tabs a group has.',
    },
    {
      id: 'acct-identity', chapter: 'account', route: DETAIL, open: 'tab:overview', selector: t('customer-overview-identity'),
      title: 'Overview',
      say: 'Overview starts with the basics. Edit info jumps to the full form, and the dashed button helps fill in what’s missing, like industry or key dates.',
      variants: [{ when: FOCUS, title: 'Account details', say: 'In the Focus look, Overview starts with the account details: the type of account, the last contact and the industry. View all details shows the rest, and Edit info jumps to the full form.' }],
    },
    {
      id: 'acct-portal', chapter: 'account', route: DETAIL, open: 'tab:overview', selector: t('customer-portal'),
      title: 'Customer Portal',
      say: 'Customer Portal lets them sign in to see their work orders, view invoices and pay online. Nothing is shared until you press Send portal invite, which goes to their email. Once they’re in, you can revoke access here.',
    },
    {
      id: 'acct-rules', chapter: 'account', route: DETAIL, open: 'tab:overview', selector: t('customer-field-requirements'),
      title: 'Field rules',
      say: 'Field Requirements are this customer’s rules for your techs: a GPS check-in and check-out, a signature when done, a minimum number of photos, before and after photos, and a default not-to-exceed cap. New jobs pick them up once you press Save field requirements.',
    },
    {
      id: 'acct-ov-contacts', chapter: 'account', route: DETAIL, open: 'tab:overview', selector: t('customer-overview-contacts'),
      title: 'Contacts at a glance',
      say: 'Contacts lists each person with badges for Main, Billing, Service and Intake. When someone signs in to the portal, it says so here, with Remove portal access if they leave.',
      variants: [{ when: FOCUS, say: 'Contacts shows the first two people, with badges for Main, Billing, Service and Intake. When there are more, View all opens the full list.' }],
    },
    {
      id: 'acct-ov-locations', chapter: 'account', route: DETAIL, open: 'tab:overview', selector: t('customer-overview-locations'),
      title: 'Locations at a glance',
      say: 'Service locations show each address with Primary and Gated badges, and the gate code. Manage takes you to the full list.',
      variants: [{ when: FOCUS, say: 'Service locations show the first two addresses, with Primary and Gated badges and the gate code. View all, or Manage, takes you to the full list.' }],
    },
    {
      id: 'acct-ov-billing', chapter: 'account', route: DETAIL, open: 'tab:overview', selector: t('customer-overview-billing'),
      title: 'Tax and billing',
      say: 'Tax and billing sums up whether they’re taxed, their tax ID, payment method and currency. When there are notes, they show just above.',
    },

    // ---------- Info, contacts, locations ----------
    {
      id: 'det-group', chapter: 'details', route: DETAIL, open: 'tab:overview', selector: t('customer-group-details'),
      wait: { appear: `${t('customer-identity')}, ${t('customer-contacts-tab')}` }, doIt: t('customer-group-details'),
      yourTurn: 'Click Details.',
      title: 'Details',
      say: 'Details is where you change who they are. Click Details.',
    },
    {
      id: 'det-edit', chapter: 'details', route: DETAIL, open: 'tab:edit', selector: t('customer-identity'),
      title: 'Edit Info',
      say: 'Edit Info is the same form you just walked through, filled in for this customer. You can even change their type here.',
    },
    {
      id: 'det-statement', chapter: 'details', route: DETAIL, open: 'tab:edit', selector: t('customer-statement-day'),
      title: 'Their statement',
      say: 'For a business customer, here’s their statement day again. The link under it, Choose this customer’s statement template, takes you to their Templates tab. We’ll go there soon.',
    },
    {
      id: 'det-exempt', chapter: 'details', route: DETAIL, open: 'tab:edit', selector: t('customer-tax-exempt'),
      title: 'Tax exempt certificate',
      say: 'Now that the customer exists, their tax exempt certificate can be uploaded here. When they aren’t taxable, it’s flagged as needed for your records.',
    },
    {
      id: 'det-agreement', chapter: 'details', route: DETAIL, open: 'tab:edit', selector: t('customer-location-agreement'),
      title: 'Agreement for a location',
      say: 'Each saved location has a Service agreement for this location link, to set up a service agreement for just that address.',
    },
    {
      id: 'det-save', chapter: 'details', route: DETAIL, open: 'tab:edit', selector: t('customer-save'),
      title: 'Save changes',
      say: 'Save changes keeps your edits and goes back to Overview. Cancel goes back without saving. We’ll leave it as it is.',
    },
    {
      id: 'det-contacts', chapter: 'details', route: DETAIL, selector: t('customer-subtab-contacts'),
      wait: { appear: t('customer-contacts-tab') }, doIt: t('customer-subtab-contacts'),
      yourTurn: 'Click Contacts.',
      title: 'Contacts',
      say: 'Contacts has its own tab, for quick changes to one person. Click Contacts.',
    },
    {
      id: 'det-contacts-tab', chapter: 'details', route: DETAIL, open: 'tab:contacts', selector: t('customer-contacts-tab'),
      title: 'One person at a time',
      say: 'Each person is listed with their roles. Edit changes one person, and Delete removes them after a check. Changes the customer makes in their portal wait in a From the portal box above the list until you import them, and + Add contact adds one more person.',
    },
    {
      id: 'det-locations', chapter: 'details', route: DETAIL, selector: t('customer-subtab-locations'),
      wait: { appear: t('customer-locations-tab') }, doIt: t('customer-subtab-locations'),
      yourTurn: 'Click Locations.',
      title: 'Locations',
      say: 'And Locations. Click it.',
    },
    {
      id: 'det-locations-tab', chapter: 'details', route: DETAIL, open: 'tab:locations', selector: t('customer-locations-tab'),
      title: 'Every address',
      say: 'Locations shows every address with a map, the gate code and entry notes. If another company on CrewBarn keeps equipment records at the same address, a card here tells you. + Add location adds an address, and Edit changes one.',
    },
    {
      id: 'det-location-agreement', chapter: 'details', route: DETAIL, selector: t('customer-location-build-agreement'), when: t('customer-location-build-agreement'),
      title: 'An agreement for one property',
      say: 'Build service agreement on a property starts an agreement with every piece of equipment there already ticked.',
    },

    // ---------- Records and new work ----------
    {
      id: 'rec-group', chapter: 'records', route: DETAIL, open: 'tab:overview', selector: t('customer-group-work'),
      wait: { appear: t('customer-jobs-tab') }, doIt: t('customer-group-work'),
      yourTurn: 'Click Records.',
      title: 'Records',
      say: 'Records holds the work you’ve done for them. Click Records.',
    },
    {
      id: 'rec-jobs', chapter: 'records', route: DETAIL, open: 'tab:jobs', selector: t('customer-jobs-tab'),
      title: 'Jobs',
      say: 'Jobs lists every work order for this customer, with its status, date and tech. Jobs from accounts under this one that are billed here say For, and the account’s name.',
    },
    {
      id: 'rec-jobs-filters', chapter: 'records', route: DETAIL, open: 'tab:jobs', selector: t('customer-jobs-filters'),
      title: 'Billed or not',
      say: 'All, Uninvoiced and Invoiced split them up. A dot on Uninvoiced means there are jobs not billed yet.',
    },
    {
      id: 'rec-jobs-new', chapter: 'records', route: DETAIL, open: 'tab:jobs', selector: t('customer-jobs-new'),
      title: 'Start a job',
      say: '+ New Job starts a job with this customer already picked. Their primary location is the default address.',
    },
    {
      id: 'rec-est', chapter: 'records', route: DETAIL, selector: t('customer-subtab-estimates'),
      wait: { appear: t('customer-estimates-tab') }, doIt: t('customer-subtab-estimates'),
      yourTurn: 'Click Estimates.',
      title: 'Estimates',
      say: 'Next, Estimates. Click it.',
    },
    {
      id: 'rec-est-tab', chapter: 'records', route: DETAIL, open: 'tab:estimates', selector: t('customer-estimates-tab'),
      title: 'Their quotes',
      say: 'Estimates are the quotes you’ve given them, with the status, total and date. + New Estimate starts a quote with the customer already filled in.',
    },
    {
      id: 'rec-inv', chapter: 'records', route: DETAIL, selector: t('customer-subtab-invoices'),
      wait: { appear: t('customer-invoices-tab') }, doIt: t('customer-subtab-invoices'),
      yourTurn: 'Click Invoices.',
      title: 'Invoices',
      say: 'Now Invoices. Click it.',
    },
    {
      id: 'rec-inv-tab', chapter: 'records', route: DETAIL, open: 'tab:invoices', selector: t('customer-invoices-tab'),
      title: 'Their bills',
      say: 'Invoices shows each bill and what’s still owed. A draft can be sent or deleted, and an open one marked paid or cancelled. Those buttons change real records, so today we only look.',
    },
    {
      id: 'rec-inv-filters', chapter: 'records', route: DETAIL, open: 'tab:invoices', selector: t('customer-invoices-filters'),
      title: 'Unpaid and paid',
      say: 'All, Unpaid and Paid split them up, plus Cancelled when there are any. Unpaid is the one you’ll want at month end.',
    },
    {
      id: 'rec-credits', chapter: 'records', route: DETAIL, open: 'tab:invoices', selector: t('customer-credits'),
      title: 'Credits',
      say: 'Available credits are down payments and overpayments that haven’t been used yet. Apply to invoice puts one toward a bill.',
    },
    {
      id: 'rec-inv-actions', chapter: 'records', route: DETAIL, open: 'tab:invoices', selector: t('customer-invoices-actions'),
      title: 'Payments, statement, new invoice',
      say: 'Receive payment spreads one check, card or cash payment over several invoices. Preview statement shows their statement and turns monthly delivery on or off, without sending anything. And + New invoice starts a bill for them.',
    },
    {
      id: 'rec-assets', chapter: 'records', route: DETAIL, selector: t('customer-subtab-assets'),
      wait: { appear: t('customer-assets-tab') }, doIt: t('customer-subtab-assets'),
      yourTurn: 'Click Assets.',
      title: 'Assets',
      say: 'Then Assets. Click it.',
    },
    {
      id: 'rec-assets-tab', chapter: 'records', route: DETAIL, open: 'tab:assets', selector: t('customer-assets-tab'),
      title: 'Their equipment',
      say: 'Assets are the equipment at their places, like a water heater or a rooftop unit, grouped by property. View / Edit opens one, and + New Asset adds one already linked to them.',
    },
    {
      id: 'rec-tasks', chapter: 'records', route: DETAIL, selector: t('customer-subtab-tasks'),
      wait: { appear: t('customer-tasks-tab') }, doIt: t('customer-subtab-tasks'),
      yourTurn: 'Click Tasks.',
      title: 'Tasks',
      say: 'And Tasks. Click it.',
    },
    {
      id: 'rec-tasks-tab', chapter: 'records', route: DETAIL, open: 'tab:tasks', selector: t('customer-tasks-tab'),
      title: 'To-dos for them',
      say: 'Tasks are to-dos tied to this customer, like a callback. + Add task makes one, and Show completed brings back the finished ones.',
    },
    {
      id: 'rec-new-job', chapter: 'records', route: DETAIL, selector: t('customer-new-job'),
      title: 'From any tab',
      say: 'And + New job up top works from any tab. A job without a date waits in To Schedule, on the Schedule page.',
    },

    // ---------- Files ----------
    {
      id: 'files-group', chapter: 'files', route: DETAIL, open: 'tab:overview', selector: t('customer-group-files'),
      wait: { appear: t('customer-documents-tab') }, doIt: t('customer-group-files'),
      yourTurn: 'Click Files.',
      title: 'Files',
      say: 'Files keeps their paperwork. Click Files.',
    },
    {
      id: 'files-docs', chapter: 'files', route: DETAIL, open: 'tab:documents', selector: t('customer-documents-tab'),
      title: 'Documents',
      say: 'Documents holds their contracts, insurance certificates, tax forms and signed agreements. PDF, Word, Excel or a photo, up to 25 MB each.',
    },
    {
      id: 'files-upload', chapter: 'files', route: DETAIL, open: 'tab:documents', selector: t('customer-documents-upload'),
      title: 'Upload',
      say: '+ Upload adds a file. For a PDF or photo, CrewBarn can then pull out the text, so you can edit it or make it signable. Open lets you read any file right here.',
    },
    {
      id: 'files-secure-tab', chapter: 'files', route: DETAIL, selector: t('customer-subtab-secure-files'),
      wait: { appear: t('customer-secure-files-tab') }, doIt: t('customer-subtab-secure-files'),
      yourTurn: 'Click Secure Files.',
      title: 'Secure Files',
      say: 'Secure Files is for the sensitive things. Click it.',
    },
    {
      id: 'files-secure', chapter: 'files', route: DETAIL, open: 'tab:secure-files', selector: t('customer-secure-files-tab'),
      title: 'Locked away',
      say: 'Secure Files are encrypted: access notes, private documents and sensitive photos. Only people with permission see this tab, and Audit shows the history of each file.',
    },
    {
      id: 'files-secure-unlock', chapter: 'files', route: DETAIL, open: 'tab:secure-files', selector: t('customer-secure-unlock'),
      title: 'Unlock with a code',
      say: 'It stays Locked until you unlock it. Choose a text or email code, press Send code, then type it in and press Verify. Once it’s open, you can upload a file or write an encrypted note.',
    },

    // ---------- Their own templates ----------
    {
      id: 'tpl-open', chapter: 'templates', route: DETAIL, open: 'tab:documents', selector: t('customer-subtab-templates'),
      wait: { appear: t('customer-templates') }, doIt: t('customer-subtab-templates'),
      yourTurn: 'Click Templates.',
      title: 'Templates',
      say: 'Here’s the part that makes one customer’s paperwork their own. Click Templates.',
    },
    {
      id: 'tpl-workflows', chapter: 'templates', route: DETAIL, open: 'tab:templates', selector: t('customer-form-workflows'),
      title: 'Three shortcuts',
      say: 'Up top are three shortcuts: their document packet, their secure records, and customer-specific forms. Step-by-step shows or hides the little how-to under each one.',
    },
    {
      id: 'tpl-section', chapter: 'templates', route: DETAIL, open: 'tab:templates', selector: t('customer-templates'),
      title: 'Templates for this customer',
      say: 'This is where you pin their own layouts. Most customers never need it. It’s for the ones who do, like a property manager who wants their own invoice or work order.',
    },
    {
      id: 'tpl-intro', chapter: 'templates', route: DETAIL, open: 'tab:templates', selector: t('customer-templates-intro'),
      title: 'Your default, unless you pick',
      say: 'Every row starts on Use tenant default. That means they get the same template as everyone else: the one marked as your default in Templates and Forms. Pick another one, and only this customer gets it.',
    },
    {
      id: 'tpl-rows', chapter: 'templates', route: DETAIL, open: 'tab:templates', selector: t('customer-template-rows'),
      title: 'One row per kind',
      say: 'There’s a row for each kind of paperwork: statement, invoice, receipt, estimate, work order, sub work order, contract and inspection.',
    },
    {
      id: 'tpl-invoice', chapter: 'templates', route: DETAIL, open: 'tab:templates', selector: t('customer-template-row-invoice'),
      title: 'Take Invoice',
      say: 'Take Invoice. The list holds your active invoice templates, and your default is labeled. If you don’t have any yet, a Create one link takes you to Templates and Forms.',
    },
    {
      id: 'tpl-pick', chapter: 'templates', route: DETAIL, open: 'tab:templates', selector: t('customer-template-doc-invoice'), hold: true,
      doIt: 'pick:invoice',
      yourTurn: 'Pick an invoice template, then press Next.',
      title: 'Pick one',
      say: 'Go ahead and pick one. Nothing is saved until you press Save overrides.',
    },
    {
      id: 'tpl-picked', chapter: 'templates', route: DETAIL, open: 'tab:templates', selector: t('customer-template-picked'),
      title: 'Just for them',
      say: 'This green line confirms it: this customer gets that template for their invoices. Everyone else keeps your default.',
    },
    {
      id: 'tpl-sms', chapter: 'templates', route: DETAIL, open: 'tab:templates', selector: t('customer-template-sms-invoice'),
      title: 'A text to go with it',
      say: 'Under each one, Text message picks a text to send them for that kind of paperwork. Leave it on No text, and they don’t get one.',
    },
    {
      id: 'tpl-statement', chapter: 'templates', route: DETAIL, open: 'tab:templates', selector: t('customer-template-row-statement'),
      title: 'Statement',
      say: 'Statement is the layout of their monthly statement. Pick it before you turn on monthly delivery.',
    },
    {
      id: 'tpl-sub', chapter: 'templates', route: DETAIL, open: 'tab:templates', selector: t('customer-template-row-sub_work_order'),
      title: 'Sub work orders and more',
      say: 'Sub Work Order is used when one of their jobs is subbed out to a partner. Contract and Inspection cover their agreements and inspection reports.',
    },
    {
      id: 'tpl-create', chapter: 'templates', route: DETAIL, open: 'tab:templates', selector: t('customer-templates-create'),
      title: 'Need a new one?',
      say: 'Need a new layout first? Create templates in Connect opens Templates and Forms in a new tab. Make it there, and it shows up in these lists.',
    },
    {
      id: 'tpl-save', chapter: 'templates', route: DETAIL, open: 'tab:templates', selector: t('customer-templates-save'),
      title: 'Save overrides',
      say: 'Save overrides keeps your picks for this customer, and a green Overrides saved note confirms it. This time we’ll leave it, so your pick goes away when you leave the tab.',
    },
    {
      id: 'tpl-after', chapter: 'templates', route: DETAIL,
      title: 'From then on',
      say: 'Once saved, when you invoice this customer, send them an estimate, print their work order or give them a receipt, CrewBarn uses their template instead of your default. If you change your default later, their pinned ones stay put.',
    },

    // ---------- Messages and activity ----------
    {
      id: 'log-group', chapter: 'log', route: DETAIL, open: 'tab:overview', selector: t('customer-group-log'),
      wait: { appear: t('customer-messages-tab') }, doIt: t('customer-group-log'),
      yourTurn: 'Click Log.',
      title: 'Log',
      say: 'Log is the history with this customer. Click Log.',
    },
    {
      id: 'log-messages', chapter: 'log', route: DETAIL, open: 'tab:messages', selector: t('customer-messages-tab'),
      title: 'Messages',
      say: 'Messages has every text, email, call and voicemail with them, grouped by job, with General for the rest. New text and New email start a conversation.',
    },
    {
      id: 'log-activity-tab', chapter: 'log', route: DETAIL, selector: t('customer-subtab-activity'),
      wait: { appear: t('customer-activity-tab') }, doIt: t('customer-subtab-activity'),
      yourTurn: 'Click Activity.',
      title: 'Activity',
      say: 'And Activity. Click it.',
    },
    {
      id: 'log-activity', chapter: 'log', route: DETAIL, open: 'tab:activity', selector: t('customer-activity-tab'),
      title: 'Who changed what',
      say: 'Activity shows who changed what on this account, and when.',
    },

    // ---------- Types and where they're used ----------
    {
      id: 'types-open', chapter: 'more', route: TYPES, open: 'goto:/tool-shed/customer-types', selector: t('customer-types-header'),
      title: 'Customer types',
      say: 'Customer types live in Tool Shed. Every customer is one of three, picked when you add them, and you can change it later on Edit Info.',
    },
    {
      id: 'types-residential', chapter: 'more', route: TYPES, selector: t('customer-types-card-residential'),
      title: 'Residential',
      say: 'Residential is a household, billed to a named person: homeowners, renters and condo owners.',
    },
    {
      id: 'types-commercial', chapter: 'more', route: TYPES, selector: t('customer-types-card-commercial'),
      title: 'Commercial',
      say: 'Commercial is a business, billed to the company. It can get monthly statements, and often has many locations under one account.',
    },
    {
      id: 'types-government', chapter: 'more', route: TYPES, selector: t('customer-types-card-government'),
      title: 'Government',
      say: 'Government is a public agency, like a city or a school district, with the same statement and location options.',
    },
    {
      id: 'types-tags', chapter: 'more', route: TYPES, selector: t('customer-types-tags'),
      title: 'Tags for everything else',
      say: 'Need another way to group them? Tags label customers without changing their type. You manage them in Tags.',
    },
    {
      id: 'used-new-people', chapter: 'more', route: TYPES,
      title: 'Where new customers come from',
      say: 'New people often reach you first in Messages or the Intake Queue. From there, you can link their number to a customer, or turn their request into a job or estimate.',
    },
    {
      id: 'used-pickers', chapter: 'more', route: TYPES,
      title: 'Every job starts with one',
      say: 'Every new job, estimate and invoice starts by picking a customer. Their primary location becomes the job address, and their billing defaults carry onto the invoice.',
    },
    {
      id: 'used-locations', chapter: 'more', route: TYPES,
      title: 'Every address in one list',
      say: 'Tool Shed, Service Locations lists every address across all your customers, so you can find a building by its nickname. Changes are still made on the customer.',
    },
    {
      id: 'used-fields', chapter: 'more', route: TYPES,
      title: 'Your own fields and labels',
      say: 'Custom Fields and Tags in Tool Shed add your own fields and labels to every customer. Custom fields also work as merge tags in your templates.',
    },
    {
      id: 'used-templates', chapter: 'more', route: TYPES,
      title: 'Templates and Forms',
      say: 'Your default paperwork lives in Templates and Forms. A customer’s own picks, on their Templates tab, only change what that one customer gets.',
    },
    {
      id: 'used-done', chapter: 'more', route: TYPES, selector: t('customer-types-header'),
      title: 'That’s the lot',
      say: 'That’s customers, start to finish: the list, adding one, their page, and their own templates. You can take this tutorial again any time from the Tutorial button at the top of the page.',
    },
  ],
}
