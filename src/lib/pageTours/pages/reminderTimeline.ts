import type { PageTour } from '../types'

/**
 * Jobs & workflow → Automations → Reminders (/tool-shed/automations/reminders).
 * A job day drawn as a timeline: customer pins on top, crew pins below.
 *
 *   rem-switch       data-on = yes | no
 *   rem-off-note     only while reminders are off
 *   rem-lane-*       data-count = number of pins on that row
 *   rem-editor, rem-*  only once a pin is picked
 */
const t = (id: string) => `[data-tour="${id}"]`
const OFF = `${t('rem-switch')}[data-on="no"]`
const EMPTY_LANE = (tone: string) => `${t(`rem-lane-${tone}`)}[data-count="0"]`

export const PAGE_TOUR: PageTour = {
  id: 'reminder-timeline',
  route: '^/tool-shed/automations/reminders/?$',
  intro: {
    page: 'Reminders',
    purpose: 'A job day, drawn as a timeline. Each pin is a reminder, placed at the time it goes out: customers on the top row, your crew on the bottom.',
    covers: ['The on and off switch', 'The timeline', 'Customer and crew rows', 'Changing a reminder', 'The preview'],
  },
  steps: [
    {
      id: 'header', selector: t('rem-header'),
      title: 'Reminders',
      say: 'Reminders get a page of their own: a job day, drawn as a timeline. Click a pin to change it.',
    },
    {
      id: 'switch', selector: t('rem-switch'), title: 'All reminders',
      say: 'This switch turns every reminder on or off. It saves the moment you flip it.',
      variants: [
        { when: OFF, title: 'Reminders are off', say: 'Reminders are off right now, so none of these pins go out. Your pins are kept, and they start again when you turn this on.' },
      ],
    },
    {
      id: 'timeline', selector: t('rem-timeline'),
      title: 'The job day',
      say: 'Each pin is one reminder, placed at the time it goes out. A faded pin is switched off.',
    },
    {
      id: 'customer', selector: t('rem-lane-customer'), title: 'What customers hear',
      say: 'The top row is what your customers hear, like a text two hours before the visit.',
      variants: [
        { when: EMPTY_LANE('customer'), say: 'No customer reminders yet. Press Add on this row to put one in, two hours before the visit.' },
      ],
    },
    {
      id: 'axis', selector: t('rem-axis'),
      title: 'The job start',
      say: 'The dark line is when the job starts. The stretch after it is when a job is running late.',
    },
    {
      id: 'tech', selector: t('rem-lane-tech'), title: 'What your crew hears',
      say: 'The bottom row is what your crew hears, like a phone alert an hour before, or a heads-up when they may be late.',
      variants: [
        { when: EMPTY_LANE('tech'), say: 'No crew reminders yet. Press Add on this row to put one in, an hour before the visit.' },
      ],
    },
    {
      id: 'add', selector: t('rem-add'),
      title: 'Add',
      say: 'Add puts a new reminder on that row straight away.',
    },
    {
      id: 'pick', selector: t('rem-pick-hint'),
      title: 'Pick a pin',
      say: 'Click any pin to open it underneath. Every change in there saves straight away.',
    },

    // ── One reminder (once a pin is picked) ──
    {
      id: 'editor', selector: t('rem-editor'),
      title: 'This reminder',
      say: 'The top line reads back what this reminder does, in plain words.',
    },
    {
      id: 'active', selector: t('rem-active'),
      title: 'On or off',
      say: 'This switches just this one reminder off, without deleting it.',
    },
    {
      id: 'who', selector: t('rem-who'),
      title: 'Who hears it',
      say: 'The customer, or your crew.',
    },
    {
      id: 'when', selector: t('rem-when'),
      title: 'When it goes out',
      say: 'Before the start, or if it hasn’t started yet. On the way and May be late use the phone’s location.',
    },
    {
      id: 'offset', selector: t('rem-offset'),
      title: 'How far out',
      say: 'How many minutes before or after. Use the minus and plus, or type it in.',
    },
    {
      id: 'channels', selector: t('rem-channels'),
      title: 'How it reaches them',
      say: 'Text, email, or a phone app alert. Pick more than one if you like.',
    },
    {
      id: 'words', selector: t('rem-sms-words'),
      title: 'The words',
      say: 'Which wording goes out. The friendly default works with nothing to set up.',
    },
    {
      id: 'preview', selector: t('rem-preview'),
      title: 'Preview',
      say: 'Here’s what they get on a sample job, and exactly when it goes out.',
    },
    {
      id: 'delete', selector: t('rem-delete'),
      title: 'Delete',
      say: 'Delete this reminder asks once more before it removes the pin.',
    },
  ],
}
