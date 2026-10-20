import type { PageTour } from '../types'

/**
 * Catalog & inventory → Service categories (/catalog/categories).
 *
 * States: rows (svccat-table) or none yet (svccat-empty); New Category and
 * Edit only for people who can change the catalog; the form open as new
 * (no Delete) or saved (svccat-delete).
 */
const t = (id: string) => `[data-tour="${id}"]`
const FORM = t('svccat-form')
const EDITING = t('svccat-delete')

export const PAGE_TOUR: PageTour = {
  id: 'service-categories',
  route: '^/catalog/categories/?$',
  intro: {
    page: 'Service categories',
    purpose: 'Groups for your service catalog, like Repairs or Maintenance, so your team finds the right service fast.',
    covers: ['Your categories', 'Groups inside groups', 'Adding one', 'Retiring one'],
  },
  steps: [
    {
      id: 'header', selector: t('svccat-header'),
      title: 'Service categories',
      say: 'These group your services. Products have categories of their own, so the two lists stay apart.',
    },
    {
      id: 'list', title: 'Your categories', say: '',
      variants: [
        { when: t('svccat-empty'), selector: t('svccat-empty'), title: 'No categories yet', say: 'No categories yet. A handful is plenty, like Repairs, Installs and Maintenance.' },
        { when: t('svccat-table'), selector: t('svccat-table'), say: 'Each category, and whether it’s active. A category can sit inside another one; those are indented under their parent.' },
      ],
    },
    {
      id: 'edit', selector: t('svccat-row-edit'), when: `!${FORM}`,
      title: 'Change one',
      say: 'Edit renames a category, moves it under another, or retires it.',
    },
    {
      id: 'new', selector: t('svccat-new'), when: `!${FORM}`,
      title: 'Add a category',
      say: 'New Category asks for a name, an optional parent, and whether it’s active.',
      variants: [{ when: `!${t('svccat-new')}`, selector: t('svccat-header'), say: 'Your role can look at categories but not change them.' }],
    },
    {
      id: 'form', selector: FORM, when: FORM,
      title: 'New category', say: 'A new category. Nothing is made until you press Create category.',
      variants: [{ when: EDITING, title: 'A saved category', say: 'A saved category. Nothing changes until you press Save changes.' }],
    },
    { id: 'name', selector: t('svccat-f-name'), title: 'Name', say: 'The name your team sees when they pick a category on a service.' },
    { id: 'parent', selector: t('svccat-f-parent'), title: 'Parent', say: 'Pick a parent to tuck it inside another category, or leave it at the top.' },
    { id: 'active', selector: t('svccat-f-active'), title: 'Active', say: 'Untick Active, and the category drops out of the list you pick from.' },
    { id: 'delete', selector: t('svccat-delete'), title: 'Delete', say: 'Delete removes it after you confirm. Unticking Active is the gentler choice.' },
  ],
}
