import type { PageTour } from '../types'

/**
 * Connect home (/connect).
 *
 * The intro explains Home and, because this is Home, the player adds
 * The full tour button to it. The steps walk the Home widgets, then the
 * parts of the frame every Connect page shares.
 *
 * The page marks its state for the tour:
 *   connect-attention data-attention-state = checking | todo | clear | error
 *   connect-plan      data-seats = full | room | unknown
 */
const t = (id: string) => `[data-tour="${id}"]`
const attention = (s: string) => `${t('connect-attention')}[data-attention-state="${s}"]`

export const PAGE_TOUR: PageTour = {
  id: 'connect-home',
  route: '^/connect/?$',
  intro: {
    page: 'Connect home',
    purpose: 'This is where your company is set up: your details, your customers, how you get paid, your team and the tools you connect. The day-to-day work stays in the CrewBarn app. Want to see everything? The full tour visits every page in order.',
    covers: ['What needs your attention', 'Your plan and seats', 'All your settings', 'Getting around', 'Help and walk-throughs'],
  },
  steps: [
    {
      id: 'hero', selector: t('connect-hero'),
      title: 'Your company',
      say: 'Your company’s name sits at the top. Everything in Connect is about how CrewBarn is set up for you.',
    },

    // ── Needs your attention ──
    {
      id: 'attention', selector: t('connect-attention'), title: 'Needs your attention',
      say: 'Needs your attention lists setup CrewBarn can check for you.',
      variants: [
        {
          when: attention('todo'),
          say: 'Needs your attention lists setup that still isn’t done, like your logo or customer texts. The count up top shows how many are left.',
        },
        {
          when: attention('clear'),
          say: 'Nothing needs your attention right now. When CrewBarn spots something left to set up, it shows up here.',
        },
        {
          when: attention('checking'),
          say: 'This box is checking your setup right now. Anything left to do shows up here in a moment.',
        },
        {
          when: attention('error'),
          say: 'We couldn’t check your setup just now. Come back a bit later and this box will fill in.',
        },
      ],
    },
    {
      id: 'attention-item', selector: t('connect-attention-item'), when: attention('todo'),
      title: 'Fix it in one click',
      say: 'Each line says what’s missing and why it matters. The button next to it goes straight to the page that fixes it.',
    },

    // ── Your plan ──
    {
      id: 'plan', selector: t('connect-plan'), title: 'Your plan',
      say: 'Your plan shows what you pay each month and how many seats are in use. The company and one admin are included, and each extra person who signs in is added on top.',
      variants: [
        {
          when: `${t('connect-plan')}[data-seats="full"]`,
          say: 'Your plan shows what you pay each month. Every seat is in use right now, so adding another person adds a seat.',
        },
      ],
    },
    {
      id: 'plan-manage', selector: t('connect-plan-manage'),
      title: 'Manage plan & seats',
      say: 'Manage plan and seats opens your subscription, where you change your plan or add seats.',
    },

    // ── All settings ──
    {
      id: 'areas', selector: t('connect-areas'),
      title: 'All settings',
      say: 'All settings is the map. Every setting lives in an area, like Your business, Money or Team, and each area is split into groups.',
    },
    {
      id: 'area-card', selector: t('connect-area-business'),
      title: 'An area',
      say: 'Each card is one area. Click its name to open it, or a line underneath to jump straight to that group.',
    },

    // ── Getting around ──
    {
      id: 'rail', selector: t('connect-rail'),
      title: 'The left rail',
      say: 'The same areas run down the left, so you can hop between them from any page. A small amber dot means something there still needs setting up.',
    },
    {
      id: 'find', selector: t('connect-find'),
      title: 'Find a setting',
      say: 'Can’t remember where something lives? Find a setting searches every setting by name. Control K opens it from anywhere.',
    },
    {
      id: 'guided', selector: t('connect-guided-setup'),
      title: 'Guided setup',
      say: 'Guided setup walks you through the first things to set up, one stage at a time, and shows how far along you are.',
    },
    {
      id: 'open-app', selector: t('connect-open-app'),
      title: 'Open CrewBarn',
      say: 'Open CrewBarn takes you to the app where your crew does the daily work: jobs, the schedule, invoices.',
    },
    {
      id: 'account', selector: t('connect-account'),
      title: 'You',
      say: 'This is who’s signed in. The question mark opens help.',
    },

    // ── Help ──
    {
      id: 'catalogs', selector: t('connect-catalogs'),
      title: 'Catalogs',
      say: 'The book opens your catalogs, the reference books you can look things up in from any page. Alt C opens them too.',
    },
    {
      id: 'launch', selector: t('tutorial-launch'),
      title: 'Walk-throughs',
      say: 'This button walks you through whatever page you’re on. On Home, it also offers the full tour.',
    },
    {
      id: 'help', selector: t('connect-help'),
      title: 'Help',
      say: 'Help has answers, and Show me this page for a walk-through any time. That’s Home. Pick an area to get started.',
    },
  ],
}
