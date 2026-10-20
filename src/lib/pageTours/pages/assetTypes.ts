import type { PageTour } from '../types'

/**
 * Customers & sites → Asset types (/asset-types).
 *
 *   asset-types-table   data-state = empty | filled
 *   asset-types-new     only for people who can edit
 *   asset-types-form, asset-types-fields  only while a type is open
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'asset-types',
  route: '^/asset-types/?$',
  intro: {
    page: 'Asset types',
    purpose: 'The kinds of equipment you install and look after for customers, and the details you record for each kind.',
    covers: ['Your asset types', 'Adding a type', 'Inspection timing', 'Extra fields'],
  },
  steps: [
    {
      id: 'header', selector: t('asset-types-header'),
      title: 'What you look after',
      say: 'An asset is a piece of equipment at a customer’s site. Each type says what you track about it.',
    },
    {
      id: 'new', selector: t('asset-types-new'),
      title: 'New asset type',
      say: 'Press New Asset Type to add a kind of equipment you work on.',
    },
    {
      id: 'table', selector: t('asset-types-table'), title: 'Your types', say: '',
      variants: [
        { when: `${t('asset-types-table')}[data-state="empty"]`, title: 'No types yet', say: 'No asset types yet. Add one for each kind of equipment you install or service.' },
        { when: `${t('asset-types-table')}[data-state="filled"]`, say: 'Each row is one type, with its extra fields, how often it’s inspected, and whether it’s active.' },
      ],
    },
    {
      id: 'row', selector: t('asset-types-row'),
      title: 'Open a type',
      say: 'Press Edit on a row to change its name, icon, inspection timing and fields.',
    },
    {
      id: 'form', selector: t('asset-types-form'),
      title: 'Name, icon and timing',
      say: 'Give the type a name and an icon. The default inspection timing is passed to every new asset of this type.',
    },
    {
      id: 'fields', selector: t('asset-types-fields'),
      title: 'Extra fields',
      say: 'Add fields your crew fills in for this kind of equipment, like a model or a size. Press Add field for each one.',
    },
  ],
}
