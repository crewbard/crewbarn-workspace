import type { TutorialData } from './types'

/**
 * Your team, start to finish: Staff & crews (adding someone, every switch on
 * a person, their pay), Roles & permissions, Payroll profiles, Time off,
 * hours and Payroll at a glance, subcontractors, and where the team shows up
 * elsewhere.
 *
 * Nothing here saves. Forms are walked and closed with their own Cancel.
 */

const t = (id: string) => `[data-tour=${JSON.stringify(id)}]`

const STAFF = '^/tool-shed/staff/?$'
const ROLES = '^/tool-shed/roles/?$'
const PROFILES = '^/accounting/payroll/profiles/?$'
const TIME_OFF = '^/tool-shed/time-off/?$'
const PAYROLL = '^/accounting/payroll/?$'
const SUBS = '^/tool-shed/subcontractors/?$'

export const TUTORIAL: TutorialData = {
  id: 'team',
  kicker: 'Your team · tutorial',
  title: 'Your team, start to finish',
  film: [
    {
      id: 'everyone',
      label: 'Everyone',
      title: 'Everyone who works for you, in one place',
      narration:
        'Welcome to your team. Everyone who works for you lives in Staff and crews. People can use the full app, the employee portal, or no login. You can still assign work, log hours and set pay for crew without full-app access.',
    },
    {
      id: 'three',
      label: 'Three switches',
      title: 'Three separate switches',
      narration:
        'Each person has three separate switches. App access decides whether they use the full app; employee portal access is chosen separately. Their role decides what they can see and change. And Works as a technician decides if they show up when you assign field work.',
    },
    {
      id: 'roles',
      label: 'Roles',
      title: 'A role is a bundle of permissions',
      narration:
        'A role is a bundle of permissions, set area by area: no access, view, or edit. Change a role, and everyone on it changes with it. When one person needs something different, you give just them their own permissions.',
    },
    {
      id: 'pay',
      label: 'Pay',
      title: 'Pay them the way you really do',
      narration:
        'Pay works the way you really pay people: by the hour, a salary, a share of the work, or an hourly rate plus a share. Pick one, and CrewBarn shows you what a normal week costs you.',
    },
    {
      id: 'time',
      label: 'Hours and time off',
      title: 'Hours and time off',
      narration:
        'Hours can come in on their own, clocked when a tech’s phone arrives at a job, or you log them by hand. Time off is asked for, then approved or denied, and approved time off shows on the schedule so nobody gets booked by mistake.',
    },
    {
      id: 'payroll',
      label: 'Payroll',
      title: 'It all adds up in payroll',
      narration:
        'Pay rules, clocked hours, finished jobs and paid leave all come together in Payroll. You check what each person is owed for the period before anything is posted.',
    },
    {
      id: 'where',
      label: 'Where it shows up',
      title: 'Your team shows up all over',
      narration:
        'Your team shows up all over CrewBarn: in the lead tech picker on every job, on Dispatch, on the schedule, and in each person’s own employee portal. Companies you send work to live alongside them as subcontractors.',
    },
    {
      id: 'yourturn',
      label: 'Your turn',
      title: 'Now let’s do it for real',
      narration:
        'That’s the idea. Now let’s do it for real. I’ll step back into the corner and point at each part of the page. When it’s your turn, you click. If you’d rather watch, press Do it for me. We won’t save or send anything.',
    },
  ],
  chapters: [
    { key: 'list', label: 'The team list' },
    { key: 'add', label: 'Add someone' },
    { key: 'person', label: 'One person’s settings' },
    { key: 'pay', label: 'Their pay' },
    { key: 'roles', label: 'Roles & permissions' },
    { key: 'profiles', label: 'Payroll profiles' },
    { key: 'timeoff', label: 'Time off' },
    { key: 'payroll', label: 'Hours and payroll' },
    { key: 'used', label: 'Subs, and where your team shows up' },
  ],
  steps: [
    // ---------- The team list ----------
    {
      id: 'list-header', chapter: 'list', route: STAFF, open: 'goto:/tool-shed/staff',
      click: t('staff-tab-staff'), selector: t('staff-header'),
      title: 'Staff & crews',
      say: 'This is Staff and crews, your team list. You’ll find it in the Tool Shed under Team and Access. The link up here jumps to role permissions.',
    },
    {
      id: 'list-three', chapter: 'list', route: STAFF, selector: t('staff-three-choices'),
      title: 'Three separate choices',
      say: 'Keep these three apart. App access is about signing in. The role is about permissions. Works as a technician is about showing up for field work. Changing one never changes the others.',
    },
    {
      id: 'list-tabs', chapter: 'list', route: STAFF, selector: t('staff-tabs'),
      title: 'Staff, Scorecard, Timesheet',
      say: 'Staff is the list itself. Scorecard shows how each person is doing, and Timesheet shows the hours they clocked. We’ll look at those two later.',
    },
    {
      id: 'list-search', chapter: 'list', route: STAFF, selector: t('staff-search'),
      title: 'Find someone',
      say: 'Search by name or email. Tick Show disabled to also see people who’ve left.',
    },
    {
      id: 'list-add', chapter: 'list', route: STAFF, selector: t('staff-add'),
      title: 'Add someone',
      say: 'Add someone brings a new person on board. We’ll walk through it next.',
    },
    {
      id: 'list-row', chapter: 'list', route: STAFF, selector: t('staff-row'),
      title: 'One row per person',
      say: 'Each row is one person: their name, their role, and badges like No app login, Portal only, or Field technician. Invite sent means they haven’t set a password yet, and No longer here means they’re disabled. Underneath is their email, phone, and when they last signed in.',
    },
    {
      id: 'list-rules', chapter: 'list', route: STAFF, selector: t('staff-rule-pills'),
      title: 'Field rules, per person',
      say: 'These are the field rules this person follows. Notes makes them log an update before working a stalled job. Nudge texts them when a job stalls. COD makes them collect payment from cash-on-delivery customers before moving on. Auto-clock clocks them in and out by GPS. A tick means it applies. Tapping one changes it right away, so we’ll leave them as they are.',
    },
    {
      id: 'list-actions', chapter: 'list', route: STAFF, selector: t('staff-row-actions'),
      title: 'Settings and Portal',
      say: 'Settings opens everything about this person, and so does clicking their row. Portal shows you their employee portal exactly as they see it.',
    },
    {
      id: 'list-subs', chapter: 'list', route: STAFF, selector: t('staff-sub-companies'),
      title: 'Sub companies',
      say: 'Sub companies you’ve invited show down here: who’s connected, who still needs to enter their code, and whether their paperwork is in.',
    },

    // ---------- Add someone ----------
    {
      id: 'add-open', chapter: 'add', route: STAFF, open: 'goto:/tool-shed/staff', selector: t('staff-add'),
      wait: { appear: `${t('staff-add-chooser')}, ${t('staff-invite-modal')}` }, doIt: t('staff-add'),
      yourTurn: 'Click Add someone.',
      title: 'Add someone',
      say: 'Let’s add someone. Don’t worry, nothing is sent until the very last button, and we’ll stop before it. Click Add someone.',
    },
    {
      id: 'add-chooser', chapter: 'add', route: STAFF, selector: t('staff-add-chooser'),
      wait: { appear: t('staff-invite-modal') }, doIt: t('staff-add-employee'),
      yourTurn: 'Pick Employee.',
      title: 'Employee or sub company',
      say: 'First, who are you adding? An employee works for you and signs in with the role you give them. A sub company is another business you send work to, with its own free CrewBarn. Pick Employee.',
    },
    {
      id: 'add-form', chapter: 'add', route: STAFF, open: 'team:invite', selector: t('staff-invite-modal'),
      title: 'Invite staff',
      say: 'This is the form for a new person. It’s called Invite staff when they’ll sign in, and Add crew when they won’t.',
    },
    {
      id: 'add-type', chapter: 'add', route: STAFF, selector: t('staff-invite-type'),
      title: 'App access or not',
      say: 'Type is the first switch. App access means they get an email to set a password and sign in. No app access makes them crew: someone you can schedule, log hours for and pay, without a login.',
    },
    {
      id: 'add-fieldtech', chapter: 'add', route: STAFF, selector: t('staff-invite-fieldtech'),
      title: 'Works as a technician',
      say: 'Works as a technician puts them in the field lists, like the lead tech picker on a job and the lanes on Dispatch. It’s ticked for you when the role is a tech, and you can change it either way.',
    },
    {
      id: 'add-portal', chapter: 'add', route: STAFF, selector: t('staff-invite-portal'),
      title: 'Employee portal',
      say: 'The employee portal is their own web page for jobs, tasks, pay, time off and messages. Choose it separately from phone-app access. People who need to sign in must have an email address, even if their setup link also goes by text.',
    },
    {
      id: 'add-email', chapter: 'add', route: STAFF, selector: t('staff-invite-email'),
      title: 'Email',
      say: 'Their email is their sign-in address. Check it and their mobile number: the private setup link can go by email and text. Crew without sign-in access can be added without an email.',
    },
    {
      id: 'add-names', chapter: 'add', route: STAFF, selector: t('staff-person-names'), hold: true,
      yourTurn: 'Type a first name, like Jordan, then press Next.',
      title: 'Their name',
      say: 'A first name is required, a last name is up to you. Go ahead and type one in. We won’t keep it.',
    },
    {
      id: 'add-phone', chapter: 'add', route: STAFF, selector: t('staff-person-phone'),
      title: 'Mobile phone',
      say: 'Their mobile number. When they press call on a customer, CrewBarn rings this phone first, then dials the customer. They can add it later.',
    },
    {
      id: 'add-texts', chapter: 'add', route: STAFF, selector: t('staff-person-texts'),
      title: 'Texts also hit Comms & Intake',
      say: 'Tick this only for someone whose texts to your business line should also land in the customer inbox and go through intake. Leave it off for regular crew.',
    },
    {
      id: 'add-n2p', chapter: 'add', route: STAFF, selector: t('staff-person-n2p'),
      title: 'Their calling number',
      say: 'If you use Net2Phone, pick the number their calls go out from. Lines that are already somebody else’s say whose they are, and leaving it on none uses your company’s calling number.',
    },
    {
      id: 'add-role', chapter: 'add', route: STAFF, selector: t('staff-invite-role'),
      title: 'Role',
      say: 'The role decides what they can see and change. It starts on the first role that isn’t Owner, so nobody becomes an owner by accident, and only an owner can make another owner. The line underneath describes the role you picked.',
    },
    {
      id: 'add-wage', chapter: 'add', route: STAFF, selector: t('staff-invite-wage'),
      title: 'Wage type',
      say: 'Wage type sets up their pay right away: hourly, salary or commission, then the rate. You can leave it on None and set pay up later in more detail.',
    },
    {
      id: 'add-crew', chapter: 'add', route: STAFF, selector: t('staff-invite-type-crew'),
      wait: { click: true }, doIt: t('staff-invite-type-crew'),
      yourTurn: 'Click No app access.',
      title: 'Now as crew',
      say: 'Now let’s see it for crew. Click No app access.',
    },
    {
      id: 'add-crew-form', chapter: 'add', route: STAFF, selector: t('staff-invite-modal'),
      title: 'Add crew',
      say: 'See how it changed? It’s Add crew now. There is no full-app role or calling number. Crew can still sign in to the employee portal if you leave it enabled. Untick the employee portal and the email becomes optional too.',
    },
    {
      id: 'add-send', chapter: 'add', route: STAFF, selector: t('staff-invite-send'),
      title: 'Send invite or Add crew',
      say: 'Choose Quick setup for a password and immediate access, or Full onboarding for contact details and optional employee documents. Send invite delivers their private setup link by email and text when available; read the delivery result and share the link yourself if needed. App users receive the download link after finishing. Add crew creates their record. We will leave it this time.',
    },
    {
      id: 'add-cancel', chapter: 'add', route: STAFF, selector: t('staff-invite-cancel'),
      wait: { gone: t('staff-invite-modal') }, doIt: t('staff-invite-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Cancel closes the form without adding anyone. Click Cancel.',
    },

    // ---------- One person's settings ----------
    {
      id: 'person-open', chapter: 'person', route: STAFF, open: 'goto:/tool-shed/staff',
      click: t('staff-tab-staff'), selector: t('staff-person-name'),
      wait: { appear: t('staff-edit-modal') }, doIt: 'team:person',
      yourTurn: 'Click a name in the list.',
      title: 'Open someone',
      say: 'Now let’s open someone who’s already here, just to look. Click a person’s name.',
    },
    {
      id: 'person-modal', chapter: 'person', route: STAFF, open: 'team:person', selector: t('staff-edit-modal'),
      title: 'Edit staff',
      say: 'Everything about this one person is in here. We’ll only look, and close it with Cancel at the end, so nothing changes.',
    },
    {
      id: 'person-email', chapter: 'person', route: STAFF, selector: t('staff-edit-email'),
      title: 'Their sign-in email',
      say: 'This is the email they sign in with. If their invite is still waiting, Resend invite sends a fresh link.',
    },
    {
      id: 'person-contact', chapter: 'person', route: STAFF, selector: t('staff-person-names'),
      title: 'Name, phone and calling number',
      say: 'Their name, mobile phone and calling number work the same as on the invite form.',
    },
    {
      id: 'person-access', chapter: 'person', route: STAFF, selector: t('staff-edit-access'),
      title: 'Access',
      say: 'Access is a box of separate doors. A tech usually has the field app and the portal. Office staff often have neither and use the full app on a computer.',
    },
    {
      id: 'person-managed', chapter: 'person', route: STAFF, selector: t('staff-edit-managed'),
      title: 'Managed technicians',
      say: 'Managed technicians is for a lead or supervisor. Pick the techs they look after, and if their job visibility is My managed team, they see those techs’ jobs too. It doesn’t give any other permission.',
    },
    {
      id: 'person-fieldtech', chapter: 'person', route: STAFF, selector: t('staff-edit-fieldtech'),
      title: 'Works as a technician',
      say: 'Works as a technician puts them in field rosters and availability. It doesn’t change what their role lets them do.',
    },
    {
      id: 'person-fieldapp', chapter: 'person', route: STAFF, selector: t('staff-edit-fieldapp'),
      title: 'Field app',
      say: 'Field app lets them sign in to the phone app and work field jobs. Automatic clock-in also depends on company rules and phone location setup. App users receive a download link after they finish setup.',
    },
    {
      id: 'person-portal', chapter: 'person', route: STAFF, selector: t('staff-edit-portal'),
      title: 'Employee portal',
      say: 'Employee portal is the light web view they land on when they sign in. View as them shows it the way they see it. Turning it on for crew with no login sends them an invite when you save.',
    },
    {
      id: 'person-connect', chapter: 'person', route: STAFF, selector: t('staff-edit-connect'),
      title: 'Company settings',
      say: 'Company settings decides whether your settings site opens for them at all. What they can change once inside still comes from their role. You can’t switch off your own, so you can never lock yourself out.',
    },
    {
      id: 'person-cbi', chapter: 'person', route: STAFF, selector: t('staff-edit-cbi'),
      title: 'Ask CBI',
      say: 'Ask CBI is the assistant button in their phone app. Untick it to take one person out. If the AI module is off for the whole company, this can’t turn it back on.',
    },
    {
      id: 'person-role', chapter: 'person', route: STAFF, selector: t('staff-edit-role'),
      title: 'Their role',
      say: 'This is where you move someone to a different role. The description underneath tells you what that role is for.',
    },
    {
      id: 'person-status', chapter: 'person', route: STAFF, selector: t('staff-edit-status'),
      title: 'Active or disabled',
      say: 'Status is Active, or Disabled, which means they can’t sign in anymore. You can’t disable yourself.',
    },
    {
      id: 'person-quiet', chapter: 'person', route: STAFF, selector: t('staff-edit-employee-settings'),
      title: 'Quiet days and reminders',
      say: 'Keep the company defaults, choose no quiet hours, or set their own weekdays and times. These use the company timezone. Check their task emails too, then use Save changes and reopen the record to verify. Late-tech alerts still come through.',
    },
    {
      id: 'person-train', chapter: 'person', route: STAFF, selector: t('staff-edit-cbi-train'),
      title: 'Can train and correct CBI',
      say: 'This lets them make lasting corrections to CBI. It doesn’t open any other records. Switching it turns on personal permissions for them.',
    },
    {
      id: 'person-override', chapter: 'person', route: STAFF, selector: t('staff-edit-permissions'),
      title: 'Personal permissions',
      say: 'Personal permissions are for one-off exceptions. Off, they simply follow their role. Tick Override role, and the boxes below become theirs alone: area by area, which jobs they see, and settings page by page. Owners always keep full access.',
    },
    {
      id: 'person-widgets', chapter: 'person', route: STAFF, selector: t('staff-edit-widgets'),
      title: 'Dashboard widgets',
      say: 'Restrict dashboard widgets picks which dashboard cards this person gets. Off, they get whatever their role allows.',
    },
    {
      id: 'person-danger', chapter: 'person', route: STAFF, selector: t('staff-edit-danger'),
      title: 'Disable, Reset 2FA, Delete code',
      say: 'Down here, Disable stops them signing in, after you confirm. Reset 2FA helps someone who lost their phone set up two-factor again. And an owner can make a one-time Delete code that lets them delete their own account in the app.',
    },
    {
      id: 'person-save', chapter: 'person', route: STAFF, selector: t('staff-edit-save'),
      title: 'Save changes',
      say: 'Save changes keeps the staff settings; pay needs its own Save button. Reopen the record to check access and quiet days. Cancel only discards changes you have not saved, and does not undo pay already saved. Let us look at pay next.',
    },

    // ---------- Their pay ----------
    {
      id: 'pay-section', chapter: 'pay', route: STAFF, open: 'team:person', selector: t('staff-pay'),
      title: 'Pay',
      say: 'Pay is what this person costs you. It feeds payroll and tells you whether a job made money. Everyone’s pay opens the payroll profiles page we’ll visit later.',
    },
    {
      id: 'pay-types', chapter: 'pay', route: STAFF, selector: t('pay-editor-types'),
      title: 'How they’re paid',
      say: 'Start with how they’re paid: by the hour, a salary, a share of the work, or an hourly rate plus a share. The rest of the form follows your pick.',
    },
    {
      id: 'pay-rate', chapter: 'pay', route: STAFF, selector: t('pay-editor-rate'),
      title: 'Rate and a normal week',
      say: 'Enter their hourly rate or salary before tax. Salary can be a year, month or payment: twice a month is 24 payments a year; every two weeks is 26. Check the yearly total. Changing the period shows the same annual salary; enter a new amount to change pay. Choose actual payment dates separately, and set their normal weekly hours.',
    },
    {
      id: 'pay-cut', chapter: 'pay', route: STAFF, selector: t('pay-editor-cut'),
      title: 'Their cut',
      say: 'For a share of the work, set the percent, and what it’s a cut of: what the job sold for, what was left after parts, or what the customer actually paid. Tax is never part of it.',
    },
    {
      id: 'pay-more', chapter: 'pay', route: STAFF, selector: t('pay-editor-more'),
      title: 'Parts, margin and time off',
      say: 'Open Parts, margin and time off for the extras: a cut on parts they fit with an optional limit, the margin you aim for, a share for supervising a territory, sick days, holiday, time-off balances, expenses, and notes.',
    },
    {
      id: 'pay-week', chapter: 'pay', route: STAFF, selector: t('pay-editor-week'), hold: true,
      yourTurn: 'Change Hours worked, then press Next.',
      title: 'What a week costs you',
      say: 'This yellow box shows what a week like this would cost you, before tax. Try changing the hours. It’s only a what-if, so it never changes their pay.',
    },
    {
      id: 'pay-save', chapter: 'pay', route: STAFF, selector: t('pay-editor-save'),
      title: 'Save pay',
      say: 'Pay has its own Save button, and This arrangement is in use turns it on or off. If you change pay and try to close without saving, CrewBarn asks first. We’ll leave it.',
    },
    {
      id: 'pay-close', chapter: 'pay', route: STAFF, selector: t('staff-edit-cancel'),
      wait: { gone: t('staff-edit-modal') }, doIt: t('staff-edit-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Close it',
      say: 'That’s one person, top to bottom. Click Cancel to close without changing anything.',
    },

    // ---------- Roles & permissions ----------
    {
      id: 'roles-header', chapter: 'roles', route: ROLES, open: 'goto:/tool-shed/roles', selector: t('roles-header'),
      title: 'Roles & permissions',
      say: 'This is Roles and permissions. Each role is a bundle of permissions, and you put people on a role in Staff and crews.',
    },
    {
      id: 'roles-list', chapter: 'roles', route: ROLES, selector: t('roles-list'),
      title: 'Your roles',
      say: 'Here are your roles. CrewBarn preset marks the ones that came with CrewBarn, and Yours marks the ones you made. Each shows how many people are on it, and the bar shows roughly how much it can do.',
    },
    {
      id: 'roles-owner', chapter: 'roles', route: ROLES, click: t('roles-role-owner'), selector: t('roles-owner'),
      title: 'Owner',
      say: 'Owner is locked to full access, so the company can never be locked out. Only a current owner can make, change or disable another owner, from Staff and crews.',
    },
    {
      id: 'roles-pick', chapter: 'roles', route: ROLES, selector: t('roles-role-pick'),
      wait: { appear: t('roles-name') }, doIt: t('roles-role-pick'),
      yourTurn: 'Click any role other than Owner.',
      title: 'Open a role',
      say: 'Now click any other role to open it.',
    },
    {
      id: 'roles-people', chapter: 'roles', route: ROLES, click: t('roles-people-button'), selector: t('roles-people'),
      title: 'People on this role',
      say: 'People shows who’s on this role. You can move someone to another role from here, and CrewBarn asks before it changes anything.',
    },
    {
      id: 'roles-compare', chapter: 'roles', route: ROLES, selector: t('roles-compare-button'),
      title: 'Compare roles',
      say: 'Compare roles lays every role side by side, area by area, so you can spot the differences.',
    },
    {
      id: 'roles-audit', chapter: 'roles', route: ROLES, selector: t('roles-audit-button'),
      title: 'Audit log',
      say: 'Audit log lists the latest role changes: who did it, and what was turned on or off. The newest access change on a role can be undone from there.',
    },
    {
      id: 'roles-copy', chapter: 'roles', route: ROLES, selector: t('roles-copy'),
      title: 'Copy a role',
      say: 'Copy makes a new role from this one. The original stays exactly as it is.',
    },
    {
      id: 'roles-name', chapter: 'roles', route: ROLES, selector: t('roles-name'),
      title: 'Name and description',
      say: 'You can rename the role and give it a short description, which shows next to it in lists.',
    },
    {
      id: 'roles-widgets', chapter: 'roles', route: ROLES, selector: t('roles-widgets'),
      title: 'Dashboard widgets',
      say: 'Restrict which widgets this role sees limits the dashboard cards for everyone on it. A person’s own setting wins over this.',
    },
    {
      id: 'roles-plain', chapter: 'roles', route: ROLES, selector: t('roles-plain-words'),
      title: 'In plain words',
      say: 'In plain words sums up the role in three columns: what they can change, what they can only look at, and what’s off.',
    },
    {
      id: 'roles-find', chapter: 'roles', route: ROLES, selector: t('roles-find'),
      title: 'Find a permission',
      say: 'Looking for something like refunds or gate codes? Search here and the cards below narrow down.',
    },
    {
      id: 'roles-areas', chapter: 'roles', route: ROLES, selector: t('roles-areas'),
      title: 'A level for each area',
      say: 'Each card is one area, like Customers, Jobs or Inventory. Pick a level, like No access, View or Edit. On Jobs, Which jobs picks their own, their team’s, their territories, or every job. Fine-tune lets you tick single permissions, and Sensitive marks the ones to think twice about.',
    },
    {
      id: 'roles-extra', chapter: 'roles', route: ROLES, selector: t('roles-extra'),
      title: 'Everything else',
      say: 'Anything that doesn’t fit an area card is listed down here, so nothing is ever hidden.',
    },
    {
      id: 'roles-save', chapter: 'roles', route: ROLES, selector: t('roles-save'),
      title: 'Check, then save',
      say: 'Before saving, this bar lists what’s turning on and off, warns about sensitive access, and says how many people it affects. Discard throws your changes away, and on a role you made, Delete role removes it after you confirm. Save permissions updates everyone on the role. We’ll leave it.',
    },
    {
      id: 'roles-new', chapter: 'roles', route: ROLES, selector: t('roles-new-button'),
      wait: { appear: t('roles-new') }, doIt: t('roles-new-button'),
      yourTurn: 'Click New role.',
      title: 'New role',
      say: 'Now let’s start a new role. Click New role.',
    },
    {
      id: 'roles-new-source', chapter: 'roles', route: ROLES, open: 'team:role-new', selector: t('roles-new-source'),
      title: 'Start from the closest role',
      say: 'You can start from the closest role you have. It copies its permissions, job visibility and widgets, and nobody is moved onto the new role.',
    },
    {
      id: 'roles-new-presets', chapter: 'roles', route: ROLES, selector: t('roles-new-presets'),
      wait: { click: true }, doIt: t('roles-new-preset-field_tech'),
      yourTurn: 'Pick a preset, like Field tech.',
      title: 'Or a plain-English preset',
      say: 'Or start from a preset: Dispatcher, Field tech, Office or bookkeeper, Manager, or Read-only viewer. Pick one.',
    },
    {
      id: 'roles-new-name', chapter: 'roles', route: ROLES, selector: t('roles-new-name'),
      title: 'Name and description',
      say: 'The preset filled in a name and description. Change them to suit your shop.',
    },
    {
      id: 'roles-new-scope', chapter: 'roles', route: ROLES, selector: t('roles-new-scope'),
      title: 'Job visibility',
      say: 'Job visibility decides which jobs they see: every job in the shop, only their own, their managed team’s, or the territories assigned to them.',
    },
    {
      id: 'roles-new-perms', chapter: 'roles', route: ROLES, selector: t('roles-new-permissions'),
      title: 'Permissions',
      say: 'And here’s every permission, ticked from the preset. Add or take off any you like.',
    },
    {
      id: 'roles-new-create', chapter: 'roles', route: ROLES, selector: t('roles-new-create'),
      title: 'Create role',
      say: 'Create role saves it, ready for you to put people on it. We’ll leave it this time.',
    },
    {
      id: 'roles-new-cancel', chapter: 'roles', route: ROLES, selector: t('roles-new-cancel'),
      wait: { gone: t('roles-new') }, doIt: t('roles-new-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Click Cancel to close it without making anything.',
    },

    // ---------- Payroll profiles ----------
    {
      id: 'profiles-header', chapter: 'profiles', route: PROFILES, open: 'goto:/accounting/payroll/profiles', selector: t('pay-profiles-header'),
      title: 'Payroll profiles',
      say: 'Payroll profiles is everyone’s pay on one page, in Accounting. It’s the same pay you saw on a person, with a few more details.',
    },
    {
      id: 'profiles-filters', chapter: 'profiles', route: PROFILES, selector: t('pay-profiles-filters'),
      title: 'Find someone',
      say: 'Search by name, email or role, and filter by pay type, or by whether they’re included in payroll.',
    },
    {
      id: 'profiles-pick', chapter: 'profiles', route: PROFILES, selector: t('pay-profiles-person'),
      wait: { click: true }, doIt: t('pay-profiles-person'),
      yourTurn: 'Click a person.',
      title: 'Pick a person',
      say: 'Each person shows their role, pay type, and Included or Excluded. Click one to open their pay.',
    },
    {
      id: 'profiles-tabs', chapter: 'profiles', route: PROFILES, selector: t('pay-profiles-tabs'),
      title: 'Pay rules and work schedule',
      say: 'Up top is their current rate at a glance, and two tabs: Pay rules and Work schedule.',
    },
    {
      id: 'profiles-type', chapter: 'profiles', route: PROFILES, click: t('pay-profiles-tab-pay'), selector: t('pay-profiles-pay-type'),
      title: 'Pay type and rates',
      say: 'Choose hourly, salary, commission or hybrid. For salary, check the amount period and yearly total: twice a month is 24 payments; every two weeks is 26. Set actual payment dates separately, with a known pay date for every-two-week pay. Review commission and the health insurance company and employee shares; confirm whether the company share is already counted in costs.',
    },
    {
      id: 'profiles-parts', chapter: 'profiles', route: PROFILES, selector: t('pay-profiles-parts'),
      title: 'Parts commission and territory',
      say: 'The parts rule pays a cut on parts, but only when a job’s parts stay under the limit you set. Supervising a territory adds a share of what their territory’s work leaves, on top of their pay.',
    },
    {
      id: 'profiles-calc', chapter: 'profiles', route: PROFILES, selector: t('pay-profiles-calculator'), hold: true,
      yourTurn: 'Change the Hours, then press Next.',
      title: 'Tech calculator',
      say: 'The tech calculator tests the rule before you save: labor, commission, parts commission, sick time and vacation earned, and the total. Try changing the hours.',
    },
    {
      id: 'profiles-balances', chapter: 'profiles', route: PROFILES, selector: t('pay-profiles-balances'),
      title: 'Time-off balances',
      say: 'PTO, sick and vacation hours are what they have in hand. Approved paid time off comes out of these in payroll.',
    },
    {
      id: 'profiles-include', chapter: 'profiles', route: PROFILES, selector: t('pay-profiles-include'),
      title: 'Include in payroll reports',
      say: 'Include in payroll reports keeps them in the payroll figures. Reimburse expenses, next to it, lets them claim money back.',
    },
    {
      id: 'profiles-schedule', chapter: 'profiles', route: PROFILES, click: t('pay-profiles-tab-schedule'), selector: t('pay-profiles-schedule'),
      title: 'Work schedule',
      say: 'Work schedule is their usual week, hour by hour, seven days. Click hours on or off, or use Mon-Fri 8-5, 7 days 8-5, or Clear. Their weekly hours follow along.',
    },
    {
      id: 'profiles-save', chapter: 'profiles', route: PROFILES, selector: t('pay-profiles-save'),
      title: 'Save profile',
      say: 'Press Save profile and wait for confirmation. Reopen the person to check the salary total, payment dates and insurance split. Review the payroll preview before posting; saving this profile does not post payroll or create an insurance deduction. We will leave it this time.',
    },

    // ---------- Time off ----------
    {
      id: 'timeoff-header', chapter: 'timeoff', route: TIME_OFF, open: 'goto:/tool-shed/time-off', selector: t('time-off-header'),
      title: 'Time off',
      say: 'This is Time off. Staff ask for vacation, sick, personal or unpaid time from any browser, and the office approves or denies it here.',
    },
    {
      id: 'timeoff-new', chapter: 'timeoff', route: TIME_OFF, selector: t('time-off-new'),
      wait: { appear: t('time-off-form-type') }, doIt: t('time-off-new'),
      yourTurn: 'Click New request.',
      title: 'New request',
      say: 'Let’s look at a request. Click New request.',
    },
    {
      id: 'timeoff-for', chapter: 'timeoff', route: TIME_OFF, open: 'team:timeoff-new', selector: t('time-off-form-for'),
      title: 'For',
      say: 'For is who it’s for. Leave it on Me, or pick anyone on your team to put it in for them.',
    },
    {
      id: 'timeoff-type', chapter: 'timeoff', route: TIME_OFF, selector: t('time-off-form-type'),
      title: 'Type',
      say: 'Type is vacation, sick, personal, unpaid, bereavement, jury or other.',
    },
    {
      id: 'timeoff-dates', chapter: 'timeoff', route: TIME_OFF, selector: t('time-off-form-start'),
      title: 'Start and end',
      say: 'Pick the first and last day. Both are needed.',
    },
    {
      id: 'timeoff-allday', chapter: 'timeoff', route: TIME_OFF, selector: t('time-off-form-allday'),
      wait: { appear: t('time-off-form-times') }, doIt: `${t('time-off-form-allday')} input`,
      yourTurn: 'Untick All day.',
      title: 'All day, or a few hours',
      say: 'All day is ticked to start. Untick it for a few hours instead, like a dentist visit.',
    },
    {
      id: 'timeoff-times', chapter: 'timeoff', route: TIME_OFF, selector: t('time-off-form-times'),
      title: 'Start and end time',
      say: 'Now there’s a start and end time. Part-day time off has to be on a single day.',
    },
    {
      id: 'timeoff-reason', chapter: 'timeoff', route: TIME_OFF, selector: t('time-off-form-reason'),
      title: 'Reason',
      say: 'A reason is optional, and shows on the request.',
    },
    {
      id: 'timeoff-submit', chapter: 'timeoff', route: TIME_OFF, selector: t('time-off-form-submit'),
      title: 'Submit',
      say: 'Submit sends the request in. We’ll leave it.',
    },
    {
      id: 'timeoff-cancel', chapter: 'timeoff', route: TIME_OFF, selector: t('time-off-form-cancel'),
      wait: { gone: t('time-off-form-type') }, doIt: t('time-off-form-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Click Cancel to close it without sending anything.',
    },
    {
      id: 'timeoff-counts', chapter: 'timeoff', route: TIME_OFF, selector: t('time-off-counts'),
      title: 'Counts',
      say: 'These count requests by status: pending, approved, denied and cancelled. Click one to show only those.',
    },
    {
      id: 'timeoff-filters', chapter: 'timeoff', route: TIME_OFF, selector: t('time-off-filters'),
      title: 'Filter and search',
      say: 'Or filter here, and search by person, reason or notes. Pending requests always sit at the top.',
    },
    {
      id: 'timeoff-row', chapter: 'timeoff', route: TIME_OFF, selector: t('time-off-row'),
      title: 'One request',
      say: 'Each request shows who, the status, the type, the dates and hours, and once decided, who decided and their note.',
    },
    {
      id: 'timeoff-actions', chapter: 'timeoff', route: TIME_OFF, selector: t('time-off-row-actions'),
      title: 'Approve or deny',
      say: 'Approve or Deny opens a short window for a note. Before approving, CrewBarn checks their schedule and warns you about any jobs already booked in that time. Reopen sends a decided request back to Pending, and Delete removes one.',
    },

    // ---------- Hours and payroll ----------
    {
      id: 'hours-scorecard', chapter: 'payroll', route: STAFF, open: 'goto:/tool-shed/staff',
      click: t('staff-tab-scorecard'), selector: t('staff-scorecard'),
      title: 'Scorecard',
      say: 'Back on Staff and crews, Scorecard scores each person over 30 days, 90 days or a year. Techs are scored on photos, notes, time on the job, callbacks and nudges. Dispatchers on estimates won and jobs booked.',
    },
    {
      id: 'hours-timesheet', chapter: 'payroll', route: STAFF, click: t('staff-tab-timesheet'), selector: t('staff-timesheet'),
      title: 'Timesheet',
      say: 'Timesheet shows clocked hours for the last 7, 14 or 30 days, person by person and job by job. With Auto clock-in on, a tech is clocked in when they reach the jobsite and out when they leave.',
    },
    {
      id: 'hours-log', chapter: 'payroll', route: STAFF, selector: t('staff-timesheet-log'),
      title: 'Log time',
      say: 'Log time adds hours by hand, like for crew with no app. Those hours flow into the timesheet and payroll just like clocked ones.',
    },
    {
      id: 'payroll-header', chapter: 'payroll', route: PAYROLL, open: 'goto:/accounting/payroll', selector: t('payroll-header'),
      title: 'Payroll & Tech Profit',
      say: 'This is Payroll, in Accounting. It brings together pay rules, hours, jobs and leave for a period, so you can check it, then post it.',
    },
    {
      id: 'payroll-filters', chapter: 'payroll', route: PAYROLL, selector: t('payroll-filters'),
      title: 'The period',
      say: 'Pick the period with From and To. It starts on this month so far. You can also narrow it to one tech or one pay type.',
    },
    {
      id: 'payroll-metrics', chapter: 'payroll', route: PAYROLL, selector: t('payroll-metrics'),
      title: 'The totals',
      say: 'Across the top: techs, jobs, revenue, payroll cost, paid leave, sick and vacation earned, expenses, and margin.',
    },
    {
      id: 'payroll-preview', chapter: 'payroll', route: PAYROLL, selector: t('payroll-preview'),
      title: 'Check before posting',
      say: 'Check before posting shows what each person would be paid: wage, commission, bonus, tips and vacation. It warns you about finished jobs nobody invoiced yet, since those don’t reach anyone’s pay.',
    },
    {
      id: 'payroll-leave', chapter: 'payroll', route: PAYROLL, selector: t('payroll-leave'),
      title: 'Time-off balances',
      say: 'PTO balances shows approved paid time off for the period, taken from each person’s balance. Open time off takes you back to the requests.',
    },
    {
      id: 'payroll-profit', chapter: 'payroll', route: PAYROLL, selector: t('payroll-profit'),
      title: 'Technician profitability',
      say: 'Technician profitability compares what each tech brought in against what they cost, so you see the margin per person.',
    },
    {
      id: 'payroll-reimb', chapter: 'payroll', route: PAYROLL, selector: t('payroll-reimbursements'),
      title: 'Reimbursements',
      say: 'Tech reimbursements lists expenses owed back to your team. They’re kept separate from payroll.',
    },
    {
      id: 'payroll-actions', chapter: 'payroll', route: PAYROLL, selector: t('payroll-actions'),
      title: 'Post payroll closeout',
      say: 'Pay profiles opens the page we just saw. The spreadsheet and PDF buttons download the figures. Post payroll closeout locks the period and posts it to your books, after you confirm. We’ll leave it.',
    },
    {
      id: 'payroll-closeouts', chapter: 'payroll', route: PAYROLL, selector: t('payroll-closeouts'),
      title: 'Posted payroll',
      say: 'Every payroll you’ve posted is kept here as a locked snapshot of that period.',
    },

    // ---------- Subs, and where your team shows up ----------
    {
      id: 'used-subs', chapter: 'used', route: SUBS, open: 'goto:/tool-shed/subcontractors', selector: t('subs-header'),
      title: 'Subcontractors',
      say: 'Last stop: Subcontractors, the companies you send work to. Each one works your jobs in its own CrewBarn once it accepts your invite.',
    },
    {
      id: 'used-subs-filter', chapter: 'used', route: SUBS, selector: t('subs-filter'),
      title: 'Search and filter',
      say: 'Search by name, contact, email or partner number, and switch between active, inactive and all.',
    },
    {
      id: 'used-subs-add', chapter: 'used', route: SUBS, selector: t('subs-add'),
      title: 'Add subcontractor',
      say: 'Add subcontractor takes their business details, the papers you have on file, and your payment terms.',
    },
    {
      id: 'used-subs-table', chapter: 'used', route: SUBS, selector: t('subs-table'),
      title: 'One row per sub',
      say: 'Each row shows their contact, where they stand on CrewBarn, with Invite if they aren’t on it yet, which papers are on file, and their payment terms.',
    },
    {
      id: 'used-intro', chapter: 'used', route: SUBS,
      title: 'Where your team shows up',
      say: 'Your team doesn’t only live on these pages. Here’s where else they show up, so you know where to look.',
    },
    {
      id: 'used-jobs', chapter: 'used', route: SUBS,
      title: 'Lead tech on a job',
      say: 'When you create a job, the Lead tech picker lists everyone with Works as a technician and app access. Crew helpers can be anyone on your team, crew included, and so can the Project manager.',
    },
    {
      id: 'used-crews', chapter: 'used', route: SUBS,
      title: 'Saved crews',
      say: 'If you have saved crews, you can put a whole crew on a job at once, and the Schedule can filter by crew.',
    },
    {
      id: 'used-dispatch', chapter: 'used', route: SUBS,
      title: 'Dispatch and the schedule',
      say: 'On Dispatch, your techs are in the roster beside the map, and the dispatch view on your dashboard gives each technician a lane. On the schedule, approved time off shows on the days it covers. And if you give a job to someone who’s off that day, CrewBarn asks before it goes ahead.',
    },
    {
      id: 'used-dashboard', chapter: 'used', route: SUBS,
      title: 'Dashboard',
      say: 'When a time-off request is waiting, your dashboard shows Time off needs approval, with a link to Time off. And the dashboard cards each person sees follow their role and widget settings.',
    },
    {
      id: 'used-portal', chapter: 'used', route: SUBS,
      title: 'The employee portal',
      say: 'People with the employee portal land on their own page when they sign in, with today’s jobs, tasks, time off and messages. They ask for time off from there too.',
    },
    {
      id: 'used-hiring', chapter: 'used', route: SUBS,
      title: 'Hiring',
      say: 'When you hire someone in Hiring, Staff and crews opens with the invite already filled in from their application.',
    },
    {
      id: 'used-done', chapter: 'used', route: SUBS,
      title: 'That’s the lot',
      say: 'That’s your whole team, from adding someone, to their access, role and pay, to time off and payroll. You can take this tutorial again any time from the button at the top of the page.',
    },
  ],
}
