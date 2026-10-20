import type { PageTour } from '../types'

/**
 * Catalog & inventory → Product categories (/catalog/product-categories).
 *
 * States: rows (prodcat-table) or none yet (prodcat-empty); New Category,
 * Edit and the photo button only for people who can change the catalog; the
 * form open as new (no Delete) or saved (prodcat-delete).
 */
const t = (id: string) => `[data-tour="${id}"]`
const FORM = t('prodcat-form')
const EDITING = t('prodcat-delete')

export const PAGE_TOUR: PageTour = {
  id: 'product-categories',
  route: '^/catalog/product-categories/?$',
  intro: {
    page: 'Product categories',
    purpose: 'Groups for your product catalog. Each one becomes a tile on the product catalog, with its own photo.',
    covers: ['Your categories', 'Tile photos', 'Adding one', 'Retiring one'],
  },
  steps: [
    {
      id: 'header', selector: t('prodcat-header'),
      title: 'Product categories',
      say: 'These group your products. Each active one shows as a tile on the product catalog.',
    },
    {
      id: 'list', title: 'Your categories', say: '',
      variants: [
        { when: t('prodcat-empty'), selector: t('prodcat-empty'), title: 'No categories yet', say: 'No categories yet. Make a few broad ones first; you can tuck others inside them later.' },
        { when: t('prodcat-table'), selector: t('prodcat-table'), say: 'Each category, and whether it’s active. Ones inside another category are indented under their parent.' },
      ],
    },
    {
      id: 'photo', selector: t('prodcat-photo'),
      title: 'The tile’s picture', say: 'This square is the category’s picture on its tile. Press it to pick a photo and crop it.',
      variants: [
        { when: `!${t('prodcat-new')}`, say: 'This is the picture on the category’s tile. Someone who can change the catalog sets it.' },
      ],
    },
    {
      id: 'edit', selector: t('prodcat-row-edit'), when: `!${FORM}`,
      title: 'Change one',
      say: 'Edit renames a category, moves it under another, or retires it.',
    },
    {
      id: 'new', selector: t('prodcat-new'), when: `!${FORM}`,
      title: 'Add a category',
      say: 'New Category asks for a name, an optional parent, and whether it’s active.',
    },
    {
      id: 'form', selector: FORM, when: FORM,
      title: 'New category', say: 'A new category. Nothing is made until you press Create category.',
      variants: [{ when: EDITING, title: 'A saved category', say: 'A saved category. Nothing changes until you press Save changes.' }],
    },
    { id: 'name', selector: t('prodcat-f-name'), title: 'Name', say: 'The name on the tile and in the list you pick from.' },
    { id: 'parent', selector: t('prodcat-f-parent'), title: 'Parent', say: 'Pick a parent to tuck it inside another category, or leave it at the top.' },
    { id: 'active', selector: t('prodcat-f-active'), title: 'Active', say: 'Untick Active to hide its tile and take it out of the pick list.' },
    { id: 'delete', selector: t('prodcat-delete'), title: 'Delete', say: 'Delete removes it after you confirm. Unticking Active is the gentler choice.' },
  ],
}
