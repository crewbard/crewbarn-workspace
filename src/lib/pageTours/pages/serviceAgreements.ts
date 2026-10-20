import type { PageTour } from '../types'

/**
 * Customers & sites → Service agreements (/tool-shed/service-agreements).
 * Two tabs: Review & setup, and Create or import.
 *
 *   agreements-notice    data-ack = done | needed | reread | view-only
 *   agreements-reviewer  data-reviewer = set | none
 *   agreements-estimate-picker  only for people who can build agreements
 */
const t = (id: string) => `[data-tour="${id}"]`
const ack = (state: string) => `${t('agreements-notice')}[data-ack="${state}"]`
const NOT_ACKED = (page: { find: (s: string) => HTMLElement | null }) => {
  const state = page.find(t('agreements-notice'))?.dataset.ack
  return state === 'needed' || state === 'reread' || state === 'view-only'
}

export const PAGE_TOUR: PageTour = {
  id: 'service-agreements',
  route: '^/tool-shed/service-agreements/?$',
  intro: {
    page: 'Service agreements',
    purpose: 'Set up the agreement customers sign for regular, scheduled service. CrewBarn can write a draft for you, or read in the one you already use.',
    covers: ['An agreement from an estimate', 'The notice to read first', 'Who reviews it', 'Writing a draft', 'Bringing in your own'],
  },
  steps: [
    {
      id: 'header', selector: t('agreements-header'),
      title: 'Service agreements',
      say: 'A service agreement is what a customer signs before you start regular work for them, like visits a few times a year.',
    },
    {
      id: 'read-only', selector: t('agreements-read-only'),
      title: 'View only',
      say: 'You can read this page, but your role can’t change company settings.',
    },
    {
      id: 'estimate', selector: t('agreements-estimate-picker'),
      title: 'From an estimate',
      say: 'Already quoted the work? Search for the estimate here and build an agreement from it. Nothing is sent or switched on until you say so.',
    },
    {
      id: 'tabs', selector: t('agreements-tabs'),
      title: 'Two tabs',
      say: 'Review and setup comes first. Create or import is where the agreement itself is made.',
    },

    // ── Review & setup ──
    {
      id: 'notice', selector: t('agreements-notice'), click: t('agreements-tab-setup'), title: 'Read this first',
      say: 'This notice explains what CrewBarn’s wording is and isn’t.',
      variants: [
        { when: ack('done'), title: 'Notice read', say: 'This notice explains what CrewBarn’s wording is and isn’t. It’s been read and recorded, so you’re free to write a draft.' },
        { when: ack('needed'), title: 'Read this first', say: 'Before CrewBarn writes anything, read this notice. It explains that a lawyer should check the wording.' },
        { when: ack('reread'), title: 'The wording changed', say: 'This notice has changed since it was last read. Please read it again before writing a new draft.' },
        { when: ack('view-only'), title: 'Not read yet', say: 'This notice hasn’t been recorded yet. Someone who can change settings needs to read it and confirm.' },
      ],
    },
    {
      id: 'ack', selector: t('agreements-ack'),
      title: 'Record that you’ve read it',
      say: 'Type I understand, then press Record this. It keeps a note of who read it and when.',
    },
    {
      id: 'reviewer', selector: t('agreements-reviewer'), click: t('agreements-tab-setup'), title: 'Who reviews it',
      say: 'Whatever CrewBarn writes still needs a lawyer to read it. Put yours here so the draft has somewhere to go.',
      variants: [
        { when: `${t('agreements-reviewer')}[data-reviewer="none"]`, say: 'No reviewer yet. Whatever CrewBarn writes still needs a lawyer to read it. If you don’t have one, there are a few ideas just below.' },
      ],
    },
    {
      id: 'reviewer-fields', selector: t('agreements-reviewer-fields'),
      title: 'Their details',
      say: 'Their name, where to send it, and a key if their service gives you one. Press Save when you’re done.',
    },

    // ── Create or import ──
    {
      id: 'write', selector: t('agreements-write'), click: t('agreements-tab-draft'),
      title: 'Write the agreement',
      say: 'Tell CrewBarn how you work, and it writes those terms in. Leave a box empty and that part stays blank. Nothing is made up.',
    },
    {
      id: 'write-fields', selector: t('agreements-write-fields'),
      title: 'How you work',
      say: 'What it covers, what it doesn’t, cancelling, payment, and anything else that belongs in writing.',
    },
    {
      id: 'generate', selector: t('agreements-generate'), title: 'Write me a draft',
      say: 'Write me a draft agreement makes an ordinary document, switched off, that you can edit, preview and send.',
      variants: [
        { when: NOT_ACKED, say: 'This button unlocks once the notice on Review and setup has been read and recorded.' },
      ],
    },
    {
      id: 'import', selector: t('agreements-import'),
      title: 'Already have one?',
      say: 'Upload a PDF or a photo of the agreement you use, and CrewBarn reads it into a draft you can edit. Check it against the original before you use it.',
    },
    {
      id: 'where', selector: t('agreements-where'),
      title: 'Where they live',
      say: 'Your agreements are kept in Templates and forms, and a contract attaches one on the Contracts page.',
    },
  ],
}
