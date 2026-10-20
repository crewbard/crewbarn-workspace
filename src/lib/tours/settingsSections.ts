import type { GuidedTour, GuidedTourStep } from '@/lib/guidedTours'

/**
 * One tour per settings section, so a link straight to a section
 * (/tool-shed/preferences#gps, /tool-shed/inventory-settings) walks every
 * setting in it rather than the whole page. Each step targets a
 * data-tour id on the setting's own row.
 */

const SHOP_RULES = /^\/tool-shed\/preferences\/?$/

const rule = (key: string) => `[data-tour="shop-rule-${key}"]`

// ─────────────────────────────────────────────────────────── Shop Rules sections

const senderTour: GuidedTour = {
  id: 'shop-rules-sender',
  title: 'Outbound sender',
  description: 'The name, email address and text number your customers see when your shop writes to them.',
  route: SHOP_RULES,
  hash: 'sender',
  roadmap: [
    { title: 'Check what customers see', detail: 'The name, email and text number on everything you send.', step: 0 },
    { title: 'Change it on Phone, SMS & email', detail: 'That page is where these are set.', step: 4 },
  ],
  use: { say: 'These are set on Phone, SMS & email: the email side under Customer email, the text number under Phone setup. Whatever you set there is what customers see on every email and text your shop sends.', go: [{ label: 'Open Customer email', to: '/tool-shed/communication#email' }, { label: 'Open Phone setup', to: '/tool-shed/communication#phone' }] },
  steps: [
    { selector: '[data-tour="prefs-sender"]', title: 'Who your messages come from', say: 'This shows who your emails and texts appear to come from. It’s here so you can check it at a glance.' },
    { selector: rule('from_email_name'), title: 'From email name', say: 'The name customers see next to your emails, like your company name. Keep it something they’ll recognize so they open it.' },
    { selector: rule('from_email_address'), title: 'From email address', say: 'The address your emails are sent from. If a customer hits reply, this is usually where it goes.' },
    { selector: rule('from_sms_number'), title: 'From SMS number', say: 'The number your texts come from. Customers who text back reach your shop on this number.' },
    { selector: rule('sender-link'), title: 'Change it here', say: 'To change any of these, open Phone, SMS & email. What you set there shows up here.' },
  ],
}

const numberingTour: GuidedTour = {
  id: 'shop-rules-numbering',
  title: 'Auto-numbering',
  description: 'The next number handed out to each customer account, work order, estimate, invoice and purchase order.',
  route: SHOP_RULES,
  hash: 'numbering',
  roadmap: [
    { title: 'Check each next number', detail: 'Five record types, each counting up on its own.', step: 1 },
    { title: 'Change a starting point', detail: 'Handy when you move over from another system.', step: 1 },
    { title: 'Save changes', detail: 'This is the one tab that waits for Save.', step: 7 },
  ],
  use: { say: 'These numbers are handed out as work comes in: a new job on Jobs, a quote on Estimates, an invoice on Invoices, an order on Purchase orders. Moving over from another system? Bring your records in with Import data, then set these to carry on where you left off.', go: [{ label: 'Go to Jobs', to: '/jobs' }, { label: 'Go to Invoices', to: '/invoices' }, { label: 'Open Import data', to: '/tool-shed/import' }] },
  steps: [
    { selector: '[data-tour="prefs-numbering"]', title: 'Your next numbers', say: 'Every record that gets a number takes the next one from here, then the count goes up by one. Set these to carry on from where your old system left off.' },
    { selector: rule('next_customer_account_number'), title: 'Customer account number', say: 'The account number the next new customer gets. Your existing customers keep theirs.' },
    { selector: rule('next_work_order_number'), title: 'Work order number', say: 'The number the next job gets when it’s created. Your crew and customers use it to talk about the job.' },
    { selector: rule('next_estimate_number'), title: 'Estimate number', say: 'The number on the next estimate you send a customer.' },
    { selector: rule('next_invoice_number'), title: 'Invoice number', say: 'The number on the next invoice. Many shops start this where their old invoices ended so the books run on without a gap.' },
    { selector: rule('next_po_number'), title: 'Purchase order number', say: 'The number on the next purchase order you send a vendor.' },
    { selector: rule('numbering-warning'), title: 'Going backwards', say: 'If you set a number lower than it is now, this warning appears. Lowering it can hand out a number you’ve already used, so only do it when you’re sure.', optional: 'Shows when you lower a number' },
    { selector: '[data-tour="prefs-save"]', title: 'Save changes', say: 'Numbers don’t change until you press Save changes. Discard puts them back the way they were.' },
  ],
}

const payStep = (title: string): GuidedTourStep[] => [
  { selector: rule('pay'), title, say: 'A job reaches nobody’s pay until it’s invoiced. These two choices decide whether you then wait for the customer’s money before it counts.' },
  { selector: rule('commission_trigger'), title: 'Commission on a tech’s own jobs', say: 'Choose “when the job is finished and invoiced” to pay commission right away, or “when the customer has paid” to wait for the money. Paying on completion means the shop carries the risk if a customer pays short.' },
  { selector: rule('supervisor_bonus_trigger'), title: 'Supervision bonus', say: 'The same choice for the bonus a supervisor earns on their territory. It can differ from commission, so you could pay techs on completion and hold the bonus until the money lands.' },
  { selector: rule('tip_card_fee_borne_by'), title: 'The card fee on a tip', say: 'When a tip goes on a card, the processor takes a cut of it. Pick whether the shop pays that so the tip is passed on in full, or the tip pays its own share. Choose the tip and a note reminds you to check the rules where you work.' },
]

const fieldRulesTour: GuidedTour = {
  id: 'shop-rules-field-rules',
  title: 'Field rules',
  description: 'Rules for jobs in the field: dormant jobs, video length, payment collection, closing jobs, pay timing, vacation and GPS clock-in.',
  route: SHOP_RULES,
  hash: 'field-rules',
  roadmap: [
    { title: 'Dormant jobs', detail: 'When a quiet job counts as stuck, and what happens then.', step: 1 },
    { title: 'In the field', detail: 'Video length, collecting payment and closing a job properly.', step: 2 },
    { title: 'Pay and time off', detail: 'When pay is earned, the card fee on tips and vacation.', step: 8 },
    { title: 'Clocking in', detail: 'Let phones clock techs in and out at the jobsite.', step: 14 },
  ],
  use: { say: 'Stuck jobs show on Jobs under the Dormant filter. In Staff & Crews each person has their own switches for notes, nudges, cash collection and auto-clock, so you can ease someone in while they train. Commission, bonuses, tips and banked vacation all add up on Payroll.', go: [{ label: 'See dormant jobs', to: '/jobs?stale=dormant' }, { label: 'Open Staff & Crews', to: '/tool-shed/staff' }, { label: 'Go to Payroll', to: '/accounting/payroll' }] },
  steps: [
    { selector: '[data-tour="prefs-field"]', title: 'Rules for the field', say: 'These rules shape how jobs run once your crew is out working. Every change here saves the moment you make it. The switches all start off.' },
    { selector: rule('dormant_days'), title: 'Dormant after', say: 'An open job with no update for this many days is marked dormant, so it stops slipping through the cracks. Pick anywhere from 1 to 365 days.' },
    { selector: rule('max_video_clip_seconds'), title: 'Max video clip length', say: 'The longest video your crew can record in the field app, from 5 to 300 seconds. Shorter clips upload faster and take less space.' },
    { selector: rule('dormant_tech_nudge_enabled'), title: 'Auto-text the assigned tech', say: 'Turn this on and the lead tech gets a text asking what’s holding things up when their job goes dormant.' },
    { selector: rule('dormant_max_nudges_per_job'), title: 'Max nudges per job', say: 'How many reminders one job can send, from 1 to 20. After that it stops, so nobody gets pestered forever.', optional: 'Shows when Auto-text the assigned tech is on' },
    { selector: rule('dormant_require_notes_enabled'), title: 'Require a note on dormant jobs', say: 'Turn this on and a dormant job is locked in the tech app until they log an update. You always know why a job stalled.' },
    { selector: rule('cod_force_collection_enabled'), title: 'Force COD collection', say: 'For customers who pay on the spot. Turn this on and the tech has to collect payment before moving to their next job.' },
    { selector: rule('job_close_blocking_enabled'), title: 'Finish jobs properly', say: 'On, every job needs its parts and labour before Complete. A customer account or job type can set its own rule. Payment comes after completion.' },
    { selector: rule('invoice_requires_complete'), title: 'Invoice needs Complete', say: 'On, a job is invoiced only once it is Complete, and money taken before then is a down payment. Turn it off if you bill progress or deposits.' },
    ...payStep('When pay is earned'),
    { selector: rule('vacation'), title: 'Vacation earned', say: 'For hourly and salaried staff. They bank time off for every hour they work.' },
    { selector: rule('vacation_accrual_days_per_year'), title: 'Days per year', say: 'Set the days a full-time person earns in a year. It starts at 10, and the line below shows how much they bank for each hour worked.' },
    { selector: rule('geofence_auto_clock_enabled'), title: 'Auto clock-in and out by GPS', say: 'Turn this on and a tech is clocked in when their phone arrives at a scheduled jobsite, and out when they leave. It turns on for the whole crew. You can switch individuals off in Staff & Crews.' },
  ],
}

const payTour: GuidedTour = {
  id: 'shop-rules-pay',
  title: 'When pay is earned',
  description: 'Whether commission and supervision bonuses count when a job is invoiced or when the customer pays, and who carries the card fee on a tip.',
  route: SHOP_RULES,
  hash: 'pay',
  roadmap: [
    { title: 'Commission', detail: 'Count it at invoice or when the money arrives.', step: 1 },
    { title: 'Supervision bonus', detail: 'The same choice, set on its own.', step: 2 },
    { title: 'Card fee on tips', detail: 'Shop pays it, or the tip does.', step: 3 },
  ],
  use: { say: 'These choices decide what lands on Payroll for each period: commission, supervision bonus, and tips with any card fee shown under them. Each person’s pay type and rates are set in Payroll profiles.', go: [{ label: 'Go to Payroll', to: '/accounting/payroll' }, { label: 'Open Payroll profiles', to: '/accounting/payroll/profiles' }] },
  steps: payStep('When pay is earned'),
}

const vacationTour: GuidedTour = {
  id: 'shop-rules-vacation',
  title: 'Vacation earned',
  description: 'How many vacation days hourly and salaried staff earn in a year of full-time work.',
  route: SHOP_RULES,
  hash: 'vacation',
  roadmap: [
    { title: 'Set days per year', detail: 'What a full-time person earns in a year.', step: 1 },
    { title: 'Check the hourly rate', detail: 'Time off builds up with every hour worked.', step: 1 },
  ],
  use: { say: 'What each person banks shows in the Vacation column on Payroll, and their hours on hand are kept in Payroll profiles. When someone wants to take it, they send a request and the office approves it on Time off.', go: [{ label: 'Go to Payroll', to: '/accounting/payroll' }, { label: 'Open Time off', to: '/tool-shed/time-off' }, { label: 'Open Payroll profiles', to: '/accounting/payroll/profiles' }] },
  steps: [
    { selector: rule('vacation'), title: 'Vacation earned', say: 'For hourly and salaried staff. They bank time off with every hour they work, so a half week earns half a week’s worth.' },
    { selector: rule('vacation_accrual_days_per_year'), title: 'Days per year', say: 'Type the days a full-time person earns in a year, in half days if you like. It starts at 10. It saves when you click away, and the line below shows how much is banked per hour.' },
  ],
}

const clockTour: GuidedTour = {
  id: 'shop-rules-clock',
  title: 'Clock in and out by GPS',
  description: 'Let your crew’s phones clock them in when they reach a jobsite and out when they leave.',
  route: SHOP_RULES,
  hash: 'clock',
  roadmap: [
    { title: 'Turn it on', detail: 'It applies to the whole crew.', step: 0 },
    { title: 'Fine-tune people', detail: 'Switch individuals off in Staff & Crews.', step: 0 },
  ],
  use: { say: 'Switch the auto-clock rule off for any one person in Staff & Crews, where their timesheet shows each automatic clock-in. The hours they clock feed the Hours column on Payroll.', go: [{ label: 'Open Staff & Crews', to: '/tool-shed/staff' }, { label: 'Go to Payroll', to: '/accounting/payroll' }] },
  steps: [
    { selector: rule('geofence_auto_clock_enabled'), title: 'Auto clock-in and out by GPS', say: 'Turn this on and a tech is clocked in when their phone arrives at a scheduled jobsite, and clocked out when they leave. It’s separate from checking in to the job. It starts off.' },
    { selector: '[data-tour="prefs-tabs-gps"]', title: 'Who it covers', say: 'Switching it on covers your whole crew. Switch anyone off in Staff & Crews. Check-in at the job itself is set up on GPS check-in.' },
  ],
}

const intakeTour: GuidedTour = {
  id: 'shop-rules-intake',
  title: 'Job intake',
  description: 'How new jobs and estimates are entered, and what has to be filled in before one can be saved.',
  route: SHOP_RULES,
  hash: 'intake',
  roadmap: [
    { title: 'Pick the entry style', detail: 'Step by step, or the full page.', step: 1 },
    { title: 'Choose what’s required', detail: 'Location, schedule, crew and description.', step: 2 },
  ],
  use: { say: 'These rules kick in whenever someone makes a new job or a new estimate. Try New job or New estimate to see what has to be filled in before it saves.', go: [{ label: 'New job', to: '/jobs/new' }, { label: 'New estimate', to: '/estimates/new' }] },
  steps: [
    { selector: '[data-tour="prefs-intake"]', title: 'Taking in new work', say: 'Decide how new jobs and estimates are entered and what must be filled in first. Customer, title, job type and status are always required. Everything here starts off and saves as you flip it.' },
    { selector: rule('intake-guided_default'), title: 'Step-by-step intake', say: 'Turn this on and new users enter jobs one section at a time, which is easier when someone’s learning. Each person can still switch to the full page.' },
    { selector: rule('intake-estimate_location'), title: 'Location on estimates', say: 'Estimates can normally be a quick phone quote with no address. Turn this on to require a service location on every estimate.' },
    { selector: rule('intake-schedule'), title: 'Require a schedule', say: 'Turn this on and every new job and estimate needs a date and time before it can be saved, so nothing sits unscheduled.' },
    { selector: rule('intake-lead_tech'), title: 'Require a crew or tech', say: 'Turn this on and a new job can’t be saved until someone is assigned to it.' },
    { selector: rule('intake-description'), title: 'Require a description', say: 'Turn this on and every new job and estimate needs a description of the work, so the crew knows what they’re walking into.' },
  ],
}

const remindersTour: GuidedTour = {
  id: 'shop-rules-reminders',
  title: 'Appointment reminders',
  description: 'Turn appointment reminders on, set quiet hours, and choose when “next business morning” is.',
  route: SHOP_RULES,
  hash: 'reminders',
  roadmap: [
    { title: 'Switch reminders on', detail: 'Nothing is sent while it’s off.', step: 1 },
    { title: 'Set quiet hours', detail: 'When customers shouldn’t hear from you.', step: 2 },
    { title: 'Business mornings', detail: 'The time and days a morning message goes out.', step: 5 },
    { title: 'Add your reminders', detail: 'On the reminder timeline.', step: 8 },
  ],
  use: { say: 'Add and adjust the reminders themselves on the reminder timeline. Status messages on Job statuses use these quiet hours and business mornings too. To stop everything automatic for one job, switch Automations off at the top of that job.', go: [{ label: 'Open the reminder timeline', to: '/tool-shed/automations/reminders' }, { label: 'Open Job statuses', to: '/tool-shed/job-statuses' }] },
  steps: [
    { selector: '[data-tour="prefs-reminders"]', title: 'Reminders around a job', say: 'Remind techs and customers before a job starts, if it’s running late, and when the tech is on the way. Every change here saves straight away.' },
    { selector: rule('job_reminders_enabled'), title: 'Enable appointment reminders', say: 'The main switch. While it’s off, no reminder is sent, whatever rules you’ve set up.' },
    { selector: rule('quiet-hours'), title: 'Quiet hours', say: 'Customer reminders wait until this window is over, so nobody gets a text in the middle of the night. Overnight windows work fine. All times are your company’s time zone.' },
    { selector: rule('reminder_quiet_start'), title: 'Quiet hours start', say: 'When the quiet window begins. Leave it blank for no quiet hours on customer reminders.' },
    { selector: rule('reminder_quiet_end'), title: 'Quiet hours end', say: 'When messages can go out again. Status texts that use quiet hours fall back to 8 PM to 8 AM if either time is blank.' },
    { selector: rule('business-morning'), title: 'Business-morning messages', say: 'Some status messages can be held for the next business morning. This sets when that is. It doesn’t turn any message on by itself.' },
    { selector: rule('status_business_start'), title: 'Start time', say: 'The time a business-morning message goes out. It starts at 8:00 AM. Changes apply to messages scheduled from now on.' },
    { selector: rule('status_business_days'), title: 'Business days', say: 'Tick the days you’re open. It starts Monday to Friday, and at least one day has to stay ticked.' },
    { selector: rule('reminder-timeline'), title: 'Your reminders, on a job day', say: 'Open the timeline to add and adjust the reminders themselves, from a day before a job to half an hour after it starts.' },
  ],
}

const gpsTour: GuidedTour = {
  id: 'shop-rules-gps',
  title: 'GPS check-in',
  description: 'When your crew’s location is kept, how GPS check-in works, the timing for alerts, and when work shows up for office review.',
  route: SHOP_RULES,
  hash: 'gps',
  roadmap: [
    { title: 'Tracking hours', detail: 'Keep location only during work hours.', step: 1 },
    { title: 'Check-in rules', detail: 'Auto check-in and strict mode.', step: 5 },
    { title: 'Timing', detail: 'Dwell, reminders, alerts and late arrivals.', step: 7 },
    { title: 'Office review', detail: 'When jobs show up for review.', step: 15 },
  ],
  use: { say: 'Visits left open too long and missed check-ins land in Field review, where you open the job to sort it out. Overdue jobs carried over from earlier days show up on Dispatch.', go: [{ label: 'Open Field review', to: '/dispatch/field-review' }, { label: 'Go to Dispatch', to: '/dispatch' }] },
  steps: [
    { selector: '[data-tour="prefs-gps"]', title: 'Check-in by location', say: 'Your techs’ phone locations make checking in easier and flag jobs that need a look. Leaving a site never closes a job. It just flags that a checkout is needed. Every change saves as you make it.' },
    { selector: rule('gps_tracking_window_enabled'), title: 'Only keep location during working hours', say: 'Off, a phone shares its location from when the tech starts until they sign out, evenings included. On, anything outside the hours you set is thrown away, and the tech’s phone tells them tracking is paused.' },
    { selector: rule('gps_tracking_start'), title: 'Tracking starts', say: 'The time each working day that location starts being kept, in your company’s time zone.', optional: 'Shows when working-hours tracking is on' },
    { selector: rule('gps_tracking_end'), title: 'Tracking stops', say: 'The time location stops being kept. If it’s earlier than the start, the hours run overnight into the next morning.', optional: 'Shows when working-hours tracking is on' },
    { selector: rule('gps_tracking_days'), title: 'Tracking days', say: 'Tap the days your crew works. With no days picked, no location is kept at all. For an overnight shift, tick the day it starts.', optional: 'Shows when working-hours tracking is on' },
    { selector: rule('geofence_auto_checkin_enabled'), title: 'Auto check-in', say: 'Turn this on and a tech who stays inside the jobsite area long enough, close to the start time, is checked in for them. They can undo it.' },
    { selector: rule('geofence_strict_mode'), title: 'Strict mode', say: 'Off, which we recommend, a tech can check in from outside the jobsite area but must add a note. On, that check-in is blocked unless a dispatcher overrides it.' },
    { selector: rule('geofence-timing'), title: 'Timing', say: 'These numbers fine-tune the check-in rules. Each saves when you click away.' },
    { selector: rule('geofence_dwell_minutes'), title: 'Dwell', say: 'How many minutes a tech has to stay inside the jobsite area before auto check-in happens. A longer dwell avoids checking in someone just driving past.' },
    { selector: rule('geofence_early_checkin_minutes'), title: 'Early window', say: 'How many minutes before the start time auto check-in is allowed. Arrive earlier than that and they check in by hand.' },
    { selector: rule('geofence_left_site_reminder_minutes'), title: 'Left-site reminder', say: 'If a tech leaves with the visit still open, they get a reminder after this many minutes to check out.' },
    { selector: rule('geofence_dispatcher_alert_minutes'), title: 'Dispatcher alert', say: 'If the visit is still open after the reminder, dispatch is alerted after this many more minutes.' },
    { selector: rule('geofence_require_note_outside_m'), title: 'Note beyond', say: 'A tech checking in farther than this many meters from the site has to add a note saying why.' },
    { selector: rule('geofence_late_arrival_lead_minutes'), title: 'Late watch', say: 'How many minutes before the start time CrewBarn begins watching whether the tech will make it on time.' },
    { selector: rule('geofence_late_arrival_threshold_minutes'), title: 'Late grace', say: 'Dispatch gets an alert when the tech’s arrival looks this many minutes past the start time, so you can let the customer know.' },
    { selector: '[data-tour="prefs-late-techs"]', title: 'Late techs', say: 'When a tech may be late, using the Late grace above, the tech hears first: a red pop-up in the phone app with a button to call the customer. Then the Schedule button flashes for the office until somebody presses Got it. The customer only gets a call if you choose that below.' },
    { selector: rule('late_tech_heads_up_minutes'), title: 'Tech’s head start', say: 'How many minutes the tech gets to call the customer before dispatch is told. If they call in that time, dispatch isn’t flashed. Zero tells everyone at once.' },
    { selector: rule('late_customer_calls'), title: 'CBI calling the customer', say: 'Never, only when the office presses CBI: call customer on the Schedule page, or automatically if the tech hasn’t called by the time dispatch is told. A customer or job set to never, or tagged do-not-call, is never called.' },
    { selector: rule('cbi_calls_daily_cap'), title: 'Most CBI calls in a day', say: 'At this many calls, CBI stops calling techs and customers until midnight and tells the office, so a fault can’t run up your phone bill.' },
    { selector: rule('late_tech_voice_call_enabled'), title: 'CBI calls the tech', say: 'CBI also phones the tech: you’re running late, press 1 to call the customer. One call per late job. The words and voice are under CBI AI, CBI calls.' },
    { selector: rule('schedule_late_flash_enabled'), title: 'Flash Schedule', say: 'Turn the flashing on or off. It stops by itself when the tech checks in, the job moves, or they’re back on time.' },
    { selector: rule('schedule_late_toast_after_minutes'), title: 'Toast if nobody answers', say: 'If nobody presses Got it within this many minutes, a toast pops up on every office screen, and keeps coming back until somebody does. It starts at 5.' },
    { selector: '[data-tour="prefs-field-review"]', title: 'Field review timing', say: 'These decide when work shows up in the office review queue. They don’t send alerts or change check-in.' },
    { selector: rule('overdue_job_lookback_days'), title: 'Carry overdue jobs onto Today', say: 'Unfinished jobs from up to this many days back stay on Dispatch and Jobs Today. It starts at 14. Zero shows only today’s jobs, and older ones stay in the full Jobs list.' },
    { selector: rule('field_review_stale_minutes'), title: 'Open visit too long', say: 'A visit left open longer than this goes to the review queue. It starts at 480 minutes, which is eight hours.' },
    { selector: rule('field_review_missed_grace_minutes'), title: 'Missed check-in grace', say: 'How long after the start time a job can go without a check-in before it shows up for review. It starts at 30 minutes.' },
  ],
}

const teamSecurityTour: GuidedTour = {
  id: 'shop-rules-team-security',
  title: 'Team security',
  description: 'Choose which backup sign-in methods your team may set up for two-factor sign-in.',
  route: SHOP_RULES,
  hash: 'team-security',
  roadmap: [
    { title: 'Two-factor is always on', detail: 'For everyone signing in on the web or desktop.', step: 0 },
    { title: 'Pick backup methods', detail: 'Keep at least one switched on.', step: 1 },
  ],
  use: { say: 'Each person sets up their own backup method on My Security, choosing from the ones you leave switched on here.', go: [{ label: 'Open My Security', to: '/me/security' }] },
  steps: [
    { selector: '[data-tour="prefs-2fa"]', title: 'Team two-factor', say: 'Everyone who signs in on the web or desktop confirms it’s really them, and that can’t be turned off. Approving on your phone always works. Here you choose which backup methods your team may use.' },
    { selector: rule('two-factor-totp'), title: 'Authenticator app', say: 'A code from an app on the person’s phone. It’s the most secure choice and works with no signal.' },
    { selector: rule('two-factor-email'), title: 'Email codes', say: 'A code emailed at each sign-in. Easy, since everyone has an email address.' },
    { selector: rule('two-factor-sms'), title: 'Text codes', say: 'A code texted at each sign-in. The person needs a mobile number on file.' },
    { selector: '[data-tour="prefs-2fa"]', title: 'What changes when you switch one off', say: 'At least one method must stay on. Someone already using a method you turn off keeps using it until they switch. People who haven’t set up yet just won’t see it. Each person picks theirs under My Security.' },
  ],
}

const deletePermissionsTour: GuidedTour = {
  id: 'shop-rules-delete-permissions',
  title: 'Delete permissions',
  description: 'Who can delete records, and what they must do to confirm it.',
  route: SHOP_RULES,
  hash: 'delete-permissions',
  roadmap: [
    { title: 'Who can delete', detail: 'Owners and admins, until you name people.', step: 1 },
    { title: 'Confirmation steps', detail: 'A password, a reason, or both.', step: 2 },
    { title: 'Always blocked', detail: 'Records tied to money stay put.', step: 5 },
  ],
  use: { say: 'Every delete is recorded in the Audit Log under Deletions, with who did it, when, and the reason they gave.', go: [{ label: 'Open the Audit Log', to: '/tool-shed/audit-log' }] },
  steps: [
    { selector: '[data-tour="prefs-delete"]', title: 'Deleting records safely', say: 'Decide who can delete records and how they confirm it. Only the company owner can change these, and changes save as you tick.' },
    { selector: '[data-tour="delete-perms-who"]', title: 'Who can delete', say: 'Until you tick anyone, owners and admins can delete. Tick people and only they can. Everyone else gets a message saying they’re not allowed.' },
    { selector: '[data-tour="delete-perms-confirm"]', title: 'Require a password', say: 'Turn this on and people retype their password before anything is deleted. It’s a moment to stop and be sure.' },
    { selector: '[data-tour="delete-perms-confirm"]', title: 'Skip the password for…', say: 'With the password on, a list appears. Tick anyone who may delete without retyping it. Everyone else still has to.' },
    { selector: '[data-tour="delete-perms-confirm"]', title: 'Require a reason', say: 'Turn this on and people type a short reason when they delete. It’s kept in the audit log so you can see why later. Quick things like sticky notes are never held up.' },
    { selector: '[data-tour="delete-perms-blocked"]', title: 'Always blocked', say: 'Records tied to money can’t be deleted by anyone, you included. That keeps payments pointing at real records. Each line says what to do instead.' },
  ],
}

// ─────────────────────────────────────────────────────────── Inventory settings

const inventoryRuleSteps: GuidedTourStep[] = [
  { selector: '[data-tour="inv-rules"]', title: 'Stock rules', say: 'These rules set how strict CrewBarn is about where stock lives and how it’s counted. Changes wait for Save changes at the bottom, and you need Edit inventory to make them.' },
  { selector: '[data-tour="inv-rule-require-bin"]', title: 'Require a bin for all stock', say: 'On, every bit of stock must say which shelf, rack or bin it sits in. Off, stock can just belong to a location. Great if your shelves are labeled; leave it off to keep things simple.' },
  { selector: '[data-tour="inv-rule-unrecorded-stock"]', title: 'Use stock that isn’t recorded yet', say: 'On, a tech can use a part even when the count says zero, and the shortfall goes to Reconciliation for a manager to sort out. Off, that’s refused until the stock is recorded.' },
  { selector: '[data-tour="inv-rule-serial-freetext"]', title: 'Type in serial numbers', say: 'On, techs installing a component can type its serial number by hand. Off, they pick it from your tracked stock, which stops typos.' },
  { selector: '[data-tour="inv-rule-unit-tracking"]', title: 'QR tracking for every item', say: 'The main switch for giving each physical item its own QR code. On, stocked items must be scanned onto jobs and you can prove exactly which one moved. Off, counts still work without the scans. Turning it off also turns off Watch van stock.' },
  { selector: '[data-tour="inv-rule-require-po"]', title: 'Require purchase orders', say: 'On, stock can only be added by receiving a purchase order, and the manual add-stock buttons are greyed out. It keeps a paper trail for everything that comes in. Off by default.' },
  { selector: '[data-tour="inv-rule-write-in"]', title: 'Write-in items on jobs', say: 'On, a tech can add a part they bought out on a job. It still gets tracked and lands in Reconciliation, where a manager can turn it into real stock. Turning it on adds a Write In item to your catalog. Off by default.' },
  { selector: '[data-tour="inv-rule-lock-store"]', title: 'Lock the store', say: 'Off, any tech can scan a part onto their van themselves. On, only people with Edit inventory move stock to a van, and the tech scans each item to confirm they got it. Needs QR tracking switched on.' },
  { selector: '[data-tour="inv-rule-watch-van"]', title: 'Watch van stock', say: 'Nothing is ever blocked. On, when a tech uses a part from someone else’s van, CrewBarn asks for one to be sent back from the shop, and flags it if their own van should have had it. Needs QR tracking switched on.' },
  { selector: '[data-tour="inv-rule-show-sn"]', title: 'Show serial-number tracking', say: 'Off by default, which keeps forms simple. Turn it on if you deal in serialized goods, and the serial-tracking options appear across the catalog and inventory. Items already tracked keep working either way.' },
  { selector: '[data-tour="inv-rules-save"]', title: 'Save changes', say: 'Press Save changes to put your new rules in place for the whole shop. Discard puts everything back.' },
]

const inventoryRoadmap = [
  { title: 'Where stock lives', detail: 'Bins, and using stock before it’s recorded.', step: 1 },
  { title: 'Tracking each item', detail: 'Serial numbers and QR codes.', step: 3 },
  { title: 'Bringing stock in', detail: 'Purchase orders and write-ins.', step: 5 },
  { title: 'Vans', detail: 'Who moves stock, and watching what’s used.', step: 7 },
  { title: 'Save', detail: 'Rules take effect when you save.', step: 10 },
]

const inventoryUse: GuidedTour['use'] = { say: 'These rules play out across your stock work. Parts used at zero and write-ins wait in Reconciliation, stock comes in through Purchase orders when you require them, and each QR-tracked item shows on Units.', go: [{ label: 'Open Reconciliation', to: '/inventory/reconciliations' }, { label: 'Go to Purchase orders', to: '/purchase-orders' }, { label: 'Open Units', to: '/inventory/units' }] }

export const SETTINGS_SECTION_TOURS: GuidedTour[] = [
  senderTour,
  numberingTour,
  fieldRulesTour,
  payTour,
  vacationTour,
  clockTour,
  intakeTour,
  remindersTour,
  gpsTour,
  teamSecurityTour,
  deletePermissionsTour,
  {
    id: 'inventory-settings',
    title: 'Inventory settings',
    description: 'The shop-wide stock rules: bins, counts, QR tracking, purchase orders, write-ins and vans.',
    route: /^\/tool-shed\/inventory-settings\/?$/,
    roadmap: inventoryRoadmap,
    use: inventoryUse,
    steps: inventoryRuleSteps,
  },
  {
    id: 'inventory-settings-tab',
    title: 'Inventory settings',
    description: 'The shop-wide stock rules: bins, counts, QR tracking, purchase orders, write-ins and vans.',
    route: /^\/inventory\/?$/,
    search: 'tab=settings',
    roadmap: inventoryRoadmap,
    use: inventoryUse,
    steps: inventoryRuleSteps,
  },
]
