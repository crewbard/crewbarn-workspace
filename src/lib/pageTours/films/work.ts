import type { FilmScene } from '../film'
import type { PageFilm } from './types'

/** Intro films for work pages. See ./types.ts and docs/tours/HOW-TO-WRITE-A-PAGE-TOUR.md. */

const go = (say = 'Let’s walk through it.'): FilmScene => ({ id: 'go', say, visual: { kind: 'go' } })

export const WORK_FILMS: PageFilm[] = [
  // ── Dashboard ──
  {
    route: '^/$',
    film: [
      { id: 'name', say: 'This is your Dashboard: your whole day on one screen.', visual: { kind: 'title', title: 'Dashboard', subtitle: 'Your day at a glance' } },
      {
        id: 'numbers', title: 'Today in numbers', say: 'See how today is shaping up, and what’s still waiting for a date, a call back or a bill.',
        visual: { kind: 'tiles', tiles: [
          { label: 'Jobs today', value: 12, tone: 'blue' },
          { label: 'Need a date', value: 3, tone: 'amber' },
          { label: 'Calls to return', value: 2, tone: 'red' },
          { label: 'Ready to invoice', value: 5, tone: 'green' },
        ] },
      },
      {
        id: 'needs', title: 'Needs you', say: 'Anything that’s stuck or running late rises to the top, so you can deal with it first.',
        visual: { kind: 'list', heading: 'Needs attention', rows: [
          { title: 'Repair visit', meta: 'Harbor View Apartments', chip: 'Running late', tone: 'red' },
          { title: 'Estimate', meta: 'Chen residence', chip: 'Waiting on quote', tone: 'amber' },
          { title: 'Service call', meta: 'Park Street Cafe', chip: 'Ready to invoice', tone: 'green' },
        ] },
      },
      { id: 'crew', title: 'Your crew right now', say: 'And see where your crew is and who’s up next, without leaving the page.', visual: { kind: 'map', pins: [
        { label: 'Sam', x: 30, y: 40, person: true, to: { x: 55, y: 30 } },
        { label: 'Alex', x: 70, y: 65, person: true },
        { label: 'Next job', x: 55, y: 30, tone: 'blue' },
      ] } },
      go(),
    ],
  },

  // ── Schedule & dispatch ──
  {
    route: '^/schedule/?$',
    film: [
      { id: 'name', say: 'This is your Schedule, where every job gets a date and a person.', visual: { kind: 'title', title: 'Schedule', subtitle: 'By day, week or person' } },
      {
        id: 'waiting', title: 'Work waiting for a date', say: 'Jobs without a date wait in a list on the left.',
        visual: { kind: 'list', heading: 'To schedule', rows: [
          { title: 'Repair visit', meta: 'Chen residence', chip: 'Emergency', tone: 'red' },
          { title: 'Estimate visit', meta: 'City Library', chip: 'Estimate', tone: 'purple' },
          { title: 'Yearly service', meta: 'Oak Street Office', chip: 'No tech', tone: 'amber' },
        ] },
      },
      {
        id: 'calendar', title: 'Drag it on', say: 'Drag one onto the calendar to book it. It checks for clashes and time off before it does.',
        visual: { kind: 'calendar', visits: [
          { day: 0, slot: 0, label: 'Chen repair', tone: 'red' },
          { day: 1, slot: 1, span: 2, label: 'Library estimate', tone: 'purple' },
          { day: 3, slot: 2, label: 'Oak St service', tone: 'blue' },
        ] },
      },
      {
        id: 'late', title: 'A tech running late', say: 'If a tech may be late, they hear it first, with a pop-up and a phone call. Then the Schedule button flashes for the office.',
        visual: { kind: 'list', heading: 'A tech may be late', rows: [
          { title: 'Repair visit · Sam', meta: 'Chen residence · starts 10:00 · 20 minutes away', chip: 'Call customer', tone: 'red' },
        ] },
      },
      go(),
    ],
  },
  {
    route: '^/dispatch/field-review/?$',
    film: [
      { id: 'name', say: 'This is Field review: the loose ends from today’s work.', visual: { kind: 'title', title: 'Field review', subtitle: 'Check it before it’s billed' } },
      {
        id: 'review', title: 'Visits that need you', say: 'Visits that finished with something missing, like a note or a photo, wait here for you to check.',
        visual: { kind: 'list', heading: 'Needs review', rows: [
          { title: 'Repair visit', meta: 'Chen residence · Sam', chip: 'No notes', tone: 'amber' },
          { title: 'Service call', meta: 'Park Street Cafe · Alex', chip: 'No photos', tone: 'amber' },
        ] },
      },
      { id: 'missed', title: 'Missed check-ins', say: 'Booked jobs nobody checked into show up too, so nothing quietly slips by.', visual: { kind: 'text', headline: 'Booked, but nobody checked in', body: 'Oak Street Office · 10:00' } },
      go(),
    ],
  },
  {
    route: '^/dispatch/route-history/?$',
    film: [
      { id: 'name', say: 'This is Route history: where your crew actually drove.', visual: { kind: 'title', title: 'Route history', subtitle: 'Day by day' } },
      { id: 'who', title: 'Who and which week', say: 'Pick a person and a week.', visual: { kind: 'chips', heading: 'Show me', chips: ['Sam', 'Alex', 'Jordan', 'This week', 'Last week'] } },
      { id: 'map', title: 'Replay a day', say: 'Their stops land on the map, and you can replay any day from start to finish.', visual: { kind: 'map', route: true, pins: [
        { label: 'Shop', x: 15, y: 70 },
        { label: 'Chen residence', x: 40, y: 35, tone: 'blue' },
        { label: 'City Library', x: 75, y: 50, tone: 'blue' },
        { label: 'Sam', x: 15, y: 70, person: true, to: { x: 75, y: 50 } },
      ] } },
      go(),
    ],
  },

  // ── Estimates ──
  {
    route: '^/estimates/?$',
    film: [
      { id: 'name', say: 'This is Estimates: every quote, from first draft to approved.', visual: { kind: 'title', title: 'Estimates', subtitle: 'Quotes and where they stand' } },
      { id: 'stages', title: 'From draft to job', say: 'Each quote moves from draft, to sent, to approved, and then becomes real work.', visual: { kind: 'pipeline', stages: ['Draft', 'Sent', 'Approved', 'Job'], card: 'Chen residence' } },
      {
        id: 'list', title: 'What to do next', say: 'The list shows who to follow up with, and what’s ready to turn into a job.',
        visual: { kind: 'list', heading: 'Your estimates', rows: [
          { title: 'Replace unit', meta: 'Chen residence · $2,450', chip: 'Approved', tone: 'green' },
          { title: 'Repair', meta: 'Park Street Cafe · $680', chip: 'Waiting on customer', tone: 'amber' },
          { title: 'Yearly service', meta: 'Oak Street Office · $1,200', chip: 'Draft', tone: 'gray' },
        ] },
      },
      go(),
    ],
  },
  {
    route: '^/estimates/new/?$',
    film: [
      { id: 'name', say: 'Here you write up a new quote for a customer.', visual: { kind: 'title', title: 'New estimate', subtitle: 'Who, what and how much' } },
      { id: 'who', title: 'Who and what', say: 'Pick the customer and describe the work. Book a walkthrough, or skip it for a quick phone quote.', visual: { kind: 'form', fields: [
        { label: 'Customer', value: 'Chen residence' },
        { label: 'The work', value: 'Repair and replace worn parts' },
        { label: 'Walkthrough', value: 'Tuesday, 10:00' },
      ], button: 'Next' } },
      { id: 'price', title: 'Lines and price', say: 'Add the lines, and the total adds itself up.', visual: { kind: 'money', title: 'Estimate', lines: [
        { label: 'Labor, 3 hours', amount: 285 },
        { label: 'Parts', amount: 140 },
        { label: 'Trip charge', amount: 45 },
      ] } },
      go(),
    ],
  },
  {
    route: '^/estimates/(?!new/?$)[^/]+/?$',
    film: [
      { id: 'name', say: 'This is one estimate, from the price to the customer’s answer.', visual: { kind: 'title', title: 'Estimate', subtitle: 'One quote in full' } },
      { id: 'price', title: 'Work and price', say: 'See the work and the price, and offer good, better and best choices if you like.', visual: { kind: 'money', title: 'Options', lines: [
        { label: 'Good: repair', amount: 450 },
        { label: 'Better: repair and tune-up', amount: 720 },
        { label: 'Best: full replacement', amount: 2450 },
      ] } },
      { id: 'sign', title: 'The customer’s answer', say: 'Send it by email or text. The customer picks an option and signs right on their phone.', visual: { kind: 'signature', doc: 'Estimate', lines: ['Better: repair and tune-up'], total: '$720', signer: 'Lisa Chen', stamp: 'Approved' } },
      { id: 'next', title: 'Next step', say: 'Once it’s approved, turn it into a job with one click.', visual: { kind: 'pipeline', stages: ['Sent', 'Approved', 'Job'], card: 'Chen repair' } },
      go(),
    ],
  },

  // ── Getting paid ──
  {
    route: '^/accounting/invoices/?$',
    film: [
      { id: 'name', say: 'This is Invoices: every bill you’ve sent, and what’s still owed.', visual: { kind: 'title', title: 'Invoices', subtitle: 'From draft to paid' } },
      { id: 'owed', title: 'What’s owed', say: 'See at a glance what’s out there and what’s overdue.', visual: { kind: 'tiles', tiles: [
        { label: 'Owed to you', value: 8420, prefix: '$', tone: 'blue' },
        { label: 'Overdue', value: 1350, prefix: '$', tone: 'red' },
        { label: 'Paid this month', value: 12600, prefix: '$', tone: 'green' },
      ] } },
      {
        id: 'list', title: 'Take a payment', say: 'Find any invoice by status, and take a payment right from the list.',
        visual: { kind: 'list', heading: 'Your invoices', search: 'Chen', rows: [
          { title: 'Invoice 1042', meta: 'Chen residence · $720', chip: 'Sent', tone: 'blue' },
          { title: 'Invoice 1038', meta: 'Chen residence · $310', chip: 'Overdue', tone: 'red' },
          { title: 'Invoice 1031', meta: 'Chen residence · $95', chip: 'Paid', tone: 'green' },
        ] },
      },
      go(),
    ],
  },
  {
    route: '^/invoices/[^/]+/?$',
    film: [
      { id: 'name', say: 'This is one invoice: what it’s for, who it’s to, and getting it paid.', visual: { kind: 'title', title: 'Invoice', subtitle: 'One bill in full' } },
      { id: 'send', title: 'Sending it', say: 'Send it by email or text, with a link to pay online.', visual: { kind: 'thread', contact: 'Lisa Chen', messages: [
        { from: 'us', text: 'Here’s your invoice for today’s visit. You can pay online with the link.', channel: 'email' },
        { from: 'them', text: 'Thanks, paying now!', channel: 'text' },
      ] } },
      { id: 'paid', title: 'Getting paid', say: 'When the money comes in, by card, cash or check, it’s marked paid.', visual: { kind: 'money', title: 'Invoice 1042', lines: [
        { label: 'Repair and tune-up', amount: 650 },
        { label: 'Tax', amount: 70 },
      ], stamp: 'Paid' } },
      go(),
    ],
  },

  // ── Service agreements ──
  {
    route: '^/maintenance-contracts/?$',
    film: [
      { id: 'name', say: 'This is Service agreements: work you’ve agreed to do on a schedule, for a fee.', visual: { kind: 'title', title: 'Service agreements', subtitle: 'Repeat work, booked and billed' } },
      {
        id: 'list', title: 'Your agreements', say: 'Each agreement books its own visits and bills on its own rhythm.',
        visual: { kind: 'list', heading: 'Agreements', rows: [
          { title: 'Quarterly service', meta: 'Oak Street Office', chip: 'Running', tone: 'green' },
          { title: 'Yearly check-up', meta: 'Chen residence', chip: 'Waiting to sign', tone: 'amber' },
          { title: 'Monthly visits', meta: 'Harbor View Apartments', chip: 'Paused', tone: 'gray' },
        ] },
      },
      { id: 'requests', title: 'Plan requests', say: 'When a customer asks for a plan, take it from walkthrough to proposal to signed.', visual: { kind: 'pipeline', stages: ['Request', 'Walkthrough', 'Proposal', 'Signed'], card: 'Park Street Cafe' } },
      go(),
    ],
  },
  {
    route: '^/maintenance-contracts/new/?$',
    film: [
      { id: 'name', say: 'Here you set up work that repeats on a schedule.', visual: { kind: 'title', title: 'New service agreement', subtitle: 'A few quick steps' } },
      { id: 'what', title: 'What and how often', say: 'Pick the customer, what’s covered, and how often you visit.', visual: { kind: 'form', fields: [
        { label: 'Customer', value: 'Oak Street Office' },
        { label: 'What’s covered', value: 'Inspection and upkeep' },
        { label: 'How often', value: 'Every 3 months' },
      ], button: 'Next' } },
      { id: 'visits', title: 'Visits placed for you', say: 'The visits are placed for you and land on the schedule.', visual: { kind: 'calendar', days: ['Jan', 'Apr', 'Jul', 'Oct', 'Jan'], visits: [
        { day: 0, slot: 1, label: 'Visit 1', tone: 'blue' },
        { day: 1, slot: 1, label: 'Visit 2', tone: 'blue' },
        { day: 2, slot: 1, label: 'Visit 3', tone: 'blue' },
        { day: 3, slot: 1, label: 'Visit 4', tone: 'blue' },
      ] } },
      { id: 'money', title: 'The money and the term', say: 'Set the fee and the term, and it bills itself.', visual: { kind: 'money', title: 'Each quarter', lines: [
        { label: 'Quarterly service', amount: 300 },
        { label: 'Priority response', amount: 50 },
      ] } },
      go(),
    ],
  },
  {
    route: '^/maintenance-contracts/(?!new/?$)[^/]+/?$',
    film: [
      { id: 'name', say: 'This is one service agreement, start to finish.', visual: { kind: 'title', title: 'Service agreement', subtitle: 'Visits, coverage and billing' } },
      { id: 'status', title: 'Where it’s at', say: 'See where it stands: sent to sign, running, paused or ended.', visual: { kind: 'pipeline', stages: ['Not started', 'Waiting to sign', 'Running'], card: 'Oak Street Office' } },
      { id: 'coming', title: 'Coming up', say: 'Confirm upcoming visits, and see what equipment it covers.', visual: { kind: 'list', heading: 'Coming up', rows: [
        { title: 'Spring visit', meta: 'April 14', chip: 'Confirm', tone: 'amber' },
        { title: 'Summer visit', meta: 'July 12', chip: 'Planned', tone: 'blue' },
      ] } },
      { id: 'billing', title: 'Billing and history', say: 'And keep track of what it’s billed and what’s been paid.', visual: { kind: 'money', title: 'This year', lines: [
        { label: 'Quarter 1', amount: 350 },
        { label: 'Quarter 2', amount: 350 },
      ], stamp: 'Paid' } },
      go(),
    ],
  },

  // ── Customers ──
  {
    route: '^/customers/new/?$',
    film: [
      { id: 'name', say: 'Here you add a new customer, once, a short part at a time.', visual: { kind: 'title', title: 'New customer', subtitle: 'Only the name is required' } },
      { id: 'parts', title: 'One part at a time', say: 'Work through the tabs, or put every part on one page if you’d rather.', visual: { kind: 'chips', heading: 'New customer', chips: ['Account', 'Contacts', 'Locations', 'Billing & notes', 'Review'] } },
      { id: 'form', title: 'Who and where', say: 'Add their name, the people to reach, and the places where you’ll work, then check it all on Review.', visual: { kind: 'form', fields: [
        { label: 'Name', value: 'Harbor View Apartments' },
        { label: 'Contact', value: 'Maria Lopez, manager' },
        { label: 'Service location', value: '400 Harbor Road' },
        { label: 'Payment terms', value: 'Due in 30 days' },
      ], button: 'Create customer' } },
      { id: 'account', title: 'One account', say: 'It all lands on one account, ready for jobs, quotes and bills.', visual: { kind: 'account', name: 'Harbor View Apartments', type: 'Business', places: ['400 Harbor Road', 'Building B'], people: ['Maria Lopez', 'Tom Reed'] } },
      go(),
    ],
  },

  // ── Assets ──
  {
    route: '^/assets(/.*)?$',
    film: [
      { id: 'name', say: 'This is Assets: the equipment you look after for your customers.', visual: { kind: 'title', title: 'Assets', subtitle: 'Equipment and its history' } },
      { id: 'list', title: 'Your equipment', say: 'Find any piece by customer or place, and see if it’s on a service plan.', visual: { kind: 'list', heading: 'Equipment', search: 'Oak', rows: [
        { title: 'Main unit', meta: 'Oak Street Office · Roof', chip: 'Covered by plan', tone: 'green' },
        { title: 'Back-up unit', meta: 'Oak Street Office · Basement', chip: 'Not on a plan', tone: 'amber' },
      ] } },
      { id: 'history', title: 'Service history', say: 'Open one for its photos, documents and every visit it’s had.', visual: { kind: 'account', name: 'Main unit', type: 'Oak Street Office', jobs: [
        { title: 'Yearly service', meta: 'March', chip: 'Done', tone: 'green' },
        { title: 'Repair', meta: 'June', chip: 'Done', tone: 'green' },
      ] } },
      go(),
    ],
  },

  // ── Tasks ──
  {
    route: '^/tasks/?$',
    film: [
      { id: 'name', say: 'This is Tasks: everyone’s to-dos and follow-ups.', visual: { kind: 'title', title: 'Tasks', subtitle: 'Your team’s to-do list' } },
      { id: 'kinds', title: 'Tie it to anything', say: 'A task can stand alone, or hang off a job or a customer.', visual: { kind: 'chips', heading: 'A task can be about', chips: ['A job', 'A customer', 'A follow-up call', 'Nothing in particular'] } },
      { id: 'list', title: 'Open, done or yours', say: 'Filter to what’s open, what’s done, or just yours, and spot the late ones.', visual: { kind: 'list', heading: 'Open tasks', rows: [
        { title: 'Call back about quote', meta: 'Chen residence · Alex', chip: 'Today', tone: 'blue' },
        { title: 'Order replacement part', meta: 'Repair visit · Sam', chip: 'Late', tone: 'red' },
        { title: 'Send yearly reminder', meta: 'Oak Street Office', chip: 'Done', tone: 'green' },
      ] } },
      go(),
    ],
  },

  // ── Warranties ──
  {
    route: '^/warranties/?$',
    film: [
      { id: 'name', say: 'This is Warranties: the work you’ve stood behind.', visual: { kind: 'title', title: 'Warranties', subtitle: 'What’s covered, and until when' } },
      { id: 'auto', title: 'Written for you', say: 'A warranty is written for you each time an invoice goes out.', visual: { kind: 'text', headline: 'Invoice sent, warranty written', body: 'Parts and labor, covered automatically' } },
      { id: 'list', title: 'When it runs out', say: 'Look up any customer’s coverage and see when each one runs out.', visual: { kind: 'list', heading: 'Your warranties', search: 'Chen', rows: [
        { title: 'Labor, 1 year', meta: 'Chen residence', chip: 'Ends in 2 months', tone: 'amber' },
        { title: 'Parts, 2 years', meta: 'Chen residence', chip: 'Active', tone: 'green' },
      ] } },
      go(),
    ],
  },

  // ── Subcontracting ──
  {
    route: '^/inbound-sub-jobs/?$',
    film: [
      { id: 'name', say: 'These are jobs other companies have sent you to do for them.', visual: { kind: 'title', title: 'Inbound sub jobs', subtitle: 'Work sent to you' } },
      { id: 'waiting', title: 'Waiting for you', say: 'Look over each one before you say yes.', visual: { kind: 'list', heading: 'Sent to you', rows: [
        { title: 'Service call', meta: 'From Northside Services · Tuesday', chip: 'New', tone: 'amber' },
        { title: 'Install', meta: 'From Bay Area Pros · Friday', chip: 'New', tone: 'amber' },
      ] } },
      { id: 'accept', title: 'Accept or decline', say: 'Accept one and it becomes one of your own jobs.', visual: { kind: 'pipeline', stages: ['Sent to you', 'Accepted', 'Your job'], card: 'Service call' } },
      go(),
    ],
  },
  {
    route: '^/sub-reviews/?$',
    film: [
      { id: 'name', say: 'This is Sub reviews: decisions your subcontractors are waiting on.', visual: { kind: 'title', title: 'Sub reviews', subtitle: 'Waiting on you' } },
      { id: 'requests', title: 'Requests to spend more', say: 'When a sub needs to go over the agreed amount, they ask here first.', visual: { kind: 'list', heading: 'Requests', rows: [
        { title: 'Extra part needed', meta: 'Riverside Crew · +$180', chip: 'Waiting', tone: 'amber' },
        { title: 'Two more hours', meta: 'Metro Techs · +$150', chip: 'Waiting', tone: 'amber' },
      ] } },
      { id: 'invoice', title: 'Sub invoices', say: 'Their invoices land here too, to approve, pay or decline.', visual: { kind: 'money', title: 'Riverside Crew', lines: [
        { label: 'Labor', amount: 400 },
        { label: 'Parts', amount: 180 },
      ], stamp: 'Approved' } },
      go(),
    ],
  },
  {
    route: '^/sub-payouts/?$',
    film: [
      { id: 'name', say: 'This is Sub payouts: what you’ve paid your subs, and what you still owe.', visual: { kind: 'title', title: 'Sub payouts', subtitle: 'Paid and owed' } },
      { id: 'totals', title: 'Paid and owed', say: 'The totals come first.', visual: { kind: 'tiles', tiles: [
        { label: 'Paid this year', value: 18400, prefix: '$', tone: 'green' },
        { label: 'Still owed', value: 2150, prefix: '$', tone: 'amber' },
      ] } },
      { id: 'bysub', title: 'By subcontractor', say: 'Then break it down by each sub, by month, or invoice by invoice.', visual: { kind: 'list', heading: 'By subcontractor', rows: [
        { title: 'Riverside Crew', meta: '12 jobs', chip: '$1,400 owed', tone: 'amber' },
        { title: 'Metro Techs', meta: '8 jobs', chip: 'All paid', tone: 'green' },
      ] } },
      go(),
    ],
  },

  // ── Calls & intake ──
  {
    route: '^/calls/?$',
    film: [
      { id: 'name', say: 'This is Calls: every call and voicemail nobody has dealt with yet.', visual: { kind: 'title', title: 'Calls', subtitle: 'So none slip through' } },
      { id: 'count', title: 'How many are waiting', say: 'The count shows how many are still waiting on someone.', visual: { kind: 'tiles', tiles: [
        { label: 'Waiting', value: 4, tone: 'red' },
        { label: 'Called back today', value: 9, tone: 'green' },
      ] } },
      { id: 'call', title: 'One call', say: 'Read what was said, call them back, then mark it reviewed.', visual: { kind: 'thread', contact: 'Lisa Chen', messages: [
        { from: 'them', text: 'Voicemail: Hi, it’s Lisa. Something stopped working again, can someone come out this week?', channel: 'call' },
        { from: 'us', text: 'Called back. Booked for Thursday morning.', channel: 'call' },
      ] } },
      go(),
    ],
  },
  {
    route: '^/intake/?$',
    film: [
      { id: 'name', say: 'This is Intake: new requests from calls and texts, already sorted out for you.', visual: { kind: 'title', title: 'Intake', subtitle: 'Requests, ready to check' } },
      { id: 'msg', title: 'A request comes in', say: 'A customer calls or texts in their own words.', visual: { kind: 'thread', contact: 'Maria Lopez', messages: [
        { from: 'them', text: 'Hi, the one in Building B is acting up again. Can you send someone tomorrow?', channel: 'text' },
      ] } },
      { id: 'draft', title: 'What was found', say: 'It’s pulled apart into who, where and what, ready for you to check.', visual: { kind: 'form', fields: [
        { label: 'Customer', value: 'Harbor View Apartments' },
        { label: 'Where', value: 'Building B' },
        { label: 'What', value: 'Repair visit' },
        { label: 'When', value: 'Tomorrow' },
      ], button: 'Create job' } },
      { id: 'create', title: 'Create or dismiss', say: 'Turn it into a job or an estimate, or dismiss it.', visual: { kind: 'pipeline', stages: ['Draft', 'Checked', 'Job'], card: 'Harbor View repair' } },
      go(),
    ],
  },

  // ── Inventory & ordering ──
  {
    route: '^/inventory(/(movements|reconciliations|units))?/?$',
    film: [
      { id: 'name', say: 'This is Inventory: where your stock lives and how much is in each spot.', visual: { kind: 'title', title: 'Inventory', subtitle: 'Stock, places and movements' } },
      { id: 'levels', title: 'Stock levels', say: 'Your shop, shelves and vans each have their own count.', visual: { kind: 'list', heading: 'Stock levels', search: 'filter', rows: [
        { title: 'Filters, standard', meta: 'Shop · Shelf A2', chip: '24 on hand', tone: 'green' },
        { title: 'Filters, standard', meta: 'Van 3', chip: '2 on hand', tone: 'amber' },
        { title: 'Fittings, small', meta: 'Van 1', chip: 'Out', tone: 'red' },
      ] } },
      { id: 'moves', title: 'Who did what', say: 'Every move is kept with the name of the person who made it.', visual: { kind: 'list', heading: 'Movements', rows: [
        { title: 'Moved 6 filters', meta: 'Shop to Van 3 · Sam', chip: 'Transfer', tone: 'blue' },
        { title: 'Used 1 fitting', meta: 'Chen repair · Alex', chip: 'Used on job', tone: 'purple' },
      ] } },
      { id: 'rules', title: 'Stock rules', say: 'And set the rules for how your team takes and tracks stock.', visual: { kind: 'toggles', heading: 'Stock rules', rows: [
        { label: 'Require a bin', on: true },
        { label: 'Restock vans to par', on: true },
        { label: 'Order low stock automatically' },
      ] } },
      go(),
    ],
  },
  {
    route: '^/purchase-orders/new/?$',
    film: [
      { id: 'name', say: 'Here you start a new order to a supplier.', visual: { kind: 'title', title: 'New purchase order', subtitle: 'The top of the order' } },
      { id: 'form', title: 'Vendor and dates', say: 'Pick the supplier, add their order number and when you expect it.', visual: { kind: 'form', fields: [
        { label: 'Vendor', value: 'City Supply Co.' },
        { label: 'Their order number', value: 'CS-20931' },
        { label: 'Expected', value: 'Friday' },
        { label: 'Shipping', value: '$25.00' },
      ], button: 'Create' } },
      { id: 'next', title: 'Then the lines', say: 'You’ll add what you’re ordering on the next screen.', visual: { kind: 'text', headline: 'Next: add what you’re ordering' } },
      go(),
    ],
  },
  {
    route: '^/purchase-orders/needs-ordered/?$',
    film: [
      { id: 'name', say: 'This is everything that’s running low.', visual: { kind: 'title', title: 'Needs ordering', subtitle: 'Below the reorder point' } },
      { id: 'low', title: 'What’s low', say: 'Anything that’s dropped to its reorder point shows up here.', visual: { kind: 'list', heading: 'Running low', rows: [
        { title: 'Filters, standard', meta: '4 left · reorder at 10', chip: 'Low', tone: 'amber' },
        { title: 'Fittings, small', meta: '0 left · reorder at 20', chip: 'Out', tone: 'red' },
      ] } },
      { id: 'detail', title: 'Know which one', say: 'Each one shows its picture, its part numbers, and where it is: the shop, each truck, and the bin.', visual: { kind: 'list', heading: 'Running low', rows: [
        { title: 'Filters, standard', meta: 'SKU F-16 · City Supply # 40112 · Shop 4 (A-2) · Van 2 0', chip: 'Low', tone: 'amber' },
        { title: 'Fittings, small', meta: 'SKU FT-3 · Part # 3/8-C · Shop 0 · Van 1 2', chip: '1 job waiting', tone: 'red' },
      ] } },
      { id: 'cart', title: 'Order it', say: 'Pick how many, then send it to your parts cart or straight to one order.', visual: { kind: 'cart', items: [
        { name: 'Filters, standard', qty: 20 },
        { name: 'Fittings, small', qty: 50 },
      ], supplier: 'City Supply Co.', order: 'Draft order' } },
      go(),
    ],
  },
  {
    route: '^/purchase-orders/(?!new/?$|needs-ordered/?$)[^/]+/?$',
    film: [
      { id: 'name', say: 'This is one order to a supplier.', visual: { kind: 'title', title: 'Purchase order', subtitle: 'From draft to received' } },
      { id: 'lines', title: 'What’s on it', say: 'See who it’s going to and what’s on it, and add lines from what’s low.', visual: { kind: 'cart', items: [
        { name: 'Filters, standard', qty: 20 },
        { name: 'Fittings, small', qty: 50, job: 'Chen repair' },
      ], supplier: 'City Supply Co.', order: 'PO 318' } },
      { id: 'receive', title: 'Receive the delivery', say: 'When it arrives, receive it, and the stock lands on your shelves.', visual: { kind: 'pipeline', stages: ['Draft', 'Ordered', 'Received'], card: 'PO 318' } },
      go(),
    ],
  },
  {
    route: '^/purchase-orders/?$',
    film: [
      { id: 'name', say: 'This is Purchase orders: every order to your suppliers.', visual: { kind: 'title', title: 'Purchase orders', subtitle: 'From draft to delivered' } },
      { id: 'stages', title: 'Draft to delivered', say: 'An order goes from draft, to ordered, to received. Receiving it puts the stock on your shelves.', visual: { kind: 'pipeline', stages: ['Draft', 'Ordered', 'Received'], card: 'PO 318' } },
      { id: 'list', title: 'Your orders', say: 'Find any order by supplier or status, or start a new one.', visual: { kind: 'list', heading: 'Your orders', rows: [
        { title: 'PO 318', meta: 'City Supply Co. · $640', chip: 'Ordered', tone: 'blue' },
        { title: 'PO 317', meta: 'Metro Parts · $210', chip: 'Part received', tone: 'amber' },
        { title: 'PO 316', meta: 'City Supply Co. · $1,120', chip: 'Received', tone: 'green' },
      ] } },
      go(),
    ],
  },
  {
    route: '^/vendors/?$',
    film: [
      { id: 'name', say: 'This is Vendors: the suppliers you buy from.', visual: { kind: 'title', title: 'Vendors', subtitle: 'Who you buy from' } },
      { id: 'list', title: 'Your vendors', say: 'Each one keeps their contact details and the parts you buy there.', visual: { kind: 'list', heading: 'Your vendors', rows: [
        { title: 'City Supply Co.', meta: 'Main counter · 42 parts', chip: 'Active', tone: 'green' },
        { title: 'Metro Parts', meta: 'Online orders · 18 parts', chip: 'Active', tone: 'green' },
      ] } },
      { id: 'terms', title: 'Account and terms', say: 'Keep your account number, discount and terms in one place.', visual: { kind: 'form', fields: [
        { label: 'Account number', value: '88-1042' },
        { label: 'Your discount', value: '15%' },
        { label: 'Terms', value: 'Due in 30 days' },
      ], button: 'Save' } },
      go(),
    ],
  },

  // ── Catalogs ──
  {
    route: '^/catalogs/?$',
    film: [
      { id: 'name', say: 'This is Catalogs: your price books and manuals, read like the printed copy.', visual: { kind: 'title', title: 'Catalogs', subtitle: 'Your shelf of books' } },
      { id: 'shelf', title: 'Your shelf', say: 'Upload one and it sits on your shelf, ready to open.', visual: { kind: 'list', heading: 'Your shelf', rows: [
        { title: 'Supplier price book', meta: '320 pages', chip: 'Shared', tone: 'blue' },
        { title: 'Install manual', meta: '84 pages', chip: 'Team only', tone: 'gray' },
      ] } },
      { id: 'do', title: 'Use what’s in it', say: 'Share it with customers, order from the page, or make reference cards from the parts in it.', visual: { kind: 'chips', heading: 'From any page', chips: ['Share with customers', 'Order parts', 'Make reference cards', 'Find a part number'] } },
      go(),
    ],
  },
  {
    route: '^/catalog/services/?$',
    film: [
      { id: 'name', say: 'This is your Service catalog: the work you charge for.', visual: { kind: 'title', title: 'Service catalog', subtitle: 'Labor, trips and more' } },
      { id: 'list', title: 'Your services', say: 'Labor, trip charges, inspections, each with its own price.', visual: { kind: 'list', heading: 'Your services', rows: [
        { title: 'Labor, per hour', meta: 'Repairs', chip: '$95', tone: 'blue' },
        { title: 'Trip charge', meta: 'Fees', chip: '$45', tone: 'blue' },
        { title: 'Yearly inspection', meta: 'Maintenance', chip: '$150', tone: 'blue' },
      ] } },
      { id: 'fills', title: 'Prices fill themselves in', say: 'Pick them onto an estimate, job or invoice, and the price fills itself in.', visual: { kind: 'money', title: 'Invoice', lines: [
        { label: 'Labor, 2 hours', amount: 190 },
        { label: 'Trip charge', amount: 45 },
      ] } },
      go(),
    ],
  },
  {
    route: '^/catalog/products/?$',
    film: [
      { id: 'name', say: 'This is your Product catalog: the parts, equipment and materials you sell or use.', visual: { kind: 'title', title: 'Product catalog', subtitle: 'Parts, equipment, materials' } },
      { id: 'cats', title: 'Shop by category', say: 'Browse by category, like a store.', visual: { kind: 'chips', heading: 'Categories', chips: ['Parts', 'Equipment', 'Materials', 'Tools'] } },
      { id: 'list', title: 'Cost, price and stock', say: 'Each one shows what it costs you, what you charge, and how many you have.', visual: { kind: 'list', heading: 'Parts', rows: [
        { title: 'Filter, standard', meta: 'Cost $6 · Price $18', chip: '24 in stock', tone: 'green' },
        { title: 'Control board', meta: 'Cost $90 · Price $210', chip: '1 in stock', tone: 'amber' },
      ] } },
      { id: 'cart', title: 'Add to parts cart', say: 'Running low? Add it straight to your parts cart.', visual: { kind: 'cart', items: [{ name: 'Control board', qty: 3 }], supplier: 'City Supply Co.' } },
      go(),
    ],
  },
  {
    route: '^/catalog/categories/?$',
    film: [
      { id: 'name', say: 'These are your service categories.', visual: { kind: 'title', title: 'Service categories', subtitle: 'Groups for your services' } },
      { id: 'why', title: 'Find the right service fast', say: 'Group your services, like Repairs or Maintenance, so your team finds the right one fast.', visual: { kind: 'chips', heading: 'Your groups', chips: ['Repairs', 'Maintenance', 'Installs', 'Fees'] } },
      { id: 'list', title: 'Groups inside groups', say: 'A group can sit inside another, and you can retire one you no longer use.', visual: { kind: 'list', heading: 'Categories', rows: [
        { title: 'Repairs', meta: 'Top level', chip: 'Active', tone: 'green' },
        { title: 'Emergency repairs', meta: 'Inside Repairs', chip: 'Active', tone: 'green' },
        { title: 'Old specials', meta: 'Top level', chip: 'Retired', tone: 'gray' },
      ] } },
      go(),
    ],
  },
  {
    route: '^/catalog/product-categories/?$',
    film: [
      { id: 'name', say: 'These are your product categories.', visual: { kind: 'title', title: 'Product categories', subtitle: 'Groups for your products' } },
      { id: 'tiles', title: 'Tiles in the catalog', say: 'Each one becomes a tile on your product catalog, with its own photo.', visual: { kind: 'chips', heading: 'Catalog tiles', chips: ['Parts', 'Equipment', 'Materials', 'Tools'] } },
      { id: 'list', title: 'Your categories', say: 'Add new ones, nest them, or retire one you no longer use.', visual: { kind: 'list', heading: 'Categories', rows: [
        { title: 'Parts', meta: 'Top level', chip: 'Active', tone: 'green' },
        { title: 'Filters', meta: 'Inside Parts', chip: 'Active', tone: 'green' },
      ] } },
      go(),
    ],
  },
  {
    route: '^/catalog/tax-classes/?$',
    film: [
      { id: 'name', say: 'These are your tax classes: the tax rates your lines carry.', visual: { kind: 'title', title: 'Tax classes', subtitle: 'Rates, in parts' } },
      { id: 'parts', title: 'Made of parts', say: 'Each rate is made of parts, like state and county, so your tax report splits them for you.', visual: { kind: 'chips', heading: 'Standard rate: 7%', chips: ['State 6%', 'County 1%'] } },
      { id: 'zip', title: 'Fill it from a ZIP', say: 'Adding one? Type a ZIP code and the parts fill in.', visual: { kind: 'form', fields: [
        { label: 'ZIP code', value: '12345' },
        { label: 'Name', value: 'Standard rate' },
        { label: 'Total rate', value: '7%' },
      ], button: 'Create tax class' } },
      go(),
    ],
  },
  {
    route: '^/reference-cards/?$',
    film: [
      { id: 'name', say: 'These are Reference cards: what your shop knows, written down once.', visual: { kind: 'title', title: 'Reference cards', subtitle: 'Your shop’s know-how' } },
      { id: 'pop', title: 'It pops up for you', say: 'Pick the words and part numbers that open a card, and it pops up wherever they appear.', visual: { kind: 'text', headline: '“Control board” mentioned', body: 'The card pops up, with the catalog page it’s on' } },
      { id: 'list', title: 'Your cards', say: 'Each card holds the tips, part numbers, pictures and who sells it.', visual: { kind: 'list', heading: 'Your cards', rows: [
        { title: 'Control board swap', meta: 'Part 4471 · page 112', chip: 'Shared', tone: 'blue' },
        { title: 'Resetting a unit', meta: 'Install manual · page 18', chip: 'Team', tone: 'gray' },
      ] } },
      { id: 'cart', title: 'The parts cart', say: 'Need the part? Add it to your cart right from the card.', visual: { kind: 'cart', items: [{ name: 'Control board 4471', qty: 1, job: 'Chen repair' }], supplier: 'City Supply Co.' } },
      go(),
    ],
  },

  // ── Documents ──
  {
    route: '^/custom-documents/new-form/?$',
    film: [
      { id: 'name', say: 'Here you build a printable form, like an inspection or a checklist.', visual: { kind: 'title', title: 'Make a form', subtitle: 'Four quick steps' } },
      { id: 'start', title: 'Start from one you know', say: 'Start from a form you already know.', visual: { kind: 'chips', heading: 'Start from', chips: ['Inspection', 'Checklist', 'Work order', 'Sign-off sheet'] } },
      { id: 'fields', title: 'Choose what goes on it', say: 'Choose the fields, the colour and the name, and the preview shows the page as you go.', visual: { kind: 'form', fields: [
        { label: 'Customer', value: 'Filled in from the job' },
        { label: 'Checked items', value: '12 checkboxes' },
        { label: 'Signature', value: 'Customer signs here' },
      ], button: 'Build it' } },
      go(),
    ],
  },
  {
    route: '^/custom-documents/?$',
    film: [
      { id: 'name', say: 'This is Templates and forms: everything you send, print or get signed.', visual: { kind: 'title', title: 'Templates & forms', subtitle: 'In the order your jobs happen' } },
      { id: 'order', title: 'In job order', say: 'They’re laid out in the order a job happens, from the first reminder to the final bill.', visual: { kind: 'pipeline', stages: ['Booked', 'Reminder', 'On the way', 'Invoice', 'Thank you'], card: 'Chen repair' } },
      { id: 'channels', title: 'What the customer gets', say: 'See each one by email, text or print, and preview it with a real job.', visual: { kind: 'thread', contact: 'Lisa Chen', messages: [
        { from: 'us', text: 'Reminder: we’ll see you tomorrow between 9 and 11.', channel: 'text' },
        { from: 'us', text: 'Sam is on the way and should be there in 20 minutes.', channel: 'text' },
      ] } },
      go(),
    ],
  },

  // ── Your own gear ──
  {
    route: '^/company-assets/?$',
    film: [
      { id: 'name', say: 'These are your company assets: the tools, vehicles and devices you own.', visual: { kind: 'title', title: 'Company assets', subtitle: 'Your own gear' } },
      { id: 'list', title: 'The list', say: 'Note what each one can do, so the right person goes out with the right gear.', visual: { kind: 'list', heading: 'Your gear', rows: [
        { title: 'Van 3', meta: 'Vehicle · with Sam', chip: 'In use', tone: 'blue' },
        { title: 'Camera scope', meta: 'Tool · shop', chip: 'Available', tone: 'green' },
        { title: 'Tablet 2', meta: 'Device · with Alex', chip: 'In use', tone: 'blue' },
      ] } },
      { id: 'cost', title: 'What it costs you', say: 'And see what your gear costs you each month.', visual: { kind: 'tiles', tiles: [
        { label: 'Vehicles', value: 1850, prefix: '$', suffix: '/mo' },
        { label: 'Tools', value: 240, prefix: '$', suffix: '/mo' },
        { label: 'Software', value: 120, prefix: '$', suffix: '/mo' },
      ] } },
      go(),
    ],
  },
  {
    route: '^/asset-types/?$',
    film: [
      { id: 'name', say: 'These are your asset types: the kinds of equipment you look after.', visual: { kind: 'title', title: 'Asset types', subtitle: 'What you look after' } },
      { id: 'list', title: 'Your types', say: 'Each type has its own icon and how often it’s inspected.', visual: { kind: 'list', heading: 'Your types', rows: [
        { title: 'Main unit', meta: 'Inspect every 12 months', chip: '48 on file', tone: 'blue' },
        { title: 'Back-up unit', meta: 'Inspect every 6 months', chip: '12 on file', tone: 'blue' },
      ] } },
      { id: 'fields', title: 'Extra fields', say: 'Add the details you want recorded for each kind.', visual: { kind: 'form', fields: [
        { label: 'Model number', value: 'Text' },
        { label: 'Installed on', value: 'Date' },
        { label: 'Size', value: 'Number' },
      ], button: 'Save type' } },
      go(),
    ],
  },
  {
    route: '^/asset-access-requests/?$',
    film: [
      { id: 'name', say: 'This is where requests to see secured equipment come in.', visual: { kind: 'title', title: 'Access requests', subtitle: 'Approve or deny' } },
      { id: 'list', title: 'Waiting for you', say: 'When someone scans a secured piece of equipment and asks to see it, the request lands here.', visual: { kind: 'list', heading: 'Requests', rows: [
        { title: 'Main unit, roof', meta: 'Asked by Tom Reed', chip: 'Pending', tone: 'amber' },
        { title: 'Back-up unit', meta: 'Asked by Maria Lopez', chip: 'Approved', tone: 'green' },
      ] } },
      { id: 'approve', title: 'Approve or deny', say: 'Approve it and they get an access code. Deny it and they don’t.', visual: { kind: 'pipeline', stages: ['Pending', 'Approved', 'Code sent'], card: 'Tom Reed' } },
      go(),
    ],
  },

  // ── Your business ──
  {
    route: '^/website-builder/?$',
    film: [
      { id: 'name', say: 'This is your website workshop.', visual: { kind: 'title', title: 'Website', subtitle: 'Written for you, online when you say' } },
      { id: 'questions', title: 'A few quick questions', say: 'Answer a few questions about your business, and your website gets written for you.', visual: { kind: 'form', fields: [
        { label: 'What you do', value: 'Repairs and installs' },
        { label: 'Towns you serve', value: 'Riverside, Oakdale' },
        { label: 'Your colour', value: 'Blue' },
      ], button: 'Write my website' } },
      { id: 'steps', title: 'Four steps', say: 'Pick a look, change any word, then put it online when you’re ready.', visual: { kind: 'pipeline', stages: ['Questions', 'Writing', 'Look', 'Online'], card: 'Your website' } },
      { id: 'live', title: 'Nothing goes public until you say', say: 'Nothing goes public until you switch it on.', visual: { kind: 'toggles', heading: 'Going live', rows: [{ label: 'Put it online', on: true }] } },
      { id: 'google', title: 'Found on Google', say: 'Then get it listed on Google. Paste the code Google gives you, and CrewBarn adds it to your domain.', visual: { kind: 'pipeline', stages: ['Your domain', 'Cloudflare', 'CrewBarn', 'Google'], card: 'Your website' } },
      go(),
    ],
  },
  {
    route: '^/onboarding/?$',
    film: [
      { id: 'name', say: 'This is Guided setup: your step-by-step checklist for getting going.', visual: { kind: 'title', title: 'Guided setup', subtitle: 'One step at a time' } },
      { id: 'steps', title: 'The steps', say: 'One decision at a time, from your starter pack to inviting your crew.', visual: { kind: 'pipeline', stages: ['Your business', 'Starter pack', 'Prices', 'Your crew', 'Ready'], card: 'You are here', stopAt: 1 } },
      { id: 'pack', title: 'Your starter pack', say: 'A starter pack fills in services, job types and templates for your kind of work.', visual: { kind: 'toggles', heading: 'Starter pack adds', rows: [
        { label: 'Common services', on: true },
        { label: 'Job types', on: true },
        { label: 'Message templates', on: true },
      ] } },
      go(),
    ],
  },
  {
    route: '^/franchise-support/?$',
    film: [
      { id: 'name', say: 'This is Franchise access: you decide when your franchisor can step in to help.', visual: { kind: 'title', title: 'Franchise access', subtitle: 'Help, on your terms' } },
      { id: 'requests', title: 'Requests to help', say: 'When they ask to step into your account, you say yes or no, and for how long.', visual: { kind: 'list', heading: 'Requests', rows: [
        { title: 'Help with your setup', meta: 'For 2 days', chip: 'Waiting', tone: 'amber' },
        { title: 'Review your prices', meta: 'For 1 day', chip: 'Ended', tone: 'gray' },
      ] } },
      { id: 'active', title: 'Who has access now', say: 'Everything they do is recorded, and you can end it any time.', visual: { kind: 'toggles', heading: 'Access now', rows: [{ label: 'Franchise support can help', on: true }] } },
      go(),
    ],
  },
]
