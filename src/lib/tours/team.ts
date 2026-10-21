import type { GuidedTour } from '@/lib/guidedTours'

/**
 * Team area tours (owner 09): Staff & crews, Roles & permissions, Hiring,
 * Companies I work for, Delete permissions, Subcontractors, Sub reviews,
 * Sub payouts, Inbound sub jobs, Your documents, Sub onboarding, Accept
 * invite, My account, My Security, Security & 2FA.
 *
 * Steps target data-tour attributes in the page components. The engine skips
 * any step whose target isn't on screen (a closed modal, an edit-only button,
 * an empty section), so those steps are marked optional.
 */
export const TEAM_TOURS: GuidedTour[] = [
  {
    id: 'team-staff',
    title: 'Staff & crews',
    description: 'Add people, decide who can sign in and what they can do, and set their pay.',
    route: /^\/tool-shed\/staff\/?$/,
    roadmap: [
      { title: 'Set up roles', detail: 'Decide what each role can do on Roles & permissions.' },
      { title: 'Add someone', detail: 'An employee (with or without a login), or a sub company if the sub network is on.' },
      { title: 'They accept the invite', detail: 'They open their private link from email or text and finish Quick setup or Full onboarding.' },
      { title: 'Fine-tune each person', detail: 'Access, role, personal permissions, pay and dashboard widgets.' },
      { title: 'Watch how it goes', detail: 'Scorecard and Timesheet show results and clocked hours. Pay flows on to Payroll.' },
    ],
    use: {
      say: 'Pay and clocked hours from here feed Payroll & Tech Profit, and the pay rules have their own page under Payroll profiles. Anyone marked Works as a technician, with app access, can be picked as Lead tech when you create a job. What each person can open comes from their role on Roles & permissions.',
      go: [{ label: 'Open Payroll', to: '/accounting/payroll' }, { label: 'Open Roles & permissions', to: '/tool-shed/roles' }, { label: 'Create a job', to: '/jobs/new' }],
    },
    steps: [
      {
        selector: '[data-tour="staff-header"]',
        title: 'Your team list',
        say: "This is your team list. Everyone who works for you lives here, whether they sign in or not. A crew member is simply someone with no app login.",
        links: [{ label: 'Roles & permissions', url: '/tool-shed/roles' }],
      },
      {
        selector: '[data-tour="staff-three-choices"]',
        title: 'Three separate choices',
        say: "Keep these three apart in your head. App access decides whether they use the full app; employee portal access is chosen separately, the role decides what they can do, and 'works as a technician' decides if they show up for field jobs.",
      },
      {
        selector: '[data-tour="staff-tabs"]',
        title: 'Staff, Scorecard, Timesheet',
        say: 'Staff is the list itself. Scorecard shows how people are doing, and Timesheet shows clocked hours. You can log time by hand there for anyone who did not clock in.',
      },
      {
        selector: '[data-tour="staff-search"]',
        title: 'Find someone',
        say: "Type a name or email to find someone. Tick Show disabled to see people who've left.",
      },
      {
        selector: '[data-tour="staff-add"]',
        title: 'Add someone',
        say: 'Use this to bring someone new on board. Choose app access and the employee portal separately. Quick setup asks for a password; Full onboarding also collects contact details and optional employee documents. The private setup link can go by email and text. App users receive the download link after finishing.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="staff-row"]',
        title: 'One row per person',
        say: 'Each row shows the person, their role and any flags, like Invite sent or No longer here. Click a row to open their settings.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="staff-rule-pills"]',
        title: 'Field rules',
        say: "These are the field rules this person has to follow: notes, nudges, collecting payment, and auto clock-in. Tap one to switch it off while someone's still in training, and tap again to turn it back on.",
        optional: 'Skip',
      },
      {
        selector: '[data-tour="staff-row-actions"]',
        title: 'Settings and portal',
        say: "Settings opens everything about this person. Portal shows you the employee portal the way they see it.",
        optional: 'Skip',
      },
      {
        selector: '[data-tour="staff-sub-companies"]',
        title: 'Sub companies',
        say: "These are companies you've invited to take your work. You can see who's connected, who still needs to enter their code, and whether their paperwork is in. Documents missing or Documents expire soon tells you when to follow up.",
        optional: 'Skip',
      },
      {
        selector: '[data-tour="staff-sub-documents"]',
        title: 'Their paperwork',
        say: "Open Documents to see each paper they uploaded and when it runs out. Red means something required is missing; amber means something expires within 30 days. The files are kept like Secure Files, so the first time you open one we email you a code.",
        optional: 'Skip',
      },
      {
        selector: '[data-tour="staff-edit-modal"]',
        title: 'Edit staff',
        say: 'Everything about this one person is here: how they reach you, what they can open, their role, their own permission tweaks, and their pay.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="staff-pay"]',
        title: 'Save pay separately',
        say: "Start with how they're paid, and the yellow box shows what a normal week would cost you. Pay has its own Save button. If you change pay and forget, we'll warn you before you close.",
        optional: 'Skip',
      },
    ],
  },
  {
    id: 'team-roles',
    title: 'Roles & permissions',
    description: 'Decide what each role can see and change.',
    route: /^\/tool-shed\/roles\/?$/,
    roadmap: [
      { title: 'Pick or create a role', detail: 'Choose a role on the left, or start a new one.' },
      { title: 'Set the access', detail: 'Pick a level for each area, plus job visibility and dashboard widgets.' },
      { title: 'Save', detail: 'Everyone on that role changes when their access refreshes, within about 5 minutes.' },
      { title: 'Check it', detail: 'Compare roles side by side, or undo a change from the Audit log.' },
      { title: 'One-off exceptions', detail: 'Give a single person their own permissions on Staff & crews.' },
    ],
    use: {
      say: 'You put people on a role in their settings on Staff & crews, and that’s also where you give one person their own permission tweaks or dashboard widgets. A role’s widget limits show up on each person’s Dashboard.',
      go: [{ label: 'Open Staff & crews', to: '/tool-shed/staff' }, { label: 'Go to Dashboard', to: '/' }],
    },
    steps: [
      {
        selector: '[data-tour="roles-header"]',
        title: 'Roles are bundles',
        say: 'Each role is a bundle of permissions. Change the role, and everyone on it changes with it. People, Compare roles and Audit log open extra views from up here.',
      },
      {
        selector: '[data-tour="roles-list"]',
        title: 'Your roles',
        say: 'Here are your roles. CrewBarn presets are marked, the ones you made say Yours, and the bar shows roughly how much each one can do.',
      },
      {
        selector: '[data-tour="roles-people"]',
        title: 'People on this role',
        say: 'These are the people on this role. You can move someone to another role right here, and we ask before changing it.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="roles-copy"]',
        title: 'Copy a role',
        say: "To start from a role that's close, copy it. The original stays as it is.",
        optional: 'Skip',
      },
      {
        selector: '[data-tour="roles-owner"]',
        title: 'Owner',
        say: "Owner always has everything, so nobody can lock the company out. Change who's an owner on Staff & crews.",
        optional: 'Skip',
      },
      {
        selector: '[data-tour="roles-widgets"]',
        title: 'Dashboard widgets',
        say: "You can limit which dashboard widgets this role gets. A person's own setting on Staff & crews wins over this.",
        optional: 'Skip',
      },
      {
        selector: '[data-tour="roles-plain-words"]',
        title: 'In plain words',
        say: 'This sums up the role in three columns: what they can change, what they can only look at, and what is off.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="roles-find"]',
        title: 'Find a permission',
        say: 'Looking for something specific, like refunds or gate codes? Search here and the cards below narrow down.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="roles-areas"]',
        title: 'Pick a level per area',
        say: 'Pick a level for each area. If you need something in between, open Fine-tune and tick single permissions.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="roles-save"]',
        title: 'Check, then save',
        say: "Before you save, check what's turning on and off. Sensitive access gets a warning, and deleting a custom role asks you first.",
        optional: 'Skip',
      },
    ],
  },
  {
    id: 'team-hiring',
    title: 'Hiring',
    description: 'Post openings, review applicants, and hire straight into your staff list.',
    route: /^\/tool-shed\/hiring\/?$/,
    roadmap: [
      { title: 'Switch hiring on', detail: 'Or just add a link to where you already take resumes.' },
      { title: 'Create a posting', detail: 'The job, your requirements and your questions. Save and open it.' },
      { title: 'People apply', detail: 'From the CrewBarn job board or your careers page.' },
      { title: 'Review and interview', detail: 'Move applicants through stages and set interviews.' },
      { title: 'Hire', detail: 'This creates their staff account and sends the set-up link.' },
    ],
    use: {
      say: 'Once you hire someone, they show up on Staff & crews with the role and pay you picked, and that’s where you fine-tune them. Your openings also show on the careers page of your website while hiring is on, which you manage in the Website builder.',
      go: [{ label: 'Open Staff & crews', to: '/tool-shed/staff' }, { label: 'Open Website builder', to: '/tool-shed/website' }],
    },
    steps: [
      {
        selector: '[data-tour="hiring-header"]',
        title: 'Find new people',
        say: 'This is where you find new people. Job seekers see your openings on the CrewBarn job board and on your website’s careers page.',
      },
      {
        selector: '[data-tour="hiring-switch"]',
        title: 'The hiring switch',
        say: "This one switch decides if anyone can see your openings. Turn it off once you've filled the job, and everything hides while staying saved.",
      },
      {
        selector: '[data-tour="hiring-outside-link"]',
        title: 'Outside resume link',
        say: 'Already taking resumes on another job site or a form? Paste the link, and job seekers see it under your name while hiring is on, even with no postings.',
      },
      {
        selector: '[data-tour="hiring-tabs"]',
        title: 'Postings and applicants',
        say: 'Postings are your openings. Applicants is everyone who applied, with a badge for new ones.',
      },
      {
        selector: '[data-tour="hiring-postings"]',
        title: 'Your postings',
        say: "Each posting shows its status, pay and how many people applied. A draft isn't public until you open it, and opening needs a description, city and state.",
        optional: 'Skip',
      },
      {
        selector: '[data-tour="hiring-applicants-tab"]',
        title: 'Review applicants',
        say: 'Open Applicants to see who applied. The stage chips at the top double as filters. Click a row to open their card.',
      },
      {
        selector: '[data-tour="hiring-applicant"]',
        title: 'The applicant card',
        say: "Here's everything they sent you. Move them along with Stage. To hire, use the Hire button: it creates their staff account and sends the set-up link.",
        optional: 'Skip',
      },
      {
        selector: '[data-tour="hiring-hire"]',
        title: 'Hire',
        say: 'Pick their role, app and portal access, and pay. Hire creates their staff account and sends the set-up link, and they show up on Staff & crews.',
        optional: 'Skip',
      },
    ],
  },
  {
    id: 'team-companies-i-work-for',
    title: 'Companies I work for',
    description: 'The companies that send your company work, and where you enter a new invite code.',
    route: /^\/companies-i-work-for\/?$/,
    roadmap: [
      { title: 'You get invited', detail: 'A company that wants to send you work emails you a code.' },
      { title: 'Enter the code', detail: 'Already on CrewBarn? Enter it here. New? Use the sub onboarding page.' },
      { title: 'Upload your documents', detail: 'The W-9, insurance and licenses they asked for.' },
      { title: 'Take their jobs', detail: 'Their jobs arrive in Inbound sub jobs.' },
    ],
    use: {
      say: 'Jobs from these companies land in Inbound sub jobs, where you accept or decline them. The papers they asked for go on Your documents.',
      go: [{ label: 'Open Inbound sub jobs', to: '/inbound-sub-jobs' }, { label: 'Open Your documents', to: '/sub-documents' }],
    },
    steps: [
      {
        selector: '[data-tour="work-for-header"]',
        title: 'Companies that send you work',
        say: 'These are the companies that send you work. Their jobs show up in Inbound sub jobs, and Your documents holds the papers they asked for.',
        links: [{ label: 'Inbound sub jobs', url: '/inbound-sub-jobs' }, { label: 'Your documents', url: '/sub-documents' }],
      },
      {
        selector: '[data-tour="work-for-code"]',
        title: 'Have an invite code?',
        say: 'Got a code from a company that wants to send you work? Type it here and press Accept invite to connect.',
      },
      {
        selector: '[data-tour="work-for-list"]',
        title: 'Who you are connected to',
        say: 'Every company you are connected to is listed here, with the date you connected.',
      },
      {
        selector: '[data-tour="work-for-docs"]',
        title: 'Your documents',
        say: 'The W-9, insurance and licenses these companies asked for live on Your documents. Keep them current so the work keeps coming.',
        links: [{ label: 'Your documents', url: '/sub-documents' }],
      },
    ],
  },
  {
    id: 'team-delete-permissions',
    title: 'Delete permissions',
    description: "Who's allowed to delete company records, and what they have to do to confirm it.",
    route: /^\/tool-shed\/delete-permissions\/?$/,
    roadmap: [
      { title: 'Decide who can delete', detail: 'By default, owners and admins.' },
      { title: 'Choose the confirmation steps', detail: 'A password, a reason, or both.' },
      { title: 'Exempt named people', detail: 'Let trusted people skip the password.' },
      { title: 'Deletes follow these rules', detail: 'Jobs, invoices, customers and more go through the delete prompt.' },
    ],
    use: {
      say: 'These rules kick in whenever someone presses Delete anywhere in CrewBarn, like on a job, invoice or customer: they get the password and reason prompt you set here. Every delete, who did it and the reason they gave, shows on the Deletions tab of the Audit Log.',
      go: [{ label: 'Open Audit Log', to: '/tool-shed/audit-log' }],
    },
    steps: [
      {
        selector: '[data-tour="delete-perms-summary"]',
        title: 'The rules at a glance',
        say: 'These rules decide who can delete records and what they have to give first. Changing a rule never deletes anything.',
      },
      {
        selector: '[data-tour="delete-perms-who"]',
        title: 'Who can delete',
        say: 'Tick the people allowed to delete. While nobody is ticked, owners and admins can. Each tick saves right away.',
      },
      {
        selector: '[data-tour="delete-perms-confirm"]',
        title: 'Confirmation steps',
        say: 'Add extra hurdles for people who are allowed to delete: retype their password, give a reason for the audit log, or both. With the password on, you can tick people who skip it.',
      },
      {
        selector: '[data-tour="delete-perms-blocked"]',
        title: 'Always blocked',
        say: 'Some records hold money together, so nobody can delete them, not even you.',
      },
    ],
  },
  {
    id: 'team-subcontractors',
    title: 'Subcontractors',
    description: 'Outside partners you send jobs to, with contact details, paperwork flags and payment terms.',
    route: /^\/tool-shed\/subcontractors\/?$/,
    roadmap: [
      { title: 'Add the subcontractor', detail: 'Name, contact, address, paperwork and terms.' },
      { title: 'Invite them to CrewBarn', detail: 'Each sub works your jobs in its own CrewBarn, so it accepts an invite first.' },
      { title: 'Send them a job', detail: 'Create a sub job from New Job.' },
      { title: 'Review what comes back', detail: 'Budget requests and invoices land on Sub reviews.' },
      { title: 'Track payouts', detail: 'See what you have paid on Sub payouts.' },
    ],
    use: {
      say: 'To send a sub some work, use New sub job from the Jobs page. When they ask for a higher limit or send an invoice, it lands on Sub reviews, and what you’ve paid them adds up on Sub payouts.',
      go: [{ label: 'New sub job', to: '/jobs/new?kind=sub' }, { label: 'Open Sub reviews', to: '/sub-reviews' }, { label: 'Open Sub payouts', to: '/sub-payouts' }],
    },
    steps: [
      {
        selector: '[data-tour="subs-header"]',
        title: 'Your outside partners',
        say: 'These are the outside partners you send work to. Each one works your jobs in its own CrewBarn once it accepts your invite.',
      },
      {
        selector: '[data-tour="subs-filter"]',
        title: 'Search and filter',
        say: 'Search by name, contact, email or partner number. Switch between active, inactive and all.',
      },
      {
        selector: '[data-tour="subs-add"]',
        title: 'Add a subcontractor',
        say: 'Add their business name, contact, address, the papers you have on file, and your payment terms. The partner number is assigned for you when you save.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="subs-table"]',
        title: 'One row per partner',
        say: 'Each row shows contact info, where the sub stands on CrewBarn (with Invite if it is not on CrewBarn yet), and which papers you have ticked as on file. Edit, Delete and Invite show only if you can edit jobs.',
        optional: 'Skip',
      },
    ],
  },
  {
    id: 'team-sub-reviews',
    title: 'Sub reviews',
    description: 'Requests for a higher not-to-exceed limit, and sub invoices waiting on you.',
    route: /^\/sub-reviews\/?$/,
    roadmap: [
      { title: 'You send a job with a cap', detail: 'The sub works under a not-to-exceed (NTE) amount.' },
      { title: 'The sub asks or invoices', detail: 'They request more headroom, or finish and submit an invoice.' },
      { title: 'You decide here', detail: 'Approve or deny, and mark invoices paid.' },
      { title: 'See the totals', detail: 'Paid amounts show up on Sub payouts.' },
    ],
    use: {
      say: 'Invoices you approve and mark paid add up on Sub payouts, by sub and by month. Each request links to its job, and all your sub jobs live on the Jobs page.',
      go: [{ label: 'Open Sub payouts', to: '/sub-payouts' }, { label: 'Go to Jobs', to: '/jobs' }],
    },
    steps: [
      {
        selector: '[data-tour="sub-reviews-header"]',
        title: 'Decisions waiting on you',
        say: 'Anything your subs need you to decide on lands here: requests for a higher limit, and invoices waiting on you. The list refreshes every minute.',
      },
      {
        selector: '[data-tour="sub-reviews-nte"]',
        title: 'Limit increase requests',
        say: 'Read why they want more, then approve or deny. If you deny, give them a reason.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="sub-reviews-invoices"]',
        title: 'Sub invoices',
        say: "Check the PDF, then approve it. Once you've paid the sub, use Mark paid to record how you paid.",
        optional: 'Skip',
      },
      {
        selector: '[data-tour="sub-reviews-invoice-actions"]',
        title: 'Approve, pay or decline',
        say: 'View PDF opens the invoice. Approve comes first, then Mark paid asks how you paid and an optional reference. Decline needs a reason, and the sub can fix it and send it again.',
        optional: 'Skip',
      },
    ],
  },
  {
    id: 'team-sub-payouts',
    title: 'Sub payouts',
    description: "What you've paid your subcontractors and what you still owe.",
    route: /^\/sub-payouts\/?$/,
    roadmap: [
      { title: 'Subs submit invoices', detail: 'From the portal, when the work is done.' },
      { title: 'Approve and pay', detail: 'On Sub reviews.' },
      { title: 'See the totals here', detail: 'Lifetime, this month, still owed, by sub and by month.' },
    ],
    use: {
      say: 'To approve a sub’s invoice or record a payment, go to Sub reviews. Your subs’ contact details and payment terms are on Subcontractors.',
      go: [{ label: 'Open Sub reviews', to: '/sub-reviews' }, { label: 'Open Subcontractors', to: '/tool-shed/subcontractors' }],
    },
    steps: [
      {
        selector: '[data-tour="sub-payouts-header"]',
        title: 'Your payout ledger',
        say: "This page shows what you've paid your subs and what's still owed. You approve and pay on Sub reviews.",
        links: [{ label: 'Sub reviews', url: '/sub-reviews' }],
      },
      {
        selector: '[data-tour="sub-payouts-tiles"]',
        title: 'The totals',
        say: 'Paid lifetime, paid this month, and approved invoices you still owe.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="sub-payouts-by-sub"]',
        title: 'By subcontractor',
        say: 'How much each sub has been paid, and what is still outstanding for them.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="sub-payouts-by-month"]',
        title: 'By month',
        say: "Each bar is a month's payouts. Hover a bar to see the exact amount.",
        optional: 'Skip',
      },
      {
        selector: '[data-tour="sub-payouts-invoices"]',
        title: 'All invoices',
        say: 'Every approved and paid invoice, with the job, how it was paid, and when.',
        optional: 'Skip',
      },
    ],
  },
  {
    id: 'team-inbound-sub-jobs',
    title: 'Inbound sub jobs',
    description: 'Jobs other CrewBarn companies sent you, waiting for you to accept or decline.',
    route: /^\/inbound-sub-jobs\/?$/,
    roadmap: [
      { title: 'A company sends you a job', detail: 'One of the companies you work for.' },
      { title: 'It lands here', detail: 'Waiting for your decision.' },
      { title: 'Accept or decline', detail: 'Accept puts it on your board; decline sends your reason back.' },
      { title: 'Decisions stay listed', detail: 'For 30 days, at the bottom of the page.' },
    ],
    use: {
      say: 'A job you accept becomes one of your own: it shows on Jobs and on Dispatch, where you schedule it and assign your techs. The companies you’re connected to are on Companies I work for.',
      go: [{ label: 'Go to Jobs', to: '/jobs' }, { label: 'Go to Dispatch', to: '/dispatch' }, { label: 'Open Companies I work for', to: '/companies-i-work-for' }],
    },
    steps: [
      {
        selector: '[data-tour="inbound-header"]',
        title: 'Jobs sent to you',
        say: 'Jobs other companies send you wait here. Accept to put them on your board, or decline and tell them why.',
      },
      {
        selector: '[data-tour="inbound-pending"]',
        title: 'Waiting for a decision',
        say: 'Each card shows who sent it, the address, any spending cap, and what the job is. View details opens the full job.',
      },
      {
        selector: '[data-tour="inbound-actions"]',
        title: 'Accept or decline',
        say: 'Accept puts the job on your own board. Decline asks you why, and that reason goes back to the company that sent it. You need permission to edit jobs to see these buttons.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="inbound-recent"]',
        title: 'Recent decisions',
        say: 'Jobs you accepted or declined in the last 30 days stay here, with your decline reason.',
        optional: 'Skip',
      },
    ],
  },
  {
    id: 'team-sub-documents',
    title: 'Your documents',
    description: 'Upload the papers the companies you work for asked for.',
    route: /^\/sub-documents\/?$/,
    roadmap: [
      { title: 'Your company is set up', detail: 'From the invite code on the sub onboarding page.' },
      { title: 'Sign in and land here', detail: 'You come back here until everything is in.' },
      { title: 'Upload each document', detail: 'Insurance needs its end date.' },
      { title: 'Save the recovery key', detail: 'Shown once, after your first upload.' },
      { title: 'Continue to CrewBarn', detail: 'Their jobs arrive in Inbound sub jobs.' },
    ],
    use: {
      say: 'Once your papers are in, the jobs these companies send you show up in Inbound sub jobs for you to accept. Companies I work for lists who you’re connected to, and takes new invite codes.',
      go: [{ label: 'Open Inbound sub jobs', to: '/inbound-sub-jobs' }, { label: 'Open Companies I work for', to: '/companies-i-work-for' }],
    },
    steps: [
      {
        selector: '[data-tour="sub-docs-header"]',
        title: 'What they asked for',
        say: 'The companies you work for asked for these. Only they can open them, and you can stop and finish later.',
      },
      {
        selector: '[data-tour="sub-docs-row"]',
        title: 'Upload each one',
        say: 'Upload each one as a PDF or a clear photo. Insurance needs its end date.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="sub-docs-recovery"]',
        title: 'Save your recovery key',
        say: "This key gets your files back if your company's key is ever lost. CrewBarn only shows it this once, so put it somewhere safe.",
        optional: 'Skip',
      },
      {
        selector: '[data-tour="sub-docs-continue"]',
        title: 'Finish up',
        say: 'Once every required document is in, Continue takes you into CrewBarn. If something is still missing, Finish later lets you go now. Jobs still come through, and the companies you work for see what is missing.',
        optional: 'Skip',
      },
    ],
  },
  {
    id: 'team-sub-onboarding',
    title: 'Set up your company',
    description: 'Create your free CrewBarn company from an invite code.',
    route: /^\/sub-onboarding\/?$/,
    roadmap: [
      { title: 'You get invited', detail: 'A company invites you from its Staff page.' },
      { title: 'Enter the code', detail: 'It works once, within 24 hours.' },
      { title: 'Create your company', detail: 'Or sign in if you already have CrewBarn.' },
      { title: 'Upload your documents', detail: 'Right after you sign in.' },
      { title: 'Take their jobs', detail: 'From Inbound sub jobs.' },
    ],
    use: {
      say: 'After you sign in, Your documents is where you upload the papers they asked for. If you already have CrewBarn, enter the code under Companies I work for instead.',
      go: [{ label: 'Open Your documents', to: '/sub-documents' }, { label: 'Open Companies I work for', to: '/companies-i-work-for' }],
    },
    steps: [
      {
        selector: '[data-tour="sub-onboard-code"]',
        title: 'Your invite code',
        say: 'Type the code from your invite email. It works once, within 24 hours.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="sub-onboard-existing"]',
        title: 'You already have CrewBarn',
        say: "You've already got CrewBarn. Sign in and enter this code under Companies I work for.",
        optional: 'Skip',
      },
      {
        selector: '[data-tour="sub-onboard-form"]',
        title: 'Set up your free company',
        say: "Set up your free company. You'll sign in with the email they invited. Your password needs at least 10 characters, with upper and lower case and a number.",
        optional: 'Skip',
      },
      {
        selector: '[data-tour="sub-onboard-done"]',
        title: 'You are set up',
        say: "You're set up. Sign in now, and we'll take you straight to the documents they asked for.",
        optional: 'Skip',
      },
    ],
  },
  {
    id: 'team-accept-invite',
    title: 'Accept your invite',
    description: 'Set your password and switch on your account.',
    route: /^\/accept-invite\/[^/]+\/?$/,
    roadmap: [
      { title: 'You were invited', detail: 'From Staff & crews, or hired from Hiring.' },
      { title: 'Open the link', detail: 'It is good for 14 days.' },
      { title: 'Set your password', detail: 'At least 8 characters.' },
      { title: 'Sign in', detail: 'Your role decides what you see.' },
    ],
    steps: [
      {
        selector: '[data-tour="accept-invite-welcome"]',
        title: 'Welcome aboard',
        say: 'Welcome aboard. Set a password to switch on your account.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="accept-invite-password"]',
        title: 'Pick a password',
        say: 'Use at least 8 characters, type it twice, and press Set password & activate. We send you to the sign-in page next.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="accept-invite-expired"]',
        title: 'Link no longer works',
        say: 'This link has expired or was already used. Ask the person who invited you to send a fresh one.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="accept-invite-expiry"]',
        title: 'When the link runs out',
        say: 'Your link works until this date. If it runs out first, ask for a fresh one.',
        optional: 'Skip',
      },
    ],
  },
  {
    id: 'team-my-account',
    title: 'My account',
    description: 'Your own sign-in details, photo, password and two-factor.',
    route: /^\/me\/account\/?$/,
    roadmap: [
      { title: 'Check your details', detail: 'Name, email and role.' },
      { title: 'Add a photo', detail: 'It shows on the dispatch map and in the app.' },
      { title: 'Change your password', detail: 'Whenever you need to.' },
      { title: 'Set up two-factor', detail: 'One link away.' },
    ],
    use: {
      say: 'Your photo is what your team sees on your marker on the Dispatch map. Two-factor for your own sign-in is set up on My Security.',
      go: [{ label: 'Open My Security', to: '/me/security' }, { label: 'Go to Dispatch', to: '/dispatch' }],
    },
    steps: [
      {
        selector: '[data-tour="my-account-details"]',
        title: 'Your sign-in details',
        say: "These are your own sign-in details. You can't change your email here; contact support if it needs to change.",
      },
      {
        selector: '[data-tour="my-account-photo"]',
        title: 'Profile photo',
        say: 'Add a photo so your team can spot you on the map and in the app. You crop it to a square before it is saved.',
      },
      {
        selector: '[data-tour="my-account-password"]',
        title: 'Change password',
        say: 'Type your current password, then the new one twice. It needs at least 8 characters.',
      },
      {
        selector: '[data-tour="my-account-2fa"]',
        title: 'Two-factor',
        say: 'Manage 2FA takes you to where you set up a one-time code for your sign-in.',
      },
    ],
  },
  {
    id: 'team-my-security',
    title: 'My Security',
    description: 'Turn on two-factor for your own login and pick how you get codes.',
    route: /^\/me\/security\/?$/,
    roadmap: [
      { title: 'Pick a method', detail: 'Authenticator app, email or text, as your company allows.' },
      { title: 'Confirm with a code', detail: 'Proves the method works.' },
      { title: 'Save recovery codes', detail: 'Shown once.' },
      { title: 'Change it any time', detail: 'Turning it off may be blocked if it is required for you.' },
    ],
    use: {
      say: 'You’ll use this every time you sign in, and you can tick a box there to skip the code on that device for 30 days. Which methods are allowed is set by an owner under Team security in Company Preferences. If you lose your phone and your recovery codes, an owner can use Reset 2FA in your settings on Staff & crews.',
      go: [{ label: 'Open My account', to: '/me/account' }, { label: 'Team security', to: '/tool-shed/preferences#team-security' }],
    },
    steps: [
      {
        selector: '[data-tour="my-security-header"]',
        title: 'Your own login',
        say: 'Two-factor adds a one-time code on top of your password. This covers your own login only.',
      },
      {
        selector: '[data-tour="my-security-methods"]',
        title: 'Pick how you get codes',
        say: "Pick how you'd like to get your codes. The authenticator app is the most secure and works without a signal.",
      },
      {
        selector: '[data-tour="my-security-recovery"]',
        title: 'Recovery codes',
        say: "Save these now. Each one works once if you can't get a code, and you won't see them again.",
        optional: 'Skip',
      },
      {
        selector: '[data-tour="my-security-totp"]',
        title: 'Authenticator setup',
        say: 'Scan the code with your authenticator app, then type the 6-digit code it shows.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="my-security-channel"]',
        title: 'Email or text setup',
        say: "We'll send the code to the email or number already on file, shown masked here. It comes from CrewBarn, not your company's number.",
        optional: 'Skip',
      },
      {
        selector: '[data-tour="my-security-enabled"]',
        title: 'Two-factor is on',
        say: "You'll be asked for a code when you sign in. You can switch methods here, or turn it off if it isn't required for you.",
        optional: 'Skip',
      },
    ],
  },
  {
    id: 'team-tenant-security',
    title: 'Security & 2FA',
    description: 'Set up your own two-factor, and find the company-wide security rules.',
    route: /^\/tool-shed\/security\/?$/,
    roadmap: [
      { title: 'Set up your own 2FA', detail: 'Right at the top of this page.' },
      { title: 'Owners: team two-factor', detail: 'Which methods the team may use, in Company Preferences.' },
      { title: 'Owners: delete permissions', detail: 'Who may delete records, in Company Preferences.' },
    ],
    use: {
      say: 'Which two-factor methods the team may use is set under Team security in Company Preferences. If someone gets locked out, open their settings on Staff & crews and use Reset 2FA so they can set it up again.',
      go: [{ label: 'Team security', to: '/tool-shed/preferences#team-security' }, { label: 'Open Staff & crews', to: '/tool-shed/staff' }],
    },
    steps: [
      {
        selector: '[data-tour="tenant-security-header"]',
        title: 'Security & 2FA',
        say: 'This page is about keeping sign-ins safe: your own two-factor first, then links to the rules for the whole team.',
      },
      {
        selector: '[data-tour="tenant-security-mine"]',
        title: 'Your two-factor',
        say: 'Start with your own login. Pick how you want to get your one-time codes and confirm it.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="my-security-methods"]',
        title: 'Pick a method',
        say: 'Only the methods your company allows are shown here.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="tenant-security-rules"]',
        title: 'Company security rules',
        say: 'The rules for the whole team live in Company Preferences. Use these links to get there.',
        optional: 'Skip',
        links: [
          { label: 'Team two-factor', url: '/tool-shed/preferences#team-security' },
          { label: 'Delete permissions', url: '/tool-shed/preferences#delete-permissions' },
        ],
      },
    ],
  },
]
