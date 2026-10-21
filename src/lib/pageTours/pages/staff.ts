import type { PageTour } from '../types'

/**
 * Team → Staff & crews (/tool-shed/staff).
 *
 * Three tabs: Staff, Scorecard, Timesheet. The person editor opens from a
 * row (only for people who can edit staff) and is closed again with its own
 * Cancel; nothing is saved.
 *
 *   staff-empty            the list has nobody in it (or nobody matches)
 *   staff-add              missing for view-only people
 *   staff-scorecard-empty / staff-scorecard-cards
 *   staff-timesheet-empty / staff-timesheet-list
 */
const t = (id: string) => `[data-tour="${id}"]`
const EDITOR = t('staff-edit-modal')

export const PAGE_TOUR: PageTour = {
  id: 'staff',
  route: '^/tool-shed/staff/?$',
  intro: {
    page: 'Staff & crews',
    purpose: 'Everyone who works for you, in one list. Add people, choose whether they sign in, and set their role, rules and pay.',
    covers: ['Adding someone', 'The list and its rules', 'One person’s settings', 'Pay', 'Scorecard', 'Timesheet'],
  },
  steps: [
    {
      id: 'header', selector: t('staff-header'),
      title: 'Staff & crews',
      say: 'Everyone on your team lives here, whether they use the full app, the employee portal, or no login.',
    },
    {
      id: 'three', selector: t('staff-three-choices'),
      title: 'Three separate choices',
      say: 'Keep these apart in your head. App access decides whether they use the full app; employee portal access is chosen separately, their role decides what they can do, and working as a technician puts them on the schedule.',
    },
    {
      id: 'tabs', selector: t('staff-tabs'),
      title: 'Three tabs',
      say: 'Staff is the list of people. Scorecard shows how each person is doing, and Timesheet shows their hours.',
    },
    {
      id: 'search', selector: t('staff-search'), click: t('staff-tab-staff'),
      title: 'Find someone',
      say: 'Search by name or email. Tick Show disabled to see people who no longer sign in.',
    },
    {
      id: 'add', selector: t('staff-add'), title: 'Add someone',
      say: 'Add someone starts their record. Choose app access and employee portal separately, then choose Quick setup for a password or Full onboarding for contact details and optional employee documents. Their private setup link goes by email and text when those channels are available.',
    },
    {
      id: 'view-only', when: `!${t('staff-add')}`, selector: t('staff-list'),
      title: 'View only',
      say: 'You can see your team here, but your role can’t add or change people. Ask an owner if something needs updating.',
    },
    {
      id: 'list', selector: t('staff-list'), title: 'Your team', say: '',
      variants: [
        { when: t('staff-empty'), say: 'Nobody matches yet. Clear the search, or press Add someone to bring in your first person.' },
        { when: t('staff-row'), say: 'Each row is one person. Badges show who has no login, who uses the portal, and who works as a technician.' },
      ],
    },
    {
      id: 'row', selector: t('staff-row'),
      title: 'One person',
      say: 'Their name, role, contact details and when they last signed in. A badge only shows up when something is unusual, like a pending invite.',
    },
    {
      id: 'rules', selector: t('staff-rule-pills'),
      title: 'Field rules',
      say: 'These are the rules this person follows in the field: notes, nudges, collecting payment, and auto clock. Tap one to switch it, handy while someone is training.',
    },
    {
      id: 'row-actions', selector: t('staff-row-actions'),
      title: 'Settings and Portal',
      say: 'Settings opens everything about this person. Portal shows you exactly what they see in their own employee portal.',
    },
    {
      id: 'subs', selector: t('staff-sub-companies'),
      title: 'Sub companies',
      say: 'Outside companies you work with show here too, so you can see who has accepted your invite.',
    },

    // ── One person's settings (opens the first row, view only) ──
    {
      id: 'editor', selector: EDITOR, open: `first:${t('staff-row')}`, waitMs: 1200,
      title: 'One person’s settings',
      say: 'Clicking a person opens their settings. We’ll look around, and nothing changes unless you press Save.',
    },
    {
      id: 'access', selector: t('staff-edit-access'), when: EDITOR,
      title: 'Access',
      say: 'Access is what this person can get into. Each switch is separate, so mix and match what fits the job they do.',
    },
    {
      id: 'tech', selector: t('staff-edit-fieldtech'), when: EDITOR,
      title: 'Works as a technician',
      say: 'Tick this and they show up when you assign jobs and build the schedule.',
    },
    {
      id: 'field-app', selector: t('staff-edit-fieldapp'), when: EDITOR,
      title: 'Field app',
      say: 'Lets them sign in to the phone app and work field jobs. Automatic clock-in also needs the company rule and phone location setup. After they finish setup, app users receive the download link.',
    },
    {
      id: 'portal', selector: t('staff-edit-portal'), when: EDITOR,
      title: 'Employee portal',
      say: 'The employee portal is their own web page for jobs, tasks, pay, time off and messages. Choose it separately from phone-app access. Check their email and mobile number before sending their setup link.',
    },
    {
      id: 'connect', selector: t('staff-edit-connect'), when: EDITOR,
      title: 'Company settings',
      say: 'Lets them open these company settings. Their role still decides what they can change here.',
    },
    {
      id: 'cbi', selector: t('staff-edit-cbi'), when: EDITOR,
      title: 'Ask CBI',
      say: 'Turns the CrewBarn assistant on or off for just this person.',
    },
    {
      id: 'role', selector: t('staff-edit-role'), when: EDITOR,
      title: 'Role',
      say: 'Their role decides what they can see and do. Roles themselves are set up on Roles and permissions.',
    },
    {
      id: 'status', selector: t('staff-edit-status'), when: EDITOR,
      title: 'Status',
      say: 'Disable someone who has left. They can’t sign in any more, and their history stays on every job.',
    },
    {
      id: 'pay', selector: t('staff-pay'), when: EDITOR,
      title: 'Pay',
      say: 'Set their wage, commission, payment dates and optional health insurance here. For salary, check the yearly total: twice a month is 24 payments; every two weeks is 26. Pay has its own Save button.',
    },
    {
      id: 'quiet', selector: t('staff-edit-employee-settings'), when: EDITOR,
      title: 'Their quiet days and reminders',
      say: 'Keep the company defaults, choose no quiet hours, or set this person’s own weekdays and times. Check the task email choices too. Save the staff settings, then reopen the person to check the saved days and hours. Late-tech alerts still come through.',
    },
    {
      id: 'permissions', selector: t('staff-edit-permissions'), when: EDITOR,
      title: 'Just for this person',
      say: 'Need one person to do a little more, or a little less, than their role? Change it here without touching everyone else.',
    },
    {
      id: 'widgets', selector: t('staff-edit-widgets'), when: EDITOR,
      title: 'Their dashboard',
      say: 'Pick which dashboard boxes this person sees when they sign in.',
    },
    {
      id: 'danger', selector: t('staff-edit-danger'), when: EDITOR,
      title: 'Password and removal',
      say: 'Send a password reset, or remove the person. Removing asks you to confirm first.',
    },
    {
      id: 'save', selector: t('staff-edit-save'), when: EDITOR,
      title: 'Save or cancel',
      say: 'Save keeps the staff settings in this window. Pay has its own Save button, so save pay separately. Cancel discards staff changes you have not saved; it does not undo pay you already saved. Reopen the person to check the saved choices.',
    },

    // ── Scorecard (closes the editor first) ──
    {
      id: 'close', click: t('staff-edit-cancel'), selector: t('staff-tab-scorecard'),
      title: 'Scorecard',
      say: 'Scorecard shows how each person is doing over a stretch of time, worked out from their real jobs.',
    },
    {
      id: 'scorecard', selector: t('staff-scorecard'), click: t('staff-tab-scorecard'), waitMs: 1200,
      title: 'How the score works',
      say: 'Office staff are scored on estimates won, jobs booked and how fast they answer. Techs are scored on photos, notes, time on the job and callbacks.',
    },
    {
      id: 'scorecard-window', selector: t('staff-scorecard-window'),
      title: 'Pick the time span',
      say: 'Look back thirty days, ninety days, or a whole year.',
    },
    {
      id: 'scorecard-cards', selector: t('staff-scorecard'), title: 'Each person', say: '',
      variants: [
        { when: t('staff-scorecard-cards'), selector: t('staff-scorecard-cards'), say: 'One card per person, so you can spot who needs a hand and who deserves a thank you.' },
        { when: t('staff-scorecard-empty'), selector: t('staff-scorecard-empty'), say: 'No scores yet. Cards appear once people start working jobs.' },
      ],
    },

    // ── Timesheet ──
    {
      id: 'timesheet', selector: t('staff-timesheet'), click: t('staff-tab-timesheet'), waitMs: 1200,
      title: 'Timesheet',
      say: 'Timesheet adds up everyone’s hours. Techs clock in automatically when they reach a job, if that’s turned on.',
    },
    {
      id: 'log', selector: t('staff-timesheet-log'),
      title: 'Log time',
      say: 'Log time adds hours by hand, for crew without the app, or when someone forgot.',
    },
    {
      id: 'timesheet-window', selector: t('staff-timesheet-window'),
      title: 'How far back',
      say: 'Show the last seven, fourteen or thirty days.',
    },
    {
      id: 'timesheet-list', selector: t('staff-timesheet'), title: 'Hours by person', say: '',
      variants: [
        { when: t('staff-timesheet-list'), selector: t('staff-timesheet-list'), say: 'Each person’s hours, job by job. A visit that hasn’t ended yet says on site.' },
        { when: t('staff-timesheet-empty'), selector: t('staff-timesheet-empty'), say: 'No hours yet. Turn on auto clock in your shop rules, or use Log time to add them by hand.' },
      ],
    },
  ],
}
