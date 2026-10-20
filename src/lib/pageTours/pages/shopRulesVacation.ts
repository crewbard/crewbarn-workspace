import type { PageTour } from '../types'

/**
 * Team → Vacation earned (/tool-shed/preferences#vacation), inside the
 * Field rules tab of Shop rules. Saves when the box is left.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'shop-rules-vacation',
  route: '^/tool-shed/preferences/?$',
  hash: 'vacation',
  intro: {
    page: 'Vacation earned',
    purpose: 'How many vacation days hourly and salaried staff build up over a year of full-time work.',
    covers: ['Days per year', 'How it adds up'],
  },
  steps: [
    {
      id: 'section', selector: t('shop-rule-vacation'),
      title: 'Vacation earned',
      say: 'Vacation builds up with every hour worked, so a half week earns half a week’s worth.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see this rule, but not change it.',
    },
    {
      id: 'days', selector: t('shop-rule-vacation_accrual_days_per_year'),
      title: 'Days per year',
      say: 'Type the days a full-time person earns in a year. Ten is a common starting point. It saves when you click away.',
    },
    {
      id: 'how', selector: t('shop-rule-vacation'),
      title: 'How it adds up',
      say: 'Underneath, it works out the hours banked for every hour worked, so you can check it makes sense.',
    },
    {
      id: 'commission-staff',
      title: 'Commission staff',
      say: 'People paid by commission bank vacation from their jobs instead. That’s set on their own pay card in Staff.',
    },
  ],
}
