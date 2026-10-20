import type { TutorialData } from './types'

/**
 * Scheduling and dispatching, start to finish: the Schedule page, Dispatch,
 * Field review, Route history, and how the field moves jobs along.
 *
 * Kept import-free (types aside) so the voice exporter can load it on its
 * own. The walk-through never books, moves, assigns, accepts or quotes
 * anything: it opens panels to look and explains the buttons that would.
 */

const t = (id: string) => `[data-tour=${JSON.stringify(id)}]`

const SCHED = '^/schedule/?$'
const DISP = '^/dispatch/?$'
/** The Focus look (<html data-theme="focus">), for words that differ there. */
const FOCUS = 'html[data-theme="focus"]'
// The Focus look shows one list at a time beside the Dispatch map: these press its Crew / To assign / Subs button first.
const RAIL = (key: string) => t(`dispatch-rail-${key}`)
// In the Focus look the Schedule's filters fold away behind a Filters button: these open it first.
const FILTERS = t('schedule-filters-toggle')
const FIELD = '^/dispatch/field-review/?$'
const ROUTES = '^/dispatch/route-history/?$'
const STAGES = '^/tool-shed/job-statuses/?$'
const REMINDERS = '^/tool-shed/automations/reminders/?$'
const PREFS = '^/tool-shed/preferences/?$'

/** The X on the Suggest a tech window (the shared window frame has no marker of its own). */
const DIALOG_CLOSE = '[role="dialog"] [data-work-dialog-header] button[aria-label="Close"]'

export const TUTORIAL: TutorialData = {
  id: 'schedule',
  kicker: 'Schedule & Dispatch · tutorial',
  title: 'Scheduling and dispatch, start to finish',
  film: [
    {
      id: 'path',
      label: 'The trip',
      title: 'Every job takes the same trip',
      narration:
        'Welcome to scheduling and dispatch. Every job takes the same trip. It waits for a date, lands on the calendar, gets a tech, and then the field moves it along until it’s done.',
    },
    {
      id: 'queue',
      label: 'To Schedule',
      title: 'Work without a date waits here',
      narration:
        'Work that doesn’t have a date yet waits in To Schedule, on the left of the Schedule page. Search it, narrow it to emergencies or jobs with no tech, and sort it however you like.',
    },
    {
      id: 'drop',
      label: 'Drag to book',
      title: 'Drag it onto the calendar',
      narration:
        'To book a job, drag it onto the calendar. A label shows exactly where it’ll land. If it has no tech yet, CrewBarn asks who’s taking it, and the job moves to Scheduled on its own.',
    },
    {
      id: 'checks',
      label: 'Checks',
      title: 'It checks before it books',
      narration:
        'Before anything is booked, CrewBarn checks it: another job at the same time, approved time off, a missing address, odd hours, or a drive that’s too tight. You see the list, and you decide.',
    },
    {
      id: 'lanes',
      label: 'Tech lanes',
      title: 'One lane per tech',
      narration:
        'Day view gives each tech a lane of their own. Drag a job into someone’s lane to hand it over. Green means the spot is open. Red means it clashes with another job.',
    },
    {
      id: 'dispatch',
      label: 'Dispatch',
      title: 'Dispatch is today, live',
      narration:
        'Dispatch is today, live. Your techs on a map, today’s jobs as dots, and a list of jobs still waiting for someone. Suggest a tech ranks who’s free and who’s closest.',
    },
    {
      id: 'field',
      label: 'The field',
      title: 'Then the field moves it along',
      narration:
        'Then the field takes over. When a tech starts travel, the job moves to On the way, and the customer can get a text. Checking in moves it to On site. If a tech may be late, they hear it first, with a pop-up and a phone call, before the office is told. Anything left hanging shows up in Field review.',
    },
    {
      id: 'yourturn',
      label: 'Your turn',
      title: 'Now let’s do it for real',
      narration:
        'That’s the idea. Now let’s look at the real pages. I’ll step back into the corner and point at each part. When it’s your turn, you click. Nothing gets booked or moved. If you’d rather watch, press Do it for me.',
    },
  ],
  chapters: [
    { key: 'page', label: 'The Schedule page' },
    { key: 'queue', label: 'To Schedule' },
    { key: 'book', label: 'Book a job' },
    { key: 'move', label: 'Move and change it' },
    { key: 'lanes', label: 'Techs, lanes and days' },
    { key: 'board', label: 'The Dispatch board' },
    { key: 'map', label: 'The map and requests' },
    { key: 'field', label: 'Field review and routes' },
    { key: 'connect', label: 'How it all connects' },
  ],
  steps: [
    // ---------- The Schedule page ----------
    {
      id: 'page-intro', chapter: 'page', route: SCHED, open: 'goto:/schedule',
      click: t('schedule-view-week'), selector: t('schedule-root'),
      title: 'The Schedule',
      say: 'This is the Schedule. On the left is work that still needs a date. On the right is the calendar. Booking a job is mostly dragging from left to right.',
    },
    {
      id: 'page-late', chapter: 'page', route: SCHED, selector: t('schedule-late-risks'),
      title: 'A tech may be late',
      say: 'When a tech may be late, the job shows up here and the Schedule button flashes. The tech has already had a pop-up and a call. Call customer rings the customer with your call script, where you allow it, and Got it stops the flashing.',
    },
    {
      id: 'page-phone', chapter: 'page', route: SCHED, selector: t('schedule-mobile-agenda'),
      title: 'On a phone',
      say: 'On a phone, you get a simple list for one day, with arrows to move between days. Tap a visit to see it. Dragging jobs onto the calendar is done on a bigger screen.',
    },
    {
      id: 'page-views', chapter: 'page', route: SCHED, selector: t('schedule-views'),
      title: 'Month, Week, Day',
      say: 'Month, Week and Day show the same jobs at different sizes. The page remembers the one you used last. On a keyboard, M, W and D switch views too.',
    },
    {
      id: 'page-nav', chapter: 'page', route: SCHED, selector: t('schedule-nav'),
      title: 'Back, Today, forward',
      say: 'The arrows step back and forward a month, a week or a day. Today brings you back to today, and so does the T key.',
    },
    {
      id: 'page-zoom', chapter: 'page', route: SCHED, selector: t('schedule-zoom'),
      title: 'Zoom',
      say: 'These make the calendar taller or shorter, so a busy day is easier to read. The number in the middle resets it to 100 percent. Plus, minus and zero on the keyboard do the same.',
    },
    {
      id: 'page-density', chapter: 'page', route: SCHED, selector: t('schedule-density'),
      title: 'How much each card shows',
      say: 'Compact, Standard and Detailed change how much each card shows. Detailed adds the stage and the job type when the card is tall enough.',
    },
    {
      id: 'page-filters', chapter: 'page', route: SCHED, when: FOCUS, selector: FILTERS,
      title: 'Filters',
      say: 'In the Focus look, the filters fold away behind Filters, so the calendar has more room. The number on it says how many filters are on.',
    },
    {
      id: 'page-customer', click: FILTERS, chapter: 'page', route: SCHED, selector: t('schedule-filters'),
      title: 'Find a customer',
      say: 'Type a name here to show only that customer’s jobs.',
    },
    {
      id: 'page-tech', click: FILTERS, chapter: 'page', route: SCHED, selector: t('schedule-tech-filter'),
      title: 'One tech',
      say: 'All techs narrows the calendar to one person’s jobs.',
    },
    {
      id: 'page-crew', click: FILTERS, chapter: 'page', route: SCHED, selector: t('schedule-crew-filter'),
      title: 'One crew',
      say: 'All crews does the same for a crew. It only shows up once you have crews set up.',
    },
    {
      id: 'page-subs', click: FILTERS, chapter: 'page', route: SCHED, selector: t('schedule-sub-filter'),
      title: 'Your jobs or sent to subs',
      say: 'When some of your jobs are done by other companies, this shows all jobs, just your own, or just the ones sent to subs.',
    },
    {
      id: 'page-legends', click: FILTERS, chapter: 'page', route: SCHED, selector: t('schedule-legends'),
      title: 'Statuses and Card Badges',
      say: 'Rest your mouse on Statuses to see every job stage and its color. Click one to hide it from the calendar for now. If you can change settings, you can set its outline and fill colors there too, and that changes it for everyone. Card Badges explains the little flags, like on site, payment due, or signature needed.',
    },
    {
      id: 'page-refresh', chapter: 'page', route: SCHED, selector: t('schedule-refresh'),
      title: 'Always up to date',
      say: 'This counts the jobs on screen. The calendar refreshes itself every few seconds, so a job someone else books just shows up.',
    },

    // ---------- To Schedule ----------
    {
      id: 'queue-intro', chapter: 'queue', route: SCHED, open: 'goto:/schedule', selector: t('schedule-queue'),
      title: 'To Schedule',
      say: 'To Schedule holds every job and estimate visit that doesn’t have a date yet. New work lands here when it’s made without a time.',
    },
    {
      id: 'queue-search', chapter: 'queue', route: SCHED, selector: t('schedule-queue-search'),
      title: 'Search',
      say: 'Search the list by customer name or address.',
    },
    {
      id: 'queue-chips', chapter: 'queue', route: SCHED, selector: t('schedule-queue-chips'),
      title: 'Narrow it down',
      say: 'These narrow the list: Emergency, Today, Estimates, No tech, and Needs approval. All shows everything again.',
    },
    {
      id: 'queue-sort', chapter: 'queue', route: SCHED, selector: t('schedule-queue-sort'),
      title: 'Sort and group',
      say: 'Sort by priority, oldest, newest, customer or type, and group the list by priority, type or customer. The number tells you how many are waiting.',
    },
    {
      id: 'queue-row', chapter: 'queue', route: SCHED, selector: t('schedule-queue-row'),
      wait: { appear: t('schedule-detail') }, doIt: t('schedule-queue-row'),
      yourTurn: 'Click a job in the list.',
      title: 'Take a look',
      say: 'Each row shows the customer, the job, and the address. Click one to take a look. Looking doesn’t change anything.',
    },
    {
      id: 'queue-detail', chapter: 'queue', route: SCHED, selector: t('schedule-detail'),
      title: 'Job detail',
      say: 'Here’s the job at a glance: the customer, a small map of the address, its stage, any flags, the tech, and the title.',
    },
    {
      id: 'queue-detail-open', chapter: 'queue', route: SCHED, selector: t('schedule-detail-open'),
      title: 'Open the job',
      say: 'Open job takes you to the full job page, or Open estimate on an estimate visit. You can set the date and the tech by hand there too.',
    },
    {
      id: 'queue-detail-close', chapter: 'queue', route: SCHED, selector: t('schedule-detail-close'),
      wait: { gone: t('schedule-detail') }, doIt: t('schedule-detail-close'),
      yourTurn: 'Close the job detail.',
      title: 'Close it',
      say: 'Close it with the X, or press Escape.',
    },
    {
      id: 'queue-staff-off', chapter: 'queue', route: SCHED, selector: t('schedule-staff-off'),
      title: 'Staff off',
      say: 'Staff off lists approved time off for the dates on screen, so you don’t book someone who’s away.',
    },
    {
      id: 'queue-pending', chapter: 'queue', route: SCHED, selector: t('schedule-pending-estimates'),
      title: 'Pending approval',
      say: 'Pending approval lists estimates you’ve sent that the customer hasn’t answered yet. The date turns red when one expires within three days. Click one to open it.',
    },

    // ---------- Book a job ----------
    {
      id: 'book-week', chapter: 'book', route: SCHED, open: 'goto:/schedule',
      click: t('schedule-view-week'), selector: t('schedule-calendar'),
      title: 'Week view',
      say: 'Week view shows seven days side by side, with the hours down the left. This is where most booking happens.',
    },
    {
      id: 'book-now', chapter: 'book', route: SCHED, selector: t('schedule-now-line'),
      title: 'Now',
      say: 'The red Now line marks the time right now, on today’s column.',
    },
    {
      id: 'book-drag', chapter: 'book', route: SCHED, selector: t('schedule-queue'),
      title: 'Drag a job over',
      say: 'To book a job, grab a row in To Schedule and drag it onto a day, at the time you want. A yellow label follows you and says exactly where it’ll land, like Drop here, May 12, 10 AM. We won’t drop one today.',
    },
    {
      id: 'book-length', chapter: 'book', route: SCHED, selector: t('schedule-calendar'),
      title: 'How long it takes',
      say: 'The job keeps the length it was given when it was made. If it doesn’t have one, it gets an hour. In Month view there are no hours, so a job dropped on a day starts at 9 AM.',
    },
    {
      id: 'book-tech', chapter: 'book', route: SCHED, selector: t('schedule-calendar'),
      title: 'Assign a tech?',
      say: 'If the job has no tech yet, a small window asks, Assign a tech? Pick someone, or press Keep unassigned to book it without one. Cancel leaves it where it was.',
    },
    {
      id: 'book-checks', chapter: 'book', route: SCHED, selector: t('schedule-calendar'),
      title: 'It checks first',
      say: 'Before it books, CrewBarn checks a few things: another job for that tech at the same time, approved time off, a missing address, a time outside 7 AM to 7 PM, and a drive that looks too tight to make. If anything’s off, it lists it and asks if you want to schedule anyway.',
    },
    {
      id: 'book-stage', chapter: 'book', route: SCHED, selector: t('schedule-queue'),
      title: 'Scheduled, by itself',
      say: 'Once it lands, the job moves to your Scheduled stage on its own, and it leaves the To Schedule list.',
    },

    // ---------- Move and change it ----------
    {
      id: 'move-card', chapter: 'move', route: SCHED, open: 'goto:/schedule',
      click: t('schedule-view-week'), selector: t('schedule-event'),
      wait: { appear: t('schedule-detail') }, doIt: t('schedule-event'),
      yourTurn: 'Click a job on the calendar.',
      title: 'A booked job',
      say: 'Each card is a booked job, colored by its stage. A red border means it’s late: its start time has passed and nobody’s started it. Estimate visits have a dashed border and an EST tag. Click a card to look.',
    },
    {
      id: 'move-detail', chapter: 'move', route: SCHED, selector: t('schedule-detail-close'),
      wait: { gone: t('schedule-detail') }, doIt: t('schedule-detail-close'),
      yourTurn: 'Close the job detail.',
      title: 'The same quick look',
      say: 'It’s the same quick look as before, now with its scheduled time. Close it when you’re done.',
    },
    {
      id: 'move-hover', chapter: 'move', route: SCHED, selector: t('schedule-event'),
      title: 'Hover for more',
      say: 'Rest your mouse on a card for a moment, and a preview pops up with the time, the tech, and every flag on the job.',
    },
    {
      id: 'move-drag', chapter: 'move', route: SCHED, selector: t('schedule-event'),
      title: 'Drag to move',
      say: 'To move a job, drag its card to another time or another day. The same checks run before it moves, and the job keeps its tech.',
    },
    {
      id: 'move-rightclick', chapter: 'move', route: SCHED, selector: t('schedule-event'),
      title: 'Right-click',
      say: 'Right-click a card for more. Open detail. Change time, to type an exact start and end. Change status. Reassign tech. And Cancel job, which asks first. On an estimate visit, Convert to job is there too.',
    },
    {
      id: 'move-unschedule', chapter: 'move', route: SCHED, selector: t('schedule-queue'),
      title: 'Take it off the calendar',
      say: 'Plans changed? Drag a card back over To Schedule. It comes off the calendar and moves to your Needs Scheduling stage, ready to book again.',
    },
    {
      id: 'move-undo', chapter: 'move', route: SCHED, selector: t('schedule-calendar'),
      title: 'Undo',
      say: 'Moved something by mistake? Ctrl Z, or Command Z on a Mac, puts the last move back.',
    },

    // ---------- Techs, lanes and days ----------
    {
      id: 'lanes-day', chapter: 'lanes', route: SCHED, open: 'goto:/schedule',
      click: t('schedule-view-day'), selector: t('schedule-calendar'),
      title: 'Day view',
      say: 'Day view gives every tech a column of their own, called a lane. It’s the best view for sharing out a day’s work.',
    },
    {
      id: 'lanes-tech', chapter: 'lanes', route: SCHED, selector: t('schedule-day-lane-tech'),
      title: 'A tech’s lane',
      say: 'The top of each lane shows the tech, how many jobs they have, their total hours, and their first and last times. Staff off shows here too when they’re away.',
    },
    {
      id: 'lanes-unassigned', chapter: 'lanes', route: SCHED, selector: t('schedule-day-lane-unassigned'),
      title: 'Unassigned',
      say: 'Unassigned is always the last lane. Jobs with no tech sit here, and it’s there even when it’s empty, so you have somewhere to drop work.',
    },
    {
      id: 'lanes-sub', chapter: 'lanes', route: SCHED, selector: t('schedule-day-lane-sub'),
      title: 'Sub company lanes',
      say: 'A company you’ve sent work to gets a lane too, marked Sub company. Their jobs only move in time. Sending a job to a sub is done on the job page, with Sub this out.',
    },
    {
      id: 'lanes-reassign', chapter: 'lanes', route: SCHED, selector: t('schedule-calendar'),
      title: 'Hand a job over',
      say: 'Drag a card into another tech’s lane to hand it over. While you drag, the spot turns green with Open if it’s free, or red with Conflict if it overlaps another job.',
    },
    {
      id: 'lanes-travel', chapter: 'lanes', route: SCHED, selector: t('schedule-calendar'),
      title: 'Tight drives',
      say: 'When two jobs in a lane are far apart with too little time between them, a Travel note shows the miles and the gap, so a hard drive is easy to spot.',
    },
    {
      id: 'lanes-month', chapter: 'lanes', route: SCHED,
      click: t('schedule-view-month'), selector: t('schedule-month-today'),
      wait: { appear: t('schedule-day-lane-unassigned') }, doIt: t('schedule-month-today'),
      yourTurn: 'Click today’s date.',
      title: 'Month view',
      say: 'Month view shows the whole month, and a busy day just grows taller. Click a date to jump straight to that day in Day view. Try today’s.',
    },
    {
      id: 'lanes-week', chapter: 'lanes', route: SCHED,
      click: t('schedule-view-week'), selector: t('schedule-views'),
      title: 'Back to Week',
      say: 'And Week brings you back. Whichever view you leave it on is the one you’ll see next time.',
    },

    // ---------- The Dispatch board ----------
    {
      id: 'board-intro', chapter: 'board', route: DISP, open: 'goto:/dispatch', selector: t('dispatch-root'),
      title: 'Dispatch',
      say: 'This is Dispatch: today, live. People and jobs are on the left, and a map is on the right.',
    },
    {
      id: 'board-phone', chapter: 'board', route: DISP, selector: t('dispatch-mobile-toggle'),
      title: 'Roster or map',
      say: 'On a phone, switch between the Roster and the Map up here.',
    },
    {
      id: 'board-header', chapter: 'board', route: DISP, selector: t('dispatch-header'),
      title: 'Today',
      say: 'Up top is today’s date and how many jobs are on today’s board.',
    },
    {
      id: 'board-territory', chapter: 'board', route: DISP, selector: t('dispatch-territory'),
      title: 'Territory',
      say: 'If you split your area into territories, pick one here to see just that part. Some people are set to see only their own.',
    },
    {
      id: 'board-roster', click: RAIL('crew'), chapter: 'board', route: DISP, selector: t('dispatch-roster'),
      title: 'Technicians',
      variants: [{ when: FOCUS, say: 'In the Focus look, the left side shows one list at a time: Crew, To assign and Subs. Crew lists your people. The dot shows how busy they are: gray is open, blue has jobs booked, green is on a job.' }],
      say: 'Technicians lists your people. The dot shows how busy they are: gray is open, blue has jobs booked, green is on a job. On the right is today’s job count, plus any estimate visits.',
    },
    {
      id: 'board-fresh', click: RAIL('crew'), chapter: 'board', route: DISP, selector: t('dispatch-tech-row'),
      title: 'Where they are',
      say: 'Beside that is how fresh their location is: Live, a few minutes ago, or No GPS. Open or Closed says whether the app was on screen. You’ll also see their speed when they’re driving, and a warning when the battery runs low.',
    },
    {
      id: 'board-find', chapter: 'board', route: DISP, selector: t('dispatch-tech-row'),
      wait: { click: true }, doIt: t('dispatch-tech-row'),
      yourTurn: 'Click a technician.',
      title: 'Find them on the map',
      say: 'Click a name to find them on the map. Give it a try.',
    },
    {
      id: 'board-ping', click: RAIL('crew'), chapter: 'board', route: DISP, selector: t('dispatch-roster'),
      title: 'Right-click a name',
      say: 'Right-click a name for two more things. Ping phone for fresh location asks their phone where it is right now. Route history shows where they’ve driven.',
    },
    {
      id: 'board-unassigned', click: RAIL('queue'), chapter: 'board', route: DISP, selector: t('dispatch-unassigned'),
      title: 'Unassigned today',
      say: 'Unassigned today lists today’s jobs that still have no tech. When everyone’s covered, it says so.',
    },
    {
      id: 'board-suggest-open', click: RAIL('queue'), chapter: 'board', route: DISP, selector: t('dispatch-suggest-open'),
      wait: { appear: t('dispatch-suggest') }, doIt: t('dispatch-suggest-open'),
      yourTurn: 'Click a job under Unassigned today.',
      title: 'Suggest a tech',
      say: 'Click a job to see who should take it. Looking won’t assign anyone.',
    },
    {
      id: 'board-suggest', chapter: 'board', selector: t('dispatch-suggest'),
      title: 'Ranked for you',
      say: 'Suggest a tech ranks your people for this job, best first. It looks at who’s free, who’s closest, and the real drive time when it can get it. If the job’s address isn’t on the map, it ranks by who’s free.',
    },
    {
      id: 'board-suggest-list', chapter: 'board', selector: t('dispatch-suggest-list'),
      title: 'Why each one',
      say: 'Each line says why: free now, or when they’re next free, how many minutes away they are, and how many jobs they have today. Current marks whoever has it now.',
    },
    {
      id: 'board-suggest-assign', chapter: 'board', selector: t('dispatch-suggest-assign'),
      title: 'Assign',
      say: 'Assign hands them the job. If they have approved time off that day, it asks you first. We’ll leave it this time.',
    },
    {
      id: 'board-suggest-job', chapter: 'board', selector: t('dispatch-suggest-job'),
      title: 'Open job',
      say: 'Open job takes you to the job itself.',
    },
    {
      id: 'board-suggest-close', chapter: 'board', selector: DIALOG_CLOSE,
      wait: { gone: t('dispatch-suggest') }, doIt: DIALOG_CLOSE,
      yourTurn: 'Close the window.',
      title: 'Close it',
      say: 'Close it without assigning anyone. Nothing changes.',
    },
    {
      id: 'board-assessment', click: RAIL('queue'), chapter: 'board', route: DISP, selector: t('dispatch-assessment'),
      title: 'Estimate visits',
      say: 'Estimate visits show up as Assessment. Their tech is set on the estimate, so these open the estimate instead.',
    },
    {
      id: 'board-subs', click: RAIL('subs'), chapter: 'board', route: DISP, selector: t('dispatch-subs'),
      title: 'Sent to subs',
      say: 'Sent to subs lists today’s work that other companies are doing for you, grouped by company, with their tech and how it’s going.',
    },
    {
      id: 'board-needs', click: RAIL('queue'), chapter: 'board', route: DISP, selector: t('dispatch-needs-scheduling'),
      title: 'Needs scheduling',
      say: 'Needs scheduling catches open jobs and estimates with no date at all, like a request you accepted from the portal. Click one to open it and book it.',
    },
    {
      id: 'board-unmappable', chapter: 'board', route: DISP, selector: t('dispatch-unmappable'),
      title: 'Not on the map',
      say: 'This counts jobs that can’t go on the map yet, because their address has no map spot saved.',
    },

    // ---------- The map and requests ----------
    {
      id: 'map-intro', chapter: 'map', route: DISP, open: 'goto:/dispatch', selector: t('dispatch-map'),
      title: 'The live map',
      say: 'The map shows jobs as dots in their stage color, and your techs as round photos, or initials, with their name underneath. It moves as their phones report in.',
    },
    {
      id: 'map-techs', chapter: 'map', route: DISP, selector: t('dispatch-map'),
      title: 'Reading a tech',
      say: 'A small number on a photo is how many open jobs they have. An arrow above means they’re driving that way. Hover a photo for their speed or Parked, their battery, and when it last updated. A faded photo means the location is old.',
    },
    {
      id: 'map-late', chapter: 'map', route: DISP, selector: t('dispatch-map'),
      title: 'Running late',
      say: 'If a tech probably can’t reach their next job on time, their name turns red and a red warning sits over that job. The tech hears it first, with a pop-up and an automated call, and then the Schedule page lists the job with Call customer and Got it. Click any job dot to see its customer, address, stage and tech.',
    },
    {
      id: 'map-range', chapter: 'map', route: DISP, selector: t('dispatch-map-range'),
      wait: { appear: `${t('dispatch-map-range-week')}[aria-pressed="true"]` }, doIt: t('dispatch-map-range-week'),
      yourTurn: 'Click Week.',
      title: 'Which jobs to show',
      say: 'These pick which jobs go on the map: today, this week, this month, or this year. The list on the left always stays on today. Click Week.',
    },
    {
      id: 'map-range-day', chapter: 'map', route: DISP, click: t('dispatch-map-range-day'), selector: t('dispatch-map-range'),
      title: 'Back to Day',
      say: 'Back to Day. On Day, each tech’s route for the rest of today is drawn as a colored line, from where they are, through their stops in order.',
    },
    {
      id: 'map-layers', chapter: 'map', route: DISP, selector: t('dispatch-layers'),
      title: 'Map layers',
      say: 'Map layers turns things on and off: Technicians, Jobs, Routes, and live Traffic. The key underneath explains the colors.',
    },
    {
      id: 'map-lasso', chapter: 'map', route: DISP, selector: t('dispatch-lasso'),
      title: 'Lasso assign',
      say: 'Lasso assign hands out several jobs at once. Click it, then click two corners on the map to draw a box around the jobs you want.',
    },
    {
      id: 'map-lasso-assign', chapter: 'map', route: DISP, selector: t('dispatch-lasso'),
      title: 'Assign them together',
      say: 'The jobs in the box are picked. Choose a tech under Assign to, then press Assign. Clear starts over. We’ll skip it today.',
    },
    {
      id: 'map-incoming', chapter: 'map', route: DISP, selector: t('dispatch-incoming'),
      title: 'Requests waiting',
      say: 'New requests that need an answer float over the map. The Dispatch link in the top bar shows a count whenever any are waiting.',
    },
    {
      id: 'map-portal', chapter: 'map', route: DISP, selector: t('dash-incoming-portal'),
      title: 'From the customer portal',
      say: 'Incoming requests come from customers in their portal. Each one shows the job, the customer, the address, and how urgent it is.',
    },
    {
      id: 'map-portal-actions', chapter: 'map', route: DISP, selector: t('dispatch-portal-actions'),
      title: 'Accept or decline',
      say: 'Accept and schedule takes the job and opens it, so you can give it a date and a tech. Decline lets you add a reason the customer will see. Open job just looks.',
    },
    {
      id: 'map-market', chapter: 'map', route: DISP, selector: t('dash-incoming-marketplace'),
      title: 'From the marketplace',
      say: 'Estimate requests come from the marketplace. Every CrewBarn company is on it, so people looking for your kind of work can ask you for a price.',
    },
    {
      id: 'map-market-actions', chapter: 'map', route: DISP, selector: t('dispatch-market-actions'),
      title: 'Answer it',
      say: 'Offer on-site estimate says you’ll come take a look. Quote a price sends a number, with how many days it’s good for. Pass turns it down. When you win one, You got it shows, with a button to go schedule it.',
    },

    // ---------- Field review and routes ----------
    {
      id: 'field-link', chapter: 'field', route: DISP, open: 'goto:/dispatch', selector: t('dispatch-link-field-review'),
      wait: { route: FIELD }, doIt: t('dispatch-link-field-review'),
      yourTurn: 'Click Field review.',
      title: 'Two more pages',
      say: 'Two more pages hang off Dispatch: Routes and Field review. Click Field review.',
    },
    {
      id: 'field-header', chapter: 'field', route: FIELD, open: 'goto:/dispatch/field-review', selector: t('field-review-header'),
      title: 'Field review',
      say: 'Field review is the office’s to-do list from the field: visits with a loose end, and booked jobs nobody checked into.',
    },
    {
      id: 'field-cards', chapter: 'field', route: FIELD, selector: t('field-review-cards'),
      title: 'What to review',
      say: 'Pick what to look at: everything, open visits, or missed arrivals.',
    },
    {
      id: 'field-visits', chapter: 'field', route: FIELD, selector: t('field-review-visits'),
      title: 'Needs review',
      say: 'Needs review lists open visits that need you. Left site means the tech left without checking out. GPS issue means they say they’re still working, but their location can’t confirm it. Past scheduled end and Open too long mean the visit has run on.',
    },
    {
      id: 'field-open', chapter: 'field', route: FIELD, selector: t('field-review-visits'),
      title: 'Sort it out on the job',
      say: 'Click a row to open the job and sort it out there. This list only shows things. It doesn’t approve work or make an invoice.',
    },
    {
      id: 'field-missed', chapter: 'field', route: FIELD, selector: t('field-review-missed'),
      title: 'Missed check-ins',
      say: 'Missed check-ins are booked jobs where nobody ever checked in, with the time they were booked for.',
    },
    {
      id: 'field-dates', chapter: 'field', route: FIELD, selector: t('field-review-dates'),
      title: 'Dates',
      say: 'The dates only change the missed check-ins. Left blank, it shows the last seven days. Open visits always show, whatever the dates.',
    },
    {
      id: 'routes-header', chapter: 'field', route: ROUTES, open: 'goto:/dispatch/route-history', selector: t('route-history-header'),
      title: 'Route history',
      say: 'Route history shows where each tech actually drove, day by day.',
    },
    {
      id: 'routes-pickers', chapter: 'field', route: ROUTES, selector: t('route-history-pickers'),
      title: 'Who and which week',
      say: 'Pick a person and a week. The arrows move a week at a time. Each day shows up the morning after it ends.',
    },
    {
      id: 'routes-map', chapter: 'field', route: ROUTES, selector: t('route-history-map'),
      title: 'Their week on a map',
      say: 'Each day is drawn in its own color, with numbered dots where they stopped. Click a dot to see when they got there, how long they stayed, and the job it matched.',
    },
    {
      id: 'routes-table', chapter: 'field', route: ROUTES, selector: t('route-history-table'),
      title: 'Day by day',
      say: 'The table has a row for each day: miles, top speed, first and last location, stops, and fixes. Untick a day to take it off the map.',
    },
    {
      id: 'routes-replay', chapter: 'field', route: ROUTES, selector: t('route-history-replay'),
      wait: { appear: t('route-history-replay-close') }, doIt: t('route-history-replay'),
      yourTurn: 'Click Replay a day.',
      title: 'Replay a day',
      say: 'Replay a day plays one day back like a video, and it works for today too. Click Replay a day.',
    },
    {
      id: 'routes-replay-when', chapter: 'field', route: ROUTES, selector: t('route-history-replay-when'),
      title: 'Pick the day and hours',
      say: 'Pick the day, and the hours you care about. It starts on today.',
    },
    {
      id: 'routes-replay-map', chapter: 'field', route: ROUTES, selector: t('route-history-replay-map'),
      title: 'Watch it',
      say: 'Their pin moves along the track, and that day’s jobs show as orange dots. Click one to open the job.',
    },
    {
      id: 'routes-replay-controls', chapter: 'field', route: ROUTES, selector: t('route-history-replay-controls'),
      title: 'Play and scrub',
      say: 'Play, pause, or drag the slider. Speed runs from 30 to 300 times real time, with the clock and their speed beside it.',
    },
    {
      id: 'routes-replay-close', chapter: 'field', route: ROUTES, selector: t('route-history-replay-close'),
      wait: { gone: t('route-history-replay-close') }, doIt: t('route-history-replay-close'),
      yourTurn: 'Close the replay.',
      title: 'Close it',
      say: 'Close the replay when you’re done.',
    },

    // ---------- How it all connects ----------
    {
      id: 'connect-intro', chapter: 'connect', route: SCHED, open: 'goto:/schedule',
      title: 'How it all connects',
      say: 'Last part. Here’s how the schedule ties into the rest of CrewBarn: job stages, customer reminders, and GPS check-in.',
    },
    {
      id: 'connect-stages', chapter: 'connect', route: STAGES, open: 'goto:/tool-shed/job-statuses',
      click: t('job-statuses-view-stages'), selector: t('job-statuses-board'),
      title: 'Stages move by themselves',
      say: 'In Job statuses, a stage can be tied to a button in the tech’s app, under Mobile field action: Start travel, Check in, or a check-out. When the tech presses it, the job moves to that stage by itself, and you see the new color on the calendar and the map.',
    },
    {
      id: 'connect-updates', chapter: 'connect', route: STAGES, selector: t('job-statuses-setup'),
      title: 'Tell the customer',
      say: 'Each stage can also email or text the customer when a job lands on it. That’s how an On the way message goes out when a tech starts driving.',
    },
    {
      id: 'connect-reminders', chapter: 'connect', route: REMINDERS, open: 'goto:/tool-shed/automations/reminders', selector: t('rem-timeline'),
      title: 'Appointment reminders',
      say: 'Reminders around a booked job live on this timeline. Customers can hear from you before the job, if it hasn’t started, and when the tech is on the way, measured by GPS. Techs can get reminders too, including one when GPS says they may be late.',
    },
    {
      id: 'connect-reminders-switch', chapter: 'connect', route: PREFS, open: 'goto:/tool-shed/preferences#reminders',
      selector: t('shop-rule-job_reminders_enabled'),
      title: 'The master switch',
      say: 'Nothing sends unless Enable appointment reminders is on, here in Shop rules. Quiet hours, just below, hold customer reminders overnight.',
    },
    {
      id: 'connect-gps', chapter: 'connect', route: PREFS, open: 'goto:/tool-shed/preferences#gps', selector: t('prefs-gps'),
      title: 'GPS check-in',
      say: 'GPS check-in uses the assigned tech’s location to make checking in and out easier, and to flag problems. Leaving a site never closes a job. It just raises the Left site flag you saw in Field review.',
    },
    {
      id: 'connect-gps-auto', chapter: 'connect', route: PREFS, selector: t('shop-rule-geofence_auto_checkin_enabled'),
      title: 'Auto check-in',
      say: 'Auto check-in checks a tech in when they’ve stayed at the job long enough, close to its start time. They can undo it. With strict mode off, a tech can still check in from farther away, with a note.',
    },
    {
      id: 'connect-gps-timing', chapter: 'connect', route: PREFS, selector: t('shop-rule-geofence-timing'),
      title: 'The timings',
      say: 'These set how long they have to stay, how early check-in can happen, when to remind a tech who left, when to alert you, and when to start watching for a late arrival.',
    },
    {
      id: 'connect-elsewhere', chapter: 'connect', route: DISP, open: 'goto:/dispatch',
      title: 'Where else it shows up',
      say: 'On a job’s own page, the Schedule card shows its date and time, and Lead tech shows who has it. The dashboard has a Dispatch tab with today’s board and the same Suggest a tech button.',
    },
    {
      id: 'connect-people', chapter: 'connect', route: DISP,
      title: 'People, devices and areas',
      say: 'Time off approved on the Time off page is what shows as Staff off and warns you before booking. Techs appear on the map from their phones, or from trackers in GPS Devices. Territories come from the Territories page.',
    },
    {
      id: 'connect-done', chapter: 'connect', route: DISP,
      title: 'That’s the lot',
      say: 'That’s scheduling and dispatch, from a job waiting for a date to the tech driving home. You can take this tutorial again any time from the button at the top of the page.',
    },
  ],
}
