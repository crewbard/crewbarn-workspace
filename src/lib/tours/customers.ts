import type { GuidedTour } from '@/lib/guidedTours'

/**
 * Guided tours for the Customers and Communication area (owner 02):
 * customer list, new customer, customer account, Messages, Calls, Intake
 * Queue, and the Tool Shed › Customers & Workflow pages.
 *
 * Steps target real `data-tour` attributes on those pages. The tour engine
 * skips any step whose target is not on screen (for example a button hidden
 * from view-only users), so optional parts are safe.
 */
export const CUSTOMER_TOURS: GuidedTour[] = [
  {
    id: 'customers',
    title: 'Your customer list',
    description: 'Find the people and businesses you work for, then open their account.',
    route: /^\/customers(\/search)?\/?$/,
    roadmap: [
      { title: 'New requests', detail: 'New people usually show up in Messages or the Intake Queue first.' },
      { title: 'Customer list', detail: 'Search or browse to see if they already exist.' },
      { title: 'New customer', detail: 'Add them if they don’t.' },
      { title: 'Customer account', detail: 'Open them for locations, equipment, jobs, estimates, invoices, and messages.' },
      { title: 'Jobs and invoices', detail: 'Create the work and the billing from the account.' },
    ],
    use: {
      say: 'Open a customer and use + New job or + New Estimate on their account to start work with them already filled in. New people often show up first in Messages or the Intake Queue.',
      go: [{ label: 'Open Intake Queue', to: '/intake' }, { label: 'Go to Messages', to: '/communications' }],
    },
    steps: [
      { selector: '[data-tour="customers-new"]', title: 'Add a customer', say: 'This is everyone you work for. The number under the title is how many customers you have. Use + New to add someone.', optional: 'Only shown if you can edit customers' },
      { selector: '[data-tour="customers-type-tabs"]', title: 'Narrow by type', say: 'These tabs narrow the list by customer type. The number on each tab is how many customers of that type you have.' },
      { selector: '[data-tour="customers-search"]', title: 'Find someone fast', say: 'Type a name, email, or phone number to find someone fast. On a bigger screen you can switch between Cards and A–Z Files here.' },
      { selector: '[data-tour="customers-list"]', title: 'Open a customer', say: 'Each customer shows their type, account number, lifetime paid, and when you last talked. The colored stripe flags warnings, VIPs, and recurring customers. Click a customer to open their account.' },
      { selector: '[data-tour="customers-pager"]', title: 'Move through pages', say: 'Big lists are split into pages of 25. Use Previous and Next to move through them.', optional: 'Only shown when there is more than one page' },
    ],
  },
  {
    id: 'customer-create',
    title: 'Create the first customer',
    description: 'Build the customer record once, then use it for locations, equipment, jobs, messages, estimates, and billing.',
    route: /^\/customers\/new\/?$/,
    roadmap: [
      { title: 'Customer', detail: 'Pick residential, commercial, or government and enter the name.' },
      { title: 'Contact', detail: 'Add the phone and email, and tick who gets job updates, invoices, and intake approvals.' },
      { title: 'Service location', detail: 'Add where the work happens. Tick Gated property to record a gate code and entry notes.' },
      { title: 'Save', detail: 'Create customer saves the record and takes you back to the customer list.' },
      { title: 'Equipment and first job', detail: 'Open the customer from the list, then use the Assets tab or + New job.' },
    ],
    use: {
      say: 'Once saved, the customer can be picked on a new job or estimate. Open them from the list to add equipment on the Assets tab or start their first job.',
      go: [{ label: 'Start a job', to: '/jobs/new' }, { label: 'Start an estimate', to: '/estimates/new' }],
    },
    steps: [
      { selector: '[data-tour="customer-identity"]', click: '[data-tour="customer-new-tab-account"]', title: 'Start with who you work for', say: 'Choose Residential, Commercial, or Government. Residential asks for a first and last name; the other two ask for a business or agency name. That name follows the customer onto jobs, estimates, and invoices.' },
      { selector: '[data-tour="customer-contacts"]', click: '[data-tour="customer-new-tab-contacts"]', title: 'Add the people you will contact', say: 'Add a phone and email when you have them. Tick Main for job updates, Billing for invoices, and Service for the person on site. SMS consent is under Show advanced.' },
      { selector: '[data-tour="customer-locations"]', click: '[data-tour="customer-new-tab-locations"]', title: 'Add where the work happens', say: 'Start typing the address and pick it from the list so the city, state, and ZIP fill in. Tick Gated property if you need to save a gate code.' },
      { selector: '[data-tour="customer-notes-tags"]', click: '[data-tour="customer-new-tab-billing"]', title: 'Add notes and tags', say: 'Internal notes stay with your team. Public notes print on invoices and work orders. Tags like vip or do-not-call color the customer’s row in the list.', optional: 'Skip notes and tags' },
      { selector: '[data-tour="customer-custom-fields"]', click: '[data-tour="customer-new-tab-billing"]', title: 'Fill in your own fields', say: 'These are the customer fields your company added in Tool Shed › Custom Fields. Each one is also a merge tag for your templates.', optional: 'Only shown when your company has customer fields' },
      { selector: '[data-tour="customer-billing"]', click: '[data-tour="customer-new-tab-billing"]', title: 'Set billing defaults if you need them', say: 'Leave these alone and your company defaults apply. Change them only if this customer is tax-exempt or has different payment terms.', optional: 'Skip billing defaults' },
      { selector: '[data-tour="customer-advanced"]', click: '[data-tour="customer-new-tab-billing"]', title: 'Extras for reports', say: 'Industry, referral source, key dates, and commission. Skip this unless you track them.', optional: 'Skip the extras' },
      { selector: '[data-tour="customer-new-review"]', click: '[data-tour="customer-new-tab-review"]', title: 'Review before creating', say: 'Review shows the account, contacts, places and billing at a glance. Pick any tab to change something.', optional: 'Only in the Tabbed workspace' },
      { selector: '[data-tour="customer-save"]', title: 'Save the customer', say: 'Select Create customer when the name and contact details look right. You will land back on the customer list. Open the customer there to add equipment or start the first job.' },
    ],
  },
  {
    id: 'customer-detail',
    title: 'A customer’s account',
    description: 'Everything about one customer: who they are, where you work, their equipment, jobs, estimates, invoices, files, and conversations.',
    route: /^\/customers\/(?!new\/?$|search\/?$)[^/]+\/?$/,
    roadmap: [
      { title: 'How you got here', detail: 'From the customer list, or from a call or message.' },
      { title: 'Header and money', detail: 'Who this is and what they owe.' },
      { title: 'Overview', detail: 'Identity, portal access, field rules, contacts, locations, and notes.' },
      { title: 'Records', detail: 'Jobs, estimates, invoices, assets, and tasks.' },
      { title: 'Files and Log', detail: 'Documents, secure files, this customer’s own templates, messages, and activity.' },
      { title: 'Next', detail: '+ New job, + New Estimate, + New invoice, or Receive payment.' },
    ],
    use: {
      say: '+ New job and + New Estimate start work with this customer already filled in, and a job without a date waits in To Schedule on Schedule. Sent estimates are followed up on Estimates, and unpaid invoices under Accounting, then Invoices.',
      go: [{ label: 'Go to Schedule', to: '/schedule' }, { label: 'Go to Estimates', to: '/estimates' }, { label: 'Open Invoices', to: '/accounting/invoices' }],
    },
    steps: [
      { selector: '[data-tour="customer-header"]', title: 'Who this is', say: 'Here’s the customer’s name, type, and account number. Tags and VIP status show under the name. Use the buttons on the right to message them or start a job.' },
      { selector: '[data-tour="customer-money"]', title: 'What they owe', say: 'Total billed, lifetime paid, and the balance still owed, plus open invoices. The main contact’s phone and email sit right here, so you can call without digging.' },
      { selector: '[data-tour="customer-tabs"]', title: 'Everything is grouped here', say: 'The tabs group everything about this customer. Pick a group, then a sub-tab under it. The number on a group is how many sub-tabs it has, not a record count.' },
      { selector: '[data-tour="customer-overview-identity"]', title: 'The basics', say: 'A quick read of the basics. Edit info takes you to the full form if you can edit customers.', optional: 'Only on the Overview tab' },
      { selector: '[data-tour="customer-portal"]', title: 'Customer portal', say: 'Invite this customer to their own portal so they can see their jobs and invoices and pay online. Nothing is shared until you send the invite.', optional: 'Only on the Overview tab' },
      { selector: '[data-tour="customer-field-requirements"]', title: 'Rules for the techs', say: 'Set the rules your techs must follow on this customer’s jobs, like a GPS check-in, a signature, or a minimum number of photos. New jobs pick these up. Jobs already open keep their old rules.', optional: 'Only on the Overview tab' },
      { selector: '[data-tour="customer-statement-day"]', click: '[data-tour="customer-group-details"], [data-tour="customer-group-more"]', title: 'Their monthly statement', say: 'For a business customer, pick the day their monthly statement goes out. The link under it takes you to their Templates tab, to choose which statement they get.', optional: 'Business and government customers only' },
      { selector: '[data-tour="customer-invoice-subject"]', title: 'Their own invoice subject', say: 'Give this customer their own invoice email subject, like one with their PO number in it. Leave it blank to use your normal subject.', optional: 'Skip' },
      { selector: '[data-tour="customer-subtab-templates"]', click: '[data-tour="customer-group-files"]', title: 'Templates just for this customer', say: 'Under Files, the Templates tab is where this customer can get their own paperwork, when they need a different invoice, work order or statement from everyone else.', optional: 'Skip' },
      { selector: '[data-tour="customer-templates"]', click: '[data-tour="customer-subtab-templates"]', title: 'Pick their templates', say: 'For each kind of document, like invoices, estimates, work orders, receipts, statements and inspections, pick the template this customer gets, and a text message to go with it. Anything left on Use tenant default gets your normal default. Press Save overrides when you’re done. New templates are made in Templates and Forms.', optional: 'Skip' },
    ],
  },
  {
    id: 'communications',
    title: 'Messages',
    description: 'One shared inbox for texts, calls, voicemails, and emails.',
    route: /^\/communications\/?$/,
    roadmap: [
      { title: 'It comes in', detail: 'A customer texts, calls, or emails, and it lands here.' },
      { title: 'Work the queue', detail: 'Needs action, Unread, and Unknown callers.' },
      { title: 'Respond', detail: 'Reply, assign, or mark it done.' },
      { title: 'Link it', detail: 'Attach unknown numbers to a customer and threads to a job.' },
      { title: 'Next', detail: 'Create a job or estimate from a call, or open the Intake Queue.' },
    ],
    use: {
      say: 'Requests the AI has read from texts and calls wait in the Intake Queue, ready to become a job or estimate. Calls nobody picked up wait on Calls, and anything you link to a customer shows on their account under Messages.',
      go: [{ label: 'Open Intake Queue', to: '/intake' }, { label: 'Go to Calls', to: '/calls' }, { label: 'Go to Customers', to: '/customers' }],
    },
    steps: [
      { selector: '[data-tour="comms-rail"]', title: 'Your shared inbox', say: 'This is your shared inbox. Use + New message to text or email anyone, even if they’re not a customer yet.', optional: 'On a phone, + New sits above the list' },
      { selector: '[data-tour="comms-views"]', title: 'Pick a view', say: 'Inbox shows this week’s threads. My queue holds the things that need you, and Channels split texts, calls, and emails. Older threads move to Archive on Sunday night, and every message stays on the customer and job.', optional: 'On a phone, pick the view from the menu above the list' },
      { selector: '[data-tour="comms-search"]', title: 'Search everything', say: 'Search covers everything, archive included. Use Date to look at one day or a time window.' },
      { selector: '[data-tour="comms-list"]', title: 'The conversations', say: 'Bold rows need your attention. Tags tell you if a thread needs a reply, is done, or is from an unknown number. A green job number means it’s tied to a job. Tap a row to open it.' },
      { selector: '[data-tour="comms-thread-actions"]', title: 'Handle the thread', say: 'From here you can call back, hand the thread to a teammate, mark it done, or link it to a customer or job. Linking an unknown number saves it to that customer so you’ll know them next time.', optional: 'Open a conversation first' },
      { selector: '[data-tour="comms-template"]', title: 'Saved replies', say: 'Template drops one of your saved texts or emails into the reply, ready to change before you send. You write and change those in Templates and Forms.', optional: 'Open a conversation first' },
      { selector: '[data-tour="comms-thread"]', title: 'Read and reply', say: 'Read and reply here. Calls show the recording and transcript, and you can turn a call into a job or estimate.', optional: 'Open a conversation first' },
    ],
  },
  {
    id: 'calls',
    title: 'Calls to review',
    description: 'Incoming calls and voicemails nobody handled when they came in.',
    route: /^\/calls\/?$/,
    roadmap: [
      { title: 'A call comes in', detail: 'An alert pops up for the team.' },
      { title: 'Nobody opens it', detail: 'It waits here.' },
      { title: 'Follow up', detail: 'Call back, open the customer, or open the thread.' },
      { title: 'Or clear it', detail: 'Mark it reviewed.' },
      { title: 'Next', detail: 'Create a job from the call in Messages.' },
    ],
    use: {
      say: 'Open the thread in Messages to reply, or to turn the call into a job or estimate. If the AI drafted a request from it, that waits in the Intake Queue.',
      go: [{ label: 'Go to Messages', to: '/communications' }, { label: 'Open Intake Queue', to: '/intake' }],
    },
    steps: [
      { selector: '[data-tour="calls-header"]', title: 'Calls nobody picked up', say: 'These are calls that came in while nobody opened the alert. Work down the list until it’s empty. The switch turns call alerts on or off for you.' },
      { selector: '[data-tour="calls-list"]', title: 'Follow up on each one', say: 'Each row shows who called and when, plus any transcript. Call back, open the customer, open the thread, or mark it reviewed. Any of these clears the call from this list.' },
    ],
  },
  {
    id: 'intake',
    title: 'Intake Queue',
    description: 'Review what the AI drafted from incoming calls, texts, and web requests before it becomes work.',
    route: /^\/intake\/?$/,
    roadmap: [
      { title: 'A request comes in', detail: 'A call, text, or website request.' },
      { title: 'CBI drafts it', detail: 'The customer, address, and job or estimate.' },
      { title: 'You check it', detail: 'Compare it with the original message and correct it.' },
      { title: 'Create the work', detail: 'Create job or Create estimate opens the form already filled in.' },
      { title: 'Or follow up', detail: 'Ask for missing details, or dismiss it.' },
    ],
    use: {
      say: 'Create job and Create estimate open the form already filled in. A job saved without a date waits in To Schedule on Schedule, and estimates you send are tracked on Estimates.',
      go: [{ label: 'Go to Schedule', to: '/schedule' }, { label: 'Go to Estimates', to: '/estimates' }],
    },
    steps: [
      { selector: '[data-tour="intake-header"]', title: 'Requests waiting for a person', say: 'Every request the AI has read waits here for a person to review. Nothing turns into a job until you say so.' },
      { selector: '[data-tour="intake-status"]', title: 'Filter by status', say: 'Start with Pending. Failed ones need a retry, and Dismissed ones can be reopened.' },
      { selector: '[data-tour="intake-list"]', title: 'The drafts', say: 'Each draft shows who it’s from, how old it is, and the start of the message. Pick one to review it.' },
      { selector: '[data-tour="intake-actions"]', title: 'Decide what happens', say: 'Open the thread to see the original message. When the details look right, create the job or estimate. The form opens already filled in.', optional: 'Pick a draft first' },
      { selector: '[data-tour="intake-review"]', title: 'Your review comes first', say: 'Check the source, fix this request, then decide. Your fixes apply to this request only, unless you choose to teach CBI.', optional: 'Pick a draft first' },
      { selector: '[data-tour="intake-follow-up"]', title: 'Ask for what’s missing', say: 'Need more info? Tick what’s missing and CrewBarn writes the question for you. Nothing is sent from here.', optional: 'Pick a draft first' },
      { selector: '[data-tour="intake-details"]', title: 'What the AI pulled out', say: 'The customer, equipment, job details, address, photos, and the full transcript. Anything marked Not captured is something to confirm before you create the work.', optional: 'Pick a draft first' },
    ],
  },
  {
    id: 'service-locations',
    title: 'Service locations',
    description: 'Every address you work at, across all your customers.',
    route: /^\/tool-shed\/service-locations\/?$/,
    roadmap: [
      { title: 'Add on the customer', detail: 'Locations are added on the customer form or its Locations tab.' },
      { title: 'Search them all', detail: 'Find any address here by nickname, street, city, or ZIP.' },
      { title: 'Open the customer', detail: 'Make changes from the customer’s account.' },
    ],
    use: {
      say: 'Add or change addresses on the customer’s account, under Locations. Each job and each piece of equipment belongs to one of these addresses, and Territories groups them by ZIP code.',
      go: [{ label: 'Go to Customers', to: '/customers' }, { label: 'Open Customer equipment', to: '/assets' }, { label: 'Open Territories', to: '/tool-shed/territories' }],
    },
    steps: [
      { selector: '[data-tour="locations-search"]', title: 'Search every address', say: 'Every address you work at, across all your customers. Search by nickname, street, city, or ZIP.' },
      { selector: '[data-tour="locations-list"]', title: 'Find the customer behind it', say: 'Each address shows which customer it belongs to. This list is read-only, so open the customer to make changes.' },
    ],
  },
  {
    id: 'customer-types',
    title: 'Customer types',
    description: 'What Residential, Commercial, and Government mean, to share with your team.',
    route: /^\/tool-shed\/customer-types\/?$/,
    roadmap: [
      { title: 'Three types', detail: 'Every customer is Residential, Commercial, or Government.' },
      { title: 'Name fields', detail: 'The type decides which name fields the customer form asks for.' },
      { title: 'Changeable', detail: 'You can change a customer’s type later from Edit Info.' },
    ],
    use: {
      say: 'You pick the type when you add a customer, and change it later on their Edit Info tab. The tabs on the customer list filter by type, and only Commercial and Government customers get a monthly statement day.',
      go: [{ label: 'Go to Customers', to: '/customers' }, { label: 'Add a customer', to: '/customers/new' }],
    },
    steps: [
      { selector: '[data-tour="customer-types-cards"]', title: 'The three types', say: 'Every customer is one of these three. Residential is billed to a person. Commercial and Government are billed to an organization. You can change a customer’s type later from Edit Info.' },
      { selector: '[data-tour="customer-types-tags"]', title: 'Other groupings', say: 'Need another way to group customers? Use tags like VIP, Recurring or Warning. They label a customer without changing their billing, and you manage them in Tags.' },
    ],
  },
  {
    id: 'tags',
    title: 'Tags',
    description: 'Your company’s label library: names, colors, and order.',
    route: /^\/tool-shed\/tags\/?$/,
    roadmap: [
      { title: 'Decide your labels', detail: 'Pick the labels your shop uses.' },
      { title: 'Add them here', detail: 'Give each one a name and a color.' },
      { title: 'Retire, don’t delete', detail: 'Turn a label off to stop it being added; customers that have it keep it. Removing it takes it off them.' },
    ],
    steps: [
      { selector: '[data-tour="tags-library"]', title: 'Your label library', say: 'These are your active customer tags, the ones the customer form offers. Click one to change its name or color; a new name goes to every customer that has it.' },
      { selector: '[data-tour="tags-manage"]', title: 'Manage every label', say: 'Every label, active or not. Search to find one, use the switch to turn it off, and Remove to delete it.', optional: 'Only shown once you have tags' },
      { selector: '[data-tour="tags-add"]', title: 'Add a tag', say: '+ Add tag opens a short form for a new label.', optional: 'Only for people who can edit' },
      { selector: '[data-tour="tag-form-name"]', title: 'Name', say: 'What the label says, like VIP or Recurring.', optional: 'Only for people who can edit', click: '[data-tour="tags-add"]' },
      { selector: '[data-tour="tag-form-color"]', title: 'Color', say: 'Pick a colour so the label stands out. The preview underneath shows how it looks.', optional: 'Only for people who can edit', click: '[data-tour="tags-add"]' },
      { selector: '[data-tour="tag-form-sort"]', title: 'Sort order', say: 'Lower numbers show first. Press Add to create the tag, or Cancel to close.', optional: 'Only for people who can edit', click: '[data-tour="tags-add"]' },
    ],
  },
  {
    id: 'custom-fields',
    title: 'Custom fields',
    description: 'Add your own fields to jobs, customers, and assets. Each one is also a merge tag.',
    route: /^\/tool-shed\/custom-fields\/?$/,
    roadmap: [
      { title: 'Pick where it lives', detail: 'Job, Customer, or Asset.' },
      { title: 'Name it', detail: 'Choose a label and a field type.' },
      { title: 'Job options', detail: 'For job fields, choose which customers it applies to and where it prints.' },
      { title: 'Use the tag', detail: 'Drop {{custom.key}} into templates and invoice email subjects.' },
    ],
    use: {
      say: 'Job fields show up on the new-job form, customer fields on the customer form and Edit Info, and asset fields when you add equipment. Their merge tags go into your templates in Templates & Forms.',
      go: [{ label: 'Start a job', to: '/jobs/new' }, { label: 'Add a customer', to: '/customers/new' }, { label: 'Open Templates & Forms', to: '/custom-documents' }],
    },
    steps: [
      { selector: '[data-tour="custom-fields-new"]', title: 'Add a field', say: 'Add your own fields, like a PO number. Each one also becomes a merge tag you can drop into any template.', optional: 'Only shown if you can edit settings' },
      { selector: '[data-tour="custom-fields-tabs"]', title: 'Where the field lives', say: 'Pick where the field lives. Job fields show on the new-job form. Customer fields show on the customer form and Edit Info. Asset fields show on the asset form.' },
      { selector: '[data-tour="custom-fields-table"]', title: 'Your fields', say: 'Each row shows the label, its merge tag, the type, and whether it’s required or active. Click a row to open it. The merge tag key is locked after the first save so existing values aren’t lost.' },
      { selector: '[data-tour="custom-field-form-label"]', title: 'Label', say: 'What the field is called on the form, like PO Number.', optional: 'Only for people who can edit', click: '[data-tour="custom-fields-new"]' },
      { selector: '[data-tour="custom-field-form-key"]', title: 'Merge tag key', say: 'The name used in templates as {{custom.key}}. It fills in from the label, and you can change it before the first save.', optional: 'Only for people who can edit', click: '[data-tour="custom-fields-new"]' },
      { selector: '[data-tour="custom-field-form-type"]', title: 'Field type', say: 'Single-line or multi-line text, number, date, yes or no, a dropdown (pick one or many), or a web address.', optional: 'Only for people who can edit', click: '[data-tour="custom-fields-new"]' },
      { selector: '[data-tour="custom-field-form-options"]', title: 'Dropdown options', say: 'Add each choice people can pick, and remove any with its ×.', optional: 'For dropdown fields', click: '[data-tour="custom-fields-new"]' },
      { selector: '[data-tour="custom-field-form-placeholder"]', title: 'Placeholder and default', say: 'The placeholder is a grey hint in the empty box. The default is a starting value that’s filled in for them.', optional: 'Only for people who can edit', click: '[data-tour="custom-fields-new"]' },
      { selector: '[data-tour="custom-field-form-customers"]', title: 'Applies to customers', say: 'Pick which customers this job field is for. Leave it empty and it applies to every customer.', optional: 'For job fields', click: '[data-tour="custom-fields-new"]' },
      { selector: '[data-tour="custom-field-form-before-invoice"]', title: 'Required before invoicing', say: 'Tick this and a job can’t be invoiced until the field is filled in, for the customers picked above.', optional: 'For job fields', click: '[data-tour="custom-fields-new"]' },
      { selector: '[data-tour="custom-field-form-help"]', title: 'Help text', say: 'A short line shown under the field to explain what to enter.', optional: 'Only for people who can edit', click: '[data-tour="custom-fields-new"]' },
      { selector: '[data-tour="custom-field-form-required"]', title: 'Required and active', say: 'Required means the form can’t be saved without it. Untick Active to hide the field from forms without losing what’s been entered.', optional: 'Only for people who can edit', click: '[data-tour="custom-fields-new"]' },
      { selector: '[data-tour="custom-field-form-documents"]', title: 'Customer documents', say: 'Choose where the value prints: invoice details, statement columns, the invoice email subject, or the top of the invoice email.', optional: 'For job fields', click: '[data-tour="custom-fields-new"]' },
      { selector: '[data-tour="custom-field-form-sort"]', title: 'Sort order', say: 'Lower numbers come first on the form. Press Create field to add it.', optional: 'Only for people who can edit', click: '[data-tour="custom-fields-new"]' },
    ],
  },
]
