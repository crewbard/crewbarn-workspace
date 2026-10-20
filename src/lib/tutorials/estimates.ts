import type { TutorialData } from './types'

/**
 * Estimates, start to finish: the list, making one, the estimate page,
 * sending it and getting it approved, the service agreement window, turning
 * it into a job, and where estimates show up across CrewBarn.
 *
 * Import-free (types aside) so the voice exporter can load it on its own.
 * The walk never saves, sends, approves, converts or deletes: it opens the
 * windows, points at the buttons, and leaves them.
 */

const t = (id: string) => `[data-tour=${JSON.stringify(id)}]`

/**
 * Markers the shared job/estimate form sets with a kind-dependent expression
 * (`estimate-…` on an estimate, `job-…` on a job), written out directly.
 */
const ESTIMATE_CUSTOMER = "[data-tour='estimate-customer']"
const ESTIMATE_SAVE = "[data-tour='estimate-save']"

const LIST = '^/estimates/?$'
const NEW = '^/estimates/new/?$'
const DETAIL = '^/estimates/(?!new/?$)[^/]+/?$'
const SCHEDULE = '^/schedule/?$'
const DISPATCH = '^/dispatch/?$'
// The Focus look shows one list at a time beside the Dispatch map: this presses its To assign button first.
const RAIL = (key: string) => t(`dispatch-rail-${key}`)
/** The Focus look (<html data-theme="focus">), for words that differ there. */
const FOCUS = 'html[data-theme="focus"]'
/** Focus's own Step by step / Full page switch on New estimate (Step by step is its default). */
const FULL_PAGE = t('estimate-entry-full')
/** The estimate page's More actions menu (Mark rejected, Re-quote, Edit details, Delete estimate). */
const MORE = t('estimate-more-actions-toggle')
const PREFS = '^/tool-shed/preferences/?$'

/** A detail-page tab, or its card when the page uses the easy layout. */
const tab = (marker: string, n: number) => `${t(marker)}, ${t('estimate-tabs')} [data-easy-action-card]:nth-child(${n})`

/** The open window on the New estimate page (signable document picker). */
const DIALOG = '[data-work-dialog]'
const CONVERT_DIALOG = `${t('estimate-convert-modal')} [data-work-dialog]`
const EMAIL_PANEL = `${t('estimate-email-composer')} > div > div`

export const TUTORIAL: TutorialData = {
  id: 'estimates',
  kicker: 'Estimates · tutorial',
  title: 'Estimates, start to finish',
  film: [
    {
      id: 'journey',
      label: 'The journey',
      title: 'Every estimate takes the same road',
      narration:
        'An estimate is a price you give before the work starts. Every one takes the same road: you write it as a draft, send it, the customer says yes or no, and a yes turns into a job.',
    },
    {
      id: 'build',
      label: 'Build it',
      title: 'Pick the customer, then add the work',
      narration:
        'You start with the customer and a title. Then you add lines: services and products from your catalog, a fee, or a discount. Each line can carry its own tax, and the total adds itself up.',
    },
    {
      id: 'visit',
      label: 'Phone or visit',
      title: 'A phone quote, or a visit first',
      narration:
        'Some quotes happen on the phone, so you skip the schedule. Others need a look first, so you book a walkthrough. That visit lands on your schedule and dispatch board like any other appointment.',
    },
    {
      id: 'send',
      label: 'Send it',
      title: 'Send it, and they answer online',
      narration:
        'When it looks right, you email or text it. The customer gets a link to their portal, reads it over, signs any agreement you attached, and approves it right there.',
    },
    {
      id: 'follow',
      label: 'Follow up',
      title: 'Nothing slips through',
      narration:
        'Each estimate tells you its next step: send, follow up, or convert. Ones waiting too long are easy to spot, and after the expiry date they close on their own. When the numbers change, Re-quote copies it into a fresh draft.',
    },
    {
      id: 'convert',
      label: 'Convert',
      title: 'A yes becomes a job',
      narration:
        'Once it’s approved, Convert to job makes the work order for you. The lines come along, you pick the day and the tech, and from there you invoice the job like any other.',
    },
    {
      id: 'where',
      label: 'Where they show up',
      title: 'Estimates show up all over',
      narration:
        'Estimates aren’t only on their own page. You’ll see them on the schedule, the dispatch board, a customer’s account, and in your orders and requests from customers.',
    },
    {
      id: 'yourturn',
      label: 'Your turn',
      title: 'Now let’s do it for real',
      narration:
        'That’s the idea. Now let’s walk the real pages, and we won’t save or send anything. I’ll step back into the corner and point at each part. When it’s your turn, you click, or press Do it for me if you’d rather watch.',
    },
  ],
  chapters: [
    { key: 'list', label: 'The estimates list' },
    { key: 'create', label: 'Start a new estimate' },
    { key: 'lines', label: 'Lines, prices and notes' },
    { key: 'detail', label: 'The estimate page' },
    { key: 'send', label: 'Send and get approval' },
    { key: 'agreement', label: 'Service agreement' },
    { key: 'convert', label: 'Turn it into a job' },
    { key: 'used', label: 'Where estimates show up' },
    { key: 'settings', label: 'Settings that shape them' },
  ],
  steps: [
    // ---------- The estimates list ----------
    {
      id: 'list-header', chapter: 'list', route: LIST, open: 'goto:/estimates',
      selector: `${t('estimates-header')}, ${t('estimates-action-cards')}`,
      title: 'Estimates',
      say: 'This is where every estimate lives, from first draft to approved. Let’s look around before we make one.',
    },
    {
      id: 'list-orders', chapter: 'list', route: LIST, selector: t('estimates-customer-orders'),
      title: 'Orders from customers',
      say: 'When customers pick parts from your catalogs in their portal, their orders wait here. Create estimate turns one into a draft at your prices, and Decline lets them know why not.',
    },
    {
      id: 'list-new', chapter: 'list', route: LIST, selector: t('estimates-new'),
      title: 'New estimate',
      say: 'New starts a fresh estimate. We’ll use it in a minute.',
    },
    {
      id: 'list-cards', chapter: 'list', route: LIST, selector: t('estimates-action-cards'),
      title: 'Move an estimate forward',
      say: 'These cards are shortcuts: drafts to finish, ones waiting on the customer, approved ones, and ones past their expiry. Each shows how many there are.',
    },
    {
      id: 'list-tabs', chapter: 'list', route: LIST, selector: t('estimates-tabs'),
      title: 'Where each one stands',
      say: 'These tabs follow the road an estimate takes: Draft, Sent, Approved, Rejected and Expired. The number beside each is how many you have.',
    },
    {
      id: 'list-tab-sent', chapter: 'list', route: LIST, selector: `${t('estimates-tabs')} button:nth-child(3)`,
      wait: { click: true }, doIt: `${t('estimates-tabs')} button:nth-child(3)`,
      yourTurn: 'Click the Sent tab.',
      title: 'Waiting on the customer',
      say: 'Sent shows the ones out with customers right now. These are the ones to follow up on. Click Sent.',
    },
    {
      id: 'list-tab-all', chapter: 'list', route: LIST, selector: `${t('estimates-tabs')} button:nth-child(1)`,
      wait: { click: true }, doIt: `${t('estimates-tabs')} button:nth-child(1)`,
      yourTurn: 'Click All to see everything again.',
      title: 'Back to all of them',
      say: 'Nice. Now click All to see every estimate again.',
    },
    {
      id: 'list-filters', chapter: 'list', route: LIST, selector: t('estimates-filters'),
      title: 'Search and filter',
      say: 'Search finds an estimate by its number or its notes. The menu next to it filters by status, including Superseded, for ones that were replaced by a re-quote.',
    },
    {
      id: 'list-view-board', chapter: 'list', route: LIST, selector: t('estimates-view'),
      title: 'Board or list',
      say: 'Workflow board lays your estimates out in lanes: Drafts, Waiting on them, Approved, and Closed or expired. Detailed list and files shows them as a list instead.',
    },
    {
      id: 'list-board', chapter: 'list', route: LIST, selector: t('estimates-board'),
      title: 'The lanes',
      say: 'Each card shows the customer, the total and the date. Quick Peek shows one without opening it, and Open estimate takes you in.',
    },
    {
      id: 'list-view-files', chapter: 'list', route: LIST, selector: `[aria-label="Estimate view"]:has(${t('estimates-view-files')}), ${t('estimates-view-files')}`,
      title: 'Rows, Cards or Files',
      say: 'Rows is a plain list, and Cards shows this page of estimates as cards. Files sorts them into folders by year and month, the same way your jobs are filed.',
    },
    {
      id: 'list-dates', chapter: 'list', route: LIST, selector: '[aria-label="Estimates created from"]',
      title: 'Created dates and sort',
      say: 'Created from and To narrow this page to estimates made between two dates. The Sort box beside them puts them newest first, oldest first, or by customer.',
    },
    {
      id: 'list-peek', chapter: 'list', route: LIST, selector: '[aria-label^="Quick Peek at"]',
      title: 'Quick Peek',
      say: 'Quick Peek shows an estimate in a window without leaving the list. Open estimate takes you all the way in.',
    },
    {
      id: 'list-files', chapter: 'list', route: LIST, click: t('estimates-view-files'), selector: t('estimates-files'),
      title: 'Filed by month',
      say: 'Each year folder shows what you won. Open a month to see its estimates.',
    },
    {
      id: 'list-tiles', chapter: 'list', route: LIST, selector: t('estimates-folder-tiles'),
      title: 'Won, lost and dormant',
      say: 'Inside a month, these tiles add up everything quoted, won, lost, and dormant. Dormant means sent, no answer, and untouched for fourteen days, so it’s worth a phone call. Click a tile to filter the list.',
    },
    {
      id: 'list-row', chapter: 'list', route: LIST, selector: t('estimates-row'),
      title: 'One estimate',
      say: 'Every estimate shows its number, title, customer, status and total. The colored stripe matches the status: gray for draft, blue for sent, green for approved, red for rejected, and amber for expired or replaced.',
    },
    {
      id: 'list-next', chapter: 'list', route: LIST, selector: t('estimates-next-step'),
      title: 'The next step',
      say: 'This little chip tells you what to do next: Send for a draft, Follow up for one that’s out, or Convert for an approved one. Clicking it opens the estimate, and Convert opens it with the convert window up.',
    },

    // ---------- Start a new estimate ----------
    {
      id: 'create-open', chapter: 'create', route: LIST, open: 'goto:/estimates', selector: t('estimates-new'),
      wait: { route: NEW }, doIt: t('estimates-new'),
      yourTurn: 'Click New estimate.',
      title: 'Start one',
      say: 'Let’s start an estimate. Press New estimate, up in the top right corner. We’ll fill it in together and stop before it’s created.',
    },
    {
      id: 'create-header', chapter: 'create', route: NEW, selector: t('estimate-new-header'),
      title: 'New estimate',
      say: 'This is the same form you use for jobs, set up for an estimate. For a phone quote, skip the schedule. For a walkthrough, book it right here.',
    },
    {
      id: 'create-order-book', chapter: 'create', route: NEW, when: FOCUS, selector: t('estimate-order-book'),
      title: 'Your order book',
      say: 'Open PDF order book puts your price book beside the form for reference. Search catalog, under the lines, adds priced items for you.',
    },
    {
      id: 'create-layout', chapter: 'create', route: NEW, when: FOCUS, click: FULL_PAGE, selector: t('estimate-entry-mode'),
      title: 'Step by step or Full page',
      say: 'Step by step takes the form one part at a time. Full page shows it all at once, with Jump to links to each part. I’ve switched to Full page so we can see everything.',
    },
    {
      id: 'create-drafts', chapter: 'create', route: NEW, selector: t('job-drafts'),
      title: 'Saved drafts',
      say: 'CrewBarn keeps what you type as a draft on this device, so a dropped call or a closed tab doesn’t lose it. Click one here to look it over, then carry on with it or throw it away.',
    },
    {
      id: 'create-customer', chapter: 'create', route: NEW, selector: ESTIMATE_CUSTOMER, hold: true,
      yourTurn: 'Pick any customer, then press Next.',
      title: 'Customer and location',
      say: 'Customer comes first, and their main service location fills in by itself. Change picks another. Go ahead and pick any customer, since nothing gets saved.',
    },
    {
      id: 'create-new-customer', chapter: 'create', route: NEW, selector: ESTIMATE_CUSTOMER,
      title: 'New customer, or a different payer',
      say: 'Brand new caller? New customer adds them right here. And if someone else pays, like a property manager or a warranty company, tick Bill a different customer and add their work order and PO numbers.',
    },
    {
      id: 'create-tools', chapter: 'create', route: NEW, selector: t('job-setup-tools'),
      title: 'Extras',
      say: 'These four are extras. Attach a document to sign, upload the customer’s own work order or PO and let CBI read it, add photos and files, or attach an inspection checklist.',
    },
    {
      id: 'create-signable-open', chapter: 'create', route: NEW,
      selector: `${t('job-setup-tools')} button[aria-haspopup="dialog"]`,
      wait: { appear: DIALOG }, doIt: `${t('job-setup-tools')} button[aria-haspopup="dialog"]`,
      yourTurn: 'Click Signable document.',
      title: 'A document to sign',
      say: 'Let’s look at the first one. Click Signable document.',
    },
    {
      id: 'create-signable', chapter: 'create', route: NEW, selector: DIALOG,
      title: 'Signed before they approve',
      say: 'Pick a contract, estimate or work order from your templates. On an estimate, the customer reads and signs it in their portal before they can approve. Generate with AI writes one from your scope and saves it to your templates.',
    },
    {
      id: 'create-signable-close', chapter: 'create', route: NEW, selector: `${DIALOG} [aria-label="Close"]`,
      wait: { gone: DIALOG }, doIt: `${DIALOG} [aria-label="Close"]`,
      yourTurn: 'Close this window.',
      title: 'Close it',
      say: 'We’ll leave it empty for now. Close the window.',
    },
    {
      id: 'create-custom', chapter: 'create', route: NEW, selector: t('job-custom-required'),
      title: 'Your own fields',
      say: 'If your company added fields that must be filled in, they show up here.',
    },
    {
      id: 'create-basics', chapter: 'create', route: NEW, selector: t('job-basics'), hold: true,
      yourTurn: 'Type a title, like Water heater replacement, then press Next.',
      title: 'Title and type',
      say: 'Give it a title the customer will understand, like Water heater replacement. Pick the job type, set the priority, and describe the work. Type a title now.',
    },
    {
      id: 'create-schedule', chapter: 'create', route: NEW, selector: `${t('job-schedule')}, ${t('job-dispatch')}`,
      title: 'Walkthrough schedule',
      say: 'Need to see it first? Choose Scheduled and pick the day, starting with a two-hour window you can change. For a phone quote, leave it Unscheduled. The lead tech and project manager go here too.',
    },
    {
      id: 'create-assets', chapter: 'create', route: NEW, selector: t('job-assets'),
      title: 'Covered assets',
      say: 'If the work is on equipment you track for this customer, like a furnace or a garage door, tick it here. Skip it for one-off work.',
    },

    // ---------- Lines, prices and notes ----------
    {
      id: 'lines-intro', chapter: 'lines', route: NEW, open: 'goto:/estimates/new', click: FULL_PAGE, selector: t('estimate-lineitems'),
      title: 'Line items',
      say: 'Now the price. Every line is a service or a product, with a quantity and a unit price. The total for each line works itself out.',
    },
    {
      id: 'lines-catalog', chapter: 'lines', route: NEW, selector: t('estimate-lineitems'), hold: true,
      yourTurn: 'Try + Search catalog or + Add blank line, then press Next.',
      title: 'From your catalog',
      say: 'Search catalog pulls in something you’ve already priced, with its tax, or start typing a description and pick a match. Add blank line is for anything new. Try one: lines stay on this page until you create the estimate.',
    },
    {
      id: 'lines-fees', chapter: 'lines', route: NEW, selector: t('estimate-lineitems'),
      title: 'Fees and discounts',
      say: 'Add fee is for things like a trip charge. Add discount takes a percent or a set dollar amount off the lines. Drag the handle on the left to put lines in order.',
    },
    {
      id: 'lines-tiers', chapter: 'lines', route: NEW, selector: t('estimate-lineitems'),
      title: 'Good, better, best',
      say: 'Want to offer a choice? New tier turns what you have into Good and adds Better as a copy, so you only change what is different. Add a third for Best. Rename any of them, say what sets each apart, and mark one as recommended. The customer picks one in their portal.',
    },
    {
      id: 'lines-tax', chapter: 'lines', route: NEW, selector: t('estimate-lineitems'),
      title: 'Tax on each line',
      say: 'Each line picks its own tax, or No tax. The tax works out when you save, so the preview here shows it as zero until then. Customers set as tax exempt get it taken off.',
    },
    {
      id: 'lines-totals', chapter: 'lines', route: NEW, selector: t('estimate-lineitems'),
      title: 'Totals and pictures',
      say: 'Down at the bottom you get the subtotal, any discount, tax, and the total. If it comes in under your minimum service call, it tells you, so you can decide before it goes out. The switch at the top decides if line pictures show on the customer’s copy.',
    },
    {
      id: 'lines-notes', chapter: 'lines', route: NEW, selector: t('job-notes'),
      title: 'Notes',
      say: 'Internal notes are for your team only. Public notes can show on what the customer sees.',
    },
    {
      id: 'lines-create', chapter: 'lines', route: NEW, selector: ESTIMATE_SAVE,
      title: 'Create Estimate',
      say: 'Create Estimate saves it as a draft and opens it, without sending anything. We’ll leave it this time. What you typed stays as a draft on this device, and you can throw it away from Saved drafts.',
    },

    // ---------- The estimate page ----------
    {
      id: 'detail-open', chapter: 'detail', route: DETAIL, open: 'estimate:first', selector: t('estimate-header'),
      title: 'An estimate up close',
      say: 'Here’s one of your estimates. We’re just looking, so nothing here will change. Up top is its number, the customer, and where it stands.',
    },
    {
      id: 'detail-strip', chapter: 'detail', route: DETAIL, selector: t('estimate-customer-strip'),
      title: 'Customer and place',
      say: 'This strip keeps the customer and the service address in view. Click the name to open their account.',
    },
    {
      id: 'detail-actions', chapter: 'detail', route: DETAIL, selector: t('estimate-actions'),
      title: 'What you can do',
      say: 'These buttons change with the estimate. A draft can be sent, a sent one can be approved, turned down or re-quoted, and an approved one can become a job. We’ll go through them in a bit.',
    },
    {
      id: 'detail-tabs', chapter: 'detail', route: DETAIL, selector: t('estimate-tabs'),
      title: 'Tabs',
      say: 'The tabs hold everything else: the overview, the lines, the details you can edit, photos, documents, and history.',
    },
    {
      id: 'detail-overview', chapter: 'detail', route: DETAIL, click: tab('estimate-tab-overview', 1), selector: t('estimate-overview'),
      title: 'Overview',
      say: 'Overview puts the work and the price together, then the customer’s answer, the next step, and the customer, site and latest activity.',
      variants: [{ when: FOCUS, say: 'Overview puts the work and the price together, then the customer’s answer and the next step. In the Focus look, the customer, site and latest activity fold into Connected records & activity, at the bottom.' }],
    },
    {
      id: 'detail-money', chapter: 'detail', route: DETAIL, click: tab('estimate-tab-overview', 1), selector: t('estimate-overview-work'),
      title: 'Work and price',
      say: 'The work and the price together: the first few lines, then subtotal, tax and total. When the customer is tax exempt, that amount comes off on its own line. Full breakdown opens every line.',
    },
    {
      id: 'detail-lifecycle', chapter: 'detail', route: DETAIL, selector: t('estimate-progress'),
      title: 'How far it’s got',
      say: 'This row shows how far it’s got: drafted, sent, the customer’s answer, and the job, each with its date. History, in the tabs, has the whole story.',
    },
    {
      id: 'detail-lines', chapter: 'detail', route: DETAIL, click: tab('estimate-tab-line-items', 2), selector: t('estimate-line-items'),
      title: 'Line items',
      say: 'Here are the lines. It’s the same editor you saw on the new estimate, but here every change saves as you go, so we’ll just look.',
    },
    {
      id: 'detail-parts', chapter: 'detail', route: DETAIL, click: tab('estimate-tab-line-items', 2), selector: t('estimate-parts'),
      title: 'Parts',
      say: 'Parts on the estimate get held from your stock when the customer approves, so nobody else uses them. Order from a catalog picks parts from a supplier catalog and adds them at your sell price.',
    },
    {
      id: 'detail-edit', chapter: 'detail', route: DETAIL, click: tab('estimate-tab-edit', 3), selector: t('estimate-edit-basics'), hold: true,
      yourTurn: 'Try changing the title if you like, then press Next.',
      title: 'Edit the details',
      say: 'Edit holds the title, priority, the expiry date and the description. Go ahead and change the title. Nothing saves unless you press Save changes.',
    },
    {
      id: 'detail-edit-schedule', chapter: 'detail', route: DETAIL, click: tab('estimate-tab-edit', 3), selector: t('estimate-edit-schedule'),
      title: 'Walkthrough schedule',
      say: 'Book or move the walkthrough here, with a start, an end and how long you expect it to take.',
    },
    {
      id: 'detail-edit-signable', chapter: 'detail', route: DETAIL, click: tab('estimate-tab-edit', 3), selector: t('estimate-edit-signable'),
      title: 'Signable document',
      say: 'Attach a document the customer has to sign before they can approve. Generate with AI drafts one from this estimate and attaches it.',
    },
    {
      id: 'detail-edit-notes', chapter: 'detail', route: DETAIL, click: tab('estimate-tab-edit', 3), selector: t('estimate-edit-notes'),
      title: 'Notes and terms',
      say: 'Customer-facing notes show on their copy and in the portal. Internal notes never do. Terms go at the bottom of the customer’s copy.',
    },
    {
      id: 'detail-edit-save', chapter: 'detail', route: DETAIL, click: tab('estimate-tab-edit', 3), selector: t('estimate-edit-save'),
      title: 'Save or reset',
      say: 'Reset puts everything back the way it was. Save changes keeps your edits. If you changed the title, press Reset now, or just move on and it won’t be saved.',
    },
    {
      id: 'detail-barncam', chapter: 'detail', route: DETAIL, click: tab('estimate-barncam', 4), selector: t('estimate-barncam-panel'),
      title: 'BarnCam',
      say: 'BarnCam holds the photos and video from the walkthrough, so the office can price what the tech saw.',
    },
    {
      id: 'detail-documents', chapter: 'detail', route: DETAIL, click: tab('estimate-documents', 5), selector: t('estimate-documents-panel'),
      title: 'Documents',
      say: 'Documents keeps any files that go with the estimate, like drawings or a supplier quote.',
    },
    {
      id: 'detail-history', chapter: 'detail', route: DETAIL, click: tab('estimate-history', 6), selector: t('estimate-timeline'),
      title: 'History',
      say: 'History is the timeline: made, sent, approved or turned down, expired, re-quoted, converted, and every file added, including ones the customer added in the portal.',
    },
    {
      id: 'detail-activity', chapter: 'detail', route: DETAIL, click: tab('estimate-tab-activity', 7), selector: t('estimate-activity-panel'),
      title: 'Activity',
      say: 'Activity lists the recorded changes, who made them, and when.',
    },

    // ---------- Send and get approval ----------
    {
      id: 'send-email-open', chapter: 'send', route: DETAIL, open: 'estimate:first', selector: t('estimate-email'),
      wait: { appear: EMAIL_PANEL }, doIt: t('estimate-email'),
      yourTurn: 'Click Email estimate.',
      title: 'Email estimate',
      say: 'When it’s ready, send it. Click Email estimate. It only opens the email, so you can read it first.',
    },
    {
      id: 'send-email', chapter: 'send', route: DETAIL, selector: EMAIL_PANEL,
      title: 'The email',
      say: 'It’s addressed to the customer’s contact, with the estimate number and total, and a link where they can review and respond. You can start from one of your email templates, too.',
    },
    {
      id: 'send-email-filled', chapter: 'send', route: DETAIL, selector: `${t('estimate-email-composer')} ${t('composer-filled-from')}`,
      title: 'Filled in for you',
      say: 'A template fills itself in from this estimate and the job behind it: names, address, appointment time, technician. This line says which job it used. Click change to pick a different one.',
    },
    {
      id: 'send-email-blanks', chapter: 'send', route: DETAIL, selector: `${t('estimate-email-composer')} ${t('composer-blanks')}`,
      title: 'Anything still blank',
      say: 'If something couldn’t be filled in, like an appointment time on a job that isn’t booked yet, it’s listed here in yellow. Type it in the box and it drops into the email. It won’t send until every blank is filled.',
    },
    {
      id: 'send-email-what', chapter: 'send', route: DETAIL, selector: EMAIL_PANEL,
      title: 'What Send does',
      say: 'Send email sends it and marks a draft as Sent. We’ll leave it this time.',
    },
    {
      id: 'send-email-close', chapter: 'send', route: DETAIL, selector: `${t('estimate-email-composer')} [aria-label="Close"]`,
      wait: { gone: EMAIL_PANEL }, doIt: `${t('estimate-email-composer')} [aria-label="Close"]`,
      yourTurn: 'Close the email without sending.',
      title: 'Close it',
      say: 'Close it without sending. Nothing goes out.',
    },
    {
      id: 'send-text', chapter: 'send', route: DETAIL, selector: t('estimate-text'),
      title: 'Text estimate',
      say: 'Text estimate does the same as a text message, with the same link. Again, it opens first so you can read it.',
    },
    {
      id: 'send-portal', chapter: 'send', route: DETAIL,
      title: 'What the customer sees',
      say: 'The link opens the estimate in their customer portal. They read the lines and the total, sign any document you attached, and approve it. Their answer shows up here, in the status and the history.',
    },
    {
      id: 'send-messages', chapter: 'send', route: DETAIL, selector: t('estimate-messages'),
      title: 'Messages',
      say: 'Messages opens your whole conversation with this customer. It’s the easy way to follow up and answer their questions.',
    },
    {
      id: 'send-approve', chapter: 'send', route: DETAIL, selector: t('estimate-approve'),
      title: 'Mark Approved',
      say: 'Did they say yes on the phone or in person? Mark Approved records it for them, after asking you first. If the estimate has tiers, it asks which one they took. We’ll leave it.',
    },
    {
      id: 'send-reject', chapter: 'send', route: DETAIL, click: MORE, selector: t('estimate-reject'),
      title: 'Mark Rejected',
      say: 'The rest lives under More actions. If they say no, Mark Rejected closes it out, so it stops asking for a follow up.',
    },
    {
      id: 'send-requote', chapter: 'send', route: DETAIL, click: MORE, selector: t('estimate-requote'),
      title: 'Re-quote',
      say: 'Prices changed, or they want a different option? Re-quote copies every line into a new draft and marks this one as replaced, so you always know which is current.',
    },
    {
      id: 'send-followup', chapter: 'send', route: DETAIL,
      title: 'Following up',
      say: 'Sent estimates show Follow up on the list, and the Files view shows the dormant ones. Set an expiry date on the Edit tab, and once it passes without an answer, the estimate moves to Expired on its own.',
    },
    {
      id: 'send-delete', chapter: 'send', route: DETAIL, click: MORE, selector: t('estimate-delete'),
      title: 'Delete',
      say: 'Delete removes an estimate, after you confirm. Most of the time, Mark Rejected or Re-quote is the better choice, because it keeps the history.',
    },

    // ---------- Service agreement ----------
    {
      id: 'agreement-open', chapter: 'agreement', route: DETAIL, open: 'estimate:first', selector: t('estimate-agreement-builder'),
      wait: { appear: t('agreement-builder') }, doIt: t('estimate-agreement-builder'),
      yourTurn: 'Click Service agreement.',
      title: 'Service agreement',
      say: 'For ongoing work, like a yearly maintenance plan, you can build a service agreement right from the estimate. Click Service agreement.',
    },
    {
      id: 'agreement-intro', chapter: 'agreement', selector: t('agreement-builder'),
      title: 'A draft that stays with the estimate',
      say: 'This builds a draft agreement for legal review. Every draft you save stays attached to this estimate as a numbered revision. You can also start one from a property, a piece of equipment, a customer or a plan request.',
    },
    {
      id: 'agreement-ack', chapter: 'agreement', selector: t('agreement-ack'),
      title: 'Read this first',
      say: 'The first time, it asks you to read a few points and type I understand. That records that you read them, so we’ll leave it for you to do when you’re ready.',
    },
    {
      id: 'agreement-steps', chapter: 'agreement', selector: t('agreement-steps'),
      title: 'Four steps',
      say: 'It goes in four steps: pick a template and the equipment to cover, fill in the coverage table and price, word the sections, then read it and save.',
    },
    {
      id: 'agreement-template', chapter: 'agreement', selector: t('agreement-template'),
      title: 'Template and project details',
      say: 'Pick a trade starter or one of your own templates, then tick the estimate lines to include. Prices and internal notes are always left out. Saved revisions are listed here to read again.',
    },
    {
      id: 'agreement-equipment', chapter: 'agreement', selector: t('agreement-equipment'),
      title: 'Equipment to cover',
      say: 'The equipment on the estimate is ticked for you. Tick anything else at the property, or add a new piece of equipment right here. Each ticked item gets a row in the coverage table: what is done each visit, how often, what is included, and its price.',
    },
    {
      id: 'agreement-draft-ai', chapter: 'agreement',
      title: 'Draft it for me',
      say: 'On the wording step, Draft it for me writes the scope, what is not covered, the customer’s part, changes, warranty and cancellation from your coverage table. Add anything special in the box first, like no parts or a 24-hour response. It never makes up prices or dates: anything it can’t find shows up in a yellow list, and clicking an item takes you to the spot to fill in. It runs on your own CBI AI account; without one, the button takes you to set it up.',
    },
    {
      id: 'agreement-section-ai', chapter: 'agreement',
      title: 'Rewrite, shorter, stricter, friendlier',
      say: 'Each section has buttons to reword it: Rewrite, Shorter, Stricter or Friendlier. Undo puts your last version back. If you have changed a section yourself, Draft it for me asks before replacing your words.',
    },
    {
      id: 'agreement-send-checklist', chapter: 'agreement',
      title: 'Before it can be sent',
      say: 'Under the sections, a checklist shows what still needs doing before the customer can sign: a visit plan for every item, a price, an end date or until cancelled with notice, what is not covered, an email address, and no blanks left. Click any item to jump to it. Sending stays locked until the list is clear.',
    },
    {
      id: 'agreement-summary', chapter: 'agreement',
      title: 'In short',
      say: 'On the read and save step, you can add three plain sentences on what the customer is agreeing to. Write it yourself or press Write it for me. It shows above the agreement and in the signing email.',
    },
    {
      id: 'agreement-sign', chapter: 'agreement',
      title: 'Signing it',
      say: 'Once a revision is saved, you can download it as a PDF, or email the customer a link to sign. After they sign, you countersign, and the signed copy is kept. When it is signed, the service plan starts from the coverage table, and its visits are booked or suggested for you to confirm, whichever you picked. It never approves the estimate.',
    },
    {
      id: 'agreement-close', chapter: 'agreement', selector: t('agreement-close'),
      wait: { gone: t('agreement-builder') }, doIt: t('agreement-close'),
      yourTurn: 'Click Close.',
      title: 'Close',
      say: 'Close the window. Nothing was saved or sent.',
    },

    // ---------- Turn it into a job ----------
    {
      id: 'convert-open', chapter: 'convert', route: DETAIL, open: 'estimate:approved', selector: t('estimate-convert'),
      wait: { appear: CONVERT_DIALOG }, doIt: t('estimate-convert'),
      yourTurn: 'Click Convert to Job.',
      title: 'Convert to Job',
      say: 'Here’s an approved estimate, so Convert to Job is showing. Click it. It opens a window first, so nothing happens yet.',
    },
    {
      id: 'convert-window', chapter: 'convert', route: DETAIL, selector: CONVERT_DIALOG,
      title: 'Make the job',
      say: 'This makes a new work order with the estimate’s lines copied over. The estimate stays as it is, for your records.',
    },
    {
      id: 'convert-fields', chapter: 'convert', route: DETAIL, selector: CONVERT_DIALOG,
      title: 'Schedule the real visit',
      say: 'Pick the job type and priority, then schedule the visit. It’s usually a different day from the walkthrough. Assign the lead tech and crew, and add notes for the tech and for the customer.',
    },
    {
      id: 'convert-button', chapter: 'convert', route: DETAIL, selector: CONVERT_DIALOG,
      title: 'Convert and schedule',
      say: 'Convert and schedule job creates the job and takes you to it. We’ll leave it this time.',
    },
    {
      id: 'convert-close', chapter: 'convert', route: DETAIL, selector: `${t('estimate-convert-modal')} [aria-label="Close"]`,
      wait: { gone: CONVERT_DIALOG }, doIt: `${t('estimate-convert-modal')} [aria-label="Close"]`,
      yourTurn: 'Close the window.',
      title: 'Close it',
      say: 'Close it. No job was made.',
    },
    {
      id: 'convert-after', chapter: 'convert',
      title: 'After it’s a job',
      say: 'Once it’s converted, the estimate links to its job, and any parts held for it show on the job’s line items. You invoice from the job, just like any other. On the schedule, you can also right-click an estimate and pick Convert to job.',
    },

    // ---------- Where estimates show up ----------
    {
      id: 'used-schedule', chapter: 'used', route: SCHEDULE, open: 'goto:/schedule', selector: t('schedule-pending-estimates'),
      title: 'Pending approval',
      say: 'On the schedule, Pending approval lists the estimates you’ve sent that are still waiting, with how long until each one expires.',
    },
    {
      id: 'used-schedule-queue', chapter: 'used', route: SCHEDULE, selector: t('schedule-queue'),
      title: 'Walkthroughs to book',
      say: 'Estimates without a date wait in this list with your jobs. The Estimates filter shows only them. Drag one onto the calendar to book the walkthrough.',
    },
    {
      id: 'used-dispatch', click: RAIL('queue'), chapter: 'used', route: DISPATCH, open: 'goto:/dispatch', selector: t('dispatch-unassigned'),
      title: 'Assessments on dispatch',
      say: 'On the dispatch board, a booked walkthrough shows as an Assessment, right next to the day’s jobs. Open it to assign a tech.',
    },
    {
      id: 'used-dispatch-needs', click: RAIL('queue'), chapter: 'used', route: DISPATCH, selector: t('dispatch-needs-scheduling'),
      title: 'Needs scheduling',
      say: 'Estimates that still need a visit land in Needs scheduling, with a Schedule the visit link.',
    },
    {
      id: 'used-marketplace', chapter: 'used', route: DISPATCH, selector: t('dash-incoming-marketplace'),
      title: 'Estimate requests',
      say: 'Requests for a quote from the marketplace show up here. Send a price or decline without leaving the board.',
    },
    {
      id: 'used-customer', chapter: 'used',
      title: 'On a customer’s account',
      say: 'Every customer’s account has an Estimates tab with all their quotes, and a New Estimate button that starts one with them already picked.',
    },
    {
      id: 'used-start', chapter: 'used',
      title: 'Other ways to start one',
      say: 'You can also start an estimate from an asset with its Estimate button, from a call or message in your intake queue, or from the New job form by switching the record type to Estimate.',
    },
    {
      id: 'used-agreements', chapter: 'used',
      title: 'Service agreements',
      say: 'And on the Service agreements page in the Tool Shed, you can search for any estimate and open its agreement builder from there.',
    },

    // ---------- Settings that shape them ----------
    {
      id: 'settings-intake', chapter: 'settings', route: PREFS, open: 'goto:/tool-shed/preferences#intake', selector: t('prefs-intake'),
      title: 'Job intake rules',
      say: 'In Shop rules, Job intake decides what a new estimate must have. You can require a service location, which is off by default so phone quotes stay quick, require a schedule, or require a description.',
    },
    {
      id: 'settings-numbering', chapter: 'settings', route: PREFS, open: 'goto:/tool-shed/preferences#numbering', selector: t('prefs-numbering'),
      title: 'Estimate numbers',
      say: 'Auto-numbering sets the next estimate number. Handy if you’re carrying on from an old system.',
    },
    {
      id: 'settings-tax', chapter: 'settings', route: '^/catalog/tax-classes/?$', open: 'goto:/catalog/tax-classes', selector: t('tax-table'),
      title: 'Tax classes',
      say: 'Tax classes are the choices in each line’s Tax menu. Set up your rates here.',
    },
    {
      id: 'settings-cost', chapter: 'settings', route: '^/tool-shed/cost-model/?$', open: 'goto:/tool-shed/cost-model', selector: t('cost-assumptions'),
      title: 'Minimum service call and markup',
      say: 'Your cost model sets the minimum service call that estimates warn you about, and the material markup used to price a catalog part that has a cost but no price.',
    },
    {
      id: 'settings-done', chapter: 'settings', route: LIST, open: 'goto:/estimates',
      selector: `${t('estimates-header')}, ${t('estimates-action-cards')}`,
      title: 'That’s the lot',
      say: 'And that’s estimates, from the first draft to a booked job. You can take this tutorial again any time from the button at the top of the page.',
    },
  ],
}
