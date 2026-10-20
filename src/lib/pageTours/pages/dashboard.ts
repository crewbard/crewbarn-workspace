import type { PageTour } from '../types'
import { FOCUS } from '../theme'

/**
 * Daily work → Dashboard (/).
 *
 * Walks whichever of the four views is open (Today’s Ops, Cash Flow,
 * Dispatch, Custom); parts of the other views aren’t on the page, so their
 * steps are skipped. The view tabs carry aria-selected.
 *
 * States: each Needs attention line (dash-attention-<key>) has
 * data-severity = danger | warning | info; the stat tiles are read by their
 * words ("All scheduled", "Nothing to bill", …).
 *
 * Focus look: the four lists at the bottom (Today’s schedule, Needs a quote,
 * Needs attention, Unanswered calls) show one at a time, picked with the
 * switcher (dash-queue-tabs, buttons dash-queue-<key> with aria-pressed).
 * Their steps press the right one first.
 */
const t = (id: string) => `[data-tour="${id}"]`
const ATTN = '[data-tour^="dash-attention-"]'
const queue = (key: string) => t(`dash-queue-${key}`)
const tileSays = (id: string, words: string) => (page: { text: (s: string) => string }) => page.text(t(id)).includes(words)

export const PAGE_TOUR: PageTour = {
  id: 'dashboard',
  route: '^/$',
  intro: {
    page: 'Dashboard',
    purpose: 'Your home base. What’s on today, what’s stuck, how the money looks and where your crew is, all in one place.',
    covers: ['The four views', 'Today in numbers', 'What needs attention', 'Your crew right now', 'The money', 'Your own board'],
  },
  steps: [
    // ── Top of the page ──
    {
      id: 'welcome', selector: t('dash-welcome'), title: 'Your home base', say: 'This is the page you land on after you sign in. Start here, deal with what needs you, then get back to the work.',
      variants: [
        { when: FOCUS, say: 'This is the page you land on after you sign in. Start with the work that needs a decision today. Schedule and + New job sit at the top right.' },
      ],
    },
    { id: 'new-job', selector: t('dash-new-job'), title: '+ New job', say: '+ New job opens the New Job form straight from here.' },
    { id: 'tabs', selector: t('dash-tabs'), title: 'Four views', say: 'Your day, the money, dispatch, and a board you build yourself. The one you used last opens next time.' },
    { id: 'badge', selector: t('dash-ops-badge'), title: 'The red number', say: 'This red number adds up jobs with no date, finished jobs not yet billed, and jobs past their time. When it’s gone, your day is in good shape.' },

    // ── Your day (Today’s Ops) ──
    { id: 'needs-you', selector: t('dash-needs-you'), title: 'Needs you', say: 'Three queues that want a person: jobs to put a date on, work that’s overdue, and finished jobs to bill. Each card opens the list where you deal with them.' },
    { id: 'workday', selector: t('dash-easy-workday'), title: 'Your workday', say: 'Shortcuts into the Jobs board. They only open a list; they never change a job.' },
    { id: 'load-error', selector: t('dash-load-error'), title: 'Something didn’t load', say: 'Part of the dashboard couldn’t load, so some totals may be short. Press Retry failed sections to try again.' },
    { id: 'stats', selector: t('dash-stats'), title: 'Today in numbers', say: 'Today at a glance. A colour means something is waiting, and the link under the number takes you to it.' },
    {
      id: 'unscheduled', selector: t('dash-stat-unscheduled'), title: 'Unscheduled', say: 'Jobs with no date yet.',
      variants: [
        { when: tileSays('dash-stat-unscheduled', 'All scheduled'), title: 'All scheduled', say: 'Every job has a date. Nice and tidy.' },
        { when: tileSays('dash-stat-unscheduled', 'Oldest needs a date'), title: 'Jobs need a date', say: 'Some jobs still need a date. Schedule now opens the Schedule, where you drag them onto the calendar.' },
      ],
    },
    {
      id: 'calls', selector: t('dash-stat-calls'), title: 'Unanswered calls', say: 'People waiting to hear back from you.',
      variants: [
        { when: tileSays('dash-stat-calls', 'All returned'), say: 'Every call has been returned. Nobody’s waiting on you.' },
        { when: tileSays('dash-stat-calls', 'no customer match'), say: 'People waiting to hear back. Some numbers don’t match a customer yet, so you may be meeting someone new.' },
      ],
    },
    {
      id: 'invoice', selector: t('dash-stat-ready-to-invoice'), title: 'Ready to invoice', say: 'Finished jobs with no invoice yet.',
      variants: [
        { when: tileSays('dash-stat-ready-to-invoice', 'Nothing to bill'), say: 'Every finished job has been billed. Nothing waiting here.' },
        { when: tileSays('dash-stat-ready-to-invoice', 'waiting to bill'), say: 'Finished jobs with no invoice yet, and the money waiting to be billed. Send invoices opens them.' },
      ],
    },
    {
      id: 'intake', selector: t('dash-stat-intake'), title: 'AI Intake', say: 'New leads from calls and texts.',
      variants: [
        { when: tileSays('dash-stat-intake', 'New leads to review'), say: 'New leads from calls and texts are waiting for someone to check them. Review queue opens Intake.' },
      ],
    },
    { id: 'mix', selector: t('dash-customer-mix'), title: 'New vs returning', say: 'How many new customers you got, and how much work came from new and returning ones, next to the period before.' },
    { id: 'sticky', selector: t('dash-sticky-notes'), title: 'Sticky notes', say: 'Notes for the team, like a whiteboard by the door. + Add note pins one up for everyone, or just a few people.' },
    { id: 'supervised', selector: t('dash-supervised'), title: 'Work you look after', say: 'Jobs you supervise for other people. Red counts ones with nobody going and ones past due.' },
    { id: 'crew', selector: t('dash-crew'), title: 'Crew right now', say: 'Each tech in the field: on site, driving or idle, what they’re on, and what’s next. Message them, or assign a job when they’re free.' },
    { id: 'incoming', selector: `${t('dash-incoming-portal')}, ${t('dash-incoming-marketplace')}`, title: 'New requests', say: 'Work customers asked for through your portal or the marketplace waits here until someone answers.' },
    { id: 'queues', when: FOCUS, selector: t('dash-queue-tabs'), title: 'One list at a time', say: 'Today, Needs a quote, Needs attention and Callbacks. The number is how many are waiting. Pick one and its list opens just below.' },
    { id: 'spotlight', selector: t('dash-spotlight'), title: 'Running late', say: 'Jobs past their arrival time that are still open, with how late each one is. Click one to move it along.' },
    { id: 'next', selector: t('dash-next'), title: 'Next up', say: 'The job coming up after the one underway. Click it to open the job.' },
    { id: 'schedule', click: queue('schedule'), selector: t('dash-schedule'), title: 'Today’s schedule', say: 'Today’s jobs in start-time order, each with its status colour. Full view opens the Schedule.' },
    {
      id: 'quote', click: queue('quotes'), selector: t('dash-needs-quote'), title: 'Waiting on a quote', say: 'Visits where a tech logged work that still needs a price.',
      variants: [
        { when: t('dash-quote-parts'), say: 'A tech logged work that still needs a price. Quote the parts builds a draft estimate from it for you to check and send.' },
        { when: tileSays('dash-needs-quote', 'Nothing is waiting'), say: 'When a tech logs work that still needs a price, it waits here. Nothing right now.' },
      ],
    },
    {
      id: 'attention', click: queue('attention'), selector: t('dash-attention'), title: 'Needs attention', say: '',
      variants: [
        { when: `${ATTN}[data-severity="danger"]`, say: 'Your cleanup list. A red dot is pressing, like money not collected or invoices overdue. Click a line to open that exact list.' },
        { when: ATTN, say: 'Your cleanup list. Amber is soon, blue is a heads-up. Click a line to open that exact list.' },
        { when: tileSays('dash-attention', 'all caught up'), say: 'Your cleanup list. You’re all caught up: nothing needs attention right now.' },
        { when: t('dash-attention'), say: 'Your cleanup list. A line only shows up when something needs it.' },
      ],
    },
    {
      id: 'callers', click: queue('calls'), selector: t('dash-calls'), title: 'Callers to ring back', say: 'The people behind the unanswered calls number. Click one to ring them back.',
      variants: [{ when: FOCUS, title: 'Callbacks', say: 'The people who called and haven’t heard back yet. Click one to ring them back.' }],
    },

    // ── Money overview (Cash Flow) ──
    { id: 'cash-range', selector: t('dash-cashflow-range'), title: 'The money', say: 'Live from your invoices and payments. Day, Month, Quarter or Year sets the period for everything below.' },
    { id: 'cash-metrics', selector: t('dash-cash-company-metrics'), title: 'Company metrics', say: 'Collected, spent and the difference, plus what’s still owed and estimates that were accepted.' },
    { id: 'cash-revenue', selector: t('dash-cash-revenue-gauge'), title: 'Revenue', say: 'Of what you billed this period, how much has come in.' },
    { id: 'cash-flow', selector: t('dash-cash-money-flow'), title: 'Money in and out', say: 'What you billed, what came in, and what went out. Net is green when you came out ahead.' },
    { id: 'cash-receivables', selector: t('dash-cash-receivables'), title: 'Receivables', say: 'Everything customers owe, sorted by how late it is.' },
    { id: 'cash-collected', selector: t('dash-cash-cash-collected'), title: 'Cash collected', say: 'Payments received, by who collected them or how they paid.' },
    { id: 'cash-outstanding', selector: t('dash-cash-outstanding-balance'), title: 'Outstanding balance', say: 'What’s owed right now, current and overdue.' },

    // ── Dispatch ──
    { id: 'dispatch-board', selector: t('dash-dispatch-board'), title: 'Today’s crew board', say: 'One row for each tech with work today, on a timeline. Click a block to open the job.' },
    { id: 'dispatch-legend', selector: t('dash-dispatch-legend'), title: 'Reading the blocks', say: 'Green is done, amber is on site now, grey is still to come. The line is the time right now.' },
    { id: 'dispatch-unscheduled', selector: t('dash-unscheduled'), title: 'Still needs a date', say: 'Jobs with no date. Click one to see suggested techs, or right-click to drop it into an open slot.' },
    { id: 'myday', selector: t('dash-myday'), title: 'My day', say: 'Just your own jobs today, with how many are done.' },
    { id: 'myday-list', selector: t('dash-myday-list'), title: 'Your jobs', say: 'A card for each of your jobs. Now marks the one you’re at. Tap a card to open it.' },

    // ── Your custom board ──
    { id: 'board', selector: t('dash-board-grid'), title: 'Your own board', say: 'A board of blocks you choose. It’s remembered on this computer.' },
    { id: 'board-range', selector: t('dash-range'), title: 'Period', say: 'Sets the period for every money block on the board.' },
    { id: 'board-size', selector: t('dash-size'), title: 'Card size', say: 'Make every card smaller or bigger at once.' },
    { id: 'board-customize', selector: t('dashboard-customize'), title: 'Customize', say: 'Customize lets you add blocks, drag them into order, and take off the ones you don’t need.' },
  ],
}
