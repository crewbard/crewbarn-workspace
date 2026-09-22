export interface SettingsHelpDetail {
  steps: string[]
  effects: string[]
  watchFor: string[]
}

export const SETTINGS_HELP_DETAILS: Record<string, SettingsHelpDetail> = {
  'delete-permissions': {
    steps: ['Open Tool Shed → Delete Permissions (only the company owner can change it).', 'Under "Who can delete", check the people allowed to delete records. Leave everyone unchecked to keep the default of owners and admins.', 'Decide whether deleting requires re-entering a password and whether it requires a written reason.', 'If the password step is on, name anyone who should skip it — everyone else still has to type it.', 'Try deleting a test record as a staff member to confirm the rules behave the way you expect.'],
    effects: ['Anyone not authorized gets a "not authorized to delete" message instead of a delete button that fails.', 'Reasons are written to the deletion audit log, so you can see who removed what and why.', 'Password exemptions only skip the password step — they never widen who may delete or bypass the financial guards.'],
    watchFor: ['Records that anchor money can never be deleted by anyone, including the owner: customers with invoices, invoices with payments applied, and invoiced jobs. Deactivate or cancel those instead.', 'Naming an explicit list replaces the owner/admin default — anyone left off loses delete access immediately.'],
  },
  automations: {
    steps: ['Choose the business event that starts the automation.', 'Define conditions narrowly enough to avoid unrelated records.', 'Select an existing approved template or action.', 'Test with a safe record and inspect automation activity.', 'Activate only after the result and recipient are correct.'],
    effects: ['Active rules can send messages, create work, or notify staff without another manual step.', 'Templates, status triggers, reminders, and webhooks may overlap, so review the whole workflow.'],
    watchFor: ['Duplicate automations can send the same customer message twice.', 'Do not activate customer-facing actions with placeholder templates.'],
  },
  'templates-forms': {
    steps: ['Choose the correct template type: email, SMS, document, or form.', 'Write customer-facing content and insert supported merge fields.', 'Preview with realistic sample data.', 'Save a clearly named reusable template.', 'Attach it to the intended status, automation, reminder, or manual send workflow.'],
    effects: ['Editing a shared template changes future uses wherever it is selected.', 'Merge fields resolve from the record used at send or generation time.'],
    watchFor: ['Keep SMS concise and include required opt-out language where applicable.', 'Preview missing merge data and never expose internal notes.'],
  },
  'import-data': {
    steps: ['Choose the supported record type and download/review its expected columns.', 'Clean duplicate and malformed source rows before upload.', 'Upload the file and map each source column.', 'Review validation errors and sample output.', 'Run the import once, then verify counts and several records.'],
    effects: ['Imports can create many tenant records in one operation.', 'Imported values still follow tenant validation and relationships.'],
    watchFor: ['Back up or export relevant data first.', 'Do not repeatedly submit the same file after a timeout without checking import results.'],
  },
  'data-export': {
    steps: ['Choose the record set and date/filter scope.', 'Confirm the requester is authorized to receive the data.', 'Generate the export and wait for completion.', 'Inspect headers and sample rows before distributing.', 'Store or transmit the file using company security policy.'],
    effects: ['Exports copy current tenant data into a file outside CrewBarn.', 'Filters determine whether the file is complete enough for the intended purpose.'],
    watchFor: ['Exports can contain personal, financial, or operational data.', 'Delete temporary copies when retention is no longer required.'],
  },
  inventory: {
    steps: ['Create real locations and labeled bins.', 'Configure stocked and serialized products in Product Catalog.', 'Receive purchases into exact bins.', 'Use transfers for stock movement and job usage for consumption.', 'Review movements and reconcile physical counts regularly.'],
    effects: ['Every supported stock change creates movement history.', 'Bin quantities feed pickers, truck availability, reorder work, and reporting.'],
    watchFor: ['Do not use manual adjustments instead of receipts, transfers, or job usage.', 'Investigate negative or repeated discrepancies.'],
  },
  'inventory-settings': {
    steps: ['Open Inventory → Settings with a role allowed to edit inventory configuration.', 'Review each rule and identify which field and office workflows it affects.', 'Enable scan requirements, serial behavior, or stock controls deliberately.', 'Save and test on a non-customer job with both an authorized manager and a technician.', 'Document the expected fallback when a barcode or registered unit is unavailable.'],
    effects: ['Rules can change what technicians must scan or select before using products.', 'Permission controls determine who may change settings, while inventory permissions control day-to-day transactions.'],
    watchFor: ['A strict scan rule can stop field work when products lack labels.', 'Do not enable free-text serial entry if exact unit custody is required.'],
  },
  'service-catalog': {
    steps: ['Create a clear service name and customer-facing description.', 'Set default price, cost assumptions, category, tax class, and active state.', 'Add optional internal guidance only in internal fields.', 'Use the service on a test estimate and job.', 'Review pricing and tax before publishing to staff.'],
    effects: ['Defaults prefill future transaction lines.', 'Catalog reporting groups use the selected category and service identity.'],
    watchFor: ['Changing a default does not necessarily rewrite historical documents.', 'Avoid duplicate services with slightly different names.'],
  },
  'product-catalog': {
    steps: ['Create the product with SKU, description, category, price, and cost.', 'Choose stocked, serialized, reorder, and asset-install behavior.', 'Assign tax and vendor information as applicable.', 'Receive initial stock through a PO or approved inventory process.', 'Test selection, scanning, transfer, and job usage.'],
    effects: ['Stocked products participate in bin quantities and movements.', 'Serialized products require exact-unit identity throughout supported workflows.'],
    watchFor: ['Do not change serialization casually after stock exists.', 'Use stable SKUs and avoid duplicate product records.'],
  },
  'service-categories': {
    steps: ['Plan a small category hierarchy staff will recognize.', 'Create parent groups before child groups.', 'Assign services to the most specific useful category.', 'Test service pickers and filters.', 'Merge or deactivate confusing categories only after reviewing usage.'],
    effects: ['Categories change how services are organized in pickers and reports.'],
    watchFor: ['Too many levels slow down selection.', 'Do not mix product categories into the service tree.'],
  },
  'product-categories': {
    steps: ['Plan categories around how staff find and report products.', 'Create parent and child groups.', 'Assign products consistently.', 'Test product and inventory pickers.', 'Review uncategorized products regularly.'],
    effects: ['Category changes affect product browsing and grouped reporting.'],
    watchFor: ['Avoid one category per item.', 'Moving a parent can relocate many products in the UI.'],
  },
  'customer-assets': {
    steps: ['Create the asset under the correct customer service location.', 'Select an asset type and enter model/serial identifiers.', 'Add useful photos, documents, warranty, and install details.', 'Print and test the QR label when used.', 'Cover the asset on relevant jobs and associate installed parts.'],
    effects: ['Jobs and installed components build long-term equipment history.', 'QR access resolves to the asset under permission/public-view rules.'],
    watchFor: ['Search before adding to avoid duplicate serial numbers.', 'One record should represent one physical asset.'],
  },
  'asset-access': {
    steps: ['Open the request and identify the asset and requester.', 'Verify the requester through an independent tenant-approved method.', 'Review the minimum access needed.', 'Approve or deny with a clear reason.', 'Revoke access when the relationship ends.'],
    effects: ['Approval can expose additional asset information to the requester according to implemented scope.'],
    watchFor: ['A QR scan alone does not prove authorization.', 'Do not disclose private notes or unrelated customer data.'],
  },
  'asset-types': {
    steps: ['Review existing types first.', 'Create a clear equipment class used by staff.', 'Activate it and create a test asset.', 'Check filters and reporting terminology.', 'Deactivate obsolete types only after reviewing existing assets.'],
    effects: ['Types classify new and existing customer assets.'],
    watchFor: ['Do not use status or location names as asset types.', 'Renaming changes labels on existing records.'],
  },
  'company-tools': {
    steps: ['Create the company-owned tool with identifying details.', 'Record serial, condition, documents, and service information.', 'Assign or transfer custody to the appropriate person/location.', 'Record returns, damage, calibration, or retirement.', 'Audit high-value tools periodically.'],
    effects: ['Custody and history remain separate from customer assets and sellable inventory.'],
    watchFor: ['Do not record a customer-owned asset as a company tool.', 'Verify custody before reassigning.'],
  },
  vendors: {
    steps: ['Create the supplier with legal/display name and ordering contacts.', 'Add account, payment, lead-time, and ordering notes.', 'Associate relevant products where supported.', 'Use the vendor on a test purchase order.', 'Deactivate duplicates or obsolete vendors carefully.'],
    effects: ['Purchase orders and purchasing history reference the vendor.'],
    watchFor: ['Keep banking or sensitive credentials out of ordinary notes.', 'Merge duplicate suppliers before reporting fragments.'],
  },
  'purchase-orders': {
    steps: ['Select the vendor and add exact product lines, quantities, and costs.', 'Review open POs before placing another order.', 'Record vendor confirmation and expected timing.', 'Receive only physically accepted quantities into exact bins.', 'Close or cancel remaining quantities with an explanation.'],
    effects: ['Ordering records intent; receiving creates inventory movements.', 'Partial receipts preserve open quantities.'],
    watchFor: ['Do not treat ordered quantity as on hand.', 'Avoid duplicate receipts after slow responses.'],
  },
  warranties: {
    steps: ['Create or verify coverage for the correct product, asset, customer, or job.', 'Enter provider, start/end dates, terms, and supporting documents.', 'Check coverage before charging covered work.', 'Record each claim and outcome.', 'Review expiring coverage and close completed claims.'],
    effects: ['Warranty and claim history can support service and billing decisions.'],
    watchFor: ['Coverage dates alone do not prove a claim is eligible.', 'Attach evidence and do not overwrite prior claim history.'],
  },
  'warranty-settings': {
    steps: ['Choose whether repeated claims are allowed.', 'Set the expiring-soon threshold used by tenant workflows.', 'Save and test with sample warranties around the threshold.', 'Explain the rule to service and billing staff.'],
    effects: ['The policy changes how warranty claims and upcoming expiration are handled.'],
    watchFor: ['A restrictive claim rule may block legitimate follow-up work.', 'Changing the threshold can alter alert/report volume.'],
  },
  'job-types': {
    steps: ['Create a type named for work staff recognize.', 'Choose its service/inspection/install/repair/estimate/project category.', 'Set a default starting status and expected duration.', 'Select the default checklist when available.', 'Create a test job and verify every default.', 'Deactivate unused types rather than repurposing their meaning.'],
    effects: ['New jobs of that type can prefill status, duration, and checklist.', 'Type/category support filtering and reporting.'],
    watchFor: ['A default status still follows tenant workflow rules after creation.', 'Changing defaults affects future jobs, not necessarily existing ones.'],
  },
  'job-statuses': {
    steps: ['Define each status name, color, category, icon, order, and active state.', 'Assign a mobile field action only when that status represents travel, arrival, return-needed, completion, or cancellation.', 'Attach reviewed email/SMS templates where customer communication is appropriate.', 'Configure flow rules and prerequisites for manual movement.', 'Test manual web/mobile changes, physical check-in/out, triggers, cancellation, and payment-related paths.', 'Keep custom statuses meaningful and document their operational owner.'],
    effects: ['Statuses drive dispatch visibility, reporting categories, mobile actions, triggers, and lifecycle behavior.', 'Flow rules guard manual transitions; physical field events can update mapped statuses automatically.', 'Templates contain messages, while triggers send them.'],
    watchFor: ['Do not assign the same field action to multiple active statuses.', 'Avoid customer messages on overlapping statuses that create duplicates.', 'Paid records customer obligation; cash drawers separately track physical custody.'],
  },
  tags: {
    steps: ['Create a short, reusable label with one understood meaning.', 'Apply it to supported records.', 'Use it in filters or workflows.', 'Review unused or duplicate tags.', 'Remove carefully if automations or reporting rely on it.'],
    effects: ['Tags add flexible grouping without changing core record type.'],
    watchFor: ['Do not use near-duplicate spelling or temporary sentence-like tags.'],
  },
  'customer-types': {
    steps: ['List the customer groups the business actually treats differently.', 'Create clear types such as Residential or Commercial.', 'Assign existing customers consistently.', 'Test filters, pricing, forms, or reports that use type.', 'Deactivate types that no longer have a distinct purpose.'],
    effects: ['Customer classification supports filtering and downstream business logic where implemented.'],
    watchFor: ['Do not confuse customer type with tags or parent/child relationships.'],
  },
  'service-locations': {
    steps: ['Create the physical site under the correct customer.', 'Enter a validated address and location-specific contacts/instructions.', 'Assign territory and custom fields where used.', 'Attach assets to this exact location.', 'Choose it on jobs and estimates.'],
    effects: ['Dispatch, mapping, assets, job history, and field arrival use the location.'],
    watchFor: ['Do not overwrite one branch address with another.', 'Keep billing address separate when appropriate.'],
  },
  territories: {
    steps: ['Search for the county and select it from the results; CrewBarn loads the county, state, and five-digit ZIP coverage automatically.', 'Review the imported ZIP list, remove ZIPs you do not serve, and add any boundary ZIPs that are missing.', 'Use a territory name dispatchers recognize.', 'Assign one or more users whose role is Dispatcher; a backup dispatcher may share the same territory.', 'Save the territory and test a known customer service location in one of its ZIP codes.', 'Open Dispatch and select the territory to confirm its jobs and scheduled estimates appear.'],
    effects: ['Customer service locations are matched to active territories by postal code.', 'New and existing jobs inherit the territory of their service location.', 'Assigned dispatchers open Dispatch inside one of their allowed territories and can switch among their assigned areas.', 'Owners and administrators can use All territories or filter to one area.'],
    watchFor: ['A ZIP code should belong to only one active territory; overlaps use the primary territory first, then name order.', 'A location with a missing or uncovered ZIP remains unassigned and will not appear inside a territory filter.', 'A Dispatcher with no territory assignment remains unrestricted during rollout, so assign each dispatcher when configuration is ready.'],
  },
  'custom-fields': {
    steps: ['Choose the record type that truly owns the information.', 'Select the correct field type and write a clear label/help text.', 'Configure options, required state, ordering, and visibility.', 'Test create/edit/mobile/customer-facing forms where applicable.', 'Export or review existing values before changing field type or removing it.'],
    effects: ['The field appears on supported forms and records.', 'Required fields can block saving until populated.'],
    watchFor: ['Do not collect sensitive data without a security and retention need.', 'Changing options can make historical values difficult to interpret.'],
  },
  'staff-crews': {
    steps: ['Create or invite the person with correct contact and employment details.', 'Assign the least-privileged role needed.', 'Enable app/field access only when required.', 'Place staff in the appropriate crew and schedule context.', 'Test login and one permitted workflow.', 'Deactivate access immediately when the relationship ends.'],
    effects: ['Role permissions determine application/API access.', 'Crew and assignment data affect dispatch and operational grouping.'],
    watchFor: ['Never share accounts.', 'Removing a person should preserve historical attribution.'],
  },
  subcontractors: {
    steps: ['Create the subcontractor/company record.', 'Store approved contact, licensing, insurance, and trade information.', 'Verify current eligibility before assignment.', 'Assign to the supported job/workflow.', 'Record completed scope and financial obligations separately from employees.'],
    effects: ['Jobs can retain who performed outside work.'],
    watchFor: ['Do not grant employee-level access by default.', 'Track expiration of required credentials.'],
  },
  'roles-permissions': {
    steps: ['Start from the person’s actual job responsibilities.', 'Grant view permissions before edit/manage permissions.', 'Separate financial, security, settings, and data-export powers.', 'Test with a non-owner account.', 'Review role assignments and audit activity regularly.'],
    effects: ['Permissions are enforced by protected UI and API operations.', 'Role changes can immediately expand or restrict access.'],
    watchFor: ['Do not solve one blocked task by granting broad owner-like access.', 'Keep at least one recoverable owner/admin path.'],
  },
  'time-off': {
    steps: ['Select the correct staff member.', 'Enter start/end times and reason/category.', 'Save and verify the period on scheduling views.', 'Reassign conflicting work.', 'Update or cancel the entry when plans change.'],
    effects: ['Availability and dispatch decisions can reflect approved unavailability.'],
    watchFor: ['Check time zones and partial days.', 'Time off does not automatically communicate every schedule change to customers.'],
  },
  security: {
    steps: ['Review the tenant 2FA policy before enforcing it.', 'Have each user enroll their own authenticator/recovery method.', 'Confirm recovery procedures and owner access.', 'Enable the policy for the intended population.', 'Review failed access and offboard old accounts.'],
    effects: ['Policy can require stronger authentication for tenant users.', 'Personal enrollment remains tied to the individual account.'],
    watchFor: ['Do not enroll a platform admin’s personal 2FA while acting as a tenant.', 'Store recovery codes securely and never in shared notes.'],
  },
  encryption: {
    steps: ['Confirm contractual and technical BYOK requirements.', 'Create and protect the key in the supported provider.', 'Grant only the required service access.', 'Configure the key reference without exposing key material.', 'Test encryption/decryption and documented recovery/rotation.', 'Monitor key availability before enforcing production dependence.'],
    effects: ['Supported sensitive tenant data depends on the configured key path.', 'Revoking or losing the key can make data unavailable.'],
    watchFor: ['Do not paste raw secrets into notes or support messages.', 'Plan rotation and disaster recovery before enabling.'],
  },
  'company-files': {
    steps: ['Classify the file and confirm it belongs in secure company storage.', 'Upload with a clear name and description.', 'Grant only required list/view/upload/manage permissions.', 'Test access using a limited role.', 'Review and remove outdated copies according to retention policy.'],
    effects: ['Authorized tenant users can access internal files independent of customer records.'],
    watchFor: ['Permission to list files may differ from permission to view content.', 'Do not upload secrets that require a dedicated secret manager.'],
  },
  integrations: {
    steps: ['Identify the business problem and system of record.', 'Open the dedicated setup page for that provider/function.', 'Authorize the minimum required scope.', 'Map ownership, identities, and sync direction.', 'Test with one safe record.', 'Monitor errors and document disconnect/recovery steps.'],
    effects: ['Connected systems can exchange data or trigger actions.', 'Provider-specific settings remain in their dedicated pages.'],
    watchFor: ['Avoid connecting duplicate providers for the same workflow.', 'Know which system wins when both sides change data.'],
  },
  communication: {
    steps: [
      'Choose exactly one Twilio source for mobile in-app calling: CrewBarn Hosted or BYO Twilio.',
      'Use CrewBarn Hosted when CrewBarn should provision and operate the Twilio service. Platform Account SID, API keys, and Primary Auth Token stay in the server environment; tenants do not enter those platform secrets.',
      'Use BYO Twilio when the tenant owns and pays for Twilio. Save that tenant Account SID, Auth Token, From number, Voice API Key SID/secret, and TwiML App SID in Communication Settings.',
      'Enable BYO Net2Phone separately when the tenant uses Net2Phone. Net2Phone is an add-on, not a competing Twilio choice, and its API key, numbers, and webhook secret belong in the tenant settings.',
      'When Net2Phone is enabled and configured, CrewBarn uses it for office calling, customer SMS, inbound hooks, recordings, and replies. Mobile in-app calls continue using the selected Twilio source.',
      "For CrewBarn Hosted, either verify the public business number customers already know as caller ID or buy an optional CrewBarn-hosted number. Verification does not transfer ownership of the tenant's existing number.",
      'Configure transcription and dedicated intake only after the main provider paths work. Confirm recording consent, retention, permissions, and SMS opt-out handling.',
      'Save changes, then open More → Phone in the mobile app and place a test call. Confirm it appears in Communications with the correct caller ID, customer match, status, recording, and transcript before testing office calls and SMS.',
    ],
    effects: [
      'The Twilio selection controls mobile in-app voice. Only one Twilio source can be selected at a time.',
      'Net2Phone can be active at the same time because it performs the office, messaging, inbound, recording, and reply functions.',
      'BYO credentials and numbers remain tenant-owned. CrewBarn-hosted resources remain under CrewBarn billing until released or ported.',
      'Status notifications, reminders, templates, transcription, and intake depend on the relevant active route being configured and tested.',
    ],
    watchFor: [
      'Do not put CrewBarn platform Twilio credentials in tenant BYO fields. Hosted secrets belong only in the protected server environment.',
      'Do not disable Net2Phone merely to enable Twilio mobile calling; they can and often should be active together.',
      'Verify which number customers see, where callbacks and replies land, recording consent, transcription consent, SMS opt-out handling, and applicable calling/texting laws.',
      'Never paste provider secrets into notes, screenshots, help requests, or chat.',
    ],
  },
  'cbi-ai': {
    steps: [
      'Choose the tenant-approved AI provider and configure credentials.',
      'Keep the master switch off while reviewing task groups, tool permissions, and customer-facing actions.',
      'Enable the least-risk internal tasks first, then test page, job, customer, location, document, and mobile context with safe records.',
      'Keep customers, jobs, estimates, invoices, expenses, catalog, inventory, assets, and company cost data accurate; CBI can retrieve relevant permitted records as evidence.',
      'Use Teach CBI and correction controls when a guess is wrong. Include the verified answer and the vehicle, equipment, customer, or workflow context that makes it correct.',
      'Review suggested memory cards from estimates, invoices, job notes, conversations, BarnCam, and other enabled learning sources. Approve durable facts; reject one-off or uncertain observations.',
      'Monitor AI activity and memory usage, remove outdated memory, and expand permissions only after accuracy and audit review.',
    ],
    effects: [
      'CBI combines current permission-gated tenant records with relevant approved tenant memory; it does not load every record into every answer.',
      'Accurate expenses, inventory, assets, pricing, completed work, and customer history can improve estimates and operational suggestions when the enabled tool supports that question.',
      'Confirmed corrections make later guesses more business-specific without retraining the public base AI model.',
      'Task switches limit what CBI may do; user permissions, tenant scope, approval gates, and source-record rules still apply.',
      'Customer-facing actions can create real communication when enabled.',
    ],
    watchFor: [
      'A better-informed guess is still a guess. Verify pricing, parts, scheduling, purchasing, accounting, and customer-facing output against source records.',
      'Do not approve a memory merely because it appeared once; save durable shop rules and verified facts.',
      'Reject or deactivate outdated memory so it does not influence later work.',
      'AI output must not bypass tenant rules or authorization.',
      'Never place passwords, API keys, authentication tokens, or unsupported claims in prompts or memory.',
      'Require human confirmation for consequential actions where configured.',
    ],
  },
  'storage-maps': {
    steps: ['Choose tenant-owned or supported storage behavior.', 'Configure storage credentials with least privilege and test upload/download.', 'Configure Google Maps browser and server usage according to key restrictions.', 'Test address lookup, map rendering, routing/geocoding, and mobile location flows.', 'Monitor provider errors and quota.', 'Document which values come from tenant settings versus server environment.'],
    effects: ['Storage settings control where supported files are kept.', 'Map keys and restrictions affect browser maps, server geocoding, and location-aware functions differently.'],
    watchFor: ['Never expose a server-secret key in browser code.', 'Restrict browser keys by approved origins and server keys by supported server restrictions.', 'A displayed map does not prove mobile location permission is granted.'],
  },
  'gps-devices': {
    steps: ['Register the supported tracker/device identifier.', 'Associate it with the correct vehicle or operational record.', 'Activate and confirm fresh location data.', 'Verify map position and timestamp.', 'Deactivate or reassign when hardware moves.'],
    effects: ['Dispatch may use device positions independently of phone GPS.'],
    watchFor: ['Stale coordinates can look like a current location.', 'Confirm employee notice and tracking policy.'],
  },
  'api-tokens': {
    steps: ['Create one token per integration/purpose.', 'Grant the smallest supported scope.', 'Copy the secret once into the external system’s secure secret store.', 'Test only required endpoints.', 'Record owner and rotation date.', 'Revoke immediately when unused or exposed.'],
    effects: ['The external system can act within token scope without a user password.'],
    watchFor: ['Token secrets should never appear in screenshots, source control, or notes.', 'Do not share one token among unrelated systems.'],
  },
  webhooks: {
    steps: ['Choose only events the receiver needs.', 'Enter the HTTPS endpoint and configure signing secret.', 'Send a test event.', 'Verify signature checking, idempotency, retries, and error handling in the receiver.', 'Activate and monitor deliveries.', 'Rotate secrets without creating downtime.'],
    effects: ['Selected CrewBarn events are delivered to an outside system.', 'Retries can send the same event more than once.'],
    watchFor: ['Receivers must verify signatures and handle duplicates.', 'Do not include unnecessary customer data.'],
  },
  'connected-apps': {
    steps: ['Review each connection, account, scope, and last activity.', 'Confirm the business owner still needs it.', 'Test replacement connections before disconnecting old ones.', 'Disconnect unused or suspicious access.', 'Verify scheduled syncs and webhooks stop as expected.'],
    effects: ['Disconnecting can stop data exchange and provider workflows.'],
    watchFor: ['Do not disconnect during an active migration without a rollback plan.'],
  },
  marketplace: {
    steps: ['Choose private, listed, or paused visibility.', 'Select the correct trade and service area.', 'Write a customer-facing description and verify company contact/brand data.', 'Preview the listing.', 'Publish and test discovery/contact flow.', 'Pause the listing when capacity or eligibility changes.'],
    effects: ['Visibility and service-area choices control marketplace discovery.'],
    watchFor: ['Do not claim licenses, coverage, or services the company cannot provide.', 'Keep ZIP coverage current.'],
  },
  'partner-connections': {
    steps: ['Identify the correct partner tenant/company.', 'Verify the relationship outside the invitation.', 'Review exactly what the connection enables.', 'Approve with an authorized role.', 'Test one referral/shared workflow.', 'Revoke when the partnership ends.'],
    effects: ['Connected partners can participate in supported cross-business workflows while tenant data remains scoped.'],
    watchFor: ['A business relationship does not justify unrestricted tenant access.', 'Confirm customer consent for shared work where required.'],
  },
  'company-info': {
    steps: ['Enter legal/display name, contact details, address, and operational information.', 'Verify phone, email, time zone, and locale.', 'Review how details appear on customer documents and portals.', 'Save and preview an estimate/invoice.', 'Update related provider or tax records separately when needed.'],
    effects: ['Company identity appears throughout customer-facing and internal workflows.'],
    watchFor: ['A display-name change does not automatically update legal/provider accounts.', 'Confirm time zone before scheduling.'],
  },
  'brand-logo': {
    steps: ['Prepare a clear high-quality logo with suitable background/transparent variant.', 'Upload and crop/preview it.', 'Choose accessible brand/accent colors.', 'Preview documents, portal, and website uses.', 'Test light/dark and print contexts.', 'Publish only after text remains readable.'],
    effects: ['Brand assets can appear across estimates, invoices, documents, portal, and website.'],
    watchFor: ['Low-contrast colors make customer content inaccessible.', 'Do not use oversized or blurry source images.'],
  },
  'website-builder': {
    steps: ['Review company info, brand, services, contact details, and service area first.', 'Generate or write page content and inspect every factual claim.', 'Choose template, hero media, navigation, and page structure.', 'Preview desktop and mobile pages.', 'Configure domains/Cloudflare as required.', 'Publish, test public forms/links, and monitor updates.'],
    effects: ['Publishing changes the public tenant website.', 'Generated copy can draw from tenant data but still requires review.'],
    watchFor: ['Do not publish invented services, licenses, guarantees, or locations.', 'Verify domain/DNS and rollback before launch.'],
  },
  'shop-rules': {
    steps: ['Review each section: numbering, field rules, intake, reminders, and GPS.', 'Document the current operational process before changing defaults.', 'Change one related group at a time.', 'Test new job/estimate creation and mobile field closeout.', 'Test reminder timing and GPS permission behavior.', 'Communicate enforced requirements to staff.'],
    effects: ['Rules can change required field evidence, numbering, intake defaults, reminders, and check-in behavior.'],
    watchFor: ['Hard requirements can block technicians without training or connectivity.', 'Communication rules can duplicate status triggers.'],
  },
  'pricing-discounts': {
    steps: ['Define approved pricing and discount policies.', 'Create clearly named discount choices and limits.', 'Assign who can view or apply them.', 'Test taxable and non-taxable lines.', 'Review estimate/job/invoice totals and reporting.', 'Audit overrides regularly.'],
    effects: ['Pricing and discounts affect customer totals, margin, and reporting.'],
    watchFor: ['Do not use discounts to conceal write-offs or payment corrections.', 'Confirm tax treatment after discount.'],
  },
  'cost-model': {
    steps: ['Gather loaded labor, overhead, vehicle, and other real cost assumptions.', 'Enter supported cost components and effective values.', 'Compare model output with known completed work.', 'Limit access to appropriate financial roles.', 'Review on a schedule and document changes.'],
    effects: ['Profitability reporting uses the configured assumptions.', 'It does not change actual payroll or vendor transactions unless explicitly connected.'],
    watchFor: ['Bad assumptions create confident but misleading margin reports.', 'Protect sensitive compensation/cost information.'],
  },
  'tax-classes-setting': {
    steps: ['Confirm rates and applicability with a tax professional.', 'Create the class and each component.', 'Assign it to the correct catalog items.', 'Test an estimate/invoice in the jurisdiction.', 'Document effective date and review future changes.'],
    effects: ['Assigned items use the configured class in supported calculations.'],
    watchFor: ['CrewBarn configuration is not tax advice.', 'Historical documents may require different handling than future rates.'],
  },
  'payment-terms': {
    steps: ['Create clear terms such as Due on Receipt or Net 30.', 'Set due-day behavior and customer-facing label.', 'Choose tenant/customer defaults where supported.', 'Test an invoice issue date and due date.', 'Update collections procedures to match.'],
    effects: ['Terms determine displayed due expectations and supported due-date calculations.'],
    watchFor: ['Changing defaults should not silently rewrite agreed historical terms.'],
  },
  'payment-types': {
    steps: ['Review built-in types first.', 'Add a custom type only for a distinct real payment method.', 'Set active state and display name.', 'Test recording and reporting.', 'Deactivate obsolete choices after reviewing historical use.'],
    effects: ['Staff can classify recorded payments with active types.'],
    watchFor: ['Payment type does not itself process funds.', 'Do not use types as statuses or notes.'],
  },
  'card-payments': {
    steps: ['Connect the correct tenant Stripe account.', 'Complete provider onboarding and verify readiness.', 'Review allowed users and payment workflow.', 'Run a controlled test payment and refund if supported.', 'Confirm invoice balance, receipt, fees, and provider dashboard.', 'Document dispute and disconnect procedures.'],
    effects: ['Successful processing can create CrewBarn payment records and update invoice balance/status.', 'Stripe remains the payment processor/system for provider settlement details.'],
    watchFor: ['Never enter live card data into notes or ordinary forms.', 'Verify test/live mode and connected account before charging.'],
  },
  cloudflare: {
    steps: ['Choose the correct Cloudflare account and zone.', 'Authorize only required scopes.', 'Verify existing DNS records before changes.', 'Connect the supported website/domain function.', 'Test HTTPS, redirects, email/DNS dependencies, and rollback.', 'Remove access no longer needed.'],
    effects: ['Domain/DNS changes can affect public website and related services.'],
    watchFor: ['Do not overwrite MX or other critical records accidentally.', 'Allow for DNS propagation and keep rollback values.'],
  },
  modules: {
    steps: ['Review how each module is currently used.', 'Confirm roles and workflows before hiding it.', 'Enable/disable one module at a time.', 'Test navigation and direct routes with affected roles.', 'Confirm existing records remain accessible as intended.', 'Communicate layout changes.'],
    effects: ['Module settings control feature visibility, not a replacement for API permissions.', 'Existing data should not be treated as deleted merely because navigation is hidden.'],
    watchFor: ['Do not hide a module staff need for active work.', 'Test direct links and mobile behavior.'],
  },
  'app-layout': {
    steps: ['Choose the navigation layout suited to the user’s device/work.', 'Set density and page width.', 'Choose default views for major lists.', 'Preview on desktop and mobile.', 'Save and verify common workflows.', 'Allow individuals to use appropriate personal preferences where supported.'],
    effects: ['Layout changes presentation and defaults, not permissions or data.'],
    watchFor: ['Dense layouts can reduce readability on small screens.', 'Do not assume every role needs the same default view.'],
  },
  onboarding: {
    steps: ['Complete company identity and brand.', 'Add staff/roles and core customer/catalog data.', 'Review seeded statuses, templates, and triggers.', 'Configure communication, maps, payments, and inventory rules used by the tenant.', 'Run end-to-end test customer, estimate, job, field, invoice, and payment workflows.', 'Finish only after defaults match tenant operations.'],
    effects: ['Onboarding seeds starting configuration that remains tenant-editable.', 'Completing stages can enable normal operation and reduce setup prompts.'],
    watchFor: ['Seeded defaults are a starting point, not proof they fit every trade.', 'Do not go live without testing notifications.'],
  },
  'billing-plan': {
    steps: ['Review the displayed availability and plan information.', 'Document required modules, users, storage, and limits.', 'Contact the approved billing channel when plan management becomes available.'],
    effects: ['This entry is marked coming soon; it should not imply a live self-service change.'],
    watchFor: ['Do not rely on unavailable controls for an urgent account change.'],
  },
  'usage-limits': {
    steps: ['Review each usage category and limit.', 'Identify unexpected growth by user, storage, communication, or other available dimensions.', 'Clean up only according to retention policy.', 'Plan upgrades or operational changes before reaching limits.', 'Recheck after imports or staff growth.'],
    effects: ['The page reports usage; changing source records or plan controls affects future totals.'],
    watchFor: ['Do not delete required records merely to reduce usage.', 'Some counters may update asynchronously.'],
  },
  'audit-log': {
    steps: ['Filter by date, actor, action, record, or area.', 'Open the event and inspect before/after context where available.', 'Correlate with the affected record and user role.', 'Export or preserve evidence according to policy.', 'Correct the underlying configuration through normal workflow.'],
    effects: ['Audit history supports investigation but does not automatically reverse changes.'],
    watchFor: ['Time zone and acting-as context matter.', 'Absence of a UI event does not prove no external/provider action occurred.'],
  },
  'franchise-access': {
    steps: ['Review the support request and required scope.', 'Enable only the minimum franchise support access.', 'Record purpose and expected duration.', 'Monitor supported actions/audit history.', 'Revoke immediately when support ends.'],
    effects: ['Authorized franchisor support may access supported franchise-tenant context.'],
    watchFor: ['Support access is not permanent ownership.', 'Confirm customer/tenant contractual boundaries.'],
  },
}
