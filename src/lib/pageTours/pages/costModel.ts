import type { PageTour } from '../types'

/**
 * Money → Cost model (/tool-shed/cost-model).
 *
 * States the page marks:
 *   cost-guide-banner  only until the guided questions are done (and only for editors)
 *   cost-readonly      a role that can read but not change it
 *   cost-metrics       data-break-even / data-target = set | missing
 *   cost-inventory     data-configured = yes | no
 *   cost-entries       data-count
 *   cost-entry-form    data-editing = yes | no (open while adding or editing a cost)
 */
const t = (id: string) => `[data-tour="${id}"]`
const field = (label: string) => t(`cost-field-${label}`)
const FORM = t('cost-entry-form')

export const PAGE_TOUR: PageTour = {
  id: 'cost-model',
  route: '^/tool-shed/cost-model/?$',
  intro: {
    page: 'Cost model',
    purpose: 'Put in what it really costs to run your business, and it works out the hourly rate you need to charge to break even and make your margin.',
    covers: ['Your numbers', 'Pricing assumptions', 'Where the money goes', 'Your costs'],
  },
  steps: [
    { id: 'header', selector: t('cost-header'), title: 'Cost model', say: 'Your real costs in, the hourly rate you need out.' },
    { id: 'readonly', selector: t('cost-readonly'), title: 'View only', say: 'You can read these numbers, but changing them needs permission to edit settings.' },
    {
      id: 'guide', selector: t('cost-guide-banner'), title: 'Go through it together',
      say: 'Not sure where to start? Start the questions walks you through your costs one step at a time, and you watch your break-even move as you answer.',
    },
    { id: 'actions', selector: t('cost-actions'), title: 'Walk through, or add one', say: 'Walk me through it asks the questions again. Add cost adds a single cost yourself.' },
    {
      id: 'metrics', selector: t('cost-metrics'), title: 'Your numbers',
      say: 'Your monthly overhead, where it comes from, your break-even per hour, and in green, your target rate.',
      variants: [
        { when: `${t('cost-metrics')}[data-break-even="missing"]`, say: 'Your monthly overhead is here. Break-even needs your billable hours, and the target needs a margin; set them below.' },
        { when: `${t('cost-metrics')}[data-target="missing"]`, say: 'Your overhead and break-even per hour. Set a margin below and the green tile shows your target rate.' },
      ],
    },
    { id: 'assumptions', selector: t('cost-assumptions'), title: 'Pricing assumptions', say: 'These turn your monthly costs into hourly rates.' },
    { id: 'hours', selector: field('expected-monthly-billable-hours'), title: 'Billable hours', say: 'The big one: how many hours your team actually charges for in a month. Be honest about it.' },
    { id: 'margins', selector: field('profit-target'), title: 'Margins', say: 'Profit is the share you aim to keep after modeled costs and a separate growth reserve. Set growth to zero if you do not want that reserve. Profit and growth together must stay below 95 percent.' },
    { id: 'minimums', selector: field('minimum-service-call'), title: 'Minimums', say: 'Set the minimum service call and job profit you want. The additional pricing floor is compared with the profit-and-growth target rather than multiplied on top of it.' },
    { id: 'markup', selector: field('material-markup'), title: 'Markups', say: 'Material markup matters most: an item with no price starts at its cost plus this markup.' },
    { id: 'save', selector: t('cost-assumptions-save'), title: 'Save assumptions', say: 'Press Save assumptions, wait for confirmation, then check the updated rates. Review the employee health insurance summary too: only add company shares not already counted in payroll or overhead. Resolve incomplete costs before relying on a full cost-based price.' },
    { id: 'breakdown', selector: t('cost-breakdown'), title: 'Monthly breakdown', say: 'Your monthly costs grouped by type, biggest first.' },
    {
      id: 'inventory', selector: t('cost-inventory'), title: 'What stock costs to hold',
      say: 'This follows the value of your stock on its own, at the yearly rate you set.',
      variants: [{ when: `${t('cost-inventory')}[data-configured="no"]`, say: 'Set a yearly rate here and the cost of holding your stock is counted on its own.' }],
    },
    {
      id: 'entries', selector: t('cost-entries'), title: 'Every cost',
      say: 'Every cost you’ve added, with its monthly amount. Edit opens one.',
      variants: [{ when: `${t('cost-entries')}[data-count="0"]`, title: 'No costs yet', say: 'No costs entered yet. Start with rent, vehicles, insurance and payroll.' }],
    },
    {
      id: 'form', selector: FORM, title: 'Add cost', say: 'Name the cost and pick its type. Enter it monthly, or yearly and it’s divided by twelve.',
      variants: [{ when: `${FORM}[data-editing="yes"]`, title: 'Edit cost', say: 'A saved cost. Change the amount or untick Active to stop counting it.' }],
    },
    { id: 'flags', selector: t('cost-field-flags'), title: 'Fixed and active', say: 'Fixed means it stays the same however busy you are. Untick Active to stop counting it.' },
  ],
}
