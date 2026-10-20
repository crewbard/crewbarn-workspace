import type { PageTour } from '../types'

/**
 * Catalog & inventory → Vendors (/vendors).
 *
 * States: rows (vendors-table), none yet or no search match (vendors-empty
 * data-searching = yes | no); New Vendor and Edit only for people who can
 * edit inventory; the vendor form open as new or saved
 * (vendors-form data-editing = yes | no).
 */
const t = (id: string) => `[data-tour="${id}"]`
const FORM = t('vendors-form')
const EDITING = `${FORM}[data-editing="yes"]`

export const PAGE_TOUR: PageTour = {
  id: 'vendors',
  route: '^/vendors/?$',
  intro: {
    page: 'Vendors',
    purpose: 'The suppliers you buy from, with their contact details, your account number with them and their terms. Purchase orders go to these.',
    covers: ['Finding a vendor', 'Your list', 'Parts we buy here', 'Adding one', 'Account and terms'],
  },
  steps: [
    {
      id: 'header', selector: t('vendors-header'),
      title: 'Vendors',
      say: 'Your suppliers. Purchase orders, low-stock reorders and catalog orders all point at a vendor from this list.',
    },
    { id: 'search', selector: t('vendors-search'), title: 'Search', say: 'Search by name to find one quickly.' },
    {
      id: 'list', title: 'Your vendors', say: '',
      variants: [
        { when: `${t('vendors-empty')}[data-searching="yes"]`, selector: t('vendors-empty'), say: 'No vendor matches that search. Clear the box to see them all.' },
        { when: t('vendors-empty'), selector: t('vendors-empty'), title: 'No vendors yet', say: 'No vendors yet. Add the suppliers you order from most, and purchase orders can go to them.' },
        { when: t('vendors-table'), selector: t('vendors-table'), say: 'Each vendor with their phone, email, your account number with them, and whether they’re active.' },
      ],
    },
    {
      id: 'row-parts', selector: t('vendors-row-parts'), when: `!${FORM}`, title: 'Parts we buy here',
      say: 'Parts we buy here lists what you get from this vendor: their code, what it cost last time and how long it took. It fills in by itself as you order.',
    },
    { id: 'edit', selector: t('vendors-row-edit'), when: `!${FORM}`, title: 'Change one', say: 'Edit opens a vendor to update their details or retire them.' },
    {
      id: 'new', selector: t('vendors-new'), when: `!${FORM}`, title: 'Add a vendor',
      say: 'New Vendor asks for a name; everything else is optional.',
    },
    {
      id: 'form', selector: FORM, when: FORM,
      title: 'New vendor', say: 'A new vendor. Only the name is required. The display name, if you set one, is what prints on purchase orders.',
      variants: [{ when: EDITING, title: 'A saved vendor', say: 'A saved vendor. Nothing changes until you press Save changes.' }],
    },
    { id: 'form-tabs', selector: t('vendors-form-tabs'), title: 'Two tabs', say: 'Details is the vendor’s contact and terms. Parts we buy here is what you order from them.' },
    {
      id: 'parts', selector: t('vendors-parts'), when: t('vendors-parts'), title: 'Parts we buy here',
      say: 'Every part you’ve bought from them. Star one to make them the preferred supplier for it: Order parts picks them first.',
      variants: [
        { when: `${t('vendors-parts')}[data-count="0"]`, say: 'Nothing here yet. Parts you order from them, and prices from their catalogs, show up by themselves.' },
      ],
    },
    { id: 'discount', selector: t('vendors-parts-discount'), title: 'Your discount', say: 'What you pay them off their printed list price. Catalog prices from them turn into your cost with it.' },
    { id: 'address', selector: t('vendors-form-address'), title: 'Billing address', say: 'Their billing address, for your records and printed orders.' },
    { id: 'terms', selector: t('vendors-form-terms'), title: 'Account terms', say: 'Their payment terms, your account number with them, and the currency you pay in.' },
    {
      id: 'active', selector: t('vendors-form-active'), title: 'Active',
      say: 'Untick Active to stop ordering from a vendor but keep their past orders.',
    },
    { id: 'delete', selector: t('vendors-delete'), title: 'Delete', say: 'Delete removes the vendor after you confirm. Making them inactive is the gentler choice.' },
  ],
}
