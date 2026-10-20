import type { GuidedTour } from '@/lib/guidedTours'

/**
 * Tours for the app shell, the dashboard, Tasks and Bugs & Ideas.
 * Source of truth for the wording: docs/tours/01-home.md.
 *
 * Steps whose target is missing or hidden (another layout, a phone-only
 * button, a panel that is empty today) are skipped by the tour layer, so one
 * step can list the targets of several layouts.
 */
export const HOME_TOURS: GuidedTour[] = [
  {
    id: 'app-shell',
    title: 'Finding your way around',
    description: 'The frame around every page: the menu, Tool Shed, search, the + button, CBI, notifications, help and your account.',
    // Never matches a real page: this tour is started by id from Help.
    route: /^\/__shell$/,
    roadmap: [
      { title: 'Pick your layout', detail: 'Top bar, side bar, category rail or one of the Easy layouts. Your choice, saved in this browser.' },
      { title: 'Move around', detail: 'The main menu for daily work, Tool Shed for setup, the + button to start something new.' },
      { title: 'Find things fast', detail: 'Search (Ctrl or Cmd + K) for customers, jobs, estimates and catalogs; CBI for questions in plain words.' },
      { title: 'Stay on top of it', detail: 'Badges on the menu and the notification bell show what is waiting.' },
      { title: 'Get help', detail: 'The ? button opens CrewBarn Help, where every page tour starts.' },
    ],
    use: {
      say: 'To change your layout for good, open All layouts from your account menu. Setup for everything in the main menu lives in Tool Shed, and your password and photo are under My account.',
      go: [
        { label: 'Open All layouts', to: '/tool-shed/appearance' },
        { label: 'Open Tool Shed', to: '/tool-shed' },
        { label: 'My account', to: '/me/account' },
      ],
    },
    steps: [
      {
        selector: '[data-tour="shell-brand"]',
        title: 'Home base',
        say: 'This is home base. Click the CrewBarn name any time to jump back to your dashboard.',
      },
      {
        selector: '[data-tour="nav-dashboard"], [data-tour="sidebar-nav"], [data-tour="rail-categories"]',
        title: 'Your main menu',
        say: 'These are the places you use every day, like Jobs, Schedule, Dispatch and Customers. You only see the ones your role can open. A colored number means something is waiting for you there.',
      },
      {
        selector: '[data-tour="nav-tool-shed"]',
        title: 'Tool Shed',
        say: 'Tool Shed holds the setup: catalogs, inventory, your team, connections and shop rules. Hover or click to open it.',
        optional: 'Skip Tool Shed',
      },
      {
        selector: '[data-tour="subnav"]',
        title: 'Shortcuts for this area',
        say: 'On some pages a thin row of tabs sits under the header, with shortcuts for that area like New Job or the money workflows.',
        optional: 'Skip shortcuts',
      },
      {
        selector: '[data-tour="topbar-comms"]',
        title: 'Messages, Calls and Intake',
        say: 'Messages, Calls and Intake live on the right. A number on Calls or Intake means someone is waiting.',
        optional: 'Skip messages',
      },
      {
        selector: '[data-tour="topbar-search"]',
        title: 'Search',
        say: 'The magnifying glass finds a customer, job, estimate or catalog by name or number. Press Ctrl or Cmd plus K from anywhere.',
      },
      {
        selector: '[data-tour="topbar-create"]',
        title: 'Start something new',
        say: 'The orange plus starts a new job, task, estimate, service agreement, customer or asset. It only lists what you are allowed to create.',
      },
      {
        selector: '[data-tour="topbar-bell"]',
        title: 'Notifications',
        say: 'The bell is the office’s shared inbox for money events and customer alerts. Click one to go straight to it.',
        optional: 'Skip notifications',
      },
      {
        selector: '[data-tour="topbar-cbi"], [data-tour="ai-help"]',
        title: 'CBI, your AI helper',
        say: 'Ask CBI about jobs, customers, money or the schedule in plain words, and it pulls live numbers for you. If it wants to change something, you confirm first.',
        optional: 'Skip CBI',
      },
      {
        selector: '[data-tour="topbar-help"]',
        title: 'Help',
        say: 'Stuck? Press the question mark, or type ? anywhere. Help opens on the topic for the page you are on, and you can start that page’s tour from there.',
      },
      {
        selector: '[data-tour="user-menu"]',
        title: 'Your account menu',
        say: 'Your initials open your own menu: your account, your time off, Bugs and Ideas, Help, and the layout switcher.',
      },
      {
        selector: '[data-tour="mobile-menu"]',
        title: 'The full menu on small screens',
        say: 'On a phone or a narrow window, this button opens the whole menu as a drawer from the left.',
        optional: 'Skip',
      },
    ],
  },
  {
    id: 'dashboard',
    title: 'Your CrewBarn dashboard',
    description: 'Where you land after signing in: today’s numbers and to-do lists, the money, the crew board, and a board you build yourself.',
    route: /^\/$|^\/dashboard\/?$/,
    roadmap: [
      { title: 'Arrive', detail: 'CrewBarn opens here after you sign in. Four views across the top; the one you used last opens next time.' },
      { title: 'Today’s numbers', detail: 'Five tiles: jobs today, jobs with no date, unanswered calls, jobs ready to invoice, and new AI intake leads.' },
      { title: 'Today’s lists', detail: 'Sticky notes, the crew right now, new requests, late jobs, today’s schedule, quotes to price, the cleanup list and callers to ring back.' },
      { title: 'Cash Flow', detail: 'What you invoiced, collected and spent, what customers still owe, and your average job.' },
      { title: 'Dispatch', detail: 'Today’s crew board for dispatchers, or your own day for everyone else, plus jobs that still need a date.' },
      { title: 'Custom', detail: 'Your own board: add, move and remove blocks, pick the period and card size, or reset it.' },
    ],
    use: {
      say: 'A number here only opens a list; the work happens there. Jobs waiting for a date or running late are handled on Jobs and Schedule, and your crew’s day is on Dispatch.',
      go: [
        { label: 'Go to Jobs', to: '/jobs' },
        { label: 'Go to Schedule', to: '/schedule' },
        { label: 'Go to Dispatch', to: '/dispatch' },
      ],
    },
    steps: [
      // ── Arrive ──────────────────────────────────────────────────────
      {
        selector: '[data-tour="dash-welcome"]',
        title: 'Your home base',
        say: 'This is your dashboard, the page CrewBarn opens to after you sign in. It shows what is on today, what is stuck, how the money looks and where your crew is, and almost every number takes you straight to the page where you deal with it.',
      },
      {
        selector: '[data-tour="dash-tabs"]',
        title: 'Four views',
        say: 'Today’s Ops is the daily work, Cash Flow is the money, Dispatch is the crew, and Custom is a board you build. The view you used last opens next time on this computer. A red number on Today’s Ops adds up jobs with no date, finished jobs not yet invoiced, and jobs past their time.',
      },
      {
        selector: '[data-tour="dash-needs-you"]',
        click: '[data-tour="dash-tab-ops"]',
        title: 'Needs you',
        say: 'In the Easy layout these three cards come first: jobs waiting for a date, scheduled jobs past their time and still open, and finished jobs with no invoice. Each card opens that list; opening it doesn’t finish anything for you.',
        optional: 'Skip (Easy layout only)',
      },

      // ── Today’s Ops: the five tiles ────────────────────────────────
      {
        selector: '[data-tour="dash-stat-jobs-today"]',
        click: '[data-tour="dash-tab-ops"]',
        title: 'Jobs today',
        say: 'Every job on today’s calendar, not counting cancelled ones. Done counts jobs in a finished status, like complete, closed, invoiced or paid, and remaining is the rest. This tile is only a count; open jobs from Today’s schedule further down.',
      },
      {
        selector: '[data-tour="dash-stat-unscheduled"]',
        click: '[data-tour="dash-tab-ops"]',
        title: 'Unscheduled',
        say: 'Jobs that don’t have a date yet. The number turns red when any are waiting, and Schedule now opens the Schedule page so you can put them on the calendar.',
      },
      {
        selector: '[data-tour="dash-stat-calls"]',
        click: '[data-tour="dash-tab-ops"]',
        title: 'Unanswered calls',
        say: 'Phone conversations where the caller spoke last or something is still unread, so someone is waiting to hear back. Blue means people are waiting, and the line underneath counts numbers that don’t match a customer yet. Open calls goes to Calls, or to Messages if you can’t open Calls.',
      },
      {
        selector: '[data-tour="dash-stat-ready-to-invoice"]',
        click: '[data-tour="dash-tab-ops"]',
        title: 'Ready to invoice',
        say: 'Finished jobs that don’t have an invoice yet, with the dollar total waiting to be billed. Amber means there is billing to do, and Send invoices opens the Jobs list showing just those jobs.',
      },
      {
        selector: '[data-tour="dash-stat-intake"]',
        click: '[data-tour="dash-tab-ops"]',
        title: 'AI Intake',
        say: 'New leads that AI intake captured and is holding for someone to review. Purple means some are waiting, and Review queue opens the Intake page. It stays at zero if you can’t view customers.',
      },

      // ── Today’s Ops: panels and lists ──────────────────────────────
      {
        selector: '[data-tour="dash-customer-mix"]',
        click: '[data-tour="dash-tab-ops"]',
        title: 'New vs returning customers',
        say: 'How much of your work came from new customers and how much from people who came back. Pick day, week, month or year, or choose an earlier period from the list; each figure shows the period before underneath. A customer counts as new when their very first job falls in that period.',
        optional: 'Skip customer mix',
      },
      {
        selector: '[data-tour="dash-sticky-notes"]',
        click: '[data-tour="dash-tab-ops"]',
        title: 'Sticky notes',
        say: 'Notes for the team, like a whiteboard by the door. Use Add note, or right-click anywhere on this tab, then pick a color, how long it stays up, and whether everyone or only certain people see it. Done takes a note down for everyone, so it asks first.',
      },
      {
        selector: '[data-tour="dash-supervised"]',
        click: '[data-tour="dash-tab-ops"]',
        title: 'My supervised projects',
        say: 'If you look after jobs other people are doing, they are listed here, apart from your own work. Red counts the jobs with nobody going and the ones past due; click a job to open it. If you can see every job, this panel stays hidden.',
        optional: 'Skip supervised projects',
      },
      {
        selector: '[data-tour="dash-crew"]',
        click: '[data-tour="dash-tab-ops"]',
        title: 'Crew right now',
        say: 'Each field tech, what they are working on, when their location last updated, and what is next. Green is on site, blue is driving, amber is idle; red No ping means they have work today but their phone hasn’t reported in 15 minutes, and Tracker off means a vehicle tracker went quiet. Each row has Message, plus Open job, Track or Assign job.',
        optional: 'Skip crew',
      },
      {
        selector: '[data-tour="dash-incoming-portal"], [data-tour="dash-incoming-marketplace"]',
        click: '[data-tour="dash-tab-ops"]',
        title: 'New requests',
        say: 'Work customers asked for through your customer portal, and quote requests from the marketplace, wait here until you answer. Accept a portal request to open it as a job, or decline with a reason the customer sees. For a marketplace request, quote a price, offer an on-site estimate, or pass.',
        optional: 'Skip, no requests today',
      },
      {
        selector: '[data-tour="dash-spotlight"]',
        click: '[data-tour="dash-tab-ops"]',
        title: 'Dormant job spotlight',
        say: 'Jobs more than a minute past their arrival time that are still open, in progress or blocked, with how late each one is. Filter by status, then click a job to open it and move it along.',
        optional: 'Skip, nothing is late',
      },
      {
        selector: '[data-tour="dash-schedule"]',
        click: '[data-tour="dash-tab-ops"]',
        title: 'Today’s schedule',
        say: 'Today’s jobs in start-time order, each with its status color, with cancelled ones at the bottom; while a job is underway, a Next bar above shows the one after it. Clear done takes finished jobs off this list, and full view opens the Schedule. Click a job to open it.',
      },
      {
        selector: '[data-tour="dash-needs-quote"]',
        click: '[data-tour="dash-tab-ops"]',
        title: 'Waiting on a quote',
        say: 'When a tech records work that still needs a price, the visit waits here with how many items need pricing, and Critical or High flags the urgent ones. Quote the parts builds a draft estimate from what the tech logged and opens it for you to check and send. Watch for On a service plan: the visit itself is covered, so nothing else will remind you.',
      },
      {
        selector: '[data-tour="dash-attention"]',
        click: '[data-tour="dash-tab-ops"]',
        title: 'Needs attention',
        say: 'Your cleanup list. A line only appears when something needs it, and clicking a line opens that exact list; opening it doesn’t mark anything done. The dot shows how urgent it is: red is pressing, amber needs a look soon, blue is a heads-up.',
      },
      {
        selector: '[data-tour="dash-attention"]',
        click: '[data-tour="dash-tab-ops"]',
        title: 'What each line means',
        say: 'Scheduling: Unscheduled jobs, red at 5 or more; Past their time, scheduled jobs not started, red at 3 or more; and Time off needs approval if you manage staff. Jobs: Needs parts, Parts ordered, and No photos uploaded when a customer requires photos. Money: Ready to invoice, Payment not collected on jobs meant to be paid on site, Overdue invoices, and Estimates pending reply.',
      },
      {
        selector: '[data-tour="dash-calls"]',
        click: '[data-tour="dash-tab-ops"]',
        title: 'Callers to ring back',
        say: 'The people behind the Unanswered calls number, with the customer’s name or No customer match, and a blue dot when something is unread. Click any of them to go to Calls, or Messages if you can’t open Calls, and call them back.',
      },

      // ── Cash Flow ───────────────────────────────────────────────────
      {
        selector: '[data-tour="dash-cashflow-range"]',
        click: '[data-tour="dash-tab-cashflow"]',
        title: 'Cash Flow',
        say: 'Cash Flow is your money at a glance, read live from your invoices and payments. Day, Month, Quarter or Year sets the period for the money blocks; it starts on Month each time you open the tab.',
        optional: 'Skip Cash Flow',
      },
      {
        selector: '[data-tour="dash-cash-company-metrics"]',
        click: '[data-tour="dash-tab-cashflow"]',
        title: 'Company metrics',
        say: 'Headline numbers for the current period: money collected, money spent, and the net between them. Outstanding and Open invoices are what customers owe right now, and Accepted est. adds up your approved estimates. The right side shows your average job and money in versus out over recent periods.',
      },
      {
        selector: '[data-tour="dash-cash-revenue-gauge"]',
        click: '[data-tour="dash-tab-cashflow"]',
        title: 'Revenue',
        say: 'Of what you invoiced this period, how much has come in. The needle and blue arc fill as collections catch up, with Invoiced and Collected underneath and the total still owed on open invoices. Money opens Accounting.',
      },
      {
        selector: '[data-tour="dash-cash-avg-job-revenue"]',
        click: '[data-tour="dash-tab-cashflow"]',
        title: 'Average revenue per job',
        say: 'The average amount per completed job this period, with the number of jobs and the total behind it. The small chart shows money collected in each recent period, and Jobs opens your Jobs list.',
      },
      {
        selector: '[data-tour="dash-cash-money-flow"]',
        click: '[data-tour="dash-tab-cashflow"]',
        title: 'Money in / out',
        say: 'Invoiced is what you billed this period, In is what you were paid, and Out is what went to subcontractors and purchase orders. Net is In minus Out, green when you came out ahead and red when you didn’t. Switch the chart between bars and lines; Money opens Accounting.',
      },
      {
        selector: '[data-tour="dash-cash-receivables"]',
        click: '[data-tour="dash-tab-cashflow"]',
        title: 'Receivables',
        say: 'Everything customers owe on open invoices, and how many invoices that is. Aging sorts it by how late it is, from not due in green to 90 days or more in dark red; vs Collected compares what came due with what you collected; By term splits it by payment terms. Money opens Accounting.',
      },
      {
        selector: '[data-tour="dash-cash-cash-collected"]',
        click: '[data-tour="dash-tab-cashflow"]',
        title: 'Cash collected',
        say: 'Payments you received, stacked by the person who collected them or by payment method. The big number adds up every bar on the chart, so on Month it covers the last 12 months, not just this one. Cash drawer opens the page where you confirm money your crew turns in.',
      },
      {
        selector: '[data-tour="dash-cash-outstanding-balance"]',
        click: '[data-tour="dash-tab-cashflow"]',
        title: 'Outstanding balance',
        say: 'What is still owed on open invoices, split into current and overdue, with the overdue amount called out in red. It doesn’t change with Day, Month, Quarter or Year. Money opens Accounting.',
      },

      // ── Dispatch ────────────────────────────────────────────────────
      {
        selector: '[data-tour="dash-dispatch-board"]',
        click: '[data-tour="dash-tab-dispatch"]',
        title: 'Today’s crew board',
        say: 'Owners, admins and dispatchers see one row per tech with work today, on a 7 am to 7 pm timeline. Green blocks are done, amber blocks are on site now, grey blocks are still to come, each block’s left edge is its status color, and the amber line is the time now. Click a block to open the job.',
        optional: 'Skip (dispatch roles only)',
      },
      {
        selector: '[data-tour="dash-unscheduled"]',
        click: '[data-tour="dash-tab-dispatch"]',
        title: 'Jobs with no date',
        say: 'Jobs that still need a date. Click one to see suggested techs and assign it, or right-click to put it in one of the next few slots at 8, 10, 1 or 3; assessments open their estimate. Past 25, a link takes you to the Schedule for the rest.',
        optional: 'Skip (dispatch roles only)',
      },
      {
        selector: '[data-tour="dash-myday"]',
        click: '[data-tour="dash-tab-dispatch"]',
        title: 'My day',
        say: 'Everyone else sees My day here: just your own jobs today on a small timeline with how many are done, then a card for each job. Now marks the job you’re on site at, and tapping a card opens it.',
        optional: 'Skip My day',
      },

      // ── Custom ──────────────────────────────────────────────────────
      {
        selector: '[data-tour="dash-board-grid"]',
        click: '[data-tour="dash-tab-custom"]',
        title: 'Your own board',
        say: 'Custom is a board you arrange yourself. A new board starts with 14 blocks: company metrics, revenue, average job, new vs returning customers, money in and out, receivables, outstanding balance, needs attention, techs on the map, unanswered messages, team messages, accepted estimates, cash to turn in, and quick actions. Your office can limit which blocks you may use.',
      },
      {
        selector: '[data-tour="dash-range"]',
        click: '[data-tour="dash-tab-custom"]',
        title: 'Period and card size',
        say: 'Day, Month, Quarter or Year sets the period for every money block, and the list beside it lets you look back at an earlier, closed period. S, M and L change the size of all the cards at once.',
      },
      {
        selector: '[data-tour="dash-add-block"]',
        click: '[data-tour="dashboard-customize"]',
        title: 'Add blocks',
        say: 'Customize opens this tray. Click a block to add it to the end of your board, and hover one to see what it shows. Reset to default puts the starting blocks back.',
      },
      {
        selector: '[data-tour="dash-block-drag"]',
        click: '[data-tour="dashboard-customize"]',
        title: 'Move and remove',
        say: 'While you’re customizing, drag a block by this handle to move it, or press the X next to it to take it off your board. Press Done when you’re finished. Your layout is saved in this browser only, so another computer starts with the default board.',
      },

      // ── Wrap up ─────────────────────────────────────────────────────
      {
        selector: '[data-tour="topbar-help"], [data-tour="dash-welcome"]',
        title: 'Come back any time',
        say: 'That’s the dashboard. To see this tour again, press the question mark at the top and choose Show me this page. The Easy layouts show the same four views as big cards named Your day, Money overview, Dispatch and Your custom board, add the Needs you and Your workday cards, and leave the red count off.',
      },
    ],
  },
  {
    id: 'tasks',
    title: 'Tasks',
    description: 'One list of to-dos and follow-ups, on their own or tied to a job or a customer.',
    route: /^\/tasks\/?$/,
    roadmap: [
      { title: 'Something comes up', detail: 'A callback, a part to order, a reminder, on a job, a customer, or nowhere in particular.' },
      { title: 'Add it', detail: 'Add a to-do here or from the + button, with a due time and the person it belongs to.' },
      { title: 'Filter', detail: 'To-dos, job tasks, customer tasks, or just your own.' },
      { title: 'Tick it off', detail: 'Mark it done; History keeps the record.' },
      { title: 'Jump to the work', detail: 'Tasks on jobs and customers link straight back to them.' },
    ],
    use: {
      say: 'To tie a task to a job, open the job and use its Tasks tab. For a customer, open them and go to Records › Tasks. Both show up in this list too.',
      go: [
        { label: 'Go to Jobs', to: '/jobs' },
        { label: 'Go to Customers', to: '/customers' },
      ],
    },
    steps: [
      {
        selector: '[data-tour="tasks-header"]',
        title: 'Your to-do list',
        say: 'This is everyone’s to-do list. Tasks can stand alone or be tied to a job or customer. Add task makes a stand-alone to-do; job and customer tasks are added on those pages.',
      },
      {
        selector: '[data-tour="tasks-anchor"]',
        title: 'What kind of task',
        say: 'Narrow the list: to-dos on their own, tasks on jobs, or tasks on customers.',
      },
      {
        selector: '[data-tour="tasks-status"]',
        title: 'Open, done, or yours',
        say: 'Active is what is still open. History is what is done or cancelled. Tick Assigned to me to see only yours.',
      },
      {
        selector: '[data-tour="tasks-list"]',
        title: 'The list',
        say: 'Tap the circle to mark a task done. Red means it is overdue. The grey tag shows which job or customer it belongs to; click it to go there. Edit and Delete show when you are allowed to change that task.',
      },
    ],
  },
  {
    id: 'feedback',
    title: 'Bugs & Ideas',
    description: 'Tell the CrewBarn team what is broken or what you would like next, and upvote what others posted.',
    route: /^\/feedback\/?$/,
    roadmap: [
      { title: 'Spot something', detail: 'Hit a snag or think of something better while you work.' },
      { title: 'Post it', detail: 'Post it as a bug or an idea, with a short title.' },
      { title: 'Upvote', detail: 'Vote for what others posted, so the CrewBarn team sees what matters most.' },
      { title: 'Follow along', detail: 'Watch the status change as it is planned, worked on and shipped.' },
    ],
    steps: [
      {
        selector: '[data-tour="feedback-header"]',
        title: 'Bugs & Ideas',
        say: 'This is where you tell the CrewBarn team what is broken or what you would like next. The board is shared, so leave customer details out.',
      },
      {
        selector: '[data-tour="feedback-form"]',
        title: 'Post a bug or an idea',
        say: 'Choose bug or idea, give it a short title, and add details if they help. Steps to reproduce make bugs much faster to fix.',
      },
      {
        selector: '[data-tour="feedback-filters"]',
        title: 'Filter and sort',
        say: 'Show bugs, ideas or both, and sort by votes or by newest.',
      },
      {
        selector: '[data-tour="feedback-list"]',
        title: 'Vote',
        say: 'Press the arrow to upvote. Press it again to take your vote back.',
      },
    ],
  },
]
