import type { PageTour } from '../types'

/**
 * Connect → CBI AI → Calls → CBI calls (/tool-shed/call-scripts).
 *
 *   call-scripts-tech / call-scripts-customer   the two lists
 *   call-script      one script (data shown: name, words, press 1)
 *
 * Nothing is changed: the tour only looks.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'call-scripts',
  route: '^/tool-shed/call-scripts/?$',
  intro: {
    page: 'CBI calls',
    purpose: 'What CBI says when it calls a tech who is running late, or their customer, the voice it says it in, and what happens when they press 1 or 2.',
    covers: ['CBI calls your tech', 'CBI calls the customer', 'Tags that fill in', 'Press 1 and 2', 'Voices', 'Test calls'],
  },
  // The intro film, before the walk-through (see ../film.ts).
  film: [
    { id: 'name', say: 'These are CBI’s calls: what CBI says when it phones a tech who’s running late, or their customer.', visual: { kind: 'title', title: 'CBI calls', area: 'CBI AI' } },
    {
      id: 'tech', title: 'The tech hears first', say: 'CBI gives your tech a short call saying they’re running late. Press 1, and they’re talking to the customer, on a recorded call kept on the job.',
      visual: { kind: 'thread', contact: 'Sam', messages: [
        { from: 'us', text: 'Hi Sam. You are running late for your 10:00 job at the Chen residence. Press 1 to call them now.', channel: 'call' },
        { from: 'them', text: 'Pressed 1. Connected to the customer.', channel: 'call' },
      ] },
    },
    {
      id: 'tags', title: 'Tags fill in', say: 'Write the words once. Tags like the customer’s name, the start time and how late fill in from the job.',
      visual: { kind: 'chips', heading: 'Tags', chips: ['Customer name', 'Tech’s first name', 'Start time', 'Minutes late', 'New arrival time', 'Office phone'] },
    },
    { id: 'test', title: 'Hear it first', say: 'Press Test call to hear a script on your own phone before it ever goes out.', visual: { kind: 'form', fields: [{ label: 'Script', value: 'Tech running late' }, { label: 'Call', value: 'Your phone' }], button: 'Test call' } },
    { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
  ],
  steps: [
    {
      id: 'header', selector: t('call-scripts-header'),
      title: 'CBI calls',
      say: 'These are the words CBI says on its calls. Tags like customer name fill in from the job, the same as your texts and emails.',
    },
    {
      id: 'tech', selector: t('call-scripts-tech'),
      title: 'CBI calls your tech',
      say: 'When a tech may be late, CBI gives them this call. Pressing 1 connects them straight to the customer, on a recorded call that’s kept on the job.',
    },
    {
      id: 'customer', selector: t('call-scripts-customer'),
      title: 'CBI calls the customer',
      say: 'When the office presses CBI: call customer, or automatically if you chose that, the customer hears this. Pressing 1 connects them to your office, pressing 2 to their tech.',
    },
    {
      id: 'script', selector: t('call-script'),
      title: 'One script',
      say: 'Edit the words, pick what pressing 1 and 2 do, choose a voice and how it sounds, and press Listen to hear it right here. Test call rings your own phone. The one marked Used for calls is the one that goes out.',
    },
    {
      id: 'where',
      title: 'Turning calls on and off',
      say: 'Whether these calls happen at all is set in Shop Rules under GPS check-in, and for each customer and job on their pages.',
    },
  ],
}
