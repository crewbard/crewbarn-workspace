import type { PageFilm } from './types'

/** Intro films for connect pages. See ./types.ts and docs/tours/HOW-TO-WRITE-A-PAGE-TOUR.md. */
export const CONNECT_FILMS: PageFilm[] = [
  // ── Connect home ──
  {
    route: '^/connect/?$',
    film: [
      { id: 'name', say: 'Welcome to Connect. This is where you set up your company, once, and everything else in CrewBarn uses it.', visual: { kind: 'title', title: 'Connect', subtitle: 'Your company, set up once', area: 'Home' } },
      { id: 'once', title: 'Set it once', say: 'Your name, your logo, your prices and your team are entered here. Every estimate, invoice and text picks them up on its own.', visual: { kind: 'text', headline: 'Set it up here. Use it everywhere.', body: 'Estimates, invoices, texts and the customer portal all read from Connect.' } },
      { id: 'attention', title: 'Needs your attention', say: 'Home tells you what still isn’t done, and each item takes you straight to the page that fixes it.', visual: { kind: 'list', heading: 'Needs your attention', rows: [
        { title: 'Add your logo', meta: 'Shows on estimates and invoices', chip: 'To do', tone: 'amber' },
        { title: 'Turn on customer texts', meta: 'Reminders and on-my-way messages', chip: 'To do', tone: 'amber' },
        { title: 'Connect card payments', meta: 'Get paid on the spot', chip: 'Done', tone: 'green' },
      ] } },
      { id: 'areas', title: 'Every settings area', say: 'Your settings are grouped into a handful of areas, so you always know where to look.', visual: { kind: 'chips', heading: 'Settings areas', chips: ['Your business', 'Customers & sites', 'Jobs & workflow', 'Catalog & inventory', 'Money', 'Team', 'CBI AI', 'Connections', 'Account & billing'] } },
      { id: 'go', say: 'Let’s take a look around Home.', visual: { kind: 'go', label: 'Connect home' } },
    ],
  },

  // ── Your business ──
  {
    route: '^/connect/business/?$',
    film: [
      { id: 'name', say: 'This is Your business. It’s who you are, and how you look to your customers.', visual: { kind: 'title', title: 'Your business', area: 'Connect' } },
      { id: 'profile', title: 'Company profile', say: 'Your name, phone, address and license number go here once, and show up on every paper you send.', visual: { kind: 'form', fields: [
        { label: 'Company name', value: 'Northside Home Services' },
        { label: 'Phone', value: '(555) 214-0198' },
        { label: 'License number', value: 'LIC-48213' },
        { label: 'Time zone', value: 'Eastern' },
      ], button: 'Save' } },
      { id: 'online', title: 'Online presence', say: 'You can also set up your website, your own customer app and your Google reviews.', visual: { kind: 'chips', heading: 'How customers find you', chips: ['Brand & logo', 'Your website', 'Customer app', 'Google Reviews', 'Marketplace listing'] } },
      { id: 'features', title: 'Features', say: 'And you choose which parts of CrewBarn are switched on for everyone.', visual: { kind: 'toggles', heading: 'Modules', rows: [
        { label: 'Estimates', on: true }, { label: 'Inventory', on: true }, { label: 'Service agreements', on: true }, { label: 'Hiring', on: false },
      ] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },

  // ── Customers & sites ──
  {
    route: '^/connect/customers/?$',
    film: [
      { id: 'name', say: 'This is Customers and sites. It sets how you sort your customers and the places you work.', visual: { kind: 'title', title: 'Customers & sites', area: 'Connect' } },
      { id: 'types', title: 'Sorting customers', say: 'Customer types and tags let you tell a homeowner from a property manager at a glance, each with its own defaults.', visual: { kind: 'list', heading: 'Customer types', rows: [
        { title: 'Residential', meta: 'Due on receipt', chip: 'Default', tone: 'blue' },
        { title: 'Commercial', meta: 'Net 30', chip: 'Active', tone: 'green' },
        { title: 'Property manager', meta: 'Net 15 · many sites', chip: 'Active', tone: 'green' },
      ] } },
      { id: 'where', title: 'Where you work', say: 'Territories mark the areas you cover and who covers them, and site rules keep gate codes and access notes handy.', visual: { kind: 'map', pins: [
        { label: 'North territory', x: 30, y: 28, tone: 'blue' },
        { label: 'South territory', x: 66, y: 70, tone: 'purple' },
        { label: 'Maple Court', x: 44, y: 46, tone: 'amber' },
      ] } },
      { id: 'account', title: 'Equipment and agreements', say: 'You also decide what equipment you track at each customer, and how your service agreements work.', visual: { kind: 'account', name: 'Riverside Apartments', type: 'Property manager', places: ['Building A', 'Building B'], jobs: [
        { title: 'Yearly service visit', meta: 'Service agreement', chip: 'Scheduled', tone: 'blue' },
      ] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },

  // ── Jobs & workflow ──
  {
    route: '^/connect/workflow/?$',
    film: [
      { id: 'name', say: 'This is Jobs and workflow. It sets how a job runs, from the first call to closed.', visual: { kind: 'title', title: 'Jobs & workflow', area: 'Connect' } },
      { id: 'stages', title: 'Job statuses', say: 'You choose the steps a job moves through, and what each one means for your team.', visual: { kind: 'pipeline', stages: ['New', 'Scheduled', 'In progress', 'Done', 'Closed'], card: 'Repair visit' } },
      { id: 'field', title: 'Rules in the field', say: 'Field rules keep things tidy, like asking for photos and a signature before a job can close.', visual: { kind: 'toggles', heading: 'Before a job closes', rows: [
        { label: 'Require photos', on: true }, { label: 'Require a signature', on: true }, { label: 'Require payment', on: true },
      ] } },
      { id: 'auto', title: 'Automations & documents', say: 'And CrewBarn can do the busywork for you, from reminders to your estimate and invoice layouts.', visual: { kind: 'chips', heading: 'Also in here', chips: ['Job types', 'Custom fields', 'Automations', 'Appointment reminders', 'Templates & forms', 'Warranties'] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },

  // ── Catalog & inventory ──
  {
    route: '^/connect/catalog/?$',
    film: [
      { id: 'name', say: 'This is Catalog and inventory. It’s what you sell, what it costs you, and where it’s kept.', visual: { kind: 'title', title: 'Catalog & inventory', area: 'Connect' } },
      { id: 'sell', title: 'What you sell', say: 'Your services and products live here with their prices, so quoting a job takes a couple of taps.', visual: { kind: 'list', heading: 'Catalog', rows: [
        { title: 'Service call', meta: 'Labor · 1 hr', chip: '$95', tone: 'blue' },
        { title: 'Replacement part', meta: 'Product · in stock', chip: '$42', tone: 'green' },
        { title: 'After-hours visit', meta: 'Labor · 1 hr', chip: '$145', tone: 'blue' },
      ] } },
      { id: 'stock', title: 'Stock and vendors', say: 'Stock rules tell you when you’re running low, and your vendors are ready when it’s time to reorder.', visual: { kind: 'cart', items: [
        { name: 'Replacement part', qty: 6 }, { name: 'Fittings kit', qty: 2 },
      ], supplier: 'Main supply house', order: 'PO 1042' } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },

  // ── Money ──
  {
    route: '^/connect/money/?$',
    film: [
      { id: 'name', say: 'This is Money. It sets how you get paid and what you charge.', visual: { kind: 'title', title: 'Money', area: 'Connect' } },
      { id: 'paid', title: 'Getting paid', say: 'Connect card payments and bank transfers, and choose which ways your techs can take payment.', visual: { kind: 'chips', heading: 'Ways to get paid', chips: ['Card', 'Bank transfer', 'Cash', 'Check'] } },
      { id: 'bill', title: 'Invoices, tax & pricing', say: 'Your tax rates, payment terms, trip charges and discounts all come from here, so every bill adds up the same way.', visual: { kind: 'money', title: 'Invoice', lines: [
        { label: 'Service call', amount: 95 }, { label: 'Parts', amount: 64 }, { label: 'Trip charge', amount: 25 }, { label: 'Tax', amount: 11.04 },
      ], stamp: 'Net 15' } },
      { id: 'cash', title: 'Cash rules', say: 'You can also make sure cash taken in the field gets handed in before the next job.', visual: { kind: 'toggles', heading: 'Cash rules', rows: [{ label: 'Hand in cash before the next job', on: true }] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },

  // ── Team ──
  {
    route: '^/connect/team/?$',
    film: [
      { id: 'name', say: 'This is Team. It’s everyone who works with you, and the rules around them.', visual: { kind: 'title', title: 'Team', area: 'Connect' } },
      { id: 'people', title: 'People', say: 'Add your staff and crews, your subcontractors, and the people you’re hiring.', visual: { kind: 'list', heading: 'Staff & crews', rows: [
        { title: 'Jordan Lee', meta: 'Lead tech · Crew A', chip: 'Active', tone: 'green' },
        { title: 'Sam Rivera', meta: 'Tech · Crew A', chip: 'Active', tone: 'green' },
        { title: 'Casey Morgan', meta: 'Office', chip: 'Invited', tone: 'amber' },
      ] } },
      { id: 'access', title: 'Access & security', say: 'Roles decide what each person can open, change or delete, and two-factor keeps sign-ins safe.', visual: { kind: 'toggles', heading: 'Tech role', rows: [
        { label: 'See their own jobs', on: true }, { label: 'Take payments', on: true }, { label: 'Delete invoices', on: false }, { label: 'Two-factor sign-in', on: true },
      ] } },
      { id: 'time', title: 'Time, pay and tools', say: 'Time off, pay rules, and the vans and tools each person carries are here too.', visual: { kind: 'chips', heading: 'Also in here', chips: ['Time off', 'When pay is earned', 'Clock in by GPS', 'Company tools', 'GPS devices'] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },

  // ── CBI AI ──
  {
    route: '^/connect/ai/?$',
    film: [
      { id: 'name', say: 'This is CBI, your CrewBarn assistant. Here you decide how it works for you.', visual: { kind: 'title', title: 'CBI AI', area: 'Connect' } },
      { id: 'help', title: 'What it does', say: 'CBI reads photos and messy notes, and drafts jobs and texts so you don’t have to type them.', visual: { kind: 'thread', contact: 'CBI', messages: [
        { from: 'us', text: 'Make a job from this note: leak under kitchen sink, Tuesday morning.' },
        { from: 'them', text: 'Done. I drafted a repair job for Tuesday at 9 for you to check.' },
      ] } },
      { id: 'allowed', title: 'What it may do', say: 'You choose exactly what it’s allowed to do on its own, and what needs your OK first.', visual: { kind: 'toggles', heading: 'Allowed actions', rows: [
        { label: 'Draft texts to customers', on: true }, { label: 'Create draft jobs', on: true }, { label: 'Send texts without asking', on: false },
      ] } },
      { id: 'learn', title: 'Teach it and watch it', say: 'You can teach it how your company works, and see a record of everything it has done.', visual: { kind: 'chips', heading: 'Also in here', chips: ['Which AI it uses', 'Your AI key', 'Voice', 'Learning', 'Memory', 'Activity'] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },

  // ── Connections ──
  {
    route: '^/connect/connections/?$',
    film: [
      { id: 'name', say: 'This is Connections. It’s how CrewBarn talks to the outside world.', visual: { kind: 'title', title: 'Connections', area: 'Connect' } },
      { id: 'talk', title: 'Phone, text & email', say: 'Set up the number and email your customers see, so every message comes from your company. The words of your automated calls live here too.', visual: { kind: 'thread', contact: 'Pat Gomez', messages: [
        { from: 'us', text: 'Hi Pat, your tech is on the way and should arrive in about 20 minutes.', channel: 'text' },
        { from: 'them', text: 'Great, thank you!', channel: 'text' },
      ] } },
      { id: 'apps', title: 'Apps and partners', say: 'Link the other apps you use, plus storage, maps, your own web address, and the TV in your shop.', visual: { kind: 'toggles', heading: 'Connected', rows: [
        { label: 'Accounting app', on: true }, { label: 'Maps', on: true }, { label: 'File storage', on: true }, { label: 'Shop TV', on: false },
      ] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },

  // ── Developers ──
  {
    route: '^/connect/developers/?$',
    film: [
      { id: 'name', say: 'This is Developers. It’s for hooking your own systems up to CrewBarn.', visual: { kind: 'title', title: 'Developers', area: 'Connect' } },
      { id: 'keys', title: 'Keys and guide', say: 'Make a key for each system that needs in, and use the guide to see what it can ask for.', visual: { kind: 'list', heading: 'API keys', rows: [
        { title: 'Reporting sync', meta: 'Read only', chip: 'Active', tone: 'green' },
        { title: 'Old website form', meta: 'Create jobs', chip: 'Revoked', tone: 'red' },
      ] } },
      { id: 'events', title: 'Events', say: 'Events send a quick alert to your systems the moment something happens, like a job being booked or paid.', visual: { kind: 'pipeline', stages: ['Job paid', 'Alert sent', 'Your system'], card: 'Invoice paid' } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },

  // ── Account & billing ──
  {
    route: '^/connect/account/?$',
    film: [
      { id: 'name', say: 'This is Account and billing. It’s your CrewBarn account itself.', visual: { kind: 'title', title: 'Account & billing', area: 'Connect' } },
      { id: 'plan', title: 'Your plan', say: 'See what you pay, how many seats you’re using, and how close you are to your limits.', visual: { kind: 'tiles', tiles: [
        { label: 'Seats in use', value: 6, tone: 'blue' }, { label: 'Monthly plan', value: 149, prefix: '$', tone: 'green' }, { label: 'Texts this month', value: 820, tone: 'amber' },
      ] } },
      { id: 'data', title: 'Your data and records', say: 'Bring your data in, take a copy out whenever you like, and check the record of who changed what.', visual: { kind: 'list', heading: 'Audit log', rows: [
        { title: 'Changed payment terms', meta: 'Casey Morgan · today', chip: 'Money', tone: 'purple' },
        { title: 'Added a new role', meta: 'Jordan Lee · yesterday', chip: 'Team', tone: 'blue' },
        { title: 'Imported 240 customers', meta: 'Casey Morgan · last week', chip: 'Data', tone: 'gray' },
      ] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
]
