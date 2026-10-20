import type { PageTour } from '../types'

/**
 * Accounting → Payroll profiles (/accounting/payroll/profiles).
 *
 * States: nobody picked yet (pay-profiles-none) or a person open, on the
 * Pay rules or Work schedule tab (pay-profiles-tab-* aria-pressed).
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'payroll-profiles',
  route: '^/accounting/payroll/profiles/?$',
  intro: {
    page: 'Payroll profiles',
    purpose: 'How each person is paid: hourly, salary or commission, the parts of a job they earn on, and their work schedule.',
    covers: ['Picking a person', 'Pay rules', 'Commission', 'Work schedule', 'Saving'],
  },
  steps: [
    { id: 'header', selector: t('pay-profiles-header'), title: 'Payroll profiles', say: 'One profile per person. Payroll uses these to work out pay.' },
    { id: 'staff', selector: t('pay-profiles-staff'), title: 'Your staff', say: 'Everyone on your team. Search or filter, then pick a person.' },
    { id: 'none', selector: t('pay-profiles-none'), title: 'Pick someone', say: 'Pick someone from the list to see and change how they’re paid.' },
    { id: 'person', selector: t('pay-profiles-tabs'), title: 'Their profile', say: 'Their current rate at the top, then two tabs: pay rules and work schedule.' },
    { id: 'pay-type', selector: t('pay-profiles-pay-type'), click: t('pay-profiles-tab-pay'), title: 'How they’re paid', say: 'Hourly, salary, commission, or a mix.' },
    { id: 'parts', selector: t('pay-profiles-parts'), title: 'What commission is paid on', say: 'Choose which parts of a job count toward their commission, like labor or parts.' },
    { id: 'calculator', selector: t('pay-profiles-calculator'), title: 'Try it out', say: 'Type a sample job to see what they’d earn on it.' },
    { id: 'balances', selector: t('pay-profiles-balances'), title: 'Time off balances', say: 'Their starting sick and vacation balances.' },
    { id: 'include', selector: t('pay-profiles-include'), title: 'Include in payroll', say: 'Untick to leave someone out of payroll runs.' },
    { id: 'schedule', selector: t('pay-profiles-schedule'), click: t('pay-profiles-tab-schedule'), waitMs: 1200, title: 'Work schedule', say: 'The days and hours they normally work, which sets their weekly hours.' },
    { id: 'save', selector: t('pay-profiles-save'), title: 'Save', say: 'Changes apply from the next payroll run once you save.' },
  ],
}
