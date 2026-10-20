import type { PageTour } from '../types'

/**
 * CBI AI → Your AI key (/tool-shed/ai/key). A three-step setup:
 * what it does, your key, test it. Steps for later cards play only once
 * the person reaches them.
 *
 *   ai-key-pick-first  no AI company picked yet
 *   ai-key-get         data-key-saved = yes | no
 */
const t = (id: string) => `[data-tour="${id}"]`
const SAVED = `${t('ai-key-get')}[data-key-saved="yes"]`

export const PAGE_TOUR: PageTour = {
  id: 'ai-key',
  route: '^/tool-shed/ai/key/?$',
  intro: {
    page: 'Your AI key',
    purpose: 'A key is what lets CrewBarn use your own AI account. It takes about five minutes, most of it on their website, and nothing runs until you turn it on at the end.',
    covers: ['Where to get it', 'What it does and won’t do', 'Pasting it', 'Testing it', 'Turning AI on'],
  },
  steps: [
    {
      id: 'pick-first', selector: t('ai-key-pick-first'),
      title: 'Pick which AI first',
      say: 'A key only works with the company that made it, so pick your AI company first. Choose which AI takes you there.',
    },
    {
      id: 'get', selector: t('ai-key-get'), title: 'Where to get it',
      say: 'This link opens the right page on their website, and a note on what it usually costs.',
      variants: [
        { when: SAVED, say: 'You already have a key saved. Use this link if you need a new one, then paste it below to replace the old one.' },
      ],
    },
    {
      id: 'header', selector: t('wizard-header'),
      title: 'Your key',
      say: 'This sets up the key for the company you picked.',
    },
    {
      id: 'steps', selector: t('wizard-steps'),
      title: 'Three short steps',
      say: 'What it does, your key, and a test. You can cancel at any step.',
    },
    {
      id: 'step1', selector: t('wizard-step1'),
      title: 'What it does, and what it won’t',
      say: 'Read what this will and won’t do. What it costs is billed to your own account, and CrewBarn never adds anything on top.',
    },
    {
      id: 'next', when: t('wizard-step1'),
      title: 'Then paste and test',
      say: 'Press Continue to paste your key, then check it with one tiny test. Turning AI on comes last, and only after the test passes.',
    },
    {
      id: 'step2', selector: t('wizard-step2'), title: 'Paste your key',
      say: 'Paste the key here. It’s stored locked away and never shown again.',
      variants: [
        { when: SAVED, say: 'Your key is already saved. Leave this empty to keep it, or paste a new one to replace it.' },
      ],
    },
    {
      id: 'step3', selector: t('wizard-step3'),
      title: 'Check the key',
      say: 'Check the key asks the AI a one-word question. It costs a fraction of a cent, and it’s the only way to know the key really works.',
    },
    {
      id: 'go-live', selector: t('wizard-golive'),
      title: 'Turn AI on',
      say: 'Once the check passes, this turns AI on. You still choose which jobs it may do, so nothing happens on its own.',
    },
  ],
}
