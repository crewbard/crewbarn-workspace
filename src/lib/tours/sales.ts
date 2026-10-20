import type { GuidedTour } from '@/lib/guidedTours'

/**
 * Sales area tours (owner 05): estimates, invoices, service agreements,
 * warranties, payment terms, and the two public signing pages.
 *
 * Steps target data-tour attributes in the page components. The engine
 * skips any step whose target isn't on screen (Easy-theme-only cards,
 * buttons a role can't use, panels that only show when there's something
 * in them), so optional steps are marked and the rest still run.
 *
 * Estimate form targets on /estimates/new (estimate-customer,
 * estimate-lineitems, estimate-save, job-schedule) are set by
 * components/WorkOrderForm.tsx (owner 03).
 */
export const SALES_TOURS: GuidedTour[] = [
  // ---------------------------------------------------------------- Estimates
  {
    id: 'estimates-list',
    title: 'Your estimates',
    description: 'Every quote, sorted by where it is in the approval cycle, plus orders customers build in the portal.',
    route: /^\/estimates\/?$/,
    roadmap: [
      { title: 'A quote comes in', detail: 'By phone, from a walkthrough, or as a customer’s portal order.' },
      { title: 'Here', detail: 'Find it, start a new one, or turn a portal order into a draft.' },
      { title: 'Open an estimate', detail: 'Send it, follow up, and record the customer’s answer.' },
      { title: 'Approved', detail: 'The green “→ Convert” chip turns it into a job.' },
      { title: 'Job done', detail: 'Invoice it from the job.' },
    ],
    use: {
      say: 'When an estimate is approved and converted, the new job goes on the Jobs board and its visit lands on the Schedule. You invoice it from the job once the work is done.',
      go: [{ label: 'Go to Jobs', to: '/jobs' }, { label: 'Go to Schedule', to: '/schedule' }],
    },
    steps: [
      {
        selector: '[data-tour="estimates-new"]',
        title: 'Start a new estimate',
        say: 'This is where every quote lives. New opens the same form you use for jobs, set to Estimate. You only see it if you can create estimates.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="estimates-customer-orders"]',
        title: 'Orders from customers',
        say: 'When a customer picks parts from your catalogs in their portal, it lands here. One click makes it a draft estimate, and you price anything you don’t carry.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="estimates-action-cards"]',
        title: 'Pick a pile to work',
        say: 'Drafts to finish, ones waiting on the customer, approved work, or ones past their expiry. Each card filters the list.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="estimates-tabs"]',
        title: 'The approval cycle',
        say: 'These tabs follow the approval cycle, and the numbers are live counts. Superseded quotes are in the status dropdown.',
      },
      {
        selector: '[data-tour="estimates-filters"]',
        title: 'Search and filter',
        say: 'Search by estimate number or notes, or narrow by status. If your estimate view is Cards or Files, you can switch between them here.',
      },
      {
        selector: '[data-tour="estimates-view"]',
        title: 'Board or list',
        say: 'The workflow board puts this page of results into four lanes. Switch to the detailed list for rows and the filing cabinet.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="estimates-list"]',
        title: 'The list',
        say: 'Each row has a colored stripe for its status, the total, and a date that changes with the status. The little chip tells you the next move. “→ Convert” opens the estimate with the convert window up, and it still asks before making a job.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="estimates-pager"]',
        title: 'More pages',
        say: 'Twenty-five estimates to a page. Use Previous and Next to move through them.',
        optional: 'Skip',
      },
    ],
  },
  {
    id: 'estimate-create',
    title: 'Writing an estimate',
    description: 'The same form as a new job, set to Estimate. The schedule here is for a walkthrough, not the work.',
    route: /^\/estimates\/new\/?$/,
    roadmap: [
      { title: 'Who it’s for', detail: 'Pick the customer, and a location if you have one.' },
      { title: 'The work', detail: 'Describe it and pick a job type.' },
      { title: 'A walkthrough?', detail: 'Optionally schedule a visit to look, and pick covered assets.' },
      { title: 'Price it', detail: 'Add line items now or later on the estimate.' },
      { title: 'Create', detail: 'You land on the new estimate, ready to send.' },
    ],
    use: {
      say: 'A walkthrough you schedule here shows on the Schedule and the Dispatch board alongside your jobs. Every quote, sent or not, is on Estimates.',
      go: [{ label: 'Go to Estimates', to: '/estimates' }, { label: 'Go to Schedule', to: '/schedule' }, { label: 'Go to Dispatch', to: '/dispatch' }],
    },
    steps: [
      {
        selector: '[data-tour="estimate-new-header"]',
        title: 'A new quote',
        say: 'Phone quote? Skip scheduling. Walkthrough? Schedule it here, the same way you’d book a job.',
      },
      {
        selector: '[data-tour="estimate-customer"]',
        title: 'Who it’s for',
        say: 'Start with the customer. A location is optional on a quote unless your company requires one. Tick “Bill a different customer” if someone else pays.',
      },
      {
        selector: '[data-tour="job-setup-tools"]',
        title: 'Optional extras',
        say: 'Attach something the customer has to sign before approving, upload their PO so CBI can read it in, add photos, or attach an inspection checklist.',
        optional: 'Skip the extras',
      },
      {
        selector: '[data-tour="job-basics"]',
        title: 'Describe the work',
        say: 'Give it a title and a job type, set the priority, and describe the work.',
      },
      {
        selector: '[data-tour="job-schedule"]',
        title: 'Walkthrough schedule',
        say: 'Only if someone is going out to look. Leave it unscheduled for a phone quote.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="job-assets"]',
        title: 'Covered assets',
        say: 'Optional. Pick which of the customer’s assets this quote covers, so each line can be tied to one.',
        optional: 'Skip assets',
      },
      {
        selector: '[data-tour="estimate-lineitems"]',
        title: 'Line items',
        say: 'You can price it now or later on the estimate. Lines can be tied to one of the covered assets. New tier offers good, better and best versions of the job, each a copy you change.',
      },
      {
        selector: '[data-tour="job-notes"]',
        title: 'Notes',
        say: 'Internal notes stay with your team. Public notes may show on what the customer sees.',
        optional: 'Skip notes',
      },
      {
        selector: '[data-tour="estimate-save"]',
        title: 'Create the estimate',
        say: 'Create Estimate saves it, uploads any files, and opens the new estimate. If a file or line didn’t make it, you’ll get a list of what to add again.',
      },
    ],
  },
  {
    id: 'estimate-detail',
    title: 'One estimate, start to finish',
    description: 'Price it, send it, record the answer, re-quote it, or turn it into a job.',
    route: /^\/estimates\/(?!new\/?$)[^/]+\/?$/,
    roadmap: [
      { title: 'Draft', detail: 'Build the line items and check the details.' },
      { title: 'Send it', detail: 'Email or text it. A draft is marked Sent once the message goes.' },
      { title: 'The answer', detail: 'The customer answers in the portal, or you mark it Approved or Rejected.' },
      { title: 'Changes?', detail: 'Re-quote makes a new draft and retires this one.' },
      { title: 'Approved', detail: 'Convert to Job schedules the work.' },
    ],
    use: {
      say: 'Convert to Job puts the work on the Jobs board, and the visit you book in the convert window lands on the Schedule. From there the job carries on to the invoice.',
      go: [{ label: 'Go to Jobs', to: '/jobs' }, { label: 'Go to Schedule', to: '/schedule' }],
    },
    steps: [
      {
        selector: '[data-tour="estimate-header"]',
        title: 'The estimate',
        say: 'Here’s the estimate number, the customer, and the status.',
      },
      {
        selector: '[data-tour="estimate-actions"]',
        title: 'What you can do now',
        say: 'Send it by email or text, record the answer, re-quote, or convert. Each button only shows when it makes sense and when your role can change estimates.',
      },
      {
        selector: '[data-tour="estimate-convert"]',
        title: 'Convert to a job',
        say: 'This makes a new job with the estimate’s lines copied over. The estimate stays for history. You schedule the actual work in the window that opens.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="estimate-agreement-builder"]',
        title: 'Service agreement',
        say: 'Drafts a service agreement from this estimate: the equipment it covers, what is done each visit, how often and the price. Saving never sends or starts anything.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="estimate-tabs"]',
        title: 'The tabs',
        say: 'Overview for the quick read, Line Items to price it, Edit for the header details, then photos, documents and history.',
      },
      {
        selector: '[data-tour="estimate-tab-line-items"]',
        title: 'Line items',
        say: 'Price the work here. Each change saves when you leave the field. Picking a catalog item uses its listed price, or your markup on cost when it has none.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="estimate-tab-edit"]',
        title: 'Edit the details',
        say: 'Title, expiry, walkthrough time, notes and terms. Nothing there saves until you press Save changes. You can also attach a document the customer must sign before approving.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="estimate-history"]',
        title: 'History',
        say: 'Everything that happened to this estimate, in order: sent, approved, re-quoted, converted.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="estimate-customer-strip"]',
        title: 'Customer and location',
        say: 'The customer’s name links to their record.',
      },
    ],
  },

  // ---------------------------------------------------------------- Invoices
  {
    id: 'invoices-list',
    title: 'Your invoices',
    description: 'What needs collecting. Open an invoice, or take a payment right from its card.',
    route: /^\/(accounting\/)?invoices\/?$/,
    roadmap: [
      { title: 'Job finished', detail: 'The invoice is made from the job, or by an agreement each period.' },
      { title: 'Here', detail: 'See drafts, sent, overdue and paid.' },
      { title: 'Draft', detail: 'Open it, check it, and send it.' },
      { title: 'Money comes in', detail: 'Take payment straight from the card.' },
      { title: 'Paid', detail: 'Find it later in the Files cabinet.' },
    ],
    use: {
      say: 'The Money desk under Accounting is your to-do list for money: invoices never sent, late ones to remind, and cash your techs collected to check in. Each invoice’s due date comes from the customer’s payment term.',
      go: [{ label: 'Open Money desk', to: '/accounting' }, { label: 'Open Payment terms', to: '/tool-shed/payment-terms' }],
    },
    steps: [
      {
        selector: '[data-tour="invoices-header"]',
        title: 'Invoices',
        say: 'There’s no New button here on purpose. Invoices come from jobs and agreements.',
      },
      {
        selector: '[data-tour="invoices-action-cards"]',
        title: 'Pick a pile',
        say: 'Past due, not sent yet, sent, or paid. Each card filters the list.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="invoices-tabs"]',
        title: 'Where each invoice is',
        say: 'All, Draft, Sent, Overdue and Paid. Sent includes the overdue ones. Cancelled invoices only show under All.',
      },
      {
        selector: '[data-tour="invoices-filters"]',
        title: 'Search and view',
        say: 'Search by invoice number or customer. Cards shows a grid; Files files them by year and month.',
      },
      {
        selector: '[data-tour="invoices-files"]',
        title: 'The filing cabinet',
        say: 'Pick a year, then a month. Each folder shows the total and what’s still outstanding.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="invoices-cards"]',
        title: 'Invoice cards',
        say: 'Each card shows the total, the balance, the job and the due date. If money’s owed and your role can take payments, the green button records one without leaving the list.',
        optional: 'Cards show in the Cards view',
      },
    ],
  },
  {
    id: 'invoice-detail',
    title: 'One invoice',
    description: 'Line items, totals, dates, and the actions to send it, take payment, print it, or cancel it.',
    route: /^\/invoices\/[^/]+\/?$/,
    roadmap: [
      { title: 'Draft', detail: 'Made from a job or an agreement.' },
      { title: 'Send it', detail: 'Email or text it from View / Print, then it counts as sent.' },
      { title: 'Take payment', detail: 'In full, in part, on a terminal, or by Stripe.' },
      { title: 'Paid', detail: 'Stamped Paid. Nothing left to do.' },
    ],
    use: {
      say: 'To change the lines, open the job it came from. Once it’s sent, a past-due invoice shows on the Money desk under Late with a reminder ready, and any warranty on what you sold appears on Warranties.',
      go: [{ label: 'Open Money desk', to: '/accounting' }, { label: 'Go to Warranties', to: '/warranties' }],
    },
    steps: [
      {
        selector: '[data-tour="invoice-header"]',
        title: 'The invoice',
        say: 'Number, job title and status. Red Overdue and blue “Bank transfer on the way” tags show up when they apply.',
      },
      {
        selector: '[data-tour="invoice-glance"]',
        title: 'At a glance',
        say: 'The total, what’s been paid, and what’s still owed.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="invoice-lines"]',
        click: '[data-tour="invoice-section-charges"]',
        title: 'Line items',
        say: 'The lines and the totals, down to the balance due. You change lines on the job, not here.',
      },
      {
        selector: '[data-tour="invoice-bill-to"]',
        click: '[data-tour="invoice-section-overview"]',
        title: 'Who pays',
        say: 'The customer, and the job this invoice came from.',
      },
      {
        selector: '[data-tour="invoice-dates"]',
        title: 'Dates',
        say: 'When it was issued, when it’s due, and when it was sent, paid or cancelled.',
      },
      {
        selector: '[data-tour="invoice-actions"]',
        click: '[data-tour="invoice-section-overview"]',
        title: 'What you can do',
        say: 'What shows depends on the status and your role. “Mark as sent” only changes the status; it doesn’t email anyone.',
      },
      {
        selector: '[data-tour="invoice-print"]',
        click: '[data-tour="invoice-section-overview"]',
        title: 'View, print and send',
        say: 'This opens what the customer sees. Print it, email it to the address on file, or text a view-and-pay link from there.',
      },
    ],
  },

  // ---------------------------------------------------------------- Agreements
  {
    id: 'contracts-list',
    title: 'Service agreements',
    description: 'Work you’ve agreed to do on a schedule for a fee. Each agreement books its own visits and bills itself.',
    route: /^\/maintenance-contracts\/?$/,
    roadmap: [
      { title: 'A customer asks', detail: 'For a plan in the portal, or you sell one.' },
      { title: 'Here', detail: 'Answer requests or start a new agreement.' },
      { title: 'New agreement', detail: 'Customer, services, rhythm, price, paperwork.' },
      { title: 'Start it', detail: 'Visits get placed, go on the board as jobs, and the fee gets invoiced.' },
    ],
    use: {
      say: 'Each running agreement puts its visits on the Jobs board as jobs and raises its own invoices, which you’ll find on Invoices. Whether those invoices wait as drafts is your choice in the contract invoices setting.',
      go: [{ label: 'Go to Jobs', to: '/jobs' }, { label: 'Go to Invoices', to: '/invoices' }, { label: 'Contract invoice setting', to: '/tool-shed/preferences/contract-invoices' }],
    },
    steps: [
      {
        selector: '[data-tour="contracts-header"]',
        title: 'Scheduled work for a fee',
        say: 'Agreements are scheduled work for a set fee. Each one books its own jobs and bills itself.',
      },
      {
        selector: '[data-tour="contracts-new"]',
        title: 'New service agreement',
        say: 'Start one from scratch here. You only see it if your role can create agreements.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="contracts-tabs"]',
        title: 'Agreements and requests',
        say: 'Your agreements, and the plan requests customers send from their portal. The badge shows how many are waiting.',
      },
      {
        selector: '[data-tour="contracts-filters"]',
        title: 'Search and status',
        say: 'Search by name, or narrow to the ones not started, waiting to be signed, running, paused, ended or cancelled.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="contracts-list"]',
        title: 'Agreement cards',
        say: 'Each card shows the name, status, term, what’s covered, and the fee per billing period. Click one to open it.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="contracts-requests"]',
        title: 'Plan requests',
        say: 'When a customer asks for a plan, you see exactly the schedule they asked for. One click turns it into a draft agreement.',
      },
    ],
  },
  {
    id: 'contract-create',
    title: 'Setting up an agreement',
    description: 'Four steps: who, what, how much, and the paperwork. The summary shows what you’re committing to.',
    route: /^\/maintenance-contracts\/new\/?$/,
    roadmap: [
      { title: 'Customer', detail: 'Who, and which properties.' },
      { title: 'What’s covered', detail: 'Services, equipment, how often.' },
      { title: 'Price and term', detail: 'Fee, billing period, dates, who looks after it.' },
      { title: 'Contract and send', detail: 'Attach or draft the wording.' },
      { title: 'Save or start', detail: 'A draft does nothing yet; starting it places the visits now.' },
    ],
    use: {
      say: 'Each service needs a job type, so set those up in Job types first. The contract you attach is one of your contract templates in Templates & Forms, and Service Agreements in the Tool Shed is where you write or import one.',
      go: [{ label: 'Open Job types', to: '/tool-shed/job-types' }, { label: 'Open Templates & Forms', to: '/custom-documents' }, { label: 'Service Agreements setup', to: '/tool-shed/service-agreements' }],
    },
    steps: [
      {
        selector: '[data-tour="contract-new-header"]',
        title: 'A new agreement',
        say: 'Work you’ve agreed to do on a schedule, for a fee. CrewBarn places the visits, puts them on the board as jobs, and invoices the fee.',
      },
      {
        selector: '[data-tour="contract-new-steps"]',
        title: 'Four steps',
        say: 'You can jump between them. Nothing saves until the last one.',
      },
      {
        selector: '[data-tour="contract-new-customer"]',
        title: 'Who it’s for',
        say: 'Have it on paper already? Upload it and CrewBarn reads it in for you to check. Otherwise pick the customer, name it, and tick the properties.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="contract-new-services"]',
        title: 'What you’ll do',
        say: 'One card per service, each with its own job type and rhythm. Pick the job type yourself; it isn’t filled in for you. You can make part of the year different.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="contract-new-money"]',
        title: 'The money and the term',
        say: 'The fee covers the visits. They’re never invoiced one by one.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="contract-new-document"]',
        title: 'The contract itself',
        say: 'Attach a contract template, or have one drafted from what you’ve entered.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="contract-new-summary"]',
        title: 'What they agree to',
        say: 'Worked out by the real planner: how many jobs you’re promising in year one, what it bills, and when the first visits land.',
      },
      {
        selector: '[data-tour="contract-new-save"]',
        title: 'Save or start',
        say: 'Save as a draft books nothing. Start the agreement places the visit dates now. If part of the save fails, you’ll see exactly what was saved and a link to it.',
      },
    ],
  },
  {
    id: 'contract-detail',
    title: 'One service agreement',
    description: 'Its status, visits, covered equipment, billing, and the rhythm of each service.',
    route: /^\/maintenance-contracts\/(?!new\/?$)[^/]+\/?$/,
    roadmap: [
      { title: 'Not started', detail: 'Send it to sign, or record a paper signature.' },
      { title: 'Start it', detail: 'Visit dates get placed.' },
      { title: 'On the board', detail: 'Each visit becomes a job 14 days before it’s due.' },
      { title: 'Billing', detail: 'Each billing period raises an invoice.' },
      { title: 'Pause', detail: 'Pause it or pick it back up as needed.' },
    ],
    use: {
      say: 'Once it’s started, each visit becomes a job on the Schedule ahead of its due date, and each billing period’s invoice lands on Invoices. The contract invoices setting decides whether those invoices wait as drafts for you.',
      go: [{ label: 'Go to Schedule', to: '/schedule' }, { label: 'Go to Invoices', to: '/invoices' }, { label: 'Contract invoice setting', to: '/tool-shed/preferences/contract-invoices' }],
    },
    steps: [
      {
        selector: '[data-tour="contract-header"]',
        title: 'The agreement',
        say: 'The name, the term and the fee. The colored tag tells you whether it’s actually doing anything.',
      },
      {
        selector: '[data-tour="contract-actions"]',
        title: 'Move it along',
        say: 'Send it to sign, record a paper signature, start it, or pause it. These only show for roles that can change agreements.',
      },
      {
        selector: '[data-tour="contract-tabs"]',
        title: 'Overview, visits, equipment, billing, history',
        say: 'Coming visits and money first. Visits lists every date and what was done; Billing links each period to its invoice.',
      },
      {
        selector: '[data-tour="contract-services"]',
        title: 'What is covered',
        say: 'Each service card has a year strip so you can see the rhythm at a glance. A season beats the all-year rhythm where they overlap.',
      },
    ],
  },
  {
    id: 'service-agreement-settings',
    title: 'Setting up a service agreement',
    description: 'The legal side: the notice, who reviews your agreements, and writing or importing a template.',
    route: /^\/tool-shed\/service-agreements\/?$/,
    roadmap: [
      { title: 'Read the notice', detail: 'And record that you understand it.' },
      { title: 'Your reviewer', detail: 'Who reads your agreements before you use them.' },
      { title: 'Write or import', detail: 'A new draft, or the agreement you already use.' },
      { title: 'Edit it', detail: 'In Templates & Forms.' },
      { title: 'Use it', detail: 'Attach it to an agreement or an estimate.' },
    ],
    use: {
      say: 'Drafts and imports land in Templates & Forms, where you edit them. From there you attach one to a new service agreement, or use the Service agreement button on an estimate.',
      go: [{ label: 'Open Templates & Forms', to: '/custom-documents' }, { label: 'New service agreement', to: '/maintenance-contracts/new' }, { label: 'Go to Estimates', to: '/estimates' }],
    },
    steps: [
      {
        selector: '[data-tour="agreements-estimate-picker"]',
        title: 'An agreement for one quote',
        say: 'Want an agreement for a specific estimate? Find it here and open the builder.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="agreements-tabs"]',
        title: 'Two parts',
        say: 'Review & setup first, then Create or import.',
      },
      {
        selector: '[data-tour="agreements-notice"]',
        title: 'Read this first',
        say: 'Read the notice about using agreements CrewBarn writes.',
        click: '[data-tour="agreements-tab-setup"]',
      },
      {
        selector: '[data-tour="agreements-ack"]',
        title: 'Record that you understand',
        say: 'Type “I understand” and press Record this. It records who accepted it and when. If the wording changes, you’ll be asked to read it again.',
        optional: 'Once you’ve accepted, this is done',
        click: '[data-tour="agreements-tab-setup"]',
      },
      {
        selector: '[data-tour="agreements-reviewer"]',
        title: 'Who reviews your agreements',
        say: 'Put your lawyer or legal service here so a draft has somewhere to go. You deal with them directly.',
        click: '[data-tour="agreements-tab-setup"]',
      },
      {
        selector: '[data-tour="agreements-reviewer-fields"]',
        title: 'Their details',
        say: 'Their name, where to send agreements, and an API key if they gave you one. The key is stored encrypted. Press Save to keep them. Nothing is sent to them automatically.',
        click: '[data-tour="agreements-tab-setup"]',
      },
      {
        selector: '[data-tour="agreements-write-fields"]',
        title: 'Write the agreement',
        say: 'Fill in what it covers, what it doesn’t, cancellation, payment terms and anything else. Leave a box empty and it stays a blank. Nothing is invented.',
        optional: 'Skip',
        click: '[data-tour="agreements-tab-draft"]',
      },
      {
        selector: '[data-tour="agreements-generate"]',
        title: 'Write me a draft',
        say: 'CrewBarn writes a draft agreement from your answers. It arrives switched off, with the notice printed on it, so you can check it first.',
        optional: 'Skip',
        click: '[data-tour="agreements-tab-draft"]',
      },
      {
        selector: '[data-tour="agreements-import"]',
        title: 'Already have one?',
        say: 'Upload a PDF or photo and CrewBarn reads it into an editable draft, with the customer details turned into fill-ins. Check it against the original before you use it.',
        optional: 'Skip',
        click: '[data-tour="agreements-tab-draft"]',
      },
    ],
  },

  // ---------------------------------------------------------------- Warranties
  {
    id: 'warranties',
    title: 'Warranties',
    description: 'Every warranty written when an invoice was sent: what’s covered, for whom, and when it runs out.',
    route: /^\/warranties\/?$/,
    roadmap: [
      { title: 'Invoice sent', detail: 'Warranty rows are written automatically.' },
      { title: 'Here', detail: 'Find coverage by customer, item, asset or invoice.' },
      { title: 'A customer calls', detail: 'Check the dates, then record a claim.' },
      { title: 'No longer applies', detail: 'Void it with a reason.' },
    ],
    use: {
      say: 'How long each item is covered is set on the item in the Product Catalog, and the claim rule and warning window are in Warranty Settings. A row shows up here each time an invoice with covered items is sent.',
      go: [{ label: 'Open Product Catalog', to: '/catalog/products' }, { label: 'Open Warranty Settings', to: '/tool-shed/warranty-settings' }, { label: 'Go to Invoices', to: '/invoices' }],
    },
    steps: [
      {
        selector: '[data-tour="warranties-header"]',
        title: 'Written for you',
        say: 'Warranties are written for you when an invoice goes out. The rules live in Warranty settings.',
      },
      {
        selector: '[data-tour="warranties-action-cards"]',
        title: 'Review coverage',
        say: 'All, active, expired or claimed coverage, one click each.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="warranties-filters"]',
        title: 'Find coverage',
        say: 'Search by customer, item, asset or invoice number, or filter by status.',
      },
      {
        selector: '[data-tour="warranties-table"]',
        title: 'Three kinds of cover',
        say: 'Manufacturer, company and labor cover can run out on different days. Anything within a week turns red. If your role allows it, active rows have Claim and Void.',
        optional: 'Skip',
      },
    ],
  },
  {
    id: 'warranty-settings',
    title: 'Warranty rules',
    description: 'What a claim does, and how early coverage is flagged as expiring. Coverage lengths are set per catalog item.',
    route: /^\/tool-shed\/warranty-settings\/?$/,
    roadmap: [
      { title: 'Catalog items', detail: 'Set coverage days on each one.' },
      { title: 'Here', detail: 'Pick the claim policy and the warning window.' },
      { title: 'Invoices', detail: 'Warranties are written when an invoice is sent.' },
      { title: 'Expiring soon', detail: 'Shows on the dashboard and the Warranties page.' },
    ],
    use: {
      say: 'Coverage days live on each item in the Product Catalog, and labor cover on services in the Service Catalog. Expiring and claimed warranties show on Warranties, and the Warranty expiring reminder in Automations emails customers using the same window.',
      go: [{ label: 'Open Product Catalog', to: '/catalog/products' }, { label: 'Go to Warranties', to: '/warranties' }, { label: 'Open Automations', to: '/tool-shed/automations' }],
    },
    steps: [
      {
        selector: '[data-tour="warranty-rules-header"]',
        title: 'Your warranty rules',
        say: 'These are the company-wide rules. How long each item is covered is set on the catalog item.',
      },
      {
        selector: '[data-tour="warranty-rules-preview"]',
        title: 'Preview',
        say: 'This sums up your choices before you save.',
      },
      {
        selector: '[data-tour="warranty-claim-policy"]',
        title: 'Claim policy',
        say: 'Allow more than one claim until it expires, or end the coverage after the first claim.',
      },
      {
        selector: '[data-tour="warranty-expiring-days"]',
        title: 'Expiring soon',
        say: 'How many days ahead a warranty shows as expiring soon. On its own this sends nothing; the Warranty expiring reminder automation, if you turn it on, uses the same window.',
      },
      {
        selector: '[data-tour="warranty-rules-save"]',
        title: 'Save',
        say: 'Nothing changes until you press Save warranty settings.',
      },
    ],
  },

  // ---------------------------------------------------------------- Payment terms
  {
    id: 'payment-terms',
    title: 'Payment terms',
    description: 'Your billing terms, like COD or NET 30. The starred one is the default for new customers.',
    route: /^\/tool-shed\/payment-terms\/?$/,
    roadmap: [
      { title: 'Set up terms', detail: 'Here, once.' },
      { title: 'Star a default', detail: 'New customers get it unless you pick another.' },
      { title: 'Per customer', detail: 'Give a customer their own term on their record.' },
      { title: 'Due dates', detail: 'Invoices get their due date from the term.' },
    ],
    use: {
      say: 'To give one customer a different term, open the customer and press Edit info; Payment terms is on that form. Their invoices then get their due date from it.',
      go: [{ label: 'Go to Customers', to: '/customers' }, { label: 'Go to Invoices', to: '/invoices' }],
    },
    steps: [
      {
        selector: '[data-tour="payment-terms-header"]',
        title: 'Your billing terms',
        say: 'Each customer can have a term, and the invoice creator uses it to set the due date.',
      },
      {
        selector: '[data-tour="payment-terms-new"]',
        title: 'Add a term',
        say: 'Give it a name and the number of days until it’s due. Zero means due on receipt.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="payment-terms-seed"]',
        title: 'Start with the usual ones',
        say: 'No terms yet? One click adds COD, NET 14, NET 30 and NET 60, with COD as the default.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="payment-terms-summary"]',
        title: 'The default',
        say: 'Which term new customers get, and how many terms are active.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="payment-terms-table"]',
        title: 'Your terms',
        say: 'Click the star to make a term the default. Clicking the star on the current default clears it. Edit or delete from the right.',
        optional: 'Skip',
      },
      { selector: '[data-tour="payment-term-form-name"]', title: 'Name', say: 'What the term is called on customers and invoices, like NET 30.', optional: 'Only for people who can edit', click: '[data-tour="payment-terms-new-button"]' },
      { selector: '[data-tour="payment-term-form-days"]', title: 'Days until due', say: 'How many days after the invoice date payment is due. Zero means due on receipt.', optional: 'Only for people who can edit', click: '[data-tour="payment-terms-new-button"]' },
      { selector: '[data-tour="payment-term-form-description"]', title: 'Description', say: 'Optional. A note on when to use it.', optional: 'Only for people who can edit', click: '[data-tour="payment-terms-new-button"]' },
      { selector: '[data-tour="payment-term-form-active"]', title: 'Active', say: 'Untick it to stop offering the term without deleting it. Press Save to keep it.', optional: 'Only for people who can edit', click: '[data-tour="payment-terms-new-button"]' },
    ],
  },

  // ---------------------------------------------------------------- Public signing
  {
    id: 'sign-document',
    title: 'Signing a document',
    description: 'What a signer sees when you send a document for signature.',
    route: /^\/sign\/[^/]+\/?$/,
    roadmap: [
      { title: 'Sent', detail: 'You send a document for signature.' },
      { title: 'Opened', detail: 'The signer opens the link.' },
      { title: 'Signed or declined', detail: 'They read it, draw a signature and submit, or decline with a reason.' },
      { title: 'Added', detail: 'Their signature goes into the document’s PDF.' },
    ],
    use: {
      say: 'When the signer finishes or declines, you see it on that customer’s account under Files, in Documents, where the request was sent from.',
      go: [{ label: 'Go to Customers', to: '/customers' }],
    },
    steps: [
      {
        selector: '[data-tour="sign-doc-header"]',
        title: 'The document',
        say: 'Here’s what you’ve been asked to sign, the part you sign as, and how long the link works.',
      },
      {
        selector: '[data-tour="sign-doc-body"]',
        title: 'Read it',
        say: 'Your signature spot is marked in the text.',
      },
      {
        selector: '[data-tour="sign-doc-signature"]',
        title: 'Your signature',
        say: 'Draw it with a mouse, finger or stylus. Clear and redraw if you need to.',
      },
      {
        selector: '[data-tour="sign-doc-submit"]',
        title: 'Sign and submit',
        say: 'This sends your signature. It’s ready once you’ve drawn something.',
      },
      {
        selector: '[data-tour="sign-doc-decline"]',
        title: 'Or decline',
        say: 'If you don’t want to sign, decline and give a reason if you like. The sender is told.',
      },
    ],
  },
  {
    id: 'sign-agreement',
    title: 'Signing an agreement',
    description: 'What a customer sees when you send a service agreement to sign.',
    route: /^\/sign-agreement\/[^/]+\/?$/,
    roadmap: [
      { title: 'Sent', detail: 'The agreement is sent from the estimate’s agreement builder.' },
      { title: 'Signed or declined', detail: 'The customer reads it and signs, or declines.' },
      { title: 'Countersigned', detail: 'The company countersigns and both signatures are archived.' },
    ],
    use: {
      say: 'Once the customer signs, the agreement waits for your counter-signature on the job’s Agreements tab, or in the Service agreement window on the estimate it was sent from.',
      go: [{ label: 'Go to Jobs', to: '/jobs' }, { label: 'Go to Estimates', to: '/estimates' }],
    },
    steps: [
      {
        selector: '[data-tour="sign-agreement-header"]',
        title: 'Who it’s from',
        say: 'The company that sent this agreement, and how to reach them.',
      },
      {
        selector: '[data-tour="sign-agreement-body"]',
        title: 'The agreement',
        say: 'Read the whole agreement here. The date the link stops working is shown under the title.',
      },
      {
        selector: '[data-tour="sign-agreement-signature"]',
        title: 'Your signature',
        say: 'Draw your signature and type your printed name. Your name, the time and your IP address are recorded.',
      },
      {
        selector: '[data-tour="sign-agreement-submit"]',
        title: 'Sign or decline',
        say: 'Sign agreement sends it back. Decline if you don’t agree; you can say why.',
      },
    ],
  },
]
