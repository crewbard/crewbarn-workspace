import type { PageTour } from '../types'

/**
 * Team → Subcontractors (/tool-shed/subcontractors).
 *
 *   subs-empty   no subcontractors yet (or none match the search)
 *   subs-add / subs-actions  only for people who can edit
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'subcontractors',
  route: '^/tool-shed/subcontractors/?$',
  intro: {
    page: 'Subcontractors',
    purpose: 'The outside companies you send work to. Keep their paperwork in one place, and invite them so they can work your jobs in their own CrewBarn.',
    covers: ['Adding a sub', 'Search and filters', 'Their paperwork', 'Inviting them'],
  },
  steps: [
    {
      id: 'header', selector: t('subs-header'),
      title: 'Subcontractors',
      say: 'These are companies you hand work to. Each one works your jobs in its own CrewBarn once it accepts your invite.',
    },
    {
      id: 'add', selector: t('subs-add'),
      title: 'Add subcontractor',
      say: 'Add subcontractor saves their business name, contact, payment terms and paperwork.',
    },
    {
      id: 'filter', selector: t('subs-filter'),
      title: 'Find one',
      say: 'Search by name, contact, email or partner number.',
    },
    {
      id: 'status', selector: t('subs-status'),
      title: 'Active or not',
      say: 'Show only active subs, the ones you’ve stopped using, or everyone.',
    },
    {
      id: 'empty', selector: t('subs-empty'),
      title: 'No subcontractors yet',
      say: 'Nobody here yet. Add your first one when you start sending work out.',
    },
    {
      id: 'row', selector: t('subs-row'),
      title: 'One company',
      say: 'Each row is one company, with its contact and phone. Faded rows are ones you’ve marked inactive.',
    },
    {
      id: 'network', selector: t('subs-network'),
      title: 'On CrewBarn',
      say: 'This shows whether they’ve joined you on CrewBarn. If not, press Invite before you send them a job.',
    },
    {
      id: 'compliance', selector: t('subs-compliance'),
      title: 'Their paperwork',
      say: 'Green means you have it on file: their tax form, insurance certificate and license. Grey means it’s still missing.',
    },
    {
      id: 'terms', selector: t('subs-terms'),
      title: 'Payment terms',
      say: 'How long you usually take to pay them.',
    },
    {
      id: 'actions', selector: t('subs-actions'),
      title: 'Edit or delete',
      say: 'Edit updates their details. Delete asks for your password and a reason before anything is removed.',
    },
  ],
}
