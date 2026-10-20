import type { PageTour } from '../types'

/**
 * Team → Company tools (/company-assets).
 *
 *   company-assets-table  data-state = empty | list
 *   company-assets-add    only for people who can edit assets
 *
 * The form opens from + Add company asset and is closed with its own ×;
 * nothing is saved.
 */
const t = (id: string) => `[data-tour="${id}"]`
const FORM = t('company-assets-form')

export const PAGE_TOUR: PageTour = {
  id: 'company-assets',
  route: '^/company-assets/?$',
  intro: {
    page: 'Company tools',
    purpose: 'The tools, vehicles, devices and software your company owns. Notes on what each one can do help dispatch send the right person with the right gear.',
    covers: ['Adding an asset', 'Finding one', 'The list', 'What it costs you'],
  },
  steps: [
    {
      id: 'header', selector: t('company-assets-header'),
      title: 'Your own gear',
      say: 'Everything your crew uses that belongs to the company, from vans to testers to laptops.',
    },
    {
      id: 'cost-link', selector: t('company-assets-cost-link'),
      title: 'What it costs each month',
      say: 'This link shows what all of this costs you each month, in the cost model.',
    },
    {
      id: 'add', selector: t('company-assets-add'),
      title: 'Add company asset',
      say: 'Add a new tool, vehicle or device when it joins the team.',
    },
    {
      id: 'filters', selector: t('company-assets-filters'),
      title: 'Find one',
      say: 'Search by name, model, serial number, tag or what it can do, and narrow by type or status.',
    },
    {
      id: 'table', selector: t('company-assets-table'), title: 'The list', say: '',
      variants: [
        { when: `${t('company-assets-table')}[data-state="empty"]`, title: 'Nothing here yet', say: 'No assets yet. Add your tools and vehicles so dispatch knows who carries what.' },
        { when: `${t('company-assets-table')}[data-state="list"]`, say: 'Each row shows the asset, whether it’s in use, who has it, and what it can do.' },
      ],
    },
    {
      id: 'row-edit', selector: t('company-assets-row-edit'),
      title: 'Edit or view',
      say: 'Open any asset to see or change its details.',
    },
    {
      id: 'form', selector: FORM, open: `click:${t('company-assets-add')}`, waitMs: 1200,
      title: 'Adding an asset',
      say: 'The name, type, maker and model, its tag and serial number, who it’s assigned to, and notes on what it can do.',
    },
    {
      id: 'cost', selector: t('company-assets-cost'), when: FORM,
      title: 'Cost model inputs',
      say: 'Payments, insurance, upkeep and fuel go here. They’re counted in your cost model, so your prices cover your gear.',
    },
    {
      id: 'close', click: t('company-assets-close'), selector: t('company-assets-filters'),
      title: 'Nothing saved',
      say: 'The form closes with its cross, and nothing is saved until you press Save.',
    },
  ],
}
