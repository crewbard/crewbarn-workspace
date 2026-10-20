import type { PageTour } from '../types'

/**
 * Daily work → Dispatch → Routes (/dispatch/route-history).
 * Where each tech drove, day by day, with a replay.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'route-history',
  route: '^/dispatch/route-history/?$',
  intro: {
    page: 'Route history',
    purpose: 'Where each person actually drove, day by day, and a replay of any day.',
    covers: ['Who and which week', 'Their week on a map', 'Day by day', 'Replay a day'],
  },
  steps: [
    { id: 'header', selector: t('route-history-header'), title: 'Route history', say: 'Where each tech actually drove, day by day.' },
    { id: 'pickers', selector: t('route-history-pickers'), title: 'Who and which week', say: 'Pick a person and a week. Each day shows up the morning after it ends.' },
    { id: 'map', selector: t('route-history-map'), title: 'Their week on a map', say: 'Each day in its own colour, with numbered dots where they stopped. Click a dot for when they got there and the job it matched.' },
    { id: 'table', selector: t('route-history-table'), title: 'Day by day', say: 'Miles, top speed, stops and more for each day. Untick a day to take it off the map.' },
    { id: 'replay', selector: t('route-history-replay'), title: 'Replay a day', say: 'Play one day back like a video, today included.' },
    { id: 'replay-controls', selector: t('route-history-replay-controls'), title: 'Play and scrub', say: 'Play, pause, or drag the slider, and pick how fast it runs.' },
  ],
}
