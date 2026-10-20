import type { PageTour } from '../types'

/**
 * CBI AI, the area page (/connect/ai).
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'area-ai',
  route: '^/connect/ai/?$',
  intro: {
    page: 'CBI AI',
    purpose: 'CBI is the CrewBarn assistant. It reads photos and messy notes, drafts texts and jobs for you, and learns how your company works. You decide what it’s allowed to do.',
    covers: ['Setting it up', 'What it may do', 'Teaching it', 'Watching what it does'],
  },
  steps: [
    {
      id: 'header', selector: t('connect-area-header'),
      title: 'CBI AI',
      say: 'Everything about your assistant lives here, one small question per page.',
    },
    {
      id: 'filter', selector: t('connect-area-filter'), title: 'Jump or search',
      say: 'The chips jump to a group, and the box finds a setting by name.',
      variants: [
        { when: t('connect-area-nomatch'), say: 'Nothing matches what’s in the search box. Press Clear search to see every setting again.' },
      ],
    },
    {
      id: 'setup', selector: t('connect-group-setup'),
      title: 'Setup',
      say: 'Start here, in order: pick which AI company does the thinking, add your key for it, then decide if your crew can talk to it out loud.',
    },
    {
      id: 'provider', selector: t('connect-setting-which-ai-does-the-thinking'),
      title: 'Step one',
      say: 'Which AI does the thinking is the first step. Nothing runs until you’ve picked one and added a key.',
    },
    {
      id: 'may-do', selector: t('connect-group-what-it-may-do'),
      title: 'What it may do',
      say: 'Nothing happens unless you allow it. Turn on just the jobs you want help with.',
    },
    {
      id: 'calls', selector: t('connect-setting-cbi-calls'),
      title: 'CBI calls',
      say: 'When a tech may be late, CBI phones them, and where you allow it, their customer. Here you set what CBI says, the voice, and what pressing 1 or 2 does.',
    },
    {
      id: 'teach', selector: t('connect-group-teach-it'),
      title: 'Teach it',
      say: 'Learning decides where it may pick things up. Memory is what it has learned, for you to check, fix or throw out.',
    },
    {
      id: 'watch', selector: t('connect-group-watch-it'),
      title: 'Watch it',
      say: 'Activity lists the last things it did, and what they cost.',
    },
  ],
}
