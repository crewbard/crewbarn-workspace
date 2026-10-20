import type { PageTour } from '../types'

/**
 * Money → Tax classes (/catalog/tax-classes).
 *
 * States: rows (tax-table) or none yet (tax-empty); New Tax Class and Edit
 * only for people who can change the catalog; the new form (tax-new) or a
 * saved one open (tax-edit).
 */
const t = (id: string) => `[data-tour="${id}"]`
const NEW = t('tax-new')
const EDIT = t('tax-edit')

export const PAGE_TOUR: PageTour = {
  id: 'tax-classes',
  route: '^/catalog/tax-classes/?$',
  intro: {
    page: 'Tax classes',
    purpose: 'The tax rates your lines carry. Each one is made of parts, like state and county, kept apart so your sales tax report splits them for you.',
    covers: ['Your tax classes', 'The default', 'Adding one from a ZIP code', 'Changing a rate'],
  },
  steps: [
    { id: 'header', selector: t('tax-header'), title: 'Tax classes', say: 'Each tax class is a total rate made of parts, each with its own rate and who you pay it to.' },
    {
      id: 'list', title: 'Your tax classes', say: '',
      variants: [
        { when: t('tax-empty'), selector: t('tax-empty'), title: 'No tax classes yet', say: 'No tax classes yet, so nothing is taxed. Add the one for where you work first.' },
        { when: t('tax-table'), selector: t('tax-table'), say: 'Each row has the total rate, the area it’s for, and its parts.' },
      ],
    },
    { id: 'star', selector: t('tax-star'), title: 'The default', say: 'The filled star is the tax new invoice lines start with. Pressing a star changes it straight away.' },
    { id: 'edit', selector: t('tax-row-edit'), when: `!${EDIT}`, title: 'Change one', say: 'Edit opens a tax class to change a rate or its parts.' },
    {
      id: 'new', selector: t('tax-new-button'), when: `!${NEW}`, title: 'Add one',
      say: 'New Tax Class opens a short form. The quick way is to type a ZIP code and let it fill the rates in.',
    },

    // ── New tax class ──
    { id: 'zip', selector: t('tax-new-zip'), title: 'Fill it from a ZIP', say: 'Type a ZIP code and press Search to fill in the state and local rates. Check them before you save.' },
    { id: 'name', selector: `${NEW} ${t('tax-field-name')}`, title: 'Name', say: 'Name it so your team knows it on sight, like the county it’s for.' },
    { id: 'components', selector: t('tax-new-components'), title: 'The parts', say: 'Each part has a name, a rate, its area and who you pay it to. Add component adds another.' },
    { id: 'total', selector: t('tax-new-total'), title: 'Total rate', say: 'All the parts added up. That’s what a line is charged.' },
    { id: 'new-save', selector: t('tax-new-save'), title: 'Create tax class', say: 'Create tax class saves it. Cancel closes without making anything.' },

    // ── A saved one ──
    { id: 'edit-components', selector: t('tax-edit-components'), title: 'Each part saves on its own', say: 'Here each part has its own Save, which shows up once you change it. The total updates as soon as it’s saved.' },
    { id: 'edit-delete', selector: t('tax-edit-delete'), title: 'Delete', say: 'Delete tax class removes it after you confirm.' },
  ],
}
