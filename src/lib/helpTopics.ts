import {
  SETTINGS_HELP,
  SETTINGS_HELP_GROUPS,
  settingsHelpTopicId,
} from '@/lib/settingsHelp'
import { EXPANDED_HELP_GUIDES } from '@/lib/expandedHelpGuides'
import { SETTINGS_HELP_DETAILS } from '@/lib/settingsHelpDetails'

/**
 * In-app help content. Plain markdown bodies; rendered with react-markdown.
 *
 * Adding a topic:
 *   1. Append a `{ id, category, title, body }` entry below
 *   2. Use a kebab-case `id` — that's the deep-link key for opening this
 *      topic from elsewhere via `?openHelp=<id>`
 *   3. Markdown supports headings, lists, **bold**, _italic_, `code`,
 *      and links
 *
 * Order within a category is preserved as written.
 */

export interface HelpTopic {
  id: string
  category: string
  title: string
  body: string
  /** Visibility filter — currently used to hide tester-only topics from non-testers. */
  audience?: 'all' | 'tester' | 'platform_admin'
}

export const OPEN_HELP_EVENT = 'crewbarn:open-help'
export const HELP_HOME_TOPIC_ID = 'what-is-crewbarn'

const ROUTE_HELP_TOPICS: Array<{ prefix: string; topicId: string }> = [
  { prefix: '/', topicId: 'dashboard-overview' },
  { prefix: '/schedule', topicId: 'schedule-overview' },
  { prefix: '/dispatch', topicId: 'dispatch-overview' },
  { prefix: '/communications', topicId: 'communications-overview' },
  { prefix: '/calls', topicId: 'communications-overview' },
  { prefix: '/intake', topicId: 'ai-intake-queue' },
  { prefix: '/tasks', topicId: 'tasks-and-time-overview' },
  { prefix: '/my-time-off', topicId: 'tasks-and-time-overview' },
  { prefix: '/jobs', topicId: 'what-is-a-job' },
  { prefix: '/sub-jobs', topicId: 'what-is-a-job' },
  { prefix: '/sub-reviews', topicId: 'what-is-a-job' },
  { prefix: '/sub-payouts', topicId: 'what-is-a-job' },
  { prefix: '/inbound-sub-jobs', topicId: 'what-is-a-job' },
  { prefix: '/customers', topicId: 'customer-workspace-overview' },
  { prefix: '/estimates', topicId: 'creating-an-estimate' },
  { prefix: '/accounting', topicId: 'accounting-reports-overview' },
  { prefix: '/reports', topicId: 'accounting-reports-overview' },
  { prefix: '/invoices', topicId: 'accounting-reports-overview' },
  { prefix: '/money', topicId: 'accounting-reports-overview' },
  { prefix: '/inventory/movements', topicId: 'movements-log' },
  { prefix: '/inventory/reconciliations', topicId: 'reconciliations' },
  { prefix: '/inventory/units', topicId: 'serialized-units' },
  { prefix: '/inventory', topicId: 'locations-vs-bins' },
  { prefix: '/purchase-orders/needs-ordered', topicId: 'needs-ordered' },
  { prefix: '/purchase-orders', topicId: 'creating-a-po' },
  { prefix: '/vendors', topicId: 'creating-a-po' },
  { prefix: '/asset-types', topicId: 'asset-types' },
  { prefix: '/asset-access-requests', topicId: 'public-scan' },
  { prefix: '/company-assets', topicId: 'what-is-an-asset' },
  { prefix: '/assets', topicId: 'what-is-an-asset' },
  { prefix: '/warranties', topicId: 'what-is-an-asset' },
  { prefix: '/catalog/tax-classes', topicId: 'tax-classes' },
  { prefix: '/catalog/categories', topicId: 'catalog-categories' },
  { prefix: '/catalog/product-categories', topicId: 'catalog-categories' },
  { prefix: '/catalog/products', topicId: 'service-vs-product-items' },
  { prefix: '/catalog/services', topicId: 'service-vs-product-items' },
  { prefix: '/custom-documents', topicId: 'documents-templates-overview' },
  { prefix: '/email-templates', topicId: 'documents-templates-overview' },
  { prefix: '/franchises', topicId: 'franchise-workspace-overview' },
  { prefix: '/franchise-support', topicId: 'franchise-workspace-overview' },
  { prefix: '/feedback', topicId: 'help-and-feedback' },
  { prefix: '/me', topicId: 'account-security-overview' },
  { prefix: '/oauth', topicId: 'account-security-overview' },
  { prefix: '/onboarding', topicId: 'settings-overview' },
  { prefix: '/settings', topicId: 'settings-overview' },
  { prefix: '/tool-shed', topicId: 'settings-overview' },
]

export function helpTopicForRoute(path: string): string | undefined {
  const pathname = path.split('?')[0]
  return ROUTE_HELP_TOPICS
    .filter(({ prefix }) =>
      pathname === prefix || (prefix !== '/' && pathname.startsWith(`${prefix}/`)),
    )
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]?.topicId
}

export function openHelpTopic(topicId: string): void {
  window.dispatchEvent(new CustomEvent<string>(OPEN_HELP_EVENT, { detail: topicId }))
}

export const HELP_CATEGORIES = [
  'Getting Started',
  'Daily Operations',
  'CBI AI',
  'Accounting & Reports',
  'Team & Documents',
  'Customers',
  'Assets',
  'Catalog & Tax',
  'Inventory',
  'Purchase Orders',
  'Jobs',
  'Estimates',
  'Settings',
  ...SETTINGS_HELP_GROUPS.map((group) => `Settings: ${group}`),
  'Testers',
  'Platform Admin',
] as const

const HELP_TOPIC_DEFINITIONS: HelpTopic[] = [
  // ---- Getting Started ----
  {
    id: 'what-is-crewbarn',
    category: 'Getting Started',
    title: 'CrewBarn help home',
    body: `
CrewBarn keeps the office, field team, customer communication, money, and inventory in one connected workflow.

## Start with the work

- [Customers](/customers) hold billing relationships, contacts, and service locations.
- [Jobs](/jobs) schedule and track the work your team performs.
- [Inventory](/inventory) shows where parts live and records every movement.
- [Estimates](/estimates) turn proposed work into an approved job.
- [CrewBarn Connect](/tool-shed) contains tenant settings, permissions, connections, and business rules.

## A practical example

A dispatcher creates a job for a customer's service location and assigns a technician. The technician checks in, uses a scanned part from the truck, records photos and a signature, and checks out. CrewBarn can then update the tenant-defined status, notify the customer using the selected template, create the inventory movement, invoice the work, and record payment.

Each part has a separate purpose:

- **Status flow rules** decide whether a manual status change is allowed.
- **Templates** contain the email or text.
- **Triggers** decide when it is sent.
- **Field actions** connect mobile events such as arrival or completion to tenant statuses.
- **Cash drawers** track who physically holds cash or checks after the invoice is paid.

Open the [Settings directory](/tool-shed) to review each function. On any documented setting, use the **?** in the header or beside its CrewBarn Connect link for instructions and an example.
`.trim(),
  },
  {
    id: 'dashboard-overview',
    category: 'Getting Started',
    title: 'Dashboard: run the day from one screen',
    body: `
The **Dashboard** is CrewBarn's live operating view. It brings today's work, customer calls, items needing attention, cash flow, dispatch, team notes, and tenant-selected reporting widgets together without changing the underlying records.

Dashboard numbers are summaries. Select a card, job, call, or alert to open the source record before making a decision.

### Today's Ops

Use **Today's Ops** as the office's daily checklist.

- **Now / Next** shows the work currently underway and what is scheduled next.
- **Unscheduled** identifies jobs that still need a time or technician.
- **Needs attention** collects completed work waiting to be invoiced, past-scheduled open jobs, pending time-off requests, and other actionable exceptions.
- **Today's schedule** shows the day's jobs and their current tenant-defined statuses.
- **Unanswered calls** opens Communications so the office can match the caller, return the call, or create work.
- **Team Notes** keeps internal notices visible until the targeted crew members acknowledge them.

The red badge on Today's Ops is an action count, not a job total. It combines items such as unscheduled work, completed jobs waiting for billing, and open jobs past their scheduled time.

### Cash Flow

Use **Cash Flow** for a quick financial review. Change the Day, Month, Quarter, or Year period to compare revenue, collections, receivables, job value, and other available finance widgets. Open Accounting or Reports for detailed transactions, exports, and reconciliation.

Financial cards follow the tenant's invoices, payments, taxes, and permissions. A dashboard total should agree with its source report for the same period and filters.

### Dispatch

**Dispatch** gives owners, admins, and dispatchers a timeline by technician from 7 a.m. to 7 p.m. Job blocks show upcoming, on-site, and completed work; select one to open the job. The **Unassigned** list identifies work that still needs a lead technician or schedule.

Technicians see their own day instead of the full team board. This is controlled by their role, not a separate dashboard setting.

### Custom

Use **Custom** to build a personal dashboard from the widgets allowed for your role.

1. Select **Customize** and add the blocks you need.
2. Drag blocks to put the most important work first.
3. Choose a card size and reporting period.
4. Remove a block when it is no longer useful, or reset the board to start over.

The arrangement is saved for this browser. Owners can restrict which dashboard widgets a role or staff member may use in Roles & Permissions.

### Practical example

At the start of the day, a dispatcher opens Today's Ops, assigns two unscheduled jobs, returns an unmatched call from Communications, and opens a completed job that still needs an invoice. They then switch to Dispatch to confirm each technician's route and use Cash Flow to check yesterday's collections.

### When something looks wrong

- Open the source job, invoice, payment, call, or schedule before correcting data.
- Confirm the selected reporting period and tenant.
- A live update may take a moment after another user changes a record.
- Missing cards can be caused by role permissions or the user's Custom board.
- Dashboard status colors and buckets follow the tenant's status configuration; they are not hard-coded by the dashboard.

[Open Dashboard](/) · [Open Jobs](/jobs) · [Open Communications](/communications) · [Open Accounting](/accounting)
`.trim(),
  },
  {
    id: 'navigating-the-app',
    category: 'Getting Started',
    title: 'Navigating the app',
    body: `
The **top bar** is where you switch between core sections (Customers, Jobs, Inventory, etc.) and access your profile.

Most pages have a **list view** with filters and a **detail view** when you click into a row.

Press \`?\` anywhere to open this help panel.
`.trim(),
  },
  {
    id: 'help-and-feedback',
    category: 'Getting Started',
    title: 'Getting help & sending feedback',
    body: `
Hit \`?\` to open this help panel from anywhere in the app.

Found a bug or have a suggestion? Email **support@crewbarn.com** — replies land directly in the platform-admin inbox and get triaged within a day.

If you're a tester, the floating walkthrough widget at the bottom-right has a **"Done — add notes"** button that's the fastest path for sending per-feature feedback.
`.trim(),
  },

  // ---- CBI AI ----
  {
    id: 'how-cbi-learns',
    category: 'CBI AI',
    title: 'Teach CBI: how it gets smarter for your business',
    body: `
CBI becomes more useful as CrewBarn contains accurate business history and your team confirms what is right. It combines **current tenant records** with **approved tenant memory** to make a better, business-specific suggestion.

This does not retrain the public base AI model on your company. CrewBarn keeps tenant-scoped facts and corrections that can be retrieved when they are relevant, allowed, and useful.

### Information CBI can use

Depending on the question, enabled AI tasks, and the signed-in user's permissions, CBI can retrieve information such as:

- customers, contacts, service locations, and communication history;
- jobs, statuses, schedules, technician assignments, notes, photos, and prior visits;
- estimates, invoices, payments, unpaid balances, pricing, and completed work;
- products, services, inventory quantities, truck stock, movements, and vendor information;
- customer assets, company assets, equipment details, warranties, and documents;
- expenses, payroll, fuel, debt, facilities, inventory cost, and other configured company-cost information;
- call recordings and transcripts, Intake drafts, and page/job context.

CBI does not load every record into every answer. It selects relevant tools and records for the current question. More complete and accurate CrewBarn data gives it better evidence, but permissions and tenant boundaries always apply.

### What teaching CBI means

CBI can retain durable tenant-specific knowledge from approved sources, including:

- an explicit **Teach CBI** instruction;
- a human correction to a Parts Guess or photo match;
- approved AI memory cards;
- durable patterns proposed from estimates, invoices, job notes, customer conversations, and BarnCam results;
- shop rules such as preferred pricing, dispatch practices, naming conventions, and customer-specific requirements.

A correction is most useful when it includes the identifying context. Instead of only saying “that part is wrong,” give the verified part plus the vehicle, equipment, customer, or situation that makes it correct.

### Example

CBI guesses the wrong key for a 2021 Silverado. The dispatcher verifies the catalog and enters the correct key with the vehicle details. CrewBarn keeps the original guess for traceability and stores the approved correction in tenant memory. The next time a similar Intake arrives, CBI can combine that correction with current catalog and inventory availability to produce a better guess.

If the shop also records real costs, labor, expenses, assets, and completed invoices, CBI can make better margin and pricing observations because it has stronger business evidence. It still presents a recommendation; an authorized person approves consequential actions.

### How to improve results

1. Keep customer, job, catalog, inventory, asset, cost, and accounting records accurate.
2. Correct wrong guesses instead of working around them silently.
3. Add enough context to explain when the correction applies.
4. Review suggested memory cards and approve only durable, verified facts.
5. Reject or deactivate outdated memory so it does not influence later work.
6. Test results against source records before using them for pricing, purchasing, scheduling, or customer communication.

### What CBI does not do

- It does not treat every employee message as permanent truth.
- It does not automatically learn a bad workaround merely because it happened once.
- It does not bypass tenant rules, role permissions, approval gates, or record visibility.
- It does not guarantee a guess is correct; current source records and human verification remain authoritative.
- It should never be taught passwords, API keys, private authentication data, or unsupported claims.

[Open CBI AI Settings](/tool-shed/ai) · [Open Intake](/intake) · [Open Inventory](/inventory) · [Open Accounting](/accounting)
`.trim(),
  },

  // ---- Daily Operations ----
  {
    id: 'schedule-overview',
    category: 'Daily Operations',
    title: 'Schedule: plan work and technician time',
    body: `
The **Schedule** is the shared calendar for jobs, estimates, technician assignments, availability, and time off. It follows the tenant's statuses, permissions, working hours, and scheduling rules.

### Plan the day

1. Choose the date or calendar range you need.
2. Review scheduled work by technician and compare it with unassigned work.
3. Open a job before moving it to confirm the customer, location, duration, required skills, and promised arrival window.
4. Assign the lead technician and crew, then set the start, end, or arrival window.
5. Resolve overlaps and travel conflicts before notifying the customer.

### What the calendar shows

- Job colors come from the tenant's status configuration.
- A technician lane shows work assigned to that person; crew helpers may also be committed elsewhere.
- Unscheduled work has no usable appointment time and still needs dispatcher action.
- Time-off and availability can block or warn about assignments according to tenant rules.
- Select a calendar item to open the source job or estimate.

### Moving work

Dragging or editing a calendar item changes operational job data. Verify the date, time zone, duration, lead tech, and customer commitment before saving. A schedule change may trigger customer or crew notifications when the tenant has enabled those automations.

### Practical example

A dispatcher receives an emergency job. They check the customer's location, compare nearby technician lanes, move a lower-priority appointment only after confirming the customer, assign the emergency call, and verify that neither technician is double-booked.

### Watch for

- Schedule conflicts are warnings to investigate, not permission to ignore tenant workflow rules.
- A status and a schedule are separate: scheduling a job does not necessarily change its status.
- GPS locations show field position, not future availability.
- If a job is missing, check its date, status, assignment, and active filters.

[Open Schedule](/schedule) · [Open Dispatch](/dispatch) · [Open Jobs](/jobs)
`.trim(),
  },
  {
    id: 'dispatch-overview',
    category: 'Daily Operations',
    title: 'Dispatch: assign and monitor field work',
    body: `
**Dispatch** is the live field-control workspace. Owners, admins, and dispatchers can compare technician schedules, unassigned work, current status, and available location data. Technicians see the work allowed for their own role.

Use Dispatch to assign the right person, identify late or unassigned work, open the job for details, and review field activity. When territories are configured, owners and admins can view all areas or filter one territory. A dispatcher assigned to territories sees and switches among only those territory job feeds. The timeline is a summary; customer commitments, job requirements, and tenant status rules remain on the source job.

**Field Review** is for checking field events that require office attention. **Route History** reconstructs recorded GPS history and should be interpreted with device permission, signal, battery, and reporting intervals in mind.

Do not use a stale GPS point as proof of a person's current location. Confirm the timestamp and job check-in/out history.

[Open Dispatch](/dispatch) · [Open Field Review](/dispatch/field-review) · [Open Route History](/dispatch/route-history)
`.trim(),
  },
  {
    id: 'communications-overview',
    category: 'Daily Operations',
    title: 'Communications: customer calls and messages',
    body: `
**Communications** keeps customer calls, recordings, transcripts, texts, emails, and job-linked messages together. Use the thread to understand the whole conversation before calling back, creating work, or changing a customer record.

Match an unknown caller to the correct customer when possible. Calls and messages started from CrewBarn should be logged to the communication thread and linked to the job when a job context exists. Provider delivery, recording, and transcription still depend on the tenant's configured phone service, consent rules, and permissions.

For failed calls or messages, check the active provider, destination number, sender/caller ID verification, webhook status, and the exact provider error. Do not repeatedly retry customer messages without checking whether an earlier attempt was delivered.

[Open Communications](/communications) · [Open Calls](/calls) · [Open Intake](/intake)
`.trim(),
  },
  {
    id: 'tasks-and-time-overview',
    category: 'Daily Operations',
    title: 'Tasks and time off',
    body: `
**Tasks** track follow-up work that may belong to a customer, job, or staff member. Give each task a clear owner, due date, and completion state so it does not become an unassigned note.

**Time Off** records staff availability. Requests may require approval and can affect Schedule and Dispatch. Review the dates, partial-day times, approver, and scheduling impact before approving.

A completed task closes the follow-up item; it does not automatically complete its related job unless a tenant automation explicitly does so.

[Open Tasks](/tasks) · [Open My Time Off](/my-time-off)
`.trim(),
  },

  // ---- Accounting & Reports ----
  {
    id: 'accounting-reports-overview',
    category: 'Accounting & Reports',
    title: 'Accounting and reports: verify the source records',
    body: `
The **Accounting** workspace summarizes invoices, payments, receivables, taxes, payroll, expenses, inventory cost, bank matching, and ledger activity. **Reports** provides filtered operational and financial exports.

Always match the date basis and filters before comparing totals. Invoice date, payment date, service date, and accounting period can produce different correct answers. Open the source invoice, payment, expense, or ledger entry before making a correction.

Use PDF for a readable snapshot and spreadsheet export for sorting, reconciliation, or further analysis. Permission and tenant scope determine which financial records a user can see.

For unpaid work, use the unpaid invoice report or invoice status filter and choose All dates or an explicit date range. Confirm credits, deposits, partial payments, voids, and write-offs before contacting the customer.

[Open Accounting](/accounting) · [Open Invoices](/accounting/invoices) · [Open Reports](/accounting/reports)
`.trim(),
  },

  // ---- Team & Documents ----
  {
    id: 'documents-templates-overview',
    category: 'Team & Documents',
    title: 'Documents and templates',
    body: `
**Custom Documents** contains reusable estimates, work orders, agreements, emails, and other tenant templates. Templates define content and merge fields; the job, customer, invoice, or automation decides when a document is generated or sent.

Preview with a safe record before publishing. Confirm merge fields, customer visibility, signature requirements, page breaks, branding, and mobile readability. Editing a template affects future documents; previously generated documents should remain historical records.

[Open Custom Documents](/custom-documents) · [Open CrewBarn Connect](/tool-shed)
`.trim(),
  },
  {
    id: 'account-security-overview',
    category: 'Team & Documents',
    title: 'My account, security, and connected access',
    body: `
Use **My Account** for your own profile and application preferences. **Security** covers password, multi-factor authentication, sessions, and other sign-in controls. AI connectors and OAuth authorization grant external access and should only be approved when you recognize the application and requested permissions.

Never paste API secrets, passwords, recovery codes, or authentication tokens into Help, CBI, notes, or support screenshots. Revoke unfamiliar sessions or connected access and notify an administrator when account activity is unexpected.
`.trim(),
  },
  {
    id: 'franchise-workspace-overview',
    category: 'Team & Documents',
    title: 'Franchise workspace',
    body: `
The **Franchise Dashboard** rolls up permitted information across franchise locations. Select the correct tenant before editing operational records. Read-only drill mode is for review; acting-as mode allows tenant changes only for the approved session and permission scope.

Use Franchise Support for documented assistance between the franchisor and location. Keep tenant-specific customer, financial, and staff information in the correct tenant context.
`.trim(),
  },

  // ---- Customers ----
  {
    id: 'customer-workspace-overview',
    category: 'Customers',
    title: 'Customers: accounts, contacts, and service locations',
    body: `
The **Customers** workspace separates the account that owns the relationship from the people you contact and the places where work happens.

Search before creating a customer to prevent duplicates. On the customer record, verify the main contact, billing contact, service contact, service location, billing address, parent account, and communication history. Jobs should use the correct service location even when a different customer or property manager receives the invoice.

Use customer Messages for the full conversation history and Activity for an audit-oriented view of changes. Merge duplicates only after confirming which account should survive and where jobs, invoices, contacts, and documents will move.

[Open Customers](/customers) · [Create Customer](/customers/new)
`.trim(),
  },
  {
    id: 'creating-a-customer',
    category: 'Customers',
    title: 'Creating a customer',
    body: `
**Customers → New** opens the create form. Fill in name, primary phone, and address — the rest is optional and can be added later.

A customer is the entity you bill. They have one or more **service locations** (the physical addresses where techs go) and any number of **contacts** (people you reach out to about jobs/estimates).
`.trim(),
  },
  {
    id: 'contacts-vs-service-locations',
    category: 'Customers',
    title: 'Contacts vs. service locations',
    body: `
- **Contacts** are *people*: the office manager, the on-site point person, the building owner. Each can have their own email + phone.
- **Service locations** are *addresses*: the physical sites where work happens. A commercial customer might have one corporate billing record and a dozen service locations across town.

Assets live at a service location, not at a customer directly — so you'll need at least one location before you can create assets.
`.trim(),
  },
  {
    id: 'parent-customer',
    category: 'Customers',
    title: 'Parent / child customer accounts',
    body: `
A customer can have a **parent customer**, used to model corporate hierarchies — branch offices that all roll up to a single HQ for billing.

Set the parent on a customer's edit form (\`Customers → {customer} → Edit → Parent customer\`).

The parent relationship is used for:

- **Default billing** — by default, jobs at a child are billed to the parent (override per-job — see "Billing to a different customer")
- **Reporting** — roll up revenue, jobs, and assets across the family tree

A customer with no parent is a top-level account (the typical residential customer). Parenting only matters when one entity pays the bills for many sites.
`.trim(),
  },
  {
    id: 'job-billing-override',
    category: 'Jobs',
    title: 'Billing the job to a different customer',
    body: `
A job has two distinct customer fields:

- **Service customer** — whose location is being worked on, whose asset is being serviced
- **Billing customer** — whose invoice this charges

By default they're the same. Change the billing customer on the job's detail page when:

- A child site needs the bill sent to its **parent corporate account**
- A property manager pays for service done at a tenant's location
- A warranty provider covers the job rather than the property owner

The invoice and AR roll-up follow the **billing** customer; the service history and asset attribution follow the **service** customer.
`.trim(),
  },

  // ---- Assets ----
  {
    id: 'what-is-an-asset',
    category: 'Assets',
    title: 'Assets overview & lifecycle',
    body: `
An **asset** is a physical thing at a customer's service location that you service over time — a door lock, an HVAC unit, a fire extinguisher, a safe.

Each asset has a **QR code** you can stick on it. Scanning the code (with any phone camera) opens a public page with the asset's history. Logged-in techs see more (job history, parts installed); the public sees a simple "this is X, last serviced Y" view.
`.trim(),
  },
  { id: 'creating-an-asset', category: 'Assets', title: 'Creating an asset correctly', body: '' },
  { id: 'asset-locations-groups', category: 'Assets', title: 'Locations, buildings & groups', body: '' },
  { id: 'asset-inspections-reports', category: 'Assets', title: 'Inspection cadence & reports', body: '' },
  { id: 'asset-components-inventory', category: 'Assets', title: 'Installed parts & inventory', body: '' },
  { id: 'asset-history-work', category: 'Assets', title: 'Service history & covered work', body: '' },
  { id: 'asset-corrections-retirement', category: 'Assets', title: 'Corrections, replacement & retirement', body: '' },
  { id: 'customer-vs-company-assets', category: 'Assets', title: 'Customer assets vs. company tools', body: '' },
  {
    id: 'asset-types',
    category: 'Assets',
    title: 'Asset types',
    body: `
**Asset types** are your per-tenant taxonomy — "Door Lock", "Mortise Cylinder", "Fire Extinguisher", whatever fits your trade.

Each asset belongs to exactly one type. Types are stored at the tenant level, not the platform level, so you can name them however your shop talks about them.
`.trim(),
  },
  {
    id: 'asset-photos-documents',
    category: 'Assets',
    title: 'Photos & documents',
    body: `
On any asset's detail page you can upload **photos** (e.g. before/after install shots) and **documents** (manuals, warranty PDFs, inspection reports).

Both are stored per-asset and survive across jobs — so the next tech who works on this asset has the full history.
`.trim(),
  },
  {
    id: 'qr-labels',
    category: 'Assets',
    title: 'Printing QR labels',
    body: `
On an asset's detail page hit **Print label** for a single label, or use **Batch labels** from the assets list to print many at once.

The print pages strip the app chrome so the label fills the sheet — load thermal label stock or regular paper depending on your printer.
`.trim(),
  },
  {
    id: 'public-scan',
    category: 'Assets',
    title: 'Public scan flow',
    body: `
Anyone (your tech, the building owner, an inspector) can scan the QR code on an asset.

If the scanner is **logged in** as a tech in your tenant, they see the full history and can start a job.

If the scanner is **anonymous**, they see a sanitized public view — they can request access (which pings you) but can't see private notes or job details.
`.trim(),
  },

  // ---- Catalog & Tax ----
  {
    id: 'service-vs-product-items',
    category: 'Catalog & Tax',
    title: 'Service vs. product catalog items',
    body: `
- **Service items** are the labor/services you sell — "Lock rekey", "Annual inspection". They have a price and a tax class but no inventory.
- **Product items** are physical things — a Schlage deadbolt, a smoke alarm. They can be marked **stocked** so they appear in your inventory and can be pulled onto jobs.

Both can be pulled onto a work order line item, an estimate, or referenced anywhere price + tax matters.
`.trim(),
  },
  {
    id: 'catalog-categories',
    category: 'Catalog & Tax',
    title: 'Categories',
    body: `
Categories let you group catalog items for the picker UI — e.g. "Lock service", "Door hardware", "Inspections".

There are separate trees for **service categories** and **product categories** since they're shown in different contexts.
`.trim(),
  },
  {
    id: 'tax-classes',
    category: 'Catalog & Tax',
    title: 'Tax classes',
    body: `
A **tax class** is a reusable rate (like "Sales Tax 7%") that you attach to catalog items.

Tax classes can have multiple **components** if your jurisdiction layers state + city + special-purpose taxes. Components stack additively.

Items without a tax class are treated as non-taxable.
`.trim(),
  },

  // ---- Inventory ----
  {
    id: 'locations-vs-bins',
    category: 'Inventory',
    title: 'Locations vs. bins',
    body: `
- A **location** is a place where stock lives — your warehouse, a service truck, a storage unit. Each has a kind (warehouse, mobile, etc.).
- A **bin** is a sub-container inside a location — "Shelf A1" inside the warehouse, "Drawer 3" inside the truck.

Stock levels are tracked **per bin**, not per location. So you always know exactly which shelf or drawer holds the part.
`.trim(),
  },
  {
    id: 'transferring-stock',
    category: 'Inventory',
    title: 'Transferring stock (loading the van)',
    body: `
Use **Transfer Stock** (top-right on the Inventory page) to move stock between bins.

The multi-row interface is built for the morning routine: pick the source (warehouse), pick the destination (your truck), then add a row per item with the quantity. One submit = one batch of movements you can audit later.
`.trim(),
  },
  {
    id: 'movements-log',
    category: 'Inventory',
    title: 'Movements audit log',
    body: `
Every stock change in the system — a PO receive, a transfer, a part pulled onto a job, a manual adjustment — creates a **movement** row.

The Movements page shows the full ordered history. Click into any movement to see what triggered it (which PO, which job, which user).
`.trim(),
  },
  {
    id: 'serialized-units',
    category: 'Inventory',
    title: 'Serialized units (SN tracking)',
    body: `
Some products are tracked by **serial number** — an alarm panel, a specific lock body. Mark a catalog item as "SN-tracked" and every receive/transfer/install records the individual unit.

The Units page shows where each serialized unit currently lives, including which job it was installed on and which customer asset it's now part of.
`.trim(),
  },
  {
    id: 'reconciliations',
    category: 'Inventory',
    title: 'Reconciliations',
    body: `
A **reconciliation** is what happens when a count doesn't match the system — you find 3 in the bin but the system says 5.

The Reconciliations page lists pending discrepancies. You can resolve each one (write off, count again, or adjust system).
`.trim(),
  },

  // ---- Purchase Orders ----
  {
    id: 'creating-a-po',
    category: 'Purchase Orders',
    title: 'Creating a purchase order',
    body: `
**Purchase Orders → New** opens a builder where you pick a vendor and add line items.

Each line is a catalog product, a quantity, and a unit cost. Save the PO and it goes into "ordered" state — nothing has hit your stock levels yet.
`.trim(),
  },
  {
    id: 'receiving-a-po',
    category: 'Purchase Orders',
    title: 'Receiving a PO (restock)',
    body: `
When the order arrives, open the PO and hit **Receive**. Pick the destination bin (typically your warehouse) and confirm quantities — partial receives are supported.

Receiving the PO writes a movement per line item, increasing the bin's stock level. The PO transitions to "received" and the audit trail links the stock back to the original order.
`.trim(),
  },
  {
    id: 'needs-ordered',
    category: 'Purchase Orders',
    title: 'Needs Ordered report',
    body: `
**Purchase Orders → Needs Ordered** lists every stocked product whose current quantity is below its reorder threshold.

Use it to plan your next PO. Threshold values are set on the catalog item itself.
`.trim(),
  },

  // ---- Jobs ----
  {
    id: 'ai-intake-queue',
    category: 'Jobs',
    title: 'Intake Queue: turn conversations into work',
    body: `
The **Intake Queue** turns customer call, voicemail, text, email, web, and pasted transcripts into drafts that your office can review. CBI extracts the likely customer, location, requested work, schedule, priority, equipment, and parts. It does **not** create a customer or job automatically.

### Review an intake

1. Open the source conversation or recording and compare it with the extracted draft.
2. Confirm the customer and service location. Link an existing record when one matches instead of creating a duplicate.
3. Check the job title, description, requested time, priority, equipment, and any part guess.
4. Correct anything uncertain, then create the job or estimate only when the draft is accurate.
5. Dismiss spam, duplicates, and conversations that do not require work.

### Queue statuses

- **Pending** means the draft still needs office review.
- **Reviewed** means someone changed or confirmed the extracted information.
- **Failed** means extraction did not finish. CrewBarn retries temporary provider overloads and timeouts; use **Retry AI extraction** when a manual retry is available.
- **Dismissed** keeps the intake for history but removes it from active work.

The original transcript and linked communication remain available for verification. A failed extraction cannot be turned into a job until usable information has been reviewed.

### Correct a Parts Guess

If CBI identifies the wrong part, select **Wrong part? Teach CBI the right one**, enter the correct part, and add a short explanation when useful. CrewBarn saves the correction on this intake and as confirmed memory for this tenant, so a later call about the same vehicle or equipment can use the correction. The original guess is retained for traceability.

A Parts Guess is guidance, not inventory work. It does not reserve stock, add a line item, or consume inventory. Confirm catalog compatibility, quantity, and stocking location before placing or using the part.

### Example

A caller says they need a replacement key for a 2021 Silverado. CBI guesses the wrong key family. The dispatcher listens to the call, links the existing customer, corrects the guess to the verified key type, and creates the job. On a later intake with the same vehicle context, CBI can use that confirmed shop correction.

### Watch for

- AI may infer a VIN, address, schedule, authorization, or part incorrectly. Treat uncertain values as suggestions.
- Confirm who authorized the work and whether the caller is the service or billing contact.
- Only roles with customer access can view Intake; creating or retrying AI extraction and teaching corrections also requires AI permission.

[Open Intake Queue](/intake) · [Open Communications](/communications)
`.trim(),
  },
  {
    id: 'what-is-a-job',
    category: 'Jobs',
    title: 'Jobs (work orders)',
    body: `
A **job** (also called a work order) is a unit of work for a customer at a service location.

It has a status (open, scheduled, in-progress, complete), an assigned tech, line items (services + parts), and optionally a list of customer **assets** that this job covers.
`.trim(),
  },
  {
    id: 'job-line-items',
    category: 'Jobs',
    title: 'Line items: services + parts',
    body: `
Each line on a job is either a **service** (labor — billed by quantity × rate) or a **part** pulled from a specific bin.

When you pull a part, the system writes an inventory movement that decrements the source bin and links the unit to this job.
`.trim(),
  },
  {
    id: 'covered-assets',
    category: 'Jobs',
    title: 'Covered assets',
    body: `
A job can be **attached** to one or more of the customer's assets — meaning "this job services these specific things".

When you mark a part installed on a covered asset, that part shows up in the asset's component list and survives across jobs (you can see "the deadbolt body installed in 2025-04 was replaced in 2026-02").
`.trim(),
  },

  // ---- Estimates ----
  {
    id: 'creating-an-estimate',
    category: 'Estimates',
    title: 'Creating an estimate',
    body: `
**Estimates → New** opens the estimate builder. Pick a customer + service location, add line items (same picker as jobs), set tax classes.

Estimates start in **draft** status. You can iterate freely until you send.
`.trim(),
  },
  {
    id: 'sending-estimates',
    category: 'Estimates',
    title: 'Sending an estimate',
    body: `
Hit **Send** to lock the estimate and email it to the customer. Once sent, line items can't be edited — you'd **supersede** with a new revision.

The customer can approve or reject through a public link. Approval flips the estimate to "approved" and unlocks the **Convert to job** action.

**Who gets the email?** The customer's contact marked **billing contact**, falling back to the **main contact**, falling back to the first contact with an email. If no contact has an email, the estimate transitions to sent but no mail goes out.

**For testers:** use a \`*@crewbarn.com\` email on the customer's contact (e.g. \`customer_alice@crewbarn.com\`). The system email loops back into the platform admin inbox so the deliverability + content can be verified end-to-end.
`.trim(),
  },
  {
    id: 'converting-estimates',
    category: 'Estimates',
    title: 'Converting an estimate to a job',
    body: `
Once approved, **Convert** spawns a new job with the same customer, location, and line items pre-filled.

You still need to schedule + assign a tech to the new job — conversion just saves you re-typing.
`.trim(),
  },

  // ---- Settings ----
  {
    id: 'settings-overview',
    category: 'Settings',
    title: 'Settings directory',
    body: `Choose an area below to read what it controls, see a practical example, or open the function directly. What you can see and change depends on your tenant role.\n\n${SETTINGS_HELP_GROUPS.map((group) => {
      const links = SETTINGS_HELP
        .filter((entry) => entry.group === group)
        .map((entry) => `- [${entry.label}](${entry.route}) — ${entry.description}`)
        .join('\n')
      return `## ${group}\n\n${links}`
    }).join('\n\n')}`,
  },
  ...SETTINGS_HELP.map<HelpTopic>((entry) => {
    // SETTINGS_HELP_DETAILS is a Record<string, …>, so TypeScript types this
    // as always-present and a missing row is invisible until runtime — where
    // it threw during module init and rendered the ENTIRE app blank, not just
    // this help page. (Adding a SETTINGS_HELP entry without its paired detail
    // row did exactly that; the build passed and prod went white.) Treating it
    // as optional keeps a missing row costing one thin help topic.
    const details = SETTINGS_HELP_DETAILS[entry.id] as typeof SETTINGS_HELP_DETAILS[string] | undefined
    const bullets = (items: string[] | undefined, fallback: string) =>
      items?.length ? items.map((i) => `- ${i}`).join('\n') : `- ${fallback}`
    return {
      id: settingsHelpTopicId(entry.id),
      category: `Settings: ${entry.group}`,
      title: entry.label,
      body: `
## What this controls

${entry.description}

## How to use it

${details?.steps?.length
        ? details.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')
        : `Open [${entry.label}](${entry.route}) and review the options described above.`}

## Practical example

> ${entry.example}

## What it affects

${bullets(details?.effects, `Changes here apply to ${entry.group.toLowerCase()} for your whole company.`)}

## Watch for

${bullets(details?.watchFor, 'Test the change on a safe record before relying on it.')}

## Before you change it

- ${entry.access ?? 'Your tenant role and permissions determine whether you can view or change this area.'}
- Confirm who uses the related workflow and test the change with a safe record when practical.

[Open ${entry.label} →](${entry.route})
`.trim(),
    }
  }),

  // ---- Testers ----
  {
    id: 'tester-walkthrough',
    category: 'Testers',
    title: 'The tester walkthrough widget',
    body: `
If your account has the **Tester** role, you'll see a floating card at the bottom-right of every page.

It walks you through ~40 numbered tests covering every major flow in the app. After each step, click **"Done — add notes"** to leave feedback (with a quick "Worked / Confusing / Broke" toggle). Notes are visible to platform admins who can review them in aggregate.

Skip is fine — feedback on the steps you actually try is more valuable than completion.
`.trim(),
    audience: 'tester',
  },
  {
    id: 'tester-feedback',
    category: 'Testers',
    title: 'Sending good tester feedback',
    body: `
The most useful notes are short and **specific**:

- ✅ "Couldn't find the bin picker — expected it on the line item row"
- ✅ "Fields reset after I clicked Save — had to re-enter everything"
- ❌ "It's confusing"
- ❌ "Looks fine"

If something's broken, paste the error message verbatim if you can. Screenshots aren't supported in the in-app form yet — email any screenshots to support@crewbarn.com referencing the step name.
`.trim(),
    audience: 'tester',
  },

  // ---- Platform Admin ----
  {
    id: 'acting-as-tenant',
    category: 'Platform Admin',
    title: 'The "Acting as" banner',
    body: `
Platform admins can act-as any tenant. The banner at the top of the app shows which tenant context you're currently in.

Without a selected tenant, **writes will fail** — the BelongsToTenant trait can't infer a tenant_id, so most create/update operations 422.

Switch tenants from the banner's dropdown. The selection persists across reloads via localStorage.
`.trim(),
    audience: 'platform_admin',
  },
  {
    id: 'admin-portal',
    category: 'Platform Admin',
    title: 'Admin portal',
    body: `
Your avatar menu has a **Tenants / Testers / Inbox** section gated to platform admins.

- **Tenants** — list, create, edit tenants. The New form is where you provision tester accounts with auto-generated passwords + invitation emails.
- **Testers** — list every tester account, see their walkthrough progress and notes timeline.
- **Inbox** — the @crewbarn.com platform email inbox. Replies are sent through the platform mail provider (Resend).
`.trim(),
    audience: 'platform_admin',
  },
  {
    id: 'tester-email-workflow',
    category: 'Platform Admin',
    title: 'Tester emails: use @crewbarn.com addresses',
    body: `
When provisioning a tester tenant, **use a \`*@crewbarn.com\` email** for the owner account (e.g. \`tester_jane@crewbarn.com\`).

The New Tenant form has an "Auto-fill @crewbarn.com" button that fills in a clean address based on the tenant slug — click it after picking the role.

**Why this works:** \`*@crewbarn.com\` MX records route through the Cloudflare Email Worker into your admin inbox. The auto-generated invitation email + walkthrough lands in your own inbox. You then **text or call the tester** with the password.

**Benefits:**

- Testers don't need to give you a real email address (low friction)
- You see every system email that gets sent (great for debugging)
- Testers replying to system mail loops back to your admin inbox automatically
- One inbox to monitor instead of N tester mailboxes

The tester logs in with the \`@crewbarn.com\` address as their username — they never need to actually receive mail at it.
`.trim(),
    audience: 'platform_admin',
  },
]

export const HELP_TOPICS: HelpTopic[] = HELP_TOPIC_DEFINITIONS.map((topic) => ({
  ...topic,
  body: ((topic.category.startsWith('Settings') ? 'Settings are now managed at [connect.crewbarn.com](https://connect.crewbarn.com/connect). Sign in with your CrewBarn account; your existing permissions still apply.\n\n' : '') + (EXPANDED_HELP_GUIDES[topic.id] ?? topic.body)).replace(/\]\((\/tool-shed[^\s)]*|\/catalog\/tax-classes|\/custom-documents|\/website-builder)\)/g, (_, path: string) =>
    '](https://connect.crewbarn.com' + (path === '/tool-shed' ? '/connect' : path) + ')'),
}))
