import type { PageTour } from '../types'

/**
 * Jobs & workflow → Automations → Build your own
 * (/tool-shed/automations/build, and /build/<id> to edit one).
 *
 *   build-header   data-mode = new | edit
 *   build-ideas    only when building a new one
 *   build-picker   only while a blank is open
 *   build-pause, build-delete, build-test  only when editing a saved one
 */
const t = (id: string) => `[data-tour="${id}"]`
const EDIT = `${t('build-header')}[data-mode="edit"]`

export const PAGE_TOUR: PageTour = {
  id: 'automation-build',
  route: '^/tool-shed/automations/build(/[^/]+)?/?$',
  intro: {
    page: 'Build your own automation',
    purpose: 'Make your own automation by filling in the blanks of one sentence: when it happens, how long after, how it’s sent, who to, and what it says.',
    covers: ['Start from an idea', 'Fill in the blanks', 'The live preview', 'Turning it on'],
  },
  steps: [
    {
      id: 'header', selector: t('build-header'), title: 'Build your own',
      say: 'Fill in the blanks. Tap any highlighted part to change it, and the preview updates as you go.',
      variants: [
        { when: EDIT, title: 'Edit this automation', say: 'You’re changing an automation you already have. Tap any highlighted part to change it.' },
      ],
    },
    {
      id: 'read-only', selector: t('build-read-only'),
      title: 'View only',
      say: 'You can read this automation, but not change it.',
    },
    {
      id: 'ideas', selector: t('build-ideas'),
      title: 'Start from an idea',
      say: 'Not sure where to start? Pick an idea and the whole sentence fills in. You can change any part after.',
    },
    {
      id: 'sentence', selector: t('build-sentence'),
      title: 'One sentence',
      say: 'This sentence is the whole automation. Each highlighted part is a blank you can tap.',
    },
    {
      id: 'when', selector: t('build-blank-when'),
      title: 'When',
      say: 'When sets the moment it starts, like when a job is finished or an invoice is paid.',
    },
    {
      id: 'wait', selector: t('build-blank-wait'),
      title: 'How long after',
      say: 'How long to wait. A little pause often works better than a text the very second a job ends.',
    },
    {
      id: 'how', selector: t('build-blank-how'),
      title: 'Text or email',
      say: 'Texts get read quickly. Emails hold more detail.',
    },
    {
      id: 'who', selector: t('build-blank-who'),
      title: 'Who hears',
      say: 'The customer, or your office inbox so someone knows.',
    },
    {
      id: 'message', selector: t('build-blank-message'),
      title: 'The words',
      say: 'Use the friendly default, or one of your own templates.',
    },
    {
      id: 'picker', selector: t('build-picker'),
      title: 'Pick one',
      say: 'Pick an option here, and the next blank opens for you.',
    },
    {
      id: 'panel', selector: t('build-panel-what'),
      title: 'What happens',
      say: 'This sums up what sets it off, and when it sends.',
    },
    {
      id: 'preview', selector: t('build-preview'),
      title: 'Preview',
      say: 'The preview shows the message as it will go out, with sample details filled in.',
    },
    {
      id: 'history', selector: t('build-history'), title: 'History',
      say: 'Once it’s on, every send, skip and failure is listed here.',
      variants: [
        { when: EDIT, say: 'Every time this automation ran is listed here: what was sent, skipped, or didn’t go.' },
      ],
    },
    {
      id: 'test', selector: t('build-test'),
      title: 'Try it on yourself',
      say: 'Send it to yourself first, to see exactly what a customer gets.',
    },
    {
      id: 'readback', selector: t('build-readback'),
      title: 'Read it back',
      say: 'The bar at the bottom reads the whole thing back, so you know exactly what you’re turning on.',
    },
    {
      id: 'pause', selector: t('build-pause'),
      title: 'Pause or delete',
      say: 'Pause stops it for now without losing anything. Delete removes it for good.',
    },
    {
      id: 'turn-on', selector: t('build-turn-on'), title: 'Turn it on',
      say: 'Turn it on when you’re happy. Cancel leaves without making anything.',
      variants: [
        { when: EDIT, title: 'Save', say: 'Save keeps your changes. Cancel leaves it as it was.' },
      ],
    },
  ],
}
