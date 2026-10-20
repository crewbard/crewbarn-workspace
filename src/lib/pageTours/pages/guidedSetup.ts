import type { PageTour } from '../types'

/**
 * Account & billing → Guided setup (/onboarding).
 *
 * The page marks its state for the tour:
 *   onboarding-readiness   data-progress = none | some | done
 *   onboarding-page-current data-complete = yes | no  (the step on screen)
 *   onboarding-locked shows once setup is finished and locked.
 *   The starter pack parts show only on the starter pack step.
 */
const t = (id: string) => `[data-tour="${id}"]`
const LOCKED = t('onboarding-locked')
const progress = (p: string) => `${t('onboarding-readiness')}[data-progress="${p}"]`

export const PAGE_TOUR: PageTour = {
  id: 'guided-setup',
  route: '^/onboarding/?$',
  intro: {
    page: 'Guided setup',
    purpose: 'Your step-by-step checklist for getting going: one decision at a time, from your trade’s starter pack to inviting your crew.',
    covers: ['How far along you are', 'The steps', 'The step you’re on', 'Your starter pack'],
  },
  steps: [
    {
      id: 'header', selector: t('onboarding-page-header'), title: 'Guided setup',
      say: 'Setting up goes one decision at a time, so you never face an empty screen.',
      variants: [
        {
          when: LOCKED, selector: LOCKED, title: 'Setup is finished',
          say: 'Setup is finished and locked. You can look back through every step, but nothing here runs again, so it can’t write over what you’ve built since.',
        },
      ],
    },
    {
      id: 'guided', selector: t('onboarding-open-guided'),
      title: 'Open guided setup',
      say: 'Open guided setup walks you through it in a window. Continue current step jumps to the next thing that isn’t done.',
    },
    {
      id: 'welcome', selector: t('onboarding-watch-welcome'),
      title: 'Watch the welcome',
      say: 'New to CrewBarn? Watch the welcome is a short film of what it does and how setup goes.',
    },
    {
      id: 'readiness', selector: t('onboarding-readiness'), title: 'Launch readiness',
      say: 'Launch readiness shows how far along you are, and counts your tools, staff, stock locations and catalog.',
      variants: [
        { when: progress('none'), say: 'Launch readiness shows how far along you are. You’re just getting started, so it fills in as you finish each step.' },
        { when: progress('done'), say: 'Launch readiness is full. Every step is done, and you’re ready to work.' },
      ],
    },
    {
      id: 'stages', selector: t('onboarding-page-stages'),
      title: 'The steps',
      say: 'Every step is listed here in order. Each one says Done, Locked, or which step it is. Click any step to open it.',
    },
    {
      id: 'current', selector: t('onboarding-page-current'), title: 'The step you’re on',
      say: 'The step you have open. It says what this step decides and why it matters.',
      variants: [
        {
          when: `${t('onboarding-page-current')}[data-complete="yes"]`,
          say: 'The step you have open is already done. You can look it over, or move on with Next.',
        },
      ],
    },
    {
      id: 'actions', selector: t('onboarding-stage-actions'), when: `!${LOCKED}`,
      title: 'Do this step',
      say: 'The buttons here finish this step. Some take you to the page where it’s done, and come back here after.',
    },
    {
      id: 'nav', selector: t('onboarding-page-nav'),
      title: 'Back and Next',
      say: 'Back and Next move between steps without changing anything.',
    },

    // ── Starter pack (only on that step) ──
    {
      id: 'pack', selector: t('onboarding-pack-section'),
      title: 'Starter pack',
      say: 'Your trade’s starter pack fills in the basics for you, like job types, services, products and stock locations, so you aren’t starting from scratch.',
    },
    {
      id: 'pack-preview', selector: t('onboarding-pack-preview'),
      title: 'See what it adds',
      say: 'Here’s exactly what the pack creates. Look it over, then apply it. You can change or remove anything afterwards.',
    },
  ],
}
