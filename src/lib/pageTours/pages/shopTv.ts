import type { PageTour } from '../types'

/**
 * Connections → Shop TV (/tool-shed/shop-tv).
 *
 *   tv-add       only for people who can edit
 *   tv-empty     no screens yet
 *   tv-screen    one per screen; data-live = yes | no
 *   tv-design    a screen's design panel, opened from Design this screen
 */
const t = (id: string) => `[data-tour="${id}"]`
const DESIGN = t('tv-design')

export const PAGE_TOUR: PageTour = {
  id: 'shop-tv',
  route: '^/tool-shed/shop-tv/?$',
  intro: {
    page: 'Shop TV',
    purpose: 'Put today on the wall: a TV anyone can read from across the shop, showing who’s out, where they are, and what’s still waiting.',
    covers: ['Adding a screen', 'Your screens', 'Designing a screen', 'Money and timing'],
  },
  steps: [
    {
      id: 'hero', selector: t('tv-hero'),
      title: 'Put today on the wall',
      say: 'Nothing is ever typed on the TV itself. You set it up from here.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see your shop screens, but not add or change them.',
    },
    {
      id: 'add', selector: t('tv-add'),
      title: 'Add a screen',
      say: 'Three steps, about a minute. Open crewbarn dot tv on the TV, type the six-letter code it shows here, and give it a name.',
    },
    {
      id: 'screens', selector: t('tv-screens'), title: 'Your screens', say: '',
      variants: [
        { when: t('tv-screens'), say: 'Each screen you’ve added, with a small picture of what’s on it.' },
      ],
    },
    {
      id: 'empty', selector: t('tv-empty'),
      title: 'No screens yet',
      say: 'No screens yet. The first board is already built for you: the map, who’s out, and what’s next.',
    },
    {
      id: 'screen', selector: t('tv-screen'), title: 'One screen', say: '',
      variants: [
        { when: `${t('tv-screen')}[data-live="yes"]`, say: 'This screen is on right now, and shows which board it’s on.' },
        { when: `${t('tv-screen')}[data-live="no"]`, say: 'This screen is asleep. Nothing is wrong. A TV that’s switched off or off the wifi looks like this, and picks up on its own.' },
      ],
    },
    {
      id: 'preview', selector: t('tv-preview'),
      title: 'See what it shows',
      say: 'Opens exactly what the TV is showing, in a new tab.',
    },
    {
      id: 'design', selector: DESIGN, open: `click:${t('tv-design-open')}`, waitMs: 1200,
      title: 'Design this screen',
      say: 'Change the name, the boards, and how it looks. Each change reaches the TV in a few seconds.',
    },
    {
      id: 'name', selector: t('tv-name'), when: DESIGN,
      title: 'Name',
      say: 'So you can tell two TVs apart.',
    },
    {
      id: 'boards', selector: t('tv-boards'), when: DESIGN,
      title: 'Boards',
      say: 'A screen can show one board, or take turns between a few.',
    },
    {
      id: 'arrange', selector: t('tv-arrange'), when: DESIGN,
      title: 'Arrange it',
      say: 'Move and resize the cards on the board, and see it as you go.',
    },
    {
      id: 'cards', selector: t('tv-cards'), when: DESIGN,
      title: 'Cards to add',
      say: 'Everything you can put on a board, like the map, today’s jobs, or who’s out.',
    },
    {
      id: 'look', selector: t('tv-look'), when: DESIGN,
      title: 'Screen size',
      say: 'How big the TV is, so the writing is sized to read from across the room.',
    },
    {
      id: 'behaviour', selector: t('tv-behaviour'), when: DESIGN,
      title: 'Timing',
      say: 'When a screen has more than one board, how long each one stays up.',
    },
    {
      id: 'moments', selector: t('tv-moments'), when: DESIGN,
      title: 'Moments',
      say: 'Short full-screen moments that pop up for a few seconds, then go back to the board. Switch off any you don’t want.',
    },
    {
      id: 'money', selector: t('tv-money'), when: DESIGN,
      title: 'Money',
      say: 'Keep money off this screen is ticked to start with, so a customer standing in your shop can’t read your figures.',
    },
    {
      id: 'unpair', selector: t('tv-unpair'), when: DESIGN,
      title: 'Remove a screen',
      say: 'Unpair this screen disconnects the TV, and it goes back to showing a code. It asks you to confirm first.',
    },
  ],
}
