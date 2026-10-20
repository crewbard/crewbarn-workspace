import type { PageTour } from '../types'

/**
 * Team → When pay is earned (/tool-shed/preferences#pay), inside the
 * Field rules tab of Shop rules. Each choice saves the moment it's picked.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'shop-rules-pay',
  route: '^/tool-shed/preferences/?$',
  hash: 'pay',
  intro: {
    page: 'When pay is earned',
    purpose: 'Decide when a job counts toward someone’s commission or bonus: once it’s invoiced, or once the customer has paid.',
    covers: ['Commission', 'Supervision bonus', 'The card fee on a tip'],
  },
  steps: [
    {
      id: 'section', selector: t('shop-rule-pay'),
      title: 'When pay is earned',
      say: 'A job never reaches anyone’s pay until it’s invoiced. This decides whether you then wait for the money to arrive.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see these rules, but not change them. Ask an owner or admin if one needs to change.',
    },
    {
      id: 'commission', selector: t('shop-rule-commission_trigger'),
      title: 'Commission',
      say: 'For a tech’s own jobs. Paying when it’s finished means the shop carries the risk of a short payment. Paying when the customer pays shares it.',
    },
    {
      id: 'bonus', selector: t('shop-rule-supervisor_bonus_trigger'),
      title: 'Supervision bonus',
      say: 'The same choice for a supervisor’s bonus on their area. It can be different from commission.',
    },
    {
      id: 'tip-fee', selector: t('shop-rule-tip_card_fee_borne_by'),
      title: 'The card fee on a tip',
      say: 'When a tip is paid by card, the card company takes a cut of it. Choose whether the shop covers that, or the tip does. Some states don’t allow taking it from the tip.',
    },
    {
      id: 'saved', selector: t('shop-rule-pay'),
      title: 'Saves straight away',
      say: 'Each choice here saves the moment you pick it. What each person’s percentage is taken from is set on their own pay card in Staff.',
    },
  ],
}
