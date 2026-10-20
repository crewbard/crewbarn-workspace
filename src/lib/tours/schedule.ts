import type { GuidedTour } from '@/lib/guidedTours'

/**
 * Help tours for the schedule / dispatch / field area (owner 04).
 * Steps target `data-tour` ids set on the pages themselves. The tour engine
 * skips any step whose target isn't on screen, so phone-only, desktop-only
 * and "only when there's data" parts are marked optional.
 */
export const SCHEDULE_TOURS: GuidedTour[] = [
  {
    id: 'schedule',
    title: 'The schedule',
    description: 'Put unscheduled jobs and estimate visits on a day, a time and a tech.',
    route: /^\/schedule\/?$/,
    roadmap: [
      { title: 'Work waits in To Schedule', detail: 'A job or estimate created without a date lands in the list on the left.' },
      { title: 'Drag it onto the calendar', detail: 'Drop it on a day, a time, or a tech’s lane in Day view. The page checks for overlaps, time off, a missing address, odd hours and tight drives first.' },
      { title: 'Adjust with a right-click', detail: 'Change the status, time or tech, convert an estimate, or cancel. Drag a card back to the left to unschedule it.' },
      { title: 'Watch it live on Dispatch', detail: 'Dispatch shows today’s work on a map, and the tech does the work in the field app.' },
    ],
    use: {
      say: 'Booked work shows on Dispatch on its day, where you can see who’s where and hand jobs to a tech. Time off approved on Time off is what blocks people here.',
      go: [{ label: 'Go to Dispatch', to: '/dispatch' }, { label: 'Open Time off', to: '/tool-shed/time-off' }],
    },
    steps: [
      {
        selector: '[data-tour="schedule-root"]',
        title: 'Your calendar',
        say: 'This is your calendar. On the left is work that still needs a date, and on the right is the calendar itself. You drag from left to right to book things.',
      },
      {
        selector: '[data-tour="schedule-queue"]',
        title: 'To Schedule',
        say: 'Everything that still needs a date lands here. Search it, filter it, sort or group it, then drag a row onto the calendar.',
        optional: 'On a phone this list opens from the Jobs button.',
      },
      {
        selector: '[data-tour="schedule-staff-off"]',
        title: 'Staff off',
        say: 'Approved time off for the dates on screen shows here, so you don’t book someone who’s away.',
        optional: 'Only shows when someone is off.',
      },
      {
        selector: '[data-tour="schedule-pending-estimates"]',
        title: 'Estimates waiting on the customer',
        say: 'Estimates you’ve sent that the customer hasn’t answered yet. Red means it expires within three days.',
        optional: 'Desktop sidebar.',
      },
      {
        selector: '[data-tour="schedule-views"]',
        title: 'Month, Week or Day',
        say: 'Pick Month, Week or Day, and step back and forward with the arrows. The page remembers the view you last used. M, W, D and T work as shortcuts.',
        optional: 'Desktop only.',
      },
      {
        selector: '[data-tour="schedule-filters"]',
        click: '[data-tour="schedule-filters-toggle"]',
        title: 'Narrow it down',
        say: 'Filter the calendar by customer here, and use the selects next to it to show one tech or one crew.',
      },
      {
        selector: '[data-tour="schedule-legends"]',
        click: '[data-tour="schedule-filters-toggle"]',
        title: 'Statuses and badges',
        say: 'Hover Statuses to hide a status for this visit. If you can edit settings, you can also change its colors there, and that saves for everyone. Card Badges explains the little flags on each card.',
      },
      {
        selector: '[data-tour="schedule-calendar"]',
        title: 'Drag, drop and right-click',
        say: 'Drag a card to change its time or day; in Day view, drag it into another tech’s lane to hand it over. Click a card for a quick look, or right-click it to change status, time or tech, or to convert an estimate into a job.',
        optional: 'Desktop only.',
      },
      {
        selector: '[data-tour="schedule-calendar"]',
        title: 'It checks before it saves',
        say: 'When you drop something, the page checks it first. If anything looks off, like an overlap or time off, it tells you and lets you decide. Ctrl or Cmd plus Z undoes the last move.',
        optional: 'Desktop only.',
      },
      {
        selector: '[data-tour="schedule-mobile-agenda"]',
        title: 'On a phone',
        say: 'On a phone you get a simple list for one day. Tap a visit to see it. Booking by drag-and-drop is done on a bigger screen.',
        optional: 'Phone only.',
      },
    ],
  },
  {
    id: 'dispatch',
    title: 'Dispatch',
    description: 'Today’s live board: who’s where, who’s busy, and which jobs still need a tech.',
    route: /^\/dispatch\/?$/,
    roadmap: [
      { title: 'Requests come in', detail: 'Portal customers and marketplace requesters send work, which shows in the panels over the map.' },
      { title: 'Jobs get a date', detail: 'Work is booked on Schedule, and today’s jobs show up here.' },
      { title: 'Put a tech on each job', detail: 'Use Suggest a tech for one job, or lasso several on the map and assign them together.' },
      { title: 'Check the loose ends', detail: 'Field review lists visits with problems, and Route history shows where a tech actually drove.' },
    ],
    use: {
      say: 'To book work for another day, drag it onto the calendar on Schedule. The techs on the map come from GPS Devices, and the territory select from Territories.',
      go: [{ label: 'Go to Schedule', to: '/schedule' }, { label: 'Open GPS Devices', to: '/tool-shed/gps' }, { label: 'Open Territories', to: '/tool-shed/territories' }],
    },
    steps: [
      {
        selector: '[data-tour="dispatch-root"]',
        title: 'Today at a glance',
        say: 'This is today at a glance. People and jobs are on the left, the live map is on the right.',
      },
      {
        selector: '[data-tour="dispatch-mobile-toggle"]',
        title: 'Roster or map',
        say: 'On a phone, flip between the list and the map. Tapping a tech jumps you to the map.',
        optional: 'Phone only.',
      },
      {
        selector: '[data-tour="dispatch-header"]',
        title: 'Date, links and territory',
        say: 'Today’s date and job count. Routes and Field review take you to the two side pages, and if you use territories you can pick one here.',
        links: [
          { label: 'Field review', url: '/dispatch/field-review' },
          { label: 'Route history', url: '/dispatch/route-history' },
        ],
      },
      {
        selector: '[data-tour="dispatch-roster"]',
        click: '[data-tour="dispatch-rail-crew"]',
        title: 'Technicians',
        say: 'The dot tells you how busy someone is. The text tells you how fresh their location is. Click a name to find them on the map, or right-click to ping their phone.',
      },
      {
        selector: '[data-tour="dispatch-unassigned"]',
        click: '[data-tour="dispatch-rail-queue"]',
        title: 'Unassigned today',
        say: 'Today’s jobs that still need a tech. Click Suggest a tech and we’ll rank who’s closest and free.',
      },
      {
        selector: '[data-tour="dispatch-subs"]',
        click: '[data-tour="dispatch-rail-subs"]',
        title: 'Sent to subs',
        say: 'Work another company is doing for you today, grouped by company.',
        optional: 'Only shows when work was sent to a sub.',
      },
      {
        selector: '[data-tour="dispatch-needs-scheduling"]',
        click: '[data-tour="dispatch-rail-queue"]',
        title: 'Needs scheduling',
        say: 'Open jobs and estimates with no date at all. They’d go missing otherwise, so they’re listed here with a link to book them.',
        optional: 'Only shows when something has no date.',
      },
      {
        selector: '[data-tour="dispatch-map"]',
        title: 'The live map',
        say: 'Pins are jobs colored by status. The round photos are your techs. A red warning means someone’s likely to be late.',
      },
      {
        selector: '[data-tour="dispatch-map-range"]',
        title: 'Day, week, month or year',
        say: 'Choose which jobs are pinned, counting from today. Weeks run Monday to Sunday, like the Schedule. The roster on the left always stays on today.',
      },
      {
        selector: '[data-tour="dispatch-layers"]',
        title: 'Map layers',
        say: 'Turn techs, jobs, routes and traffic on or off. This browser remembers your choice.',
      },
      {
        selector: '[data-tour="dispatch-lasso"]',
        title: 'Lasso assign',
        say: 'Click this, then click two corners on the map. Every job and estimate visit inside the box is selected, and you can assign them all to one tech. If any can’t be assigned, we tell you which and keep them selected.',
      },
      {
        selector: '[data-tour="dispatch-incoming"]',
        title: 'New requests',
        say: 'New work from your customers and the marketplace shows here. Accept it, quote it, or pass.',
        optional: 'Only shows when requests are waiting.',
      },
    ],
  },
  {
    id: 'dispatch-field-review',
    title: 'Field review',
    description: 'Visits with loose ends and scheduled jobs nobody checked into.',
    route: /^\/dispatch\/field-review\/?$/,
    roadmap: [
      { title: 'Techs check in', detail: 'By hand in the field app, or automatically by GPS when auto check-in is on.' },
      { title: 'Things get missed', detail: 'Visits are left open, phones lose GPS, jobs run long, or nobody shows up.' },
      { title: 'Review them here', detail: 'Scan both lists and open each job to sort it out. Nothing is changed from this page.' },
      { title: 'Tune the thresholds', detail: 'Shop Rules sets how long a visit can stay open and the grace period for a missed check-in.' },
    ],
    use: {
      say: 'Fixes are made on the job itself. How long a visit can stay open and the grace for a missed check-in are set in Shop Rules, under GPS check-in.',
      go: [{ label: 'Go to Jobs', to: '/jobs' }, { label: 'Open GPS check-in rules', to: '/tool-shed/preferences#gps' }],
    },
    steps: [
      {
        selector: '[data-tour="field-review-header"]',
        title: 'Loose ends',
        say: 'This is the to-do list for visits with loose ends. It refreshes every minute.',
      },
      {
        selector: '[data-tour="field-review-cards"]',
        title: 'Choose what to review',
        say: 'Pick everything, just open visits, or just missed arrivals.',
        optional: 'Easy theme only.',
      },
      {
        selector: '[data-tour="field-review-dates"]',
        title: 'Missed check-in dates',
        say: 'Pick dates for the missed check-ins. Open visits always show, whatever the dates. Blank means the last seven days.',
      },
      {
        selector: '[data-tour="field-review-visits"]',
        title: 'Needs review',
        say: 'Open visits with a problem. The tag says what’s wrong. Click a row to open the job and fix it there.',
      },
      {
        selector: '[data-tour="field-review-missed"]',
        title: 'Missed check-ins',
        say: 'Scheduled jobs nobody checked into. Open the job to find out what happened.',
      },
    ],
  },
  {
    id: 'dispatch-route-history',
    title: 'Route history',
    description: 'Where a tech actually drove, day by day, with a replay for any single day.',
    route: /^\/dispatch\/route-history\/?$/,
    roadmap: [
      { title: 'Devices send GPS', detail: 'Phones and trackers report their position. Set them up on GPS Devices.' },
      { title: 'Days are rolled up nightly', detail: 'Each day becomes a route with stops and miles, ready the morning after.' },
      { title: 'Compare or replay', detail: 'Pick a person and a week to compare days, or replay one day hour by hour, including today.' },
    ],
    use: {
      say: 'The trail comes from the phones and trackers on GPS Devices. For where your techs are right now, use the live map on Dispatch.',
      go: [{ label: 'Open GPS Devices', to: '/tool-shed/gps' }, { label: 'Go to Dispatch', to: '/dispatch' }],
    },
    steps: [
      {
        selector: '[data-tour="route-history-header"]',
        title: 'Where each tech drove',
        say: 'Where each tech drove. A day shows up the morning after it ends. Use Replay to see today.',
      },
      {
        selector: '[data-tour="route-history-pickers"]',
        title: 'Person and week',
        say: 'Pick the person and step through the weeks. Weeks run Monday to Sunday.',
      },
      {
        selector: '[data-tour="route-history-replay"]',
        title: 'Replay a day',
        say: 'Play back one day like a video. It uses the raw GPS points, so today works too. Narrow it to a few hours if you like.',
      },
      {
        selector: '[data-tour="route-history-map"]',
        title: 'The week on a map',
        say: 'Each weekday gets its own color. Click a numbered stop to see when they arrived, how long they stayed, and which job it was.',
      },
      {
        selector: '[data-tour="route-history-table"]',
        title: 'Day by day',
        say: 'Miles, top speed, first and last fix, and stops for each day. Untick a day to hide it from the map.',
      },
    ],
  },
  {
    id: 'gps-devices',
    title: 'GPS tracking devices',
    description: 'The phones and trackers that feed the dispatch map.',
    route: /^\/tool-shed\/gps\/?$/,
    roadmap: [
      { title: 'Phones register themselves', detail: 'A tech’s phone shows up here when they clock in in the app. Hardware is added by hand.' },
      { title: 'Hardware needs a token', detail: 'A hardware feed, such as a Traccar server, reports in with an ingest token from this page.' },
      { title: 'Positions go live', detail: 'Locations show on Dispatch and roll up into Route history.' },
    ],
    use: {
      say: 'Active devices put your techs on the live map on Dispatch and build each day’s trail in Route history. Auto check-in by GPS is switched on in Shop Rules, under GPS check-in.',
      go: [{ label: 'Go to Dispatch', to: '/dispatch' }, { label: 'Open Route history', to: '/dispatch/route-history' }, { label: 'Open GPS check-in rules', to: '/tool-shed/preferences#gps' }],
    },
    steps: [
      {
        selector: '[data-tour="gps-header"]',
        title: 'Your devices',
        say: 'Every device that tells us where a van or phone is. If you can’t edit, a note here says so.',
      },
      {
        selector: '[data-tour="gps-devices"]',
        title: 'Device list',
        say: 'Each card shows what it is, who carries it, and when we last heard from it. Flip the switch to take one off the map, or use Test to see its last position.',
      },
      {
        selector: '[data-tour="gps-add"]',
        title: 'Add a tracker',
        say: 'Add a hardware tracker here: pick the provider and the kind of device, give it a label, and assign it to a tech.',
        optional: 'Only for people who can edit.',
      },
      { selector: '[data-tour="gps-form-provider"]', title: 'GPS provider', say: 'Who makes or runs the tracker: One Step GPS, HyperTrack, or Other.', optional: 'Only for people who can edit.', click: '[data-tour="gps-add"]' },
      { selector: '[data-tour="gps-form-source"]', title: 'Data source', say: 'The kind of device: a plug-in OBD-II dongle, a hardwired tracker, an asset tracker, or manual entry.', optional: 'Only for people who can edit.', click: '[data-tour="gps-add"]' },
      { selector: '[data-tour="gps-form-id"]', title: 'Device ID', say: 'The device’s own ID or serial number, from the provider.', optional: 'Only for people who can edit.', click: '[data-tour="gps-add"]' },
      { selector: '[data-tour="gps-form-label"]', title: 'Label', say: 'A name you’ll recognise on the map, like Van 3.', optional: 'Only for people who can edit.', click: '[data-tour="gps-add"]' },
      { selector: '[data-tour="gps-form-tech"]', title: 'Assign to a tech', say: 'Who carries it, so their position shows on the dispatch map.', optional: 'Only for people who can edit.', click: '[data-tour="gps-add"]' },
      { selector: '[data-tour="gps-form-active"]', title: 'Active', say: 'Off takes the device off the dispatch map and roster without deleting it.', optional: 'Only for people who can edit.', click: '[data-tour="gps-add"]' },
      {
        selector: '[data-tour="gps-ingest-tokens"]',
        title: 'Hardware GPS feeds',
        say: 'Hardware trackers need their own password, called a token. Phones don’t. Give it a name, choose the whole fleet or one device, and press Issue token. Copy it straight away, because you only see it once.',
      },
    ],
  },
  {
    id: 'territories',
    title: 'Territories',
    description: 'Group the ZIP codes you serve into areas and pick who dispatches each one.',
    route: /^\/tool-shed\/territories\/?$/,
    roadmap: [
      { title: 'Draw your areas', detail: 'Add a territory from a county, which loads its ZIP codes, or type ZIP codes in by hand.' },
      { title: 'Assign dispatchers', detail: 'Dispatch opens in their territory by default.' },
      { title: 'Filter the board', detail: 'On Dispatch, use the territory select to see one area.' },
    ],
    use: {
      say: 'On Dispatch, the territory select shows one area at a time. A customer can also be put in a territory on their Edit Info tab.',
      go: [{ label: 'Go to Dispatch', to: '/dispatch' }, { label: 'Go to Customers', to: '/customers' }],
    },
    steps: [
      {
        selector: '[data-tour="territories-header"]',
        title: 'Your service areas',
        say: 'Set up the areas you cover and who dispatches each one.',
      },
      {
        selector: '[data-tour="territories-add"]',
        title: 'Add a territory',
        say: 'Search for a county to load its ZIP codes, adjust the list, then pick the dispatchers.',
        optional: 'Only for people who can edit settings.',
      },
      {
        selector: '[data-tour="territories-list"]',
        title: 'Territory list',
        say: 'Each row shows the county, how many ZIP codes it covers, and who dispatches it. Edit or delete from the buttons on the right.',
      },
      { selector: '[data-tour="territory-form-county"]', title: 'County coverage', say: 'Start typing a county and pick it. All of its ZIP codes are added for you.', optional: 'Only for people who can edit', click: '[data-tour="territories-add"]' },
      { selector: '[data-tour="territory-form-name"]', title: 'Territory name', say: 'The name dispatchers see on the Dispatch board.', optional: 'Only for people who can edit', click: '[data-tour="territories-add"]' },
      { selector: '[data-tour="territory-form-zips"]', title: 'ZIP codes', say: 'Jobs at a service location with one of these ZIP codes belong to this territory. Add a ZIP by hand or remove any you don’t cover.', optional: 'Only for people who can edit', click: '[data-tour="territories-add"]' },
      { selector: '[data-tour="territory-form-dispatchers"]', title: 'Assigned dispatchers', say: 'Tick who dispatches this territory.', optional: 'Only for people who can edit', click: '[data-tour="territories-add"]' },
      { selector: '[data-tour="territory-form-flags"]', title: 'Primary and active', say: 'Primary marks your main territory. Untick Active to stop using it without deleting it. Press Save territory to keep it.', optional: 'Only for people who can edit', click: '[data-tour="territories-add"]' },
    ],
  },
  {
    id: 'franchises',
    title: 'Franchise dashboard',
    description: 'Your whole franchise network: totals, each franchise, and royalties.',
    route: /^\/franchises\/?$/,
    roadmap: [
      { title: 'Add a franchise', detail: 'It inherits your trade, and its owner gets an email invite.' },
      { title: 'Watch the network', detail: 'See sales, jobs and customers across every franchise, and set the royalty default.' },
      { title: 'Look inside', detail: 'Open a franchise to view it read-only, or request access to help with edits. The franchise approves it on Franchise access.' },
    ],
    steps: [
      {
        selector: '[data-tour="franchise-header"]',
        title: 'Your network',
        say: 'Your whole network at a glance.',
      },
      {
        selector: '[data-tour="franchise-add"]',
        title: 'Add franchise',
        say: 'Create a franchise and invite its owner. Its name is locked once created, and it uses your trade.',
        optional: 'Only for people who can manage franchises.',
      },
      {
        selector: '[data-tour="franchise-totals"]',
        title: 'Network totals',
        say: 'How many franchises are active, plus sales, jobs and customers across all of them.',
      },
      {
        selector: '[data-tour="franchise-list"]',
        title: 'Franchises',
        say: 'One row per franchise. Open lets you look around inside it, read-only. Request access asks the franchise to let you help with edits for a while.',
      },
      {
        selector: '[data-tour="franchise-royalties"]',
        title: 'Royalties',
        say: 'Set what franchises owe you. We calculate it, and you collect it outside CrewBarn.',
      },
    ],
  },
  {
    id: 'franchise-support',
    title: 'Franchise access',
    description: 'Decide if, and for how long, your franchisor can help inside your account.',
    route: /^\/franchise-support\/?$/,
    roadmap: [
      { title: 'Your franchisor asks', detail: 'They request support access from their franchise dashboard.' },
      { title: 'You decide', detail: 'Approve for 24 hours, 3 days or a week, or decline.' },
      { title: 'End it any time', detail: 'Everything they do is recorded in your audit log.' },
    ],
    use: {
      say: 'Everything your franchisor does while they have access is recorded in Audit Log, in Tool Shed.',
      go: [{ label: 'Open Audit Log', to: '/tool-shed/audit-log' }],
    },
    steps: [
      {
        selector: '[data-tour="franchise-access-header"]',
        title: 'You’re in control',
        say: 'You decide if and how long your franchisor can help inside your account. Everything they do is logged.',
      },
      {
        selector: '[data-tour="franchise-access-requests"]',
        title: 'Requests',
        say: 'Pending requests show here. Pick how long, then approve or decline each one.',
      },
      {
        selector: '[data-tour="franchise-access-active"]',
        title: 'Active access',
        say: 'Who has access right now and until when. End access now cuts it off straight away.',
      },
    ],
  },
  {
    id: 'time-off',
    title: 'Time off',
    description: 'Ask for time off, and for the office, approve or deny it.',
    route: /^\/(?:tool-shed\/time-off|my-time-off)\/?$/,
    roadmap: [
      { title: 'Someone asks', detail: 'A staff member asks here or in their portal, or the office asks for them.' },
      { title: 'The office decides', detail: 'Approve or deny with a note. Approving first checks for work they’re already booked on.' },
      { title: 'It blocks the schedule', detail: 'Approved time shows on Schedule and is checked when booking or assigning on Schedule and Dispatch.' },
    ],
    use: {
      say: 'Approved time off shows under Staff off on Schedule, and booking or assigning that person on Schedule or Dispatch warns you first.',
      go: [{ label: 'Go to Schedule', to: '/schedule' }, { label: 'Go to Dispatch', to: '/dispatch' }],
    },
    steps: [
      {
        selector: '[data-tour="time-off-header"]',
        title: 'Time off',
        say: 'Time off for the team, or just yours. Approved time blocks the schedule.',
      },
      {
        selector: '[data-tour="time-off-new"]',
        title: 'New request',
        say: 'Pick the type and the dates, all day or a few hours on one day, and add a reason if you like.',
      },
      {
        selector: '[data-tour="time-off-counts"]',
        title: 'By status',
        say: 'How many requests are pending, approved, denied or cancelled. Click one to filter, and click again to clear.',
      },
      {
        selector: '[data-tour="time-off-filters"]',
        title: 'Filter and search',
        say: 'Filter by status or search the names, reasons and notes.',
      },
      {
        selector: '[data-tour="time-off-list"]',
        title: 'Requests',
        say: 'Pending requests float to the top. If you approve time off, open one to approve or deny it with a note. You can cancel your own pending request.',
        optional: 'No requests yet',
      },
      { selector: '[data-tour="time-off-form-for"]', title: 'Who it’s for', say: 'Pick the person the time off is for.', optional: 'Only for people who manage the team’s time off', click: '[data-tour="time-off-new"]' },
      { selector: '[data-tour="time-off-form-type"]', title: 'Type', say: 'Vacation, sick, personal, unpaid, bereavement, jury duty or other.', optional: 'Opens the request form', click: '[data-tour="time-off-new"]' },
      { selector: '[data-tour="time-off-form-allday"]', title: 'All day', say: 'Ticked, it covers whole days. Untick it to take a few hours on one day.', optional: 'Opens the request form', click: '[data-tour="time-off-new"]' },
      { selector: '[data-tour="time-off-form-start"]', title: 'Start and end', say: 'The first and last day off.', optional: 'Opens the request form', click: '[data-tour="time-off-new"]' },
      { selector: '[data-tour="time-off-form-times"]', title: 'Hours', say: 'The start and end time, for part of a day.', optional: 'When All day is unticked', click: '[data-tour="time-off-new"]' },
      { selector: '[data-tour="time-off-form-reason"]', title: 'Reason', say: 'Optional. A short note for whoever approves it. Then send the request.', optional: 'Opens the request form', click: '[data-tour="time-off-new"]' },
    ],
  },
  {
    id: 'employee-home',
    title: 'Your portal',
    description: 'Your day, your tasks, your time off and your messages, in one small app.',
    route: /^\/me\/?$/,
    roadmap: [
      { title: 'Start with Today', detail: 'Things to deal with first, then today’s jobs.' },
      { title: 'Keep up', detail: 'Check the week, tick off tasks, ask for time off and message the office.' },
      { title: 'Do the work in the field app', detail: 'Clocking in, photos and closing out happen in the field app on site.' },
    ],
    steps: [
      {
        selector: '[data-tour="me-nav"]',
        title: 'Your own space',
        say: 'This is your own space. Your day, your schedule, your tasks, your time off, your messages and your profile.',
        optional: 'Wider screens.',
      },
      {
        selector: '[data-tour="me-tabbar"]',
        title: 'Your own space',
        say: 'This is your own space. Use the tabs at the bottom to move between your day, schedule, tasks, time off, messages and profile.',
        optional: 'Phone only.',
      },
      {
        selector: '[data-tour="me-nags"]',
        title: 'Deal with these first',
        say: 'Anything you need to deal with is at the top. Red is urgent.',
        optional: 'Only shows when something needs you.',
      },
      {
        selector: '[data-tour="me-today-jobs"]',
        title: 'Today',
        say: 'Today’s jobs, in time order. Finished ones fade out.',
      },
      {
        selector: '[data-tour="me-tiles"]',
        title: 'Tasks and the week',
        say: 'How many tasks are open and how many jobs are coming up this week. Tap either one to see the list.',
      },
      {
        selector: '[data-tour="me-today-time-off"]',
        title: 'Your time off',
        say: 'Requests waiting on the office, approved time coming up, and anything decided recently, including a denial.',
        optional: 'Only shows when you have time-off requests.',
      },
    ],
  },
]
