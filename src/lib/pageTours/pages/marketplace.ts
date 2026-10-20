import type { PageTour } from '../types'

/**
 * Your business → Marketplace listing (/tool-shed/marketplace).
 *
 * Five tabs; each step presses its tab first. The page marks its state:
 *   market-visibility-modes data-mode = private | marketplace_listed | hidden_paused
 *   market-services data-picked = some | none
 *   market-area     data-zips = some | none
 *   market-walkthrough data-rate = none | free | paid
 *   market-save     data-dirty = yes | no
 */
const t = (id: string) => `[data-tour="${id}"]`
const tab = (id: string) => t(`market-tabs-${id}`)
const mode = (m: string) => `${t('market-visibility-modes')}[data-mode="${m}"]`

export const PAGE_TOUR: PageTour = {
  id: 'marketplace',
  route: '^/tool-shed/marketplace/?$',
  intro: {
    page: 'Marketplace listing',
    purpose: 'How new customers find you on the CrewBarn marketplace: whether you’re listed, what you do, where you work, and a few words about you.',
    covers: ['Who can find you', 'Your services', 'Where you work', 'Your blurb', 'Walkthroughs', 'Saving'],
  },
  steps: [
    {
      id: 'header', selector: t('market-header'),
      title: 'Marketplace listing',
      say: 'Customers looking for help can find companies on the CrewBarn marketplace. This page decides how you show up there.',
    },
    {
      id: 'tabs', selector: t('market-tabs'),
      title: 'Five parts',
      say: 'The listing comes in five parts. We’ll go through each one.',
    },

    // ── Portal visibility ──
    {
      id: 'modes', click: tab('visibility'), selector: t('market-visibility-modes'), title: 'Who can find you',
      say: 'Pick one of three. Customers you’ve invited keep using your portal whichever you choose.',
      variants: [
        {
          when: mode('private'),
          say: 'You’re on Private portal. Customers you invite can use your portal, but you’re hidden from public search. Pick Marketplace listed to be found.',
        },
        {
          when: mode('marketplace_listed'),
          say: 'You’re Marketplace listed, so new customers can find you and send you work or estimate requests.',
        },
        {
          when: mode('hidden_paused'),
          say: 'You’re Hidden, paused. Current customers keep access, but nobody new can find you or send a request.',
        },
      ],
    },
    {
      id: 'accepting', click: tab('visibility'), selector: t('market-accepting'), title: 'Accept new requests',
      say: 'This switch lets new customers send you requests. It only works while Marketplace listed is picked.',
      variants: [
        {
          when: mode('marketplace_listed'),
          say: 'This switch lets new customers send you requests. Turn it off when you’re too busy, and you stay listed.',
        },
      ],
    },
    {
      id: 'hide-similar', click: tab('visibility'), selector: t('market-hide-similar'),
      title: 'Keep your customers yours',
      say: 'Turn this on, and customers who came to you won’t be shown other companies in your trade in the counties you cover. It goes by your zip codes and territories.',
    },

    // ── Trade and services ──
    {
      id: 'services', click: tab('services'), selector: t('market-services'), title: 'Your trade and services',
      say: 'Your trade was set when you signed up. Below it, tap each service you offer, so customers can filter for the right company.',
      variants: [
        {
          when: `${t('market-services')}[data-picked="none"]`,
          say: 'Your trade was set when you signed up. You haven’t picked any services yet. Tap each one you offer, so customers can find you for the right job.',
        },
      ],
    },

    // ── Service area ──
    {
      id: 'area', click: tab('area'), selector: t('market-area'), title: 'Where you work',
      say: 'Customers searching by zip code only see companies that cover it. Here are the zip codes you cover.',
      variants: [
        {
          when: `${t('market-area')}[data-zips="none"]`,
          say: 'No zip codes yet, so nobody searching by location will find you. Add at least one.',
        },
      ],
    },
    {
      id: 'county', click: tab('area'), selector: t('market-county'),
      title: 'Add a whole county',
      say: 'Type a county name, pick it from the list, and every zip code in it is added at once.',
    },
    {
      id: 'zip', click: tab('area'), selector: t('market-zip'),
      title: 'Add one zip code',
      say: 'Or type a single zip code and press Add. The little cross on a zip code removes it.',
    },

    // ── Blurb ──
    {
      id: 'blurb', click: tab('blurb'), selector: t('market-blurb'),
      title: 'Listing blurb',
      say: 'One to three sentences on your listing. Say what sets you apart, like years in business, or answering calls after hours.',
    },

    // ── Walkthroughs ──
    {
      id: 'walkthrough', click: tab('walkthrough'), selector: t('market-walkthrough'), title: 'Walkthrough rate',
      say: 'Customers asking for a service plan can have you come out and list their equipment. Set an hourly rate to offer that.',
      variants: [
        {
          when: `${t('market-walkthrough')}[data-rate="none"]`,
          say: 'Customers asking for a service plan can have you come out and list their equipment. Right now it isn’t offered. Put in an hourly rate to offer it, or zero to do it free.',
        },
        {
          when: `${t('market-walkthrough')}[data-rate="free"]`,
          say: 'You offer walkthroughs free. Your tech comes out and lists the customer’s equipment for their service plan.',
        },
        {
          when: `${t('market-walkthrough')}[data-rate="paid"]`,
          say: 'You offer walkthroughs at this hourly rate. Time is billed from the first thing your tech records to the last, rounded up to the next quarter hour.',
        },
      ],
    },

    // ── Save ──
    {
      id: 'save', selector: t('market-save'), title: 'Save listing',
      say: 'Changes on any tab wait here. Save listing keeps them all at once.',
      variants: [
        {
          when: `${t('market-save')}[data-dirty="yes"]`,
          say: 'You have changes that aren’t saved yet. Save listing keeps them, from every tab at once.',
        },
      ],
    },
  ],
}
