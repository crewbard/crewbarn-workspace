import type { TutorialData } from './types'

/**
 * Service agreements (maintenance contracts), start to finish: the list,
 * the New service agreement flow, an agreement's own page, where agreements
 * show up elsewhere, and their setup and settings.
 *
 * Kept import-free (types aside) so the voice exporter can load it on its
 * own. Nothing here saves, sends, starts, pauses or signs anything: the
 * walk stops before every button that would.
 */

const t = (id: string) => '[data-tour=' + JSON.stringify(id) + ']'

const LIST = '^/maintenance-contracts/?$'
const NEW = '^/maintenance-contracts/new/?$'
const DETAIL = '^/maintenance-contracts/(?!new/?$)[^/]+/?$'
const SETUP = '^/tool-shed/service-agreements/?$'
const INVOICES = '^/tool-shed/preferences/contract-invoices/?$'

export const TUTORIAL: TutorialData = {
  id: 'contracts',
  kicker: 'Service agreements · tutorial',
  title: 'Service agreements, start to finish',

  film: [
    {
      id: 'idea',
      label: 'The idea',
      title: 'Work you’ve agreed to do on a schedule',
      narration:
        'A service agreement is work you’ve agreed to do on a schedule, for a fee. Set it up once, and CrewBarn places the visit dates, puts each one on the board as a job, and invoices the fee every period.',
    },
    {
      id: 'services',
      label: 'Services',
      title: 'One agreement, as many services as you like',
      narration:
        'One agreement can cover more than one kind of work. A tune-up every three months and lawn care every week is one agreement with two services, and each service has its own rhythm.',
    },
    {
      id: 'year',
      label: 'Seasons',
      title: 'Different for part of the year',
      narration:
        'A rhythm can change with the seasons. Lawn care every week, but every two weeks from November to March. CrewBarn draws the year across twelve months, so a gap or an overlap jumps right out.',
    },
    {
      id: 'money',
      label: 'The money',
      title: 'The fee covers the visits',
      narration:
        'You set one fee, billed every week, month or year. The visits are covered by it, so they’re never invoiced one by one. Before you save, a summary counts the jobs and what gets billed in the first year.',
    },
    {
      id: 'sign',
      label: 'Signing',
      title: 'Nothing runs until it starts',
      narration:
        'Attach the contract the customer signs, or have one drafted. Send it to sign, or record a paper signature. Until it’s signed or started, an agreement books nothing and bills nothing.',
    },
    {
      id: 'running',
      label: 'Running',
      title: 'Once it’s running, it looks after itself',
      narration:
        'A running agreement places every visit date. Fourteen days before each one, it lands on the board as a real job, marked as covered. And each billing period, it raises its own invoice.',
    },
    {
      id: 'where',
      label: 'Where it shows up',
      title: 'Agreements reach all over CrewBarn',
      narration:
        'You’ll see agreements on the Jobs board, on each covered job, on Invoices, and on the customer’s record. Renewal reminders go to whoever looks after it. And customers can ask for a plan from their portal.',
    },
    {
      id: 'yourturn',
      label: 'Your turn',
      title: 'Now let’s do it for real',
      narration:
        'That’s the idea. Now let’s do it for real, right on the page. I’ll step back into the corner and point at each part. When it’s your turn, you click. If you’d rather watch, press Do it for me.',
    },
  ],

  chapters: [
    { key: 'list', label: 'The list' },
    { key: 'customer', label: 'New: who it’s for' },
    { key: 'services', label: 'What’s covered' },
    { key: 'money', label: 'Price and term' },
    { key: 'paperwork', label: 'Contract and send' },
    { key: 'detail', label: 'An agreement’s page' },
    { key: 'tabs', label: 'Visits, billing, history' },
    { key: 'used', label: 'Where it shows up' },
    { key: 'setup', label: 'Setup and settings' },
  ],

  steps: [
    // ---------- The list ----------
    {
      id: 'list-header', chapter: 'list', route: LIST, open: 'goto:/maintenance-contracts',
      click: t('contracts-tab-agreements'), selector: t('contracts-header'),
      title: 'Service agreements',
      say: 'Here’s where your service agreements live. Each one is work you’ve agreed to do on a schedule, and each one books its own visits and bills on its own.',
    },
    {
      id: 'list-new', chapter: 'list', route: LIST, selector: t('contracts-new'),
      title: 'New service agreement',
      say: 'New service agreement starts one. We’ll make one together in a minute.',
    },
    {
      id: 'list-tabs', chapter: 'list', route: LIST, selector: t('contracts-tabs'),
      title: 'Two tabs',
      say: 'Agreements are the ones you have. Plan requests are customers asking for one. A number on that tab means requests are waiting for an answer.',
    },
    {
      id: 'list-search', chapter: 'list', route: LIST, selector: t('contracts-search'),
      title: 'Search',
      say: 'Search finds an agreement by its name.',
    },
    {
      id: 'list-status', chapter: 'list', route: LIST, selector: t('contracts-status'),
      title: 'Status',
      say: 'This narrows the list by status: Not started, Waiting to be signed, Running, Paused, Ended, or Cancelled.',
    },
    {
      id: 'list-card', chapter: 'list', route: LIST, selector: t('contracts-row'),
      title: 'One card each',
      say: 'Each card is one agreement: its name and status, the customer, the dates it runs, the services it covers, and the fee with how often it’s billed. Click one to open it.',
    },
    {
      id: 'list-empty', chapter: 'list', route: LIST, selector: t('contracts-empty'),
      title: 'Nothing here yet',
      say: 'No agreements yet? That’s fine. You’ll have your first one set up by the end of this.',
    },
    {
      id: 'list-requests', chapter: 'list', route: LIST, selector: t('contracts-requests'),
      wait: { click: true }, doIt: t('contracts-requests'),
      yourTurn: 'Click Plan requests.',
      title: 'Plan requests',
      say: 'Let’s look at Plan requests. Click it.',
    },
    {
      id: 'list-requests-panel', chapter: 'list', route: LIST, selector: t('contracts-requests-panel'),
      title: 'What customers asked for',
      say: 'When a customer asks for a service plan from their portal, it lands here with the schedule they want: how often, time of day, best days, months you’re closed, and which properties and items.',
    },
    {
      id: 'list-request-actions', chapter: 'list', route: LIST, selector: t('contracts-request-actions'),
      title: 'Start proposal or Decline',
      say: 'Start proposal turns the request into a draft agreement and opens it, with their schedule already filled in. Build service agreement writes the full agreement instead, with the equipment they listed ticked. Decline asks you why first. We’ll leave this one as it is.',
    },
    {
      id: 'list-back', chapter: 'list', route: LIST, selector: t('contracts-tab-agreements'),
      wait: { click: true }, doIt: t('contracts-tab-agreements'),
      yourTurn: 'Click Agreements.',
      title: 'Back to Agreements',
      say: 'Now back to Agreements.',
    },

    // ---------- New: who it's for ----------
    {
      id: 'new-open', chapter: 'customer', route: LIST, open: 'goto:/maintenance-contracts',
      click: t('contracts-tab-agreements'), selector: t('contracts-new'),
      wait: { route: NEW }, doIt: t('contracts-new'),
      yourTurn: 'Click New service agreement.',
      title: 'Start a new one',
      say: 'Let’s start one. Nothing is saved until the very last button, and we’ll stop just before it. Click New service agreement.',
    },
    {
      id: 'new-header', chapter: 'customer', route: NEW, selector: t('contract-new-header'),
      title: 'New service agreement',
      say: 'This is the whole form. Once it runs, CrewBarn places the visit dates, puts them on the board as jobs when they come due, and invoices the fee each period.',
    },
    {
      id: 'new-steps', chapter: 'customer', route: NEW, selector: t('contract-new-steps'),
      title: 'Four steps',
      say: 'Four steps, in the order the answers come: Customer, What’s covered, Price and term, and Contract and send. Finished ones get a green tick, and you can click any of them to jump back.',
    },
    {
      id: 'new-summary', chapter: 'customer', route: NEW, selector: t('contract-new-summary'),
      title: 'What they agree to',
      say: 'On the side, a running summary of what the customer agrees to. Once there’s a service, it counts the jobs in the first year, what gets billed, and when the first visits land.',
    },
    {
      id: 'new-read', chapter: 'customer', route: NEW, click: t('contract-new-step-0'), selector: t('contract-new-read'),
      wait: { appear: t('contract-read-overlay') }, doIt: t('contract-new-read'),
      yourTurn: 'Click Already have this agreement on paper?',
      title: 'Already on paper?',
      say: 'Already signed this customer up on paper? CrewBarn can read the contract for you. Click it to have a look.',
    },
    {
      id: 'new-read-panel', chapter: 'customer', route: NEW, selector: t('contract-read-overlay'),
      title: 'Read a contract you already have',
      say: 'Choose a PDF or a photo of the pages. It reads the services, how often, the fee and the term, and shows you everything first, with anything it couldn’t find at the top. Fill the form in with this puts it on the form. Nothing is saved.',
    },
    {
      id: 'new-read-who', chapter: 'customer', route: NEW, selector: t('contract-read-overlay'),
      title: 'You still pick who',
      say: 'The customer and the properties are never filled in from a scan. You pick those yourself, and the names it read are shown beside them to help you match.',
    },
    {
      id: 'new-read-close', chapter: 'customer', route: NEW, selector: t('contract-read-close'),
      wait: { gone: t('contract-read-overlay') }, doIt: t('contract-read-close'),
      yourTurn: 'Close it.',
      title: 'Close it',
      say: 'Close it for now, and we’ll fill the form in by hand.',
    },
    {
      id: 'new-add-customer', chapter: 'customer', route: NEW, click: t('contract-new-step-0'), selector: t('contract-new-add-customer'),
      title: 'New customer',
      say: 'Signing up someone new? New customer adds them right here, without leaving the form.',
    },
    {
      id: 'new-customer', chapter: 'customer', route: NEW, click: t('contract-new-step-0'), selector: t('contract-new-customer-picker'),
      hold: true, yourTurn: 'Type a customer’s name and pick one, then press Next.',
      title: 'Customer',
      say: 'Type a name to find the customer. Go ahead and pick any one. Nothing is saved.',
    },
    {
      id: 'new-title', chapter: 'customer', route: NEW, click: t('contract-new-step-0'), selector: t('contract-new-title'),
      hold: true, yourTurn: 'Give it a name, like Quarterly service plan, then press Next.',
      title: 'What to call it',
      say: 'What to call it is the agreement’s name. It’s what you’ll see on the list. Type one in.',
    },
    {
      id: 'new-properties', chapter: 'customer', route: NEW, click: t('contract-new-step-0'), selector: t('contract-new-properties'),
      title: 'Which properties',
      say: 'Then tick which of their properties it covers. Each property gets its own visit and its own job. If a customer has none yet, add one on their record first.',
    },
    {
      id: 'new-next', chapter: 'customer', route: NEW, click: t('contract-new-step-0'), selector: t('contract-new-next'),
      wait: { appear: t('contract-new-services') }, doIt: t('contract-new-next'),
      yourTurn: 'Click Next: What’s covered.',
      title: 'On to what’s covered',
      say: 'That’s who it’s for. Click Next.',
    },

    // ---------- What's covered ----------
    {
      id: 'svc-intro', chapter: 'services', route: NEW, open: 'goto:/maintenance-contracts/new',
      click: t('contract-new-step-1'), selector: t('contract-new-services'),
      title: 'What you will do',
      say: 'One card per service. Two kinds of work on one agreement, like a tune-up and lawn care, is two services, each with its own rhythm. Not two agreements.',
    },
    {
      id: 'svc-name', chapter: 'services', route: NEW, click: t('contract-new-step-1'), selector: t('contract-new-service-name'),
      hold: true, yourTurn: 'Name the service, like HVAC tune-up, then press Next.',
      title: 'The service',
      say: 'Name the service, the way you’d say it to the customer.',
    },
    {
      id: 'svc-jobtype', chapter: 'services', route: NEW, click: t('contract-new-step-1'), selector: t('contract-new-service-jobtype'),
      title: 'Books this kind of job',
      say: 'Books this kind of job is the job type each visit becomes on the board. Nothing is picked for you, so every service lands as the right kind of work. You can’t save until each one has one.',
    },
    {
      id: 'svc-desc', chapter: 'services', route: NEW, click: t('contract-new-step-1'), selector: t('contract-new-service-desc'),
      title: 'What this involves',
      say: 'What this involves is written into the agreement, so the customer knows what they’re paying for.',
    },
    {
      id: 'svc-assets', chapter: 'services', route: NEW, click: t('contract-new-step-1'), selector: t('contract-new-service-assets'),
      title: 'What this covers',
      say: 'This lists the equipment on record at the properties you picked. Tick what this service looks after. Each visit then carries the items at its property, so the job’s record says which ones were seen.',
    },
    {
      id: 'svc-often', chapter: 'services', route: NEW, click: t('contract-new-step-1'), selector: t('contract-new-rhythm'),
      title: 'How often',
      say: 'How often. Normally is the all-year rhythm: every week, every two weeks, monthly, quarterly, every six months, once a year, or Custom for anything else. It starts on every month.',
    },
    {
      id: 'svc-season', chapter: 'services', route: NEW, click: t('contract-new-step-1'), selector: t('contract-new-season-add'),
      title: 'Different for part of the year',
      say: 'This adds a season, like every two weeks from November to March. Where a season and the normal rhythm overlap, the season wins.',
    },
    {
      id: 'svc-so', chapter: 'services', route: NEW, click: t('contract-new-step-1'), selector: t('contract-new-rhythm-sentence'),
      title: 'Said back in a sentence',
      say: 'The So line reads the whole schedule back to you in plain words, so you can check exactly what you’re promising.',
    },
    {
      id: 'svc-add', chapter: 'services', route: NEW, click: t('contract-new-step-1'), selector: t('contract-new-add-service'),
      title: 'Add another service',
      say: 'Add another service adds a second card. Every service runs at every property you picked, and each visit becomes its own job.',
    },
    {
      id: 'svc-summary', chapter: 'services', route: NEW, click: t('contract-new-step-1'), selector: t('contract-new-summary'),
      title: 'The summary fills in',
      say: 'Look over here. With a service and a rhythm, the summary shows how many visits each service gets, and the jobs it books in the first year.',
    },
    {
      id: 'svc-next', chapter: 'services', route: NEW, click: t('contract-new-step-1'), selector: t('contract-new-next'),
      wait: { appear: t('contract-new-money') }, doIt: t('contract-new-next'),
      yourTurn: 'Click Next: Price and term.',
      title: 'On to the money',
      say: 'Now the money. Click Next.',
    },

    // ---------- Price and term ----------
    {
      id: 'money-intro', chapter: 'money', route: NEW, open: 'goto:/maintenance-contracts/new',
      click: t('contract-new-step-2'), selector: t('contract-new-money'),
      title: 'The money and the term',
      say: 'The money and the term. The fee covers the visits, so they’re never invoiced separately.',
    },
    {
      id: 'money-fee', chapter: 'money', route: NEW, click: t('contract-new-step-2'), selector: t('contract-new-fee'),
      hold: true, yourTurn: 'Type a fee, like 450, then press Next.',
      title: 'Fee',
      say: 'The fee is what the customer pays each billing period. Type an amount.',
    },
    {
      id: 'money-billed', chapter: 'money', route: NEW, click: t('contract-new-step-2'), selector: t('contract-new-billed'),
      title: 'Billed every',
      say: 'Billed every week, month or year, with month picked to start. Each period, the agreement raises one invoice for the fee.',
    },
    {
      id: 'money-starts', chapter: 'money', route: NEW, click: t('contract-new-step-2'), selector: t('contract-new-starts'),
      title: 'Starts',
      say: 'Starts is today, unless you change it. Visits are placed from this date.',
    },
    {
      id: 'money-ends', chapter: 'money', route: NEW, click: t('contract-new-step-2'), selector: t('contract-new-ends'),
      title: 'Ends',
      say: 'Ends is filled in a year out. An end date is what lets it come up for renewal. Clear it if the agreement just keeps going.',
    },
    {
      id: 'money-supervisor', chapter: 'money', route: NEW, click: t('contract-new-step-2'), selector: t('contract-new-supervisor'),
      title: 'Who looks after it',
      say: 'Who looks after it is the person in charge of this agreement. They get the renewal reminders, and they lead any job it books that has no tech of its own.',
    },
    {
      id: 'money-summary', chapter: 'money', route: NEW, click: t('contract-new-step-2'), selector: t('contract-summary-counts'),
      title: 'Jobs and billing, first year',
      say: 'And here’s the part to check before you promise anything: how many jobs it books in the first year, and how much it bills.',
    },
    {
      id: 'money-next', chapter: 'money', route: NEW, click: t('contract-new-step-2'), selector: t('contract-new-next'),
      wait: { appear: t('contract-new-document') }, doIt: t('contract-new-next'),
      yourTurn: 'Click Next: Contract and send.',
      title: 'On to the paperwork',
      say: 'Last step, the paperwork. Click Next.',
    },

    // ---------- Contract and send ----------
    {
      id: 'doc-intro', chapter: 'paperwork', route: NEW, open: 'goto:/maintenance-contracts/new',
      click: t('contract-new-step-3'), selector: t('contract-new-document'),
      title: 'The contract itself',
      say: 'The contract itself is the wording the customer signs. It’s optional here, and you can attach it later.',
    },
    {
      id: 'doc-select', chapter: 'paperwork', route: NEW, click: t('contract-new-step-3'), selector: t('contract-new-doc-select'),
      title: 'Attach a contract',
      say: 'Attach a contract lists your contract documents from Templates and Forms. Once one is attached, a link lets you edit its wording there.',
    },
    {
      id: 'doc-draft', chapter: 'paperwork', route: NEW, click: t('contract-new-step-3'), selector: t('contract-new-draft'),
      wait: { appear: t('contract-draft-overlay') }, doIt: t('contract-new-draft'),
      yourTurn: 'Click Draft one for me.',
      title: 'Draft one for me',
      say: 'Don’t have one yet? Draft one for me writes one from everything you’ve entered. Click it to see how it works.',
    },
    {
      id: 'doc-draft-terms', chapter: 'paperwork', route: NEW, selector: t('contract-draft-terms'),
      title: 'Read this first',
      say: 'First, a short notice about what a drafted contract is, and what it isn’t. It’s a starting point, and a lawyer should read it before you use it.',
    },
    {
      id: 'doc-draft-ack', chapter: 'paperwork', route: NEW, selector: t('contract-draft-ack'),
      title: 'Type I understand',
      say: 'The first time, you type I understand, then Record this. It’s typed rather than ticked, so there’s a record of who read it and when.',
    },
    {
      id: 'doc-draft-lists', chapter: 'paperwork', route: NEW, selector: t('contract-draft-lists'),
      title: 'Included, and charged separately',
      say: 'Then two lists, one item per line: what’s included in the fee, and what’s charged separately. Your services and rhythms are written in as well.',
    },
    {
      id: 'doc-draft-go', chapter: 'paperwork', route: NEW, selector: t('contract-draft-go'),
      title: 'Write it',
      say: 'This button does it for real. The draft comes back switched off, for you to read and then attach. We’ll leave it this time.',
    },
    {
      id: 'doc-draft-close', chapter: 'paperwork', route: NEW, selector: t('contract-draft-cancel'),
      wait: { gone: t('contract-draft-overlay') }, doIt: t('contract-draft-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Cancel closes it without writing anything.',
    },
    {
      id: 'doc-start-note', chapter: 'paperwork', route: NEW, click: t('contract-new-step-3'), selector: t('contract-new-start-note'),
      title: 'Start, or keep it as a draft',
      say: 'This is the big choice. Starting it places the visit dates now. A draft sits there doing nothing until you start it: no visits, no jobs, no invoices.',
    },
    {
      id: 'doc-save-draft', chapter: 'paperwork', route: NEW, click: t('contract-new-step-3'), selector: t('contract-new-save-draft'),
      title: 'Save as a draft',
      say: 'Save as a draft keeps it without booking anything. That’s the one to use while you wait for the customer to sign.',
    },
    {
      id: 'doc-start', chapter: 'paperwork', route: NEW, click: t('contract-new-step-3'), selector: t('contract-new-start'),
      title: 'Start the agreement',
      say: 'Start the agreement saves it, places the visit dates, and opens it. It commits real work, so we’ll leave it.',
    },
    {
      id: 'doc-needed', chapter: 'paperwork', route: NEW, click: t('contract-new-step-3'), selector: t('contract-new-still-needed'),
      title: 'Still needed',
      say: 'Until everything’s there, this line says what’s missing: a customer, a name, at least one property, and a service with a name and a job type.',
    },

    // ---------- An agreement's page ----------
    {
      id: 'detail-open', chapter: 'detail', route: LIST, open: 'goto:/maintenance-contracts',
      click: t('contracts-tab-agreements'), selector: t('contracts-row'),
      wait: { route: DETAIL }, doIt: `first:${t('contracts-row')}`,
      yourTurn: 'Click any agreement.',
      title: 'Open one',
      say: 'Now let’s open an agreement you already have. This is just for looking, and nothing will change. Click any card.',
    },
    {
      id: 'detail-header', chapter: 'detail', route: DETAIL, selector: t('contract-header'),
      title: 'The agreement',
      say: 'Up top: its name, the dates it runs, and the fee with how often it’s billed.',
    },
    {
      id: 'detail-back', chapter: 'detail', route: DETAIL, selector: t('contract-back'),
      title: 'All contracts',
      say: 'All contracts takes you back to the list.',
    },
    {
      id: 'detail-status', chapter: 'detail', route: DETAIL, selector: t('contract-status'),
      title: 'Status',
      say: 'The status, in plain words. Only a Running agreement books visits and bills. Not started, Waiting to be signed and Paused all sit still.',
    },
    {
      id: 'detail-note', chapter: 'detail', route: DETAIL, selector: t('contract-status-note'),
      title: 'Said out loud',
      say: 'When it isn’t running, this line tells you so, like: it books no visits and bills nothing until you start it.',
    },
    {
      id: 'detail-confirm-visits', chapter: 'detail', route: DETAIL, selector: t('contract-confirm-visits'), when: t('contract-confirm-visits'),
      title: 'Confirm visits',
      say: 'When a signed agreement said to suggest the visits, they wait here. Confirm the ones you want and they go on the schedule, or skip them. Book automatically from now on lets this plan book its own visits.',
    },
    {
      id: 'detail-send', chapter: 'detail', route: DETAIL, selector: t('contract-send'),
      title: 'Send to sign',
      say: 'Send to sign emails the customer a link to sign the attached contract, and shows you the link too. The wording is frozen when it goes, so later edits don’t change what they sign. It needs a contract attached.',
    },
    {
      id: 'detail-paper', chapter: 'detail', route: DETAIL, selector: t('contract-paper'),
      title: 'They signed on paper',
      say: 'Signed at the kitchen table? They signed on paper asks who signed, then starts the agreement and places its visits.',
    },
    {
      id: 'detail-start', chapter: 'detail', route: DETAIL, selector: t('contract-start'),
      title: 'Start it',
      say: 'Start it starts the agreement without a signature. On a paused one, the same button says Pick it back up.',
    },
    {
      id: 'detail-pause', chapter: 'detail', route: DETAIL, selector: t('contract-pause'),
      title: 'Pause',
      say: 'Pause stops it booking visits and billing until you pick it back up. Each of these buttons changes the real agreement, so we won’t press any of them.',
    },
    {
      id: 'detail-renewal', chapter: 'detail', route: DETAIL, selector: t('contract-renewal'),
      title: 'How it renews',
      say: 'When next term’s price is set to change, this line says how it renews, automatically or after review, and what the new fee will be.',
    },

    // ---------- Visits, billing, history ----------
    {
      id: 'tabs-overview', chapter: 'tabs', route: DETAIL, open: 'contracts:first',
      click: t('contract-tab-overview'), selector: t('contract-tabs'),
      title: 'Five tabs',
      say: 'Everything that happens on an agreement is in these five tabs: Overview, Visits, Equipment, Billing and History.',
    },
    {
      id: 'tabs-coming', chapter: 'tabs', route: DETAIL, click: t('contract-tab-overview'), selector: t('contract-overview-coming'),
      title: 'Coming up',
      say: 'Coming up lists the next visits and where they are. A visit goes on the board as a job fourteen days before it’s due.',
    },
    {
      id: 'tabs-money', chapter: 'tabs', route: DETAIL, click: t('contract-tab-overview'), selector: t('contract-overview-money'),
      title: 'Money',
      say: 'Money shows what’s been billed, how much of it is paid, and when the next period starts.',
    },
    {
      id: 'tabs-visits', chapter: 'tabs', route: DETAIL, selector: t('contract-tab-visits'),
      wait: { appear: t('contract-visits') }, doIt: t('contract-tab-visits'),
      yourTurn: 'Click Visits.',
      title: 'Visits',
      say: 'Now click Visits.',
    },
    {
      id: 'tabs-visits-list', chapter: 'tabs', route: DETAIL, click: t('contract-tab-visits'), selector: t('contract-visits'),
      title: 'Every visit',
      say: 'Every visit, with its date, service, property and state: Planned, On the board, Done or Skipped. Open goes to its job, and What was done shows what the tech recorded on each item.',
    },
    {
      id: 'tabs-equipment', chapter: 'tabs', route: DETAIL, click: t('contract-tab-equipment'), selector: t('contract-equipment'),
      title: 'Equipment',
      say: 'Equipment lists everything this agreement covers: where it is, when it was last serviced, and anything still outstanding. Items taken off the plan stay listed, with the date they came off.',
    },
    {
      id: 'tabs-billing', chapter: 'tabs', route: DETAIL, click: t('contract-tab-billing'), selector: t('contract-billing'),
      title: 'Billing',
      say: 'Billing lists each period, its amount, and where its invoice stands: Draft invoice, Invoiced, Paid, or Could not bill with the reason. The invoice number opens the invoice.',
    },
    {
      id: 'tabs-history', chapter: 'tabs', route: DETAIL, click: t('contract-tab-history'), selector: t('contract-history'),
      title: 'History',
      say: 'History is everything that happened, in order: visit dates placed, visits put on the board, invoices raised, renewal notices sent, and status changes.',
    },
    {
      id: 'tabs-services', chapter: 'tabs', route: DETAIL, click: t('contract-tab-overview'), selector: t('contract-services'),
      title: 'What is covered',
      say: 'Under the tabs is What is covered, one card per service. Add a service adds another, with the kind of job it books.',
    },
    {
      id: 'tabs-service-card', chapter: 'tabs', route: DETAIL, selector: t('contract-service-card'),
      title: 'A service',
      say: 'Each card says what kind of job the service books, and how many properties it covers.',
    },
    {
      id: 'tabs-strip', chapter: 'tabs', route: DETAIL, selector: t('contract-season-strip'),
      title: 'The year',
      say: 'The year is drawn across twelve months, so you can see in a second whether the seasons meet, or leave a month with no visits.',
    },
    {
      id: 'tabs-rule', chapter: 'tabs', route: DETAIL, selector: t('contract-rule'),
      title: 'A rhythm',
      say: 'Each rhythm reads like a sentence: every so many weeks, only part of the year, from one month to another. Change it, and a Save button shows up. We’ll leave these as they are.',
    },
    {
      id: 'tabs-add-season', chapter: 'tabs', route: DETAIL, selector: t('contract-add-season'),
      title: 'Add a season',
      say: 'Add a season gives this service another rhythm for part of the year.',
    },

    // ---------- Where it shows up ----------
    // Nothing on this page to point at: the cards say where to look.
    {
      id: 'used-intro', chapter: 'used', route: LIST, open: 'goto:/maintenance-contracts',
      title: 'Agreements reach everywhere',
      say: 'Agreements don’t only live on this page. Here’s where else they show up, so you know where to look.',
    },
    {
      id: 'used-visits', chapter: 'used', route: LIST,
      title: 'Scheduled visits become jobs',
      say: 'Once it’s running, every visit date is placed ahead of time. Fourteen days before each one, it goes on the Jobs board as a real job, with the right job type, property and equipment.',
    },
    {
      id: 'used-job', chapter: 'used', route: LIST,
      title: 'On the job',
      say: 'On a job an agreement booked, a green Covered by banner names the agreement. The fee already pays for that visit, so don’t collect for it. Extra work found there is quoted and billed separately.',
    },
    {
      id: 'used-invoices', chapter: 'used', route: LIST,
      title: 'Invoices',
      say: 'Each billing period, the agreement raises its own invoice, and it shows up on Invoices. Whether it waits as a draft is a setting we’ll look at in a moment. Nothing is emailed to the customer on its own.',
    },
    {
      id: 'used-customer', chapter: 'used', route: LIST,
      title: 'The customer’s record',
      say: 'On a customer’s record, each saved property has a Service agreement for this location link. It starts a new agreement with the customer and the property already picked.',
    },
    {
      id: 'used-start', chapter: 'used', route: LIST,
      title: 'Other ways in',
      say: 'You can also start one from New Service Agreement in the quick create menu at the top, and from the Jobs and Estimates pages.',
    },
    {
      id: 'used-renewal', chapter: 'used', route: LIST,
      title: 'Renewal reminders',
      say: 'Renewal reminders go to whoever looks after the agreement. And on the Automations page in the Tool Shed, under Bring customers back, you can email the customer when a contract is coming up for renewal, and the office when one runs out.',
    },
    {
      id: 'used-scan', chapter: 'used', route: LIST,
      title: 'Equipment tags',
      say: 'And when someone scans the tag on a piece of covered equipment, they see that it’s on a service plan, how often it’s serviced, and when the next visit is.',
    },

    // ---------- Setup and settings ----------
    {
      id: 'setup-header', chapter: 'setup', route: SETUP, open: 'goto:/tool-shed/service-agreements',
      click: t('agreements-tab-setup'), selector: t('agreements-header'),
      title: 'Setting up a service agreement',
      say: 'In the Tool Shed, Setting up a service agreement is where you get your contract wording ready.',
    },
    {
      id: 'setup-estimate', chapter: 'setup', route: SETUP, selector: t('agreements-estimate-picker'),
      title: 'An agreement for an estimate',
      say: 'Build an agreement for an estimate finds an estimate and builds an agreement from its details. You read it and save a draft. Nothing is sent or started.',
    },
    {
      id: 'setup-tabs', chapter: 'setup', route: SETUP, selector: t('agreements-tabs'),
      title: 'Two tabs',
      say: 'Two tabs: Review and setup, then Create or import.',
    },
    {
      id: 'setup-notice', chapter: 'setup', route: SETUP, click: t('agreements-tab-setup'), selector: t('agreements-notice'),
      title: 'The notice',
      say: 'First, the notice about what CrewBarn’s drafts are and aren’t. Someone who can change settings reads it, types I understand, and records it once. After that, drafts can be written.',
    },
    {
      id: 'setup-reviewer', chapter: 'setup', route: SETUP, click: t('agreements-tab-setup'), selector: t('agreements-reviewer'),
      title: 'Who reviews your agreements',
      say: 'Who reviews your agreements: your lawyer’s name and where to send it. Whatever CrewBarn writes still needs a lawyer to read it. You deal with them directly.',
    },
    {
      id: 'setup-create', chapter: 'setup', route: SETUP, selector: t('agreements-tab-draft'),
      wait: { appear: t('agreements-write') }, doIt: t('agreements-tab-draft'),
      yourTurn: 'Click Create or import.',
      title: 'Create or import',
      say: 'Now click Create or import.',
    },
    {
      id: 'setup-write', chapter: 'setup', route: SETUP, click: t('agreements-tab-draft'), selector: t('agreements-write-fields'),
      title: 'Write the agreement',
      say: 'Tell CrewBarn how you work: what it covers, what it doesn’t, cancellation, payment terms, and anything else. Leave a box empty and that part stays a blank to fill in. Nothing is made up.',
    },
    {
      id: 'setup-generate', chapter: 'setup', route: SETUP, click: t('agreements-tab-draft'), selector: t('agreements-generate'),
      title: 'Write me a draft',
      say: 'Write me a draft agreement makes a draft document, switched off, and opens it in Templates and Forms. We’ll leave it.',
    },
    {
      id: 'setup-import', chapter: 'setup', route: SETUP, click: t('agreements-tab-draft'), selector: t('agreements-import'),
      title: 'Already have one?',
      say: 'Already have an agreement you use? Upload a PDF or a photo, and CrewBarn reads it into an editable draft. Check it against the original before you use it.',
    },
    {
      id: 'setup-where', chapter: 'setup', route: SETUP, selector: t('agreements-where'),
      title: 'Where they live',
      say: 'Your agreements live in Templates and Forms, and each service agreement attaches one in its last step.',
    },
    {
      id: 'invoices-open', chapter: 'setup', route: INVOICES, open: 'goto:/tool-shed/preferences/contract-invoices',
      selector: t('setting-title'),
      title: 'Whether contract invoices wait for you',
      say: 'One last setting: whether the invoices an agreement raises wait for you, or count straight away.',
    },
    {
      id: 'invoices-control', chapter: 'setup', route: INVOICES, selector: t('setting-control'),
      title: 'Off or on',
      say: 'Off, which is how it starts, each one waits as a draft until somebody reads it and issues it. On, they count as soon as they’re raised.',
    },
    {
      id: 'invoices-consequences', chapter: 'setup', route: INVOICES, selector: t('setting-consequences'),
      title: 'With this choice',
      say: 'This box says what your choice means, in plain words. Either way, nothing is emailed to the customer. Sending an invoice is still up to you.',
    },
    {
      id: 'invoices-scope', chapter: 'setup', route: INVOICES, selector: t('setting-scope'),
      title: 'Only contract invoices',
      say: 'It only touches invoices raised by an agreement. Invoices you make from a job are left alone. Change it and a bar asks you to save. We’ll leave it as it is.',
    },
    {
      id: 'done', chapter: 'setup', route: INVOICES,
      title: 'That’s the lot',
      say: 'That’s everything, from starting an agreement to watching it run. You can take this tutorial again any time from the button at the top of the page.',
    },
  ],
}
