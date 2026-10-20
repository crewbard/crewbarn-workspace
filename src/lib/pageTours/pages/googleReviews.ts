import type { PageTour } from '../types'

/**
 * Your business → Google Reviews (/tool-shed/google-reviews).
 *
 * The page marks its state for the tour:
 *   reviews-listing data-listing = chosen | none, data-asking = yes | no
 *   reviews-connect data-gbp = unavailable | off | picking | on
 */
const t = (id: string) => `[data-tour="${id}"]`
const READ_ONLY = t('settings-read-only')
const CHOSEN = `${t('reviews-listing')}[data-listing="chosen"]`
const gbp = (s: string) => `${t('reviews-connect')}[data-gbp="${s}"]`

export const PAGE_TOUR: PageTour = {
  id: 'google-reviews',
  route: '^/tool-shed/google-reviews/?$',
  intro: {
    page: 'Google Reviews',
    purpose: 'Pick your Google listing, and CrewBarn asks happy customers for a review after a job. Connect your Business Profile to read and answer reviews here too.',
    covers: ['Your Google listing', 'Asking for reviews', 'Reading reviews here', 'Answering reviews'],
  },
  steps: [
    {
      id: 'header', selector: t('reviews-header'), title: 'Google reviews',
      say: 'Reviews bring in new customers. Pick your Google listing and CrewBarn can ask for a review after every finished job. There’s nothing to connect for that part.',
      variants: [
        {
          when: READ_ONLY, selector: READ_ONLY, title: 'View only',
          say: 'You can see these review settings but not change them. Ask an owner or admin if something needs updating.',
        },
      ],
    },
    {
      id: 'listing', selector: t('reviews-listing'), title: 'Your listing',
      say: 'No listing is chosen yet, so customers don’t get a review link. Find your business just below.',
      variants: [
        { when: CHOSEN, say: 'This is the Google listing your review link points to.' },
      ],
    },
    {
      id: 'find', selector: t('reviews-find'),
      title: 'Find your business',
      say: 'Type your business name and town, then press Search Google. When you see yours, press This is mine.',
    },
    {
      id: 'test', selector: t('reviews-test-link'),
      title: 'Test the review link',
      say: 'Test the review link opens it just as a customer would, so you can check it’s really you. Picked the wrong one? Choose a different listing.',
    },
    {
      id: 'enable', selector: t('reviews-enable'), title: 'Ask after every job',
      say: 'Tick this, and the review link goes in the invoice email and the customer portal, but only for jobs marked complete.',
      variants: [
        {
          when: `${t('reviews-listing')}[data-asking="yes"]`,
          say: 'This is on, so every finished job’s invoice email and the customer portal carry your review link.',
        },
        {
          when: `${t('reviews-listing')}[data-asking="no"]`,
          say: 'This is off, so nobody is asked for a review yet. Tick it, and finished jobs’ invoice emails and the customer portal carry your link.',
        },
      ],
    },

    // ── Google Business Profile ──
    {
      id: 'connect', selector: t('reviews-connect'), title: 'Read your reviews here',
      say: '',
      variants: [
        {
          when: gbp('unavailable'),
          say: 'Reading and answering reviews happens on Google itself for now. Asking for reviews still works as normal.',
        },
        {
          when: gbp('off'),
          say: 'Connect your Google Business Profile, and new reviews come into CrewBarn. You get told when one lands and can answer it without leaving.',
        },
        {
          when: gbp('picking'),
          say: 'You’re connected. Now pick which of your Google listings is this business, and your reviews are pulled in.',
        },
        {
          when: gbp('on'),
          say: 'Your Google Business Profile is connected, so your reviews come in here. Disconnect stops that any time.',
        },
      ],
    },
    {
      id: 'summary', selector: t('reviews-gbp-summary'),
      title: 'Your rating',
      say: 'Your rating, how many reviews you have, and how many still need an answer. Pull now fetches the newest ones straight away.',
    },
    {
      id: 'auto-reply', selector: t('reviews-auto-reply'),
      title: 'Answering automatically',
      say: 'Set up replies for new reviews. You choose which star ratings get answered on their own, and the rest wait as drafts for you.',
    },
    {
      id: 'list', selector: t('reviews-gbp-list'),
      title: 'Your reviews',
      say: 'Your reviews, newest first. Answer any one of them right here.',
    },
  ],
}
