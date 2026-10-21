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
    purpose: 'Set each person’s pay, payment dates, optional health insurance and normal work week. Add the person in Staff first, then check the saved profile before running payroll.',
    covers: ['Picking a person', 'Pay and payment dates', 'Health insurance', 'Commission', 'Work schedule', 'Saving and checking'],
  },
  steps: [
    { id: 'header', selector: t('pay-profiles-header'), title: 'Payroll profiles', say: 'One profile per person. Payroll uses these to work out pay.' },
    { id: 'staff', selector: t('pay-profiles-staff'), title: 'Your staff', say: 'Everyone on your team. Search or filter, then pick a person.' },
    { id: 'none', selector: t('pay-profiles-none'), title: 'Pick someone', say: 'Pick someone from the list to see and change how they’re paid.' },
    { id: 'person', selector: t('pay-profiles-tabs'), title: 'Their profile', say: 'Their current rate at the top, then two tabs: pay rules and work schedule.' },
    { id: 'pay-type', selector: t('pay-profiles-pay-type'), click: t('pay-profiles-tab-pay'), title: 'How they’re paid', say: 'Choose hourly, salary, commission or a mix. For salary, enter the before-tax amount and what period it covers, then check the yearly total. Twice a month means 24 payments; every two weeks means 26. Changing the period shows the same yearly salary; enter a new amount to change it. Set actual pay dates separately below.' },
    { id: 'benefits', selector: t('pay-profiles-rules'), title: 'Health insurance', say: 'If enrolled, enter the full monthly premium and the company share. Check both monthly amounts, then confirm whether the company share is already in payroll or overhead before adding it to the cost model. This does not create a paycheck deduction.' },
    { id: 'parts', selector: t('pay-profiles-parts'), title: 'What commission is paid on', say: 'Choose which parts of a job count toward their commission, like labor or parts.' },
    { id: 'calculator', selector: t('pay-profiles-calculator'), title: 'Try it out', say: 'Type a sample job to see what they’d earn on it.' },
    { id: 'balances', selector: t('pay-profiles-balances'), title: 'Time off balances', say: 'Their starting sick and vacation balances.' },
    { id: 'include', selector: t('pay-profiles-include'), title: 'Include in payroll', say: 'Untick to leave someone out of payroll runs.' },
    { id: 'schedule', selector: t('pay-profiles-schedule'), click: t('pay-profiles-tab-schedule'), waitMs: 1200, title: 'Work schedule', say: 'The days and hours they normally work, which sets their weekly hours.' },
    { id: 'save', selector: t('pay-profiles-save'), title: 'Save', say: 'Press Save profile and wait for confirmation. Reopen this person and check the salary total, pay dates and insurance split. Review the payroll preview before posting a run; saving a profile does not post payroll.' },
  ],
}
