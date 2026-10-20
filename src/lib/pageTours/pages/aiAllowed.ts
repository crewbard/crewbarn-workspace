import type { PageTour } from '../types'

/**
 * CBI AI → Allowed actions (/tool-shed/ai/allowed).
 *
 *   ai-allowed-master  data-ai-state = no-key | awake | asleep
 */
const t = (id: string) => `[data-tour="${id}"]`
const M = t('ai-allowed-master')
const state = (s: string) => `${M}[data-ai-state="${s}"]`

export const PAGE_TOUR: PageTour = {
  id: 'ai-allowed',
  route: '^/tool-shed/ai/allowed/?$',
  intro: {
    page: 'Allowed actions',
    purpose: 'Nothing happens unless you allow it. Wake AI up, then turn on just the jobs you want help with.',
    covers: ['Awake or asleep', 'Each job, one switch', 'It drafts, you send'],
  },
  steps: [
    {
      id: 'header', selector: t('ai-allowed-header'),
      title: 'What AI is allowed to do',
      say: 'Turn on the jobs you want help with and leave the rest alone. You can change your mind any time.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see what AI is allowed to do, but not change it.',
    },
    {
      id: 'master', selector: M, title: 'Awake or asleep', say: '',
      variants: [
        { when: state('no-key'), title: 'There’s no key yet', say: 'There’s no AI key yet, so none of these switches can do anything. Set up the key takes about five minutes.' },
        { when: state('awake'), title: 'AI is awake', say: 'AI is awake and helping with the jobs switched on below. This switch puts it to sleep without losing your choices.' },
        { when: state('asleep'), title: 'AI is asleep', say: 'AI is asleep, so nothing below runs and nothing is charged, whatever the switches say. Wake it up when you’re ready.' },
      ],
    },
    {
      id: 'tasks', selector: t('ai-allowed-tasks'), title: 'Each job, one switch',
      say: 'Each job has its own switch, grouped by where it helps. It says what it does, and what runs it.',
      variants: [
        { when: `!${state('awake')}`, say: 'These are the jobs AI can help with. They’re greyed out until AI is awake, and you can set them up now or later.' },
      ],
    },
    {
      id: 'footer', selector: t('ai-allowed-footer'),
      title: 'It drafts, you send',
      say: 'Whatever you allow, AI only drafts. Anything going to a customer still waits for a person to read it and press send.',
    },
  ],
}
