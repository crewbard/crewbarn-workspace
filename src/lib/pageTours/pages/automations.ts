import type { PageTour } from '../types'

/**
 * Jobs & workflow → Automations (/tool-shed/automations).
 *
 *   auto-autopilot  data-autopilot = on | off
 *   auto-tiles      data-failed = yes | no
 *   auto-ready      data-missing = yes | no  (something still to set up)
 *   auto-row        data-state = on | off | idea | soon | follows
 *   auto-undo       shown just after a switch is flipped
 *   auto-panel-*    only once a row is picked
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'automations',
  route: '^/tool-shed/automations/?$',
  intro: {
    page: 'Automations',
    purpose: 'The things CrewBarn does for you so nobody has to remember: reminders, thank-yous, review asks, payment nudges and more. Each one reads like a sentence and has its own switch.',
    covers: ['Autopilot', 'Ready to send', 'Finding one', 'In job order', 'Switching one on', 'What it sends'],
  },
  steps: [
    {
      id: 'header', selector: t('auto-header'),
      title: 'Automations',
      say: 'These are the jobs CrewBarn does by itself. Flip one on, and it just happens.',
    },
    {
      id: 'actions', selector: t('auto-actions'),
      title: 'See what ran, or build your own',
      say: 'See what ran jumps to the history of what was sent. Build your own starts a new one from scratch.',
    },
    {
      id: 'autopilot', selector: t('auto-autopilot'), title: 'Autopilot',
      say: 'Autopilot sums it up: whether anything is on, and how much CrewBarn has sent for you this week.',
      variants: [
        { when: `${t('auto-autopilot')}[data-autopilot="off"]`, title: 'Autopilot is off', say: 'Nothing is switched on yet. Flip one switch below and CrewBarn starts doing it for you. Reminders are a good first one.' },
        { when: `${t('auto-autopilot')}[data-autopilot="on"]`, title: 'Autopilot is on', say: 'Autopilot is on. This shows how many things CrewBarn runs for you, and how much typing it saved this week.' },
      ],
    },
    {
      id: 'tiles', selector: t('auto-tiles'), title: 'On, waiting, didn’t send',
      say: 'How many are switched on, how many messages are waiting, and how many didn’t send.',
      variants: [
        { when: `${t('auto-tiles')}[data-failed="yes"]`, title: 'Some didn’t send', say: 'Some messages didn’t send. Press that number to see which, and why.' },
      ],
    },
    {
      id: 'ready', selector: t('auto-ready'), title: 'Ready to send',
      say: 'Ready to send checks the basics: texting, email, message templates and GPS. Everything here is green.',
      variants: [
        { when: `${t('auto-ready')}[data-missing="yes"]`, title: 'Something to set up', say: 'Ready to send checks the basics: texting, email, message templates and GPS. Anything in amber needs setting up. Press it to go there.' },
      ],
    },
    {
      id: 'reminders', selector: t('auto-reminders-chip'),
      title: 'All reminders at once',
      say: 'This chip turns every appointment reminder on or off in one go. It saves the moment you press it.',
    },
    {
      id: 'undo', selector: t('auto-undo'),
      title: 'Undo',
      say: 'You just flipped a switch. Undo puts it back, just in case.',
    },

    // ── Finding one ──
    {
      id: 'search', selector: t('auto-search'),
      title: 'Search',
      say: 'Search finds an automation by any word in its sentence, like review, invoice or late.',
    },
    {
      id: 'who', selector: t('auto-who'), title: 'Who gets it',
      say: 'These narrow the list by who hears about it: customers, your crew, the office, or your other apps.',
      variants: [
        { when: `${t('auto-who-all')}[aria-pressed="false"]`, say: 'The list is narrowed to one group right now. Press Everyone to see them all again.' },
      ],
    },
    {
      id: 'ideas', selector: t('auto-ideas-toggle'),
      title: 'Ideas',
      say: 'Striped rows are ideas that aren’t on yet. This button shows or hides them.',
    },

    // ── In job order ──
    {
      id: 'groups', selector: t('auto-groups'),
      title: 'In job order',
      say: 'The list reads in the order a job happens, one group for each part of it. Each group says how many are on.',
    },
    {
      id: 'before', selector: t('auto-group-before'),
      title: 'Before the job',
      say: 'Before the job holds your reminders, so nobody forgets or wonders where you are.',
    },
    {
      id: 'status', selector: t('auto-group-status'),
      title: 'When a status changes',
      say: 'These fire when a job moves to a new status: an email, a text, a document, or a note in the job’s history. They’re set on each status in Job statuses.',
    },
    {
      id: 'gps', selector: t('auto-group-gps'),
      title: 'On the job',
      say: 'These use your crew’s phones: check them in when they arrive, and tell dispatch when someone’s running late.',
    },
    {
      id: 'after', selector: t('auto-group-after'),
      title: 'After the job',
      say: 'Say thanks, ask for a review, nudge an unpaid invoice, or tell the office when money comes in.',
    },
    {
      id: 'back', selector: t('auto-group-back'),
      title: 'Bring customers back',
      say: 'Warranty and agreement reminders, and a note to customers who’ve gone quiet. Only customers who said yes to marketing get these.',
    },
    {
      id: 'mine', selector: t('auto-group-mine'),
      title: 'Your own',
      say: 'Ones you built yourself land here.',
    },

    // ── One row ──
    {
      id: 'row', selector: t('auto-row'),
      title: 'One row, one automation',
      say: 'Each row is one automation. The highlighted words are the parts you can change, and the line underneath says how it’s going.',
    },
    {
      id: 'switch', selector: t('auto-row-switch'),
      title: 'The switch',
      say: 'The switch turns it on or off, and saves right away.',
    },
    {
      id: 'turn-on', selector: t('auto-row-turnon'),
      title: 'Turn on an idea',
      say: 'Turn on makes an idea real, straight away.',
    },
    {
      id: 'timing', selector: t('auto-row-timing'),
      title: 'Edit timing',
      say: 'Edit timing changes when it happens, like how long before a visit a reminder goes out.',
    },

    // ── What it sends ──
    {
      id: 'panel', selector: t('auto-panel'), title: 'What happens',
      say: 'Pick any row, and this side shows exactly what it sends, who to, and when.',
      variants: [
        { when: t('auto-panel-what'), selector: t('auto-panel-what'), say: 'This is the row you picked: what sets it off, how long it waits, and who hears about it.' },
      ],
    },
    {
      id: 'panel-body', selector: t('auto-panel-body'),
      title: 'The message',
      say: 'Here’s the wording that goes out, or the setting it follows.',
    },
    {
      id: 'panel-lately', selector: t('auto-panel-lately'),
      title: 'Lately',
      say: 'Lately shows what this one did recently, so you can check it’s working.',
    },
    {
      id: 'panel-actions', selector: t('auto-panel-actions'),
      title: 'Change it',
      say: 'Change the wording or timing here. For your own automations, you can send yourself a test.',
    },
  ],
}
