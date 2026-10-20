import type { PageTour } from '../types'

/**
 * Customers & sites → Tags (/tool-shed/tags).
 *
 *   tags-library  data-can-edit = yes | no
 *   tags-empty    no tags yet
 *   tags-row      data-active = yes | no
 *   tag-form-*    only while the Add or Edit box is open
 */
const t = (id: string) => `[data-tour="${id}"]`
const VIEW_ONLY = `${t('tags-library')}[data-can-edit="no"]`

export const PAGE_TOUR: PageTour = {
  id: 'tags',
  route: '^/tool-shed/tags/?$',
  intro: {
    page: 'Tags',
    purpose: 'Coloured labels for your customers, like VIP, Recurring or Do not call, so anyone can see at a glance who they’re dealing with.',
    covers: ['Your label library', 'Adding a tag', 'Turning one off', 'Renaming and removing'],
  },
  steps: [
    {
      id: 'header', selector: t('tags-header'),
      title: 'Customer tags',
      say: 'Tags are short coloured labels you put on customers. The customer form offers the ones that are switched on.',
    },
    {
      id: 'empty', selector: t('tags-empty'),
      title: 'No tags yet',
      say: 'You haven’t made any tags yet. Press Add your first tag to start with something like VIP or Recurring.',
    },
    {
      id: 'library', selector: t('tags-library'), title: 'Your label library',
      say: 'These are your active tags. Press one to change its name or colour.',
      variants: [
        { when: VIEW_ONLY, say: 'These are your active tags. You can look, but only someone who can edit settings can change them.' },
      ],
    },
    {
      id: 'add', selector: t('tags-add'),
      title: 'Add tag',
      say: 'Add tag makes a new label. Give it a name and a colour, and it’s ready on every customer form.',
    },
    {
      id: 'manage', selector: t('tags-manage'),
      title: 'Manage labels',
      say: 'Below is every tag, switched on or not. The search box finds one by name.',
    },
    {
      id: 'row', selector: t('tags-row'), title: 'One tag',
      say: 'Each row shows how many customers have the tag. The switch turns it off without taking it off anyone. Edit renames it everywhere, and Remove takes it off every customer.',
      variants: [
        { when: VIEW_ONLY, say: 'Each row shows the tag and how many customers have it.' },
      ],
    },
    {
      id: 'inactive', selector: `${t('tags-row')}[data-active="no"]`,
      title: 'Switched-off tags',
      say: 'A faded tag is switched off. It stays on customers who already have it, but can’t be added to anyone new.',
    },
    {
      id: 'form-name', selector: t('tag-form-name'),
      title: 'Name',
      say: 'Type the tag’s name. Keep it short so it fits on a customer card.',
    },
    {
      id: 'form-color', selector: t('tag-form-color'),
      title: 'Colour',
      say: 'Pick a colour. The preview below shows how it will look.',
    },
    {
      id: 'form-sort', selector: t('tag-form-sort'),
      title: 'Sort order',
      say: 'Lower numbers show first in the list.',
    },
  ],
}
