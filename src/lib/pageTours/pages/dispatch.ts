import type { PageTour } from '../types'
import { FOCUS } from '../theme'

/**
 * Daily work → Dispatch (/dispatch).
 *
 * States: dispatch-tech-row data-gps = live | recent | none;
 * dispatch-unassigned data-count = how many of today’s jobs have no tech;
 * each marketplace request (dispatch-market-request) data-kind = plan |
 * one-off and data-status = pending | viewed | quoted | awarded; a service
 * plan request shows dispatch-market-plan, and its quote form
 * dispatch-market-plan-fields. On a phone, dispatch-mobile-toggle swaps
 * between the roster and the map.
 *
 * Focus look: the left side shows one list at a time, picked with
 * dispatch-rail-tabs (dispatch-rail-crew / -queue / -subs, aria-pressed):
 * Crew is the roster, To assign holds Unassigned today and Needs scheduling,
 * Subs holds Sent to subs. Their steps press the right one first.
 */
const t = (id: string) => `[data-tour="${id}"]`
const REQ = t('dispatch-market-request')
const rail = (key: 'crew' | 'queue' | 'subs') => t(`dispatch-rail-${key}`)

export const PAGE_TOUR: PageTour = {
  id: 'dispatch',
  route: '^/dispatch/?$',
  intro: {
    page: 'Dispatch',
    purpose: 'Today, live. Who’s where, which jobs still need someone, and new requests waiting for an answer.',
    covers: ['Your techs', 'Jobs with nobody going', 'Suggest a tech', 'The live map', 'New requests', 'Service plan requests'],
  },
  // The intro film, before the walk-through (see ../film.ts).
  film: [
    { id: 'name', say: 'This is Dispatch: your day, live.', visual: { kind: 'title', title: 'Dispatch', subtitle: 'Today, live' } },
    { id: 'map', title: 'The live map', say: 'See where your crew is right now, which jobs they’re heading to, and who may be late.', visual: { kind: 'map', route: true } },
    {
      id: 'nobody', title: 'Jobs with nobody going', say: 'Jobs with nobody going show up here, and Suggest a tech shows who’s best placed to take one.',
      visual: { kind: 'list', heading: 'Unassigned today', rows: [
        { title: 'Repair visit', meta: 'Harbor View Apartments · 2:00', chip: 'Nobody yet', tone: 'red' },
        { title: 'Service call', meta: 'Chen residence · 3:30', chip: 'Suggested: Sam', tone: 'blue' },
        { title: 'Estimate visit', meta: 'City Library · 4:00', chip: 'Alex', tone: 'green' },
      ] },
    },
    {
      id: 'requests', title: 'New requests', say: 'New requests from your customer portal wait here, for you to accept or decline.',
      visual: { kind: 'list', heading: 'Requests', rows: [
        { title: 'Chen residence', meta: 'Asked for a visit next week', chip: 'Accept', tone: 'green' },
        { title: 'Park Street Cafe', meta: 'Asked for an estimate', chip: 'New', tone: 'amber' },
      ] },
    },
    { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
  ],
  steps: [
    { id: 'phone', selector: t('dispatch-mobile-toggle'), title: 'Roster or map', say: 'On a phone, switch between your people and the map up here.' },
    { id: 'header', selector: t('dispatch-header'), title: 'Today', say: 'Today’s date and how many jobs are on the board. Routes and Field review are one tap away.' },
    { id: 'territory', selector: t('dispatch-territory'), title: 'Territory', say: 'Pick a territory to see just that part of your area.' },

    // ── People ──
    { id: 'rail-tabs', when: FOCUS, selector: t('dispatch-rail-tabs'), title: 'Crew, To assign, Subs', say: 'The left side shows one list at a time. Crew is your people, To assign is work with nobody going or no date yet, and Subs is work other companies are doing for you. The number is how many are in each.' },
    { id: 'roster', click: rail('crew'), selector: t('dispatch-roster'), title: 'Technicians', say: 'Your people. The dot shows how busy they are: grey is open, blue has jobs booked, green is on a job.' },
    {
      id: 'tracking', click: rail('crew'), selector: t('dispatch-tech-row'), title: 'Live tracking', say: 'How fresh each person’s location is.',
      variants: [
        { when: `${t('dispatch-tech-row')}[data-gps="live"]`, selector: `${t('dispatch-tech-row')}[data-gps="live"]`, say: 'Live means their phone reported in within the last minute or so. Click a name to find them on the map.' },
        { when: `${t('dispatch-tech-row')}[data-gps="recent"]`, selector: `${t('dispatch-tech-row')}[data-gps="recent"]`, say: 'This shows when their location last came in. Click a name to find them on the map, or right-click to ask their phone for a fresh one.' },
        { when: `${t('dispatch-tech-row')}[data-gps="none"]`, selector: `${t('dispatch-tech-row')}[data-gps="none"]`, say: 'No GPS means their phone hasn’t sent a location yet. Right-click the name to ping it.' },
      ],
    },

    // ── Work ──
    {
      id: 'unassigned', click: rail('queue'), selector: t('dispatch-unassigned'), title: 'Unassigned today', say: 'Today’s jobs that still have nobody going.',
      variants: [
        { when: `${t('dispatch-unassigned')}[data-count="0"]`, say: 'Every job today has someone going. Nice work.' },
      ],
    },
    { id: 'suggest', click: rail('queue'), selector: t('dispatch-suggest-open'), title: 'Suggest a tech', say: 'Click a job to see who should take it, ranked by who’s free and who’s closest. Looking doesn’t assign anyone.' },
    { id: 'assessment', click: rail('queue'), selector: t('dispatch-assessment'), title: 'Estimate visits', say: 'Estimate visits open the estimate instead, since that’s where their tech is set.' },
    { id: 'subs', click: rail('subs'), selector: t('dispatch-subs'), title: 'Sent to subs', say: 'Today’s work other companies are doing for you, and how it’s going.' },
    { id: 'needs-scheduling', click: rail('queue'), selector: t('dispatch-needs-scheduling'), title: 'Needs scheduling', say: 'Open jobs and estimates with no date at all. Click one to open it and book it.' },
    { id: 'unmappable', selector: t('dispatch-unmappable'), title: 'Not on the map', say: 'Jobs that can’t go on the map yet, because their address hasn’t been placed.' },

    // ── The map ──
    { id: 'map', selector: t('dispatch-map'), title: 'The live map', say: 'Jobs are dots in their stage colour, and your techs are their photos. It moves as their phones report in. A red name means they may be late for their next job. They hear it first on their phone, and the Schedule page lists the job with a Call customer button.' },
    { id: 'range', selector: t('dispatch-map-range'), title: 'Which jobs to show', say: 'Show today, this week, this month or this year on the map. On today, each tech’s route is drawn as a line.' },
    { id: 'layers', selector: t('dispatch-layers'), title: 'Map layers', say: 'Turn techs, jobs, routes and live traffic on and off.' },
    { id: 'lasso', selector: t('dispatch-lasso'), title: 'Lasso assign', say: 'Draw a box around several jobs on the map and hand them all to one person at once.' },

    // ── Requests waiting ──
    { id: 'portal', selector: t('dash-incoming-portal'), title: 'From your customer portal', say: 'Work customers asked for in their portal: the job, the address, and how urgent it is.' },
    { id: 'portal-actions', selector: t('dispatch-portal-actions'), title: 'Accept or decline', say: 'Accept and schedule takes the job and opens it to book. Decline lets you tell the customer why.' },
    { id: 'market', selector: t('dash-incoming-marketplace'), title: 'Estimate requests', say: 'People looking for your kind of work asking you for a price, from the marketplace.' },
    {
      id: 'market-plan', selector: t('dispatch-market-plan'), title: 'A service plan request', say: 'This one is asking for a service plan: regular visits, how often, and any months to skip.',
    },
    { id: 'market-plan-fields', selector: t('dispatch-market-plan-fields'), title: 'Your plan terms', say: 'For a plan, say what the price is per, how many visits a year and in which months, what it covers, and how long it runs.' },
    {
      id: 'market-actions', selector: t('dispatch-market-actions'), title: 'Answer it', say: 'Offer on-site estimate says you’ll come take a look. Quote a price sends a number. Pass turns it down.',
    },
    {
      id: 'market-state', title: 'Where it’s at', say: '',
      variants: [
        { when: `${REQ}[data-status="awarded"][data-kind="plan"]`, selector: `${REQ}[data-status="awarded"][data-kind="plan"]`, title: 'You got the plan', say: 'You won this plan. Open Plan requests to write up the agreement.' },
        { when: `${REQ}[data-status="awarded"]`, selector: `${REQ}[data-status="awarded"]`, title: 'You got it', say: 'You won this one. Open it from here and schedule the visit.' },
        { when: `${REQ}[data-status="quoted"]`, selector: `${REQ}[data-status="quoted"]`, title: 'Waiting on the customer', say: 'You’ve sent your price and the customer is deciding. Revise quote changes it.' },
      ],
    },
  ],
}
