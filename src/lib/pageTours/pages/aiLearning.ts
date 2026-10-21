import type { PageTour } from '../types'

/**
 * CBI AI → Learning (/tool-shed/ai/learning).
 *
 *   ai-learning-master  data-learning = on | off
 *   ai-learning-no-key  no AI key yet
 */
const t = (id: string) => `[data-tour="${id}"]`
const ON = `${t('ai-learning-master')}[data-learning="on"]`

export const PAGE_TOUR: PageTour = {
  id: 'ai-learning',
  route: '^/tool-shed/ai/learning/?$',
  intro: {
    page: 'Learning',
    purpose: 'Left on, CrewBarn notices how your company does things, like what you call jobs, what you charge, and how you word a text, and uses it next time.',
    covers: ['On or off', 'Where it may look', 'Asking you first', 'Tidying up'],
  },
  steps: [
    {
      id: 'header', selector: t('ai-learning-header'),
      title: 'What AI picks up as you work',
      say: 'Everything it learns is yours to read, and yours to throw out.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see these choices, but not change them.',
    },
    {
      id: 'no-key', selector: t('ai-learning-no-key'),
      title: 'No key yet',
      say: 'There’s no AI key yet, so nothing here runs. Set one up first.',
    },
    {
      id: 'master', selector: t('ai-learning-master'), title: 'Learn as I work', say: '',
      variants: [
        { when: ON, title: 'It’s learning', say: 'It’s learning. Nothing it picks up is used until you approve it, unless you say otherwise below.' },
        { when: `!${ON}`, title: 'It’s not learning', say: 'It’s not learning. AI still does the jobs you allow, it just won’t remember anything from them.' },
      ],
    },
    {
      id: 'sources', selector: t('ai-learning-sources'), title: 'Where it may look',
      say: 'These choices control where learning looks for lessons: your corrections, CBI questions, calls, texts, emails, job notes, quotes and invoices. Choose the sources you want learning to use; each switch saves immediately. Wait for it to finish and check for an error. These choices do not replace permissions for using CBI on an individual record.',
      variants: [
        { when: `!${ON}`, say: 'Once learning is on, the places you tick here are its sources for new lessons.' },
      ],
    },
    {
      id: 'approval', selector: t('ai-learning-approval'),
      title: 'Does it need your say-so',
      say: 'Leave the first switch off and everything waits for you on the Memory page. The others decide what happens to unsure finds, and whether to keep the original it learned from.',
    },
    {
      id: 'retention', selector: t('ai-learning-retention'),
      title: 'Tidying up',
      say: 'How long to keep things you said no to, and things nobody got round to checking.',
    },
    {
      id: 'footer', selector: t('ai-learning-footer'),
      title: 'Read what it learned',
      say: 'Open What AI has learned, check a lesson against its source, then approve, correct or reject it. Check the saved result before relying on the lesson in a new CBI question.',
    },
  ],
}
