import type { PageTour } from '../types'

/**
 * Accounting → Money desk (/accounting): the to-do list for money, with the
 * accounting tools above it.
 *
 * States the page marks:
 *   money-desk-header  data-state = checking | clear | todo
 *   money-desk-<group> data-rows = waiting | cleared  (a group shows only
 *                      when it has rows, or was cleared this visit)
 *   money-desk-clear   nothing waiting at all
 */
const t = (id: string) => `[data-tour="${id}"]`
const group = (id: string) => t(`money-desk-${id}`)
const waiting = (id: string) => `${group(id)}[data-rows="waiting"]`
const cleared = (id: string) => `${group(id)}[data-rows="cleared"]`

const groupStep = (id: string, title: string, say: string, done: string) => ({
  id, selector: group(id), title, say: '',
  variants: [
    { when: waiting(id), say },
    { when: cleared(id), say: done },
  ],
})

export const PAGE_TOUR: PageTour = {
  id: 'money-desk',
  route: '^/accounting/?$',
  intro: {
    page: 'Money desk',
    purpose: 'The front of Accounting: every money job that needs you, top to bottom, plus a link to every accounting tool.',
    covers: ['Accounting tools', 'The period', 'What needs you', 'Clearing things in batches'],
  },
  steps: [
    { id: 'tools', selector: t('accounting-tools'), title: 'Accounting tools', say: 'Every accounting page, in three groups. The money desk itself is below.' },
    { id: 'tools-collect', selector: t('accounting-tools-collect'), title: 'Collect money', say: 'Invoices, the cash register, payments and refunds, customer credits and card transactions.' },
    { id: 'tools-spend', selector: t('accounting-tools-spend'), title: 'Spending and payroll', say: 'Expenses, vendor bills, payroll, what your stock cost, purchase orders and subcontractor payouts.' },
    { id: 'tools-reconcile', selector: t('accounting-tools-reconcile'), title: 'Reconcile and report', say: 'Bank matching, the ledger, sales tax, syncing with your accounting software, and reports.' },
    {
      id: 'header', selector: t('money-desk-header'), title: 'Money desk',
      say: 'This is a to-do list, not a report. Clear it top to bottom.',
      variants: [
        { when: `${t('money-desk-header')}[data-state="clear"]`, say: 'Nothing needs you right now. Anything you just want to look at is in Reports.' },
        { when: `${t('money-desk-header')}[data-state="todo"]`, say: 'The count here is how many things need you. Clear them top to bottom.' },
      ],
    },
    { id: 'period', selector: t('money-desk-period'), title: 'The period', say: 'Pick the stretch of time the desk covers, or type exact dates.' },
    { id: 'progress', selector: t('money-desk-progress'), title: 'Money in and out', say: 'How much you’ve cleared this visit, and money in, out and net for the period.' },
    { id: 'clear', selector: t('money-desk-clear'), title: 'Desk is clear', say: 'Nothing is waiting on you. Come back after a busy day.' },
    groupStep('in', 'Money in hand',
      'Cash and checks your techs collected. Check them in so the books match the bag.',
      'All collected money is checked in for this visit.'),
    groupStep('bill', 'Finished but not billed',
      'Work that’s done and signed off, but the invoice never went out. Send sends it.',
      'Everything finished has been billed.'),
    groupStep('late', 'Late',
      'Invoices past due with no payment. Remind sends a reminder with a pay link.',
      'Reminders are out for everything late.'),
    groupStep('approve', 'Spending to approve',
      'Receipts your techs sent in to be paid back. Approve them one at a time or together.',
      'All receipts are approved.'),
    groupStep('match', 'Bank deposits to match',
      'Money landed in the bank, and CrewBarn guessed which payments it was. Review checks the guesses.',
      'Every deposit is matched.'),
    {
      id: 'batch', selector: t('money-desk-groups'), when: (page) => !!page.find('[data-tour^="money-desk-"][data-rows="waiting"]'),
      title: 'In batches', say: 'Tick rows, or Select all, and do them together. Nothing happens until you confirm.',
    },
  ],
}
