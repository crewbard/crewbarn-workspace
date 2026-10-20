import type { PageTour } from '../types'

/**
 * CBI AI → Which AI does the thinking (/tool-shed/ai/provider).
 * A focused setting page that saves as soon as a card is picked.
 *
 *   setting-control   data-setting-value = anthropic | openai | google | azure (missing = none picked)
 *   ai-provider-next  data-key = needed | in-place
 */
const t = (id: string) => `[data-tour="${id}"]`
const C = t('setting-control')
const picked = (v: string) => `${C}[data-setting-value="${v}"]`

export const PAGE_TOUR: PageTour = {
  id: 'ai-provider',
  route: '^/tool-shed/ai/provider/?$',
  intro: {
    page: 'Which AI does the thinking',
    purpose: 'CrewBarn doesn’t run AI itself. You bring an account from one of these companies, and what it costs goes to them, not to us.',
    covers: ['The four choices', 'What changes', 'Your key'],
  },
  steps: [
    {
      id: 'title', selector: t('setting-title'),
      title: 'Which AI does the thinking',
      say: 'Pick the company whose AI reads your photos and drafts for you. Nothing happens until you add a key.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see which AI is picked, but not change it.',
    },
    {
      id: 'choice', selector: C, title: 'Pick one',
      say: 'Four choices. Claude is what we recommend. Claude and ChatGPT can also do things for you, like book a job or draft a text.',
      variants: [
        { when: picked('anthropic'), title: 'Claude is picked', say: 'Claude is picked. It’s best at reading photos and messy notes, and it can do things for you, like book a job.' },
        { when: picked('openai'), title: 'ChatGPT is picked', say: 'ChatGPT is picked. It can do things for you, and it’s the only one that turns recorded calls into text by itself.' },
        { when: picked('google'), title: 'Gemini is picked', say: 'Gemini is picked. It’s the cheapest for heavy use, but it reads and writes only. It can’t book a job or send a text for you.' },
        { when: picked('azure'), title: 'Azure is picked', say: 'Azure is picked, for companies already on Microsoft. Like Gemini, it reads and writes but doesn’t act.' },
      ],
    },
    {
      id: 'saves',
      title: 'Saves when you pick',
      say: 'Picking a card saves it right away, and you can undo it straight after. If it still needs a key, you’re taken to that next.',
    },
    {
      id: 'what', selector: t('setting-consequences'),
      title: 'With this choice',
      say: 'This box spells out what your pick means: what it costs, what it can do, and whether your key still works.',
    },
    {
      id: 'scope', selector: t('setting-scope'),
      title: 'Nothing switches on',
      say: 'Picking a company doesn’t switch anything on. AI stays asleep until you turn it on.',
    },
    {
      id: 'key', selector: t('ai-provider-next'), title: 'Your key', say: '',
      variants: [
        { when: `${t('ai-provider-next')}[data-key="needed"]`, title: 'Next: a key', say: 'Next you need a key from that company. Set up the key walks you through getting one, then checks it works.' },
        { when: `${t('ai-provider-next')}[data-key="in-place"]`, title: 'Your key is in place', say: 'Your key is in place. Replace it whenever you like, and the guide walks you through it again.' },
      ],
    },
  ],
}
