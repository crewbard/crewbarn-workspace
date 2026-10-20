import type { PageFilm } from './types'

/** Intro films for settings pages. See ./types.ts and docs/tours/HOW-TO-WRITE-A-PAGE-TOUR.md. */
export const SETTINGS_FILMS: PageFilm[] = [
  {
    route: '^/tool-shed$',
    film: [
      { id: 'name', say: 'This is the Tool Shed: every setting for your business, in one place.', visual: { kind: 'title', title: 'Tool Shed', subtitle: 'Business setup and controls' } },
      { id: 'search', title: 'Find any setting', say: 'Type what you’re after, and the right setting comes straight up.', visual: { kind: 'list', heading: 'Settings', search: 'invoice', rows: [
        { title: 'Invoice numbering', meta: 'Shop rules', chip: 'Open', tone: 'blue' },
        { title: 'Payment terms', meta: 'Money', chip: 'Open', tone: 'blue' },
        { title: 'Automations', meta: 'Reminders and nudges', chip: 'Open', tone: 'blue' },
      ] } },
      { id: 'cards', title: 'Your cards', say: 'Setup cards guide you through the basics, and you can arrange the rest the way you like.', visual: { kind: 'chips', heading: 'Get set up', chips: ['Daily workflow', 'Customer experience', 'Inventory', 'Your team', 'Billing'] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/company-info$',
    film: [
      { id: 'name', say: 'This is Company info: the details your customers see on everything you send.', visual: { kind: 'title', title: 'Company info', area: 'Tool Shed' } },
      { id: 'details', title: 'Your details', say: 'Fill in your name, phone, email and address once. Leave a box empty and nothing prints in its place.', visual: { kind: 'form', fields: [
        { label: 'Company name', value: 'Brightside Home Services' },
        { label: 'Phone', value: '(555) 201-4410' },
        { label: 'Email', value: 'office@brightside.com' },
        { label: 'License number', value: 'LIC-48210' },
      ], button: 'Save changes' } },
      { id: 'paper', title: 'On paper', say: 'Those same details show up at the top of your estimates and invoices.', visual: { kind: 'signature', doc: 'Estimate', lines: ['Brightside Home Services', '(555) 201-4410', 'office@brightside.com'], total: '$480.00' } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/brand$',
    film: [
      { id: 'name', say: 'This is Brand and logo. It makes what you send look like it came from you.', visual: { kind: 'title', title: 'Brand & logo', area: 'Tool Shed' } },
      { id: 'pick', title: 'Logo and colour', say: 'Upload your logo and pick your colour.', visual: { kind: 'form', fields: [{ label: 'Logo', value: 'logo.png' }, { label: 'Brand colour', value: '#1F6FEB' }], button: 'Save colour' } },
      { id: 'where', title: 'Where it shows', say: 'Your estimates, invoices, emails and customer portal all pick it up.', visual: { kind: 'chips', chips: ['Estimates', 'Invoices', 'Emails', 'Customer portal'] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/settings-location$',
    film: [
      { id: 'name', say: 'Here you decide where your company settings live.', visual: { kind: 'title', title: 'Where your settings live', area: 'Tool Shed' } },
      { id: 'choice', title: 'Two choices', say: 'Keep settings here only, so your crew’s app stays about the work. Or show them in the app as well.', visual: { kind: 'toggles', heading: 'Settings show in', rows: [{ label: 'This settings area', on: true }, { label: 'The crew app too', on: false }] } },
      { id: 'go', say: 'Nothing is taken away either way. Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/google-reviews$',
    film: [
      { id: 'name', say: 'This is Google Reviews. Happy customers become five-star reviews.', visual: { kind: 'title', title: 'Google Reviews', area: 'Tool Shed' } },
      { id: 'ask', title: 'Asking for reviews', say: 'Pick your Google listing, and after a job we ask the customer for a review.', visual: { kind: 'thread', contact: 'Dana Lee', messages: [
        { from: 'us', text: 'Thanks for having us today! Would you leave us a quick review?', channel: 'text' },
        { from: 'them', text: 'Happy to. Great work!', channel: 'text' },
      ] } },
      { id: 'read', title: 'Reading them here', say: 'Connect your Business Profile to read and answer your reviews right here.', visual: { kind: 'tiles', tiles: [{ label: 'Reviews', value: 126, tone: 'blue' }, { label: 'Five stars', value: 112, tone: 'amber' }, { label: 'Waiting for a reply', value: 3, tone: 'red' }] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/marketplace$',
    film: [
      { id: 'name', say: 'This is your Marketplace listing: how new customers find you.', visual: { kind: 'title', title: 'Marketplace listing', area: 'Tool Shed' } },
      { id: 'what', title: 'Who can find you', say: 'Choose whether you’re listed and taking new requests, and which services you offer.', visual: { kind: 'toggles', heading: 'Your listing', rows: [{ label: 'Show me on the marketplace', on: true }, { label: 'Accept new requests', on: true }, { label: 'Keep my customers mine', on: true }] } },
      { id: 'where', title: 'Where you work', say: 'Add the counties and zip codes you cover, so you only hear from nearby customers.', visual: { kind: 'map', pins: [{ label: 'North County', x: 30, y: 30, tone: 'blue' }, { label: 'Downtown', x: 55, y: 50, tone: 'blue' }, { label: 'South Shore', x: 70, y: 75, tone: 'blue' }] } },
      { id: 'blurb', title: 'A few words', say: 'Then write a short blurb about you, and save your listing.', visual: { kind: 'text', headline: 'Family-run, on time, and tidy.', body: 'Serving the whole county for over ten years.' } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/modules$',
    film: [
      { id: 'name', say: 'This is Modules. Show your crew only the parts of CrewBarn you use.', visual: { kind: 'title', title: 'Modules', area: 'Tool Shed' } },
      { id: 'switch', title: 'Switch areas on or off', say: 'Start from a ready-made setup, then flip whole areas on or off for everyone.', visual: { kind: 'toggles', heading: 'Areas', rows: [{ label: 'Jobs and schedule', on: true }, { label: 'Estimates', on: true }, { label: 'Inventory', on: false }, { label: 'Service agreements', on: true }] } },
      { id: 'shortcuts', title: 'Shortcuts in Work', say: 'For each area that’s on, choose whether its shortcut shows in your work menus.', visual: { kind: 'toggles', heading: 'Show in Work', rows: [{ label: 'Jobs and schedule', on: true }, { label: 'Estimates', on: true }, { label: 'Service agreements', on: false }] } },
      { id: 'safe', title: 'Nothing is lost', say: 'Nothing is deleted, and it doesn’t change your bill.', visual: { kind: 'text', headline: 'Off just means hidden.', body: 'Switch it back on and everything is right where you left it.' } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/customer-app$',
    film: [
      { id: 'name', say: 'This is your Customer app: your own phone app, with your name and icon.', visual: { kind: 'title', title: 'Customer app', area: 'Tool Shed' } },
      { id: 'style', title: 'Make it yours', say: 'Give it a name, an icon and a style. It opens straight into your customer portal.', visual: { kind: 'form', fields: [{ label: 'App name', value: 'Brightside' }, { label: 'Icon', value: 'icon.png' }, { label: 'Colour', value: 'Blue' }], button: 'Build my app' } },
      { id: 'build', title: 'From build to phone', say: 'We build it for you, then you try it on a phone before it goes out.', visual: { kind: 'pipeline', stages: ['Set up', 'Building', 'Test copy', 'Ready'], card: 'Brightside app' } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/subscription$',
    film: [
      { id: 'name', say: 'This is your Subscription: what you pay each month.', visual: { kind: 'title', title: 'Subscription', area: 'Tool Shed' } },
      { id: 'price', title: 'How the price works', say: 'One price covers your company and one admin, then a seat for each extra person who signs in.', visual: { kind: 'money', title: 'Monthly plan', lines: [{ label: 'Company and one admin', amount: 49 }, { label: '3 extra seats', amount: 45 }] } },
      { id: 'billing', title: 'Billing', say: 'Change your seats or manage how you pay, right here.', visual: { kind: 'chips', chips: ['Your plan', 'Seats', 'Payment method', 'Invoices'] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/usage$',
    film: [
      { id: 'name', say: 'This is Usage and limits: a count of what you keep in CrewBarn.', visual: { kind: 'title', title: 'Usage & limits', area: 'Tool Shed' } },
      { id: 'counts', title: 'Your records', say: 'See how many customers, jobs and invoices you have, next to the plan you’re on. It’s a count, not a bill.', visual: { kind: 'tiles', tiles: [{ label: 'Customers', value: 842, tone: 'blue' }, { label: 'Jobs', value: 3150, tone: 'green' }, { label: 'Invoices', value: 2766, tone: 'purple' }] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/import$',
    film: [
      { id: 'name', say: 'This is Import data. Bring your records over from another system.', visual: { kind: 'title', title: 'Import data', area: 'Tool Shed' } },
      { id: 'steps', title: 'Three steps', say: 'Pick what you’re bringing in, choose your file or QuickBooks, and match up the columns.', visual: { kind: 'pipeline', stages: ['Choose file', 'Match columns', 'Preview', 'Import'], card: 'customers.csv' } },
      { id: 'check', title: 'Check first', say: 'You see every row before a single record is made.', visual: { kind: 'list', heading: 'Preview', rows: [
        { title: 'Dana Lee', meta: '12 Oak Street', chip: 'New', tone: 'green' },
        { title: 'Harbor View Apartments', meta: '400 Harbor Road', chip: 'New', tone: 'green' },
        { title: 'Sam Ortiz', meta: 'Missing phone', chip: 'Check', tone: 'amber' },
      ] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/data-export$',
    film: [
      { id: 'name', say: 'This is Data export. It’s your data, and you can take a copy any time.', visual: { kind: 'title', title: 'Data export', area: 'Tool Shed' } },
      { id: 'files', title: 'One file each', say: 'Pick what you want, and each kind of record downloads as its own spreadsheet.', visual: { kind: 'list', heading: 'Exports', rows: [
        { title: 'Customers', meta: 'Spreadsheet', chip: 'Download', tone: 'blue' },
        { title: 'Jobs', meta: 'Spreadsheet', chip: 'Download', tone: 'blue' },
        { title: 'Invoices', meta: 'Spreadsheet', chip: 'Download', tone: 'blue' },
      ] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/encryption$',
    film: [
      { id: 'name', say: 'This is Data encryption: lock your private files with a key you own.', visual: { kind: 'title', title: 'Data encryption', area: 'Tool Shed' } },
      { id: 'warn', title: 'Read this first', say: 'It’s for businesses that must hold their own key. Lose the key, and those files are gone for good.', visual: { kind: 'text', headline: 'Your key, your responsibility.', body: 'Only turn this on if you need to.' } },
      { id: 'setup', title: 'Setting it up', say: 'Your key lives in your own cloud account. Set it up, agree, then turn it on.', visual: { kind: 'pipeline', stages: ['Read the warning', 'Set up your key', 'Agree', 'Turn on'], card: 'Your key' } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/company-files$',
    film: [
      { id: 'name', say: 'This is Company files: a locked vault for your business paperwork.', visual: { kind: 'title', title: 'Company files', area: 'Tool Shed' } },
      { id: 'files', title: 'Your vault', say: 'Keep insurance, licences and contracts here. Each file is locked on its own.', visual: { kind: 'list', heading: 'Your files', rows: [
        { title: 'Insurance certificate', meta: 'Added in March', chip: 'Locked', tone: 'purple' },
        { title: 'Business licence', meta: 'Added in January', chip: 'Locked', tone: 'purple' },
        { title: 'Lease agreement', meta: 'Added last year', chip: 'Locked', tone: 'purple' },
      ] } },
      { id: 'code', title: 'Unlock with a code', say: 'It opens with a code, and every look is recorded.', visual: { kind: 'form', fields: [{ label: 'Unlock code', value: '••••••' }], button: 'Unlock' } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/audit-log$',
    film: [
      { id: 'name', say: 'This is the Audit log: a record of what your team did, and when.', visual: { kind: 'title', title: 'Audit log', area: 'Tool Shed' } },
      { id: 'activity', title: 'Activity', say: 'Every change is here, and nobody can edit it.', visual: { kind: 'list', heading: 'Activity', search: 'Alex', rows: [
        { title: 'Alex updated a job', meta: 'Today, 9:12', chip: 'Job', tone: 'blue' },
        { title: 'Alex sent an invoice', meta: 'Today, 10:40', chip: 'Invoice', tone: 'green' },
      ] } },
      { id: 'deletions', title: 'Deletions', say: 'Anything deleted is listed too, with the reason given.', visual: { kind: 'text', headline: 'Estimate removed by Sam', body: 'Reason: the customer changed their mind.' } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/customer-types$',
    film: [
      { id: 'name', say: 'These are Customer types. Every customer is one of three.', visual: { kind: 'title', title: 'Customer types', area: 'Tool Shed' } },
      { id: 'three', title: 'Three types', say: 'A household, a business or a public agency. The type decides which name you need and how they’re billed.', visual: { kind: 'chips', chips: ['Residential', 'Commercial', 'Government'] } },
      { id: 'go', say: 'Need other groups? Tags handle the rest. Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/tags$',
    film: [
      { id: 'name', say: 'This is Tags: coloured labels for your customers.', visual: { kind: 'title', title: 'Tags', area: 'Tool Shed' } },
      { id: 'labels', title: 'Your labels', say: 'Labels like VIP or Do not call tell anyone at a glance who they’re dealing with.', visual: { kind: 'chips', chips: ['VIP', 'Recurring', 'Do not call', 'Pays on time', 'New'] } },
      { id: 'on', title: 'On a customer', say: 'Add a tag, pick its colour, and it shows on the customer’s account.', visual: { kind: 'account', name: 'Dana Lee', type: 'VIP · Recurring', places: ['12 Oak Street'], jobs: [{ title: 'Yearly service', meta: 'Next month', chip: 'Scheduled', tone: 'blue' }] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/service-locations$',
    film: [
      { id: 'name', say: 'This is Service locations: every address you work at, in one list.', visual: { kind: 'title', title: 'Service locations', area: 'Tool Shed' } },
      { id: 'map', title: 'All your sites', say: 'Every site across all your customers, wherever they are.', visual: { kind: 'map', pins: [{ label: '12 Oak Street', x: 25, y: 35 }, { label: 'Harbor View Apartments', x: 60, y: 60 }, { label: 'City Library', x: 75, y: 25 }] } },
      { id: 'find', title: 'Find a site', say: 'Search for an address, then open its customer in one tap.', visual: { kind: 'list', heading: 'Sites', search: 'Harbor', rows: [{ title: 'Harbor View Apartments', meta: '400 Harbor Road', chip: 'Open customer', tone: 'blue' }] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/territories$',
    film: [
      { id: 'name', say: 'This is Territories. Split up the area you cover.', visual: { kind: 'title', title: 'Territories', area: 'Tool Shed' } },
      { id: 'areas', title: 'Your areas', say: 'Build each territory from counties and zip codes.', visual: { kind: 'map', pins: [{ label: 'North', x: 35, y: 25, tone: 'blue' }, { label: 'East', x: 70, y: 45, tone: 'green' }, { label: 'South', x: 40, y: 75, tone: 'amber' }] } },
      { id: 'who', title: 'Who dispatches', say: 'Then choose who dispatches each one, so nothing falls through the cracks.', visual: { kind: 'list', heading: 'Territories', rows: [
        { title: 'North', meta: '3 zip codes', chip: 'Jordan', tone: 'blue' },
        { title: 'East', meta: '1 county', chip: 'Priya', tone: 'green' },
        { title: 'South', meta: '4 zip codes', chip: 'Nobody yet', tone: 'red' },
      ] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/service-agreements$',
    film: [
      { id: 'name', say: 'This is Service agreements: what customers sign for regular, scheduled service.', visual: { kind: 'title', title: 'Service agreements', area: 'Tool Shed' } },
      { id: 'write', title: 'Your agreement', say: 'We can write a draft for you, or read in the one you already use.', visual: { kind: 'form', fields: [{ label: 'Visits a year', value: '2' }, { label: 'What’s covered', value: 'Check-up and cleaning' }, { label: 'Price', value: '$199 a year' }], button: 'Write a draft' } },
      { id: 'sign', title: 'Signed on the spot', say: 'Your customer signs it right on a phone.', visual: { kind: 'signature', doc: 'Service agreement', lines: ['Two visits a year', 'Priority booking'], total: '$199 / year', signer: 'Dana Lee', stamp: 'Signed' } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/job-types$',
    film: [
      { id: 'name', say: 'This is Job types: each kind of work you do.', visual: { kind: 'title', title: 'Job types', area: 'Tool Shed' } },
      { id: 'types', title: 'Your job types', say: 'Each one has its own colour, starting status and usual length.', visual: { kind: 'list', heading: 'Job types', rows: [
        { title: 'Service call', meta: '1 hour', chip: 'Scheduled', tone: 'blue' },
        { title: 'Installation', meta: '4 hours', chip: 'Scheduled', tone: 'green' },
        { title: 'Estimate visit', meta: '30 minutes', chip: 'New', tone: 'amber' },
      ] } },
      { id: 'half', title: 'A head start', say: 'Pick a type on a new job, and it’s already half filled in.', visual: { kind: 'form', fields: [{ label: 'Job type', value: 'Installation' }, { label: 'Status', value: 'Scheduled' }, { label: 'Length', value: '4 hours' }], button: 'Create job' } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/job-statuses$',
    film: [
      { id: 'name', say: 'This is Job statuses: the stages a job moves through.', visual: { kind: 'title', title: 'Job statuses', area: 'Tool Shed' } },
      { id: 'stages', title: 'The stages', say: 'From booked to done, set the stages and the rules for moving between them.', visual: { kind: 'pipeline', stages: ['New', 'Scheduled', 'On the way', 'Done'], card: 'Service call' } },
      { id: 'tell', title: 'Telling the customer', say: 'Each stage can send your customer an update. Go carefully, because these reach real people.', visual: { kind: 'thread', contact: 'Dana Lee', messages: [{ from: 'us', text: 'Your tech is on the way and should arrive around 2:00.', channel: 'text' }] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/custom-fields$',
    film: [
      { id: 'name', say: 'This is Custom fields: your own boxes, for anything we don’t ask yet.', visual: { kind: 'title', title: 'Custom fields', area: 'Tool Shed' } },
      { id: 'where', title: 'Where they go', say: 'Add them to jobs, customers or equipment.', visual: { kind: 'chips', chips: ['Jobs', 'Customers', 'Equipment'] } },
      { id: 'fill', title: 'Filled in on the job', say: 'Make a field required or optional, and print it on your documents if you like.', visual: { kind: 'form', fields: [{ label: 'Gate code', value: '4821' }, { label: 'Equipment age', value: '8 years' }, { label: 'Permit number', value: 'P-20931' }], button: 'Save' } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/automations$',
    film: [
      { id: 'name', say: 'This is Automations: the things CrewBarn does so nobody has to remember.', visual: { kind: 'title', title: 'Automations', area: 'Tool Shed' } },
      { id: 'list', title: 'Each with a switch', say: 'Reminders, thank-yous, review asks and payment nudges. Each reads like a sentence and has its own switch.', visual: { kind: 'toggles', heading: 'Automations', rows: [
        { label: 'Remind the customer the day before', on: true },
        { label: 'Say thanks when a job is done', on: true },
        { label: 'Ask for a review', on: true },
        { label: 'Nudge when a bill is late', on: false },
      ] } },
      { id: 'sends', title: 'What it sends', say: 'See exactly what goes out, and to whom.', visual: { kind: 'thread', contact: 'Dana Lee', messages: [{ from: 'us', text: 'Just a reminder: we’ll see you tomorrow between 9 and 11.', channel: 'text' }] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/automations/build(/[^/]+)?$',
    film: [
      { id: 'name', say: 'Here you build your own automation.', visual: { kind: 'title', title: 'Build your own', area: 'Automations' } },
      { id: 'blanks', title: 'Fill in the blanks', say: 'It’s one sentence: when it happens, how long after, how it’s sent, who to, and what it says.', visual: { kind: 'form', fields: [
        { label: 'When', value: 'A job is done' },
        { label: 'How long after', value: '2 days' },
        { label: 'Send by', value: 'Text' },
        { label: 'To', value: 'The customer' },
      ], button: 'Turn it on' } },
      { id: 'preview', title: 'Live preview', say: 'Watch the message as your customer will see it.', visual: { kind: 'thread', contact: 'Dana Lee', messages: [{ from: 'us', text: 'Hi Dana, how is everything working since our visit?', channel: 'text' }] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/automations/reminders$',
    film: [
      { id: 'name', say: 'This is Reminders: a job day, drawn as a timeline.', visual: { kind: 'title', title: 'Reminders', area: 'Automations' } },
      { id: 'timeline', title: 'Pins on the day', say: 'Each pin is a reminder, placed at the time it goes out. Customers on top, your crew below.', visual: { kind: 'calendar', days: ['Day before', 'Job day', 'Day after'], visits: [
        { day: 0, slot: 1, label: 'Customer: see you tomorrow', tone: 'blue' },
        { day: 1, slot: 0, label: 'Crew: first job at 9', tone: 'green' },
        { day: 1, slot: 1, label: 'Customer: on the way', tone: 'blue' },
        { day: 2, slot: 1, label: 'Customer: thank you', tone: 'purple' },
      ] } },
      { id: 'change', title: 'Change one', say: 'Pick a pin to change who hears it, when it goes out, and what it says.', visual: { kind: 'thread', contact: 'Dana Lee', messages: [{ from: 'us', text: 'Your tech is on the way!', channel: 'text' }] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/warranty-settings$',
    film: [
      { id: 'name', say: 'This is Warranty settings.', visual: { kind: 'title', title: 'Warranty settings', area: 'Tool Shed' } },
      { id: 'claim', title: 'After a claim', say: 'Decide what happens when a customer makes a warranty claim.', visual: { kind: 'pipeline', stages: ['Claim made', 'Reviewed', 'Visit booked', 'Resolved'], card: 'Warranty claim' } },
      { id: 'soon', title: 'Running out', say: 'And choose how early you hear that a warranty is about to end.', visual: { kind: 'toggles', heading: 'Expiring soon', rows: [{ label: 'Warn me 30 days ahead', on: true }, { label: 'Email the customer', on: false }] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/warranty-settings/expiring$',
    film: [
      { id: 'name', say: 'Here you choose when to hear that a warranty is running out.', visual: { kind: 'title', title: 'Warranty heads-up', area: 'Warranty settings' } },
      { id: 'flag', title: 'A heads-up', say: 'Get notice before a warranty ends, so you can offer the work while it’s still covered.', visual: { kind: 'list', heading: 'Ending soon', rows: [
        { title: 'Dana Lee', meta: 'Installation warranty', chip: '12 days left', tone: 'amber' },
        { title: 'Park Street Cafe', meta: 'Parts warranty', chip: '28 days left', tone: 'amber' },
      ] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/staff$',
    film: [
      { id: 'name', say: 'This is Staff and crews: everyone who works for you.', visual: { kind: 'title', title: 'Staff & crews', area: 'Tool Shed' } },
      { id: 'team', title: 'Your team', say: 'Everyone is in one list, with their role and whether they sign in.', visual: { kind: 'list', heading: 'Your team', rows: [
        { title: 'Alex Morgan', meta: 'Technician', chip: 'Signs in', tone: 'green' },
        { title: 'Priya Shah', meta: 'Office', chip: 'Signs in', tone: 'green' },
        { title: 'Sam Ortiz', meta: 'Helper', chip: 'No sign-in', tone: 'gray' },
      ] } },
      { id: 'person', title: 'One person', say: 'Open someone to set their rules and pay, and see their scorecard and timesheet.', visual: { kind: 'chips', chips: ['Role', 'Field rules', 'Pay', 'Scorecard', 'Timesheet'] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/subcontractors$',
    film: [
      { id: 'name', say: 'This is Subcontractors: the outside companies you send work to.', visual: { kind: 'title', title: 'Subcontractors', area: 'Tool Shed' } },
      { id: 'list', title: 'Their paperwork', say: 'Keep their insurance and paperwork in one place, and see when something runs out.', visual: { kind: 'list', heading: 'Subcontractors', rows: [
        { title: 'Ridgeline Services', meta: 'Insurance current', chip: 'Active', tone: 'green' },
        { title: 'Coastal Crew Co.', meta: 'Insurance ends soon', chip: 'Check', tone: 'amber' },
      ] } },
      { id: 'invite', title: 'Invite them', say: 'Invite them, and they can work your jobs in their own CrewBarn.', visual: { kind: 'thread', contact: 'Ridgeline Services', messages: [{ from: 'us', text: 'We’d like to send you jobs through CrewBarn. Join here.', channel: 'email' }, { from: 'them', text: 'Joined. Ready when you are.', channel: 'email' }] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/hiring$',
    film: [
      { id: 'name', say: 'This is Hiring: find your next great team member.', visual: { kind: 'title', title: 'Hiring', area: 'Tool Shed' } },
      { id: 'post', title: 'Post an opening', say: 'Post an opening, and it shows on your careers page.', visual: { kind: 'form', fields: [{ label: 'Job title', value: 'Field technician' }, { label: 'Type', value: 'Full time' }, { label: 'Pay', value: '$25–32 an hour' }], button: 'Post it' } },
      { id: 'move', title: 'Applied to hired', say: 'Then move each applicant along, from applied to hired.', visual: { kind: 'pipeline', stages: ['Applied', 'Interview', 'Offer', 'Hired'], card: 'Jordan Reyes' } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/roles$',
    film: [
      { id: 'name', say: 'This is Roles and permissions: who can see and change what.', visual: { kind: 'title', title: 'Roles & permissions', area: 'Tool Shed' } },
      { id: 'roles', title: 'Your roles', say: 'Each kind of person gets a role. Give someone a role, and they get exactly that access.', visual: { kind: 'chips', chips: ['Owner', 'Office manager', 'Dispatcher', 'Technician'] } },
      { id: 'access', title: 'Access by area', say: 'Switch access on or off, one area at a time, in plain words.', visual: { kind: 'toggles', heading: 'Technician', rows: [{ label: 'See their own jobs', on: true }, { label: 'Take payments', on: true }, { label: 'See company reports', on: false }, { label: 'Change prices', on: false }] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/security$',
    film: [
      { id: 'name', say: 'This is Security and two-factor, for your own sign-in.', visual: { kind: 'title', title: 'Security & two-factor', area: 'Tool Shed' } },
      { id: 'code', title: 'A code on top', say: 'Add a one-time code on top of your password, and save your recovery codes somewhere safe.', visual: { kind: 'form', fields: [{ label: 'Password', value: '••••••••' }, { label: 'Code', value: '482 913' }], button: 'Sign in' } },
      { id: 'go', say: 'Your company’s rules are here too. Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/time-off$',
    film: [
      { id: 'name', say: 'This is Time off: vacation, sick days and personal time.', visual: { kind: 'title', title: 'Time off', area: 'Tool Shed' } },
      { id: 'requests', title: 'Asked and answered', say: 'Requests come in here, and you approve or deny each one.', visual: { kind: 'list', heading: 'Requests', rows: [
        { title: 'Alex Morgan', meta: 'Vacation · Mon–Wed', chip: 'Waiting', tone: 'amber' },
        { title: 'Priya Shah', meta: 'Sick day · Today', chip: 'Approved', tone: 'green' },
        { title: 'Sam Ortiz', meta: 'Personal · Friday', chip: 'Denied', tone: 'red' },
      ] } },
      { id: 'blocked', title: 'Off the schedule', say: 'Approved time off blocks the schedule, so nobody gets booked while they’re away.', visual: { kind: 'calendar', visits: [
        { day: 0, slot: 0, span: 4, label: 'Alex: vacation', tone: 'gray' },
        { day: 1, slot: 0, span: 4, label: 'Alex: vacation', tone: 'gray' },
        { day: 2, slot: 0, span: 4, label: 'Alex: vacation', tone: 'gray' },
        { day: 3, slot: 1, label: 'Service call', tone: 'blue' },
      ] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/responsibilities$',
    film: [
      { id: 'name', say: 'This is Responsibilities: every part of the office has one owner.', visual: { kind: 'title', title: 'Responsibilities', area: 'Tool Shed' } },
      { id: 'who', title: 'Who has what', say: 'Each area has an owner and a backup.', visual: { kind: 'list', heading: 'Areas', rows: [
        { title: 'Late invoices', meta: 'Priya · backup Jordan', chip: '2 overdue', tone: 'red' },
        { title: 'Unscheduled jobs', meta: 'Jordan · backup Priya', chip: 'All clear', tone: 'green' },
        { title: 'Parts to order', meta: 'Alex', chip: '1 to do', tone: 'amber' },
      ] } },
      { id: 'hourly', title: 'Every hour', say: 'Every hour, what needs doing lands on that person’s to-do list, and comes off once it’s done.', visual: { kind: 'tiles', tiles: [{ label: 'To do', value: 5, tone: 'amber' }, { label: 'Overdue', value: 2, tone: 'red' }, { label: 'Done today', value: 14, tone: 'green' }] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/tool-shed/gps$',
    film: [
      { id: 'name', say: 'This is GPS devices: what puts your crew on the live map.', visual: { kind: 'title', title: 'GPS devices', area: 'Tool Shed' } },
      { id: 'devices', title: 'Your devices', say: 'Plug-in trackers, wired trackers and the phone app, all in one list.', visual: { kind: 'list', heading: 'Devices', rows: [
        { title: 'Van 1 tracker', meta: 'Plug-in', chip: 'Reporting', tone: 'green' },
        { title: 'Alex’s phone', meta: 'Phone app', chip: 'Reporting', tone: 'green' },
        { title: 'Truck 3 tracker', meta: 'Wired', chip: 'Quiet', tone: 'amber' },
      ] } },
      { id: 'map', title: 'On the map', say: 'Test one any time to see it show up on the map.', visual: { kind: 'map', pins: [{ label: 'Van 1', x: 30, y: 40, to: { x: 60, y: 55 }, person: true }, { label: 'Alex', x: 70, y: 25, person: true }] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
]
