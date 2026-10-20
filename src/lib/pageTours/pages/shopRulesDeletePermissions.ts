import type { PageTour } from '../types'

/**
 * Team → Delete permissions (/tool-shed/preferences#delete-permissions).
 *
 *   delete-perms-who       data-mode = default (owners and admins) | named
 *   delete-perms-readonly  shown to everyone but the owner
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'shop-rules-delete-permissions',
  route: '^/tool-shed/preferences/?$',
  hash: 'delete-permissions',
  intro: {
    page: 'Delete permissions',
    purpose: 'Decide who can delete company records, and what they have to do to prove it’s really them.',
    covers: ['Who can delete', 'Confirmation steps', 'What’s always blocked'],
  },
  steps: [
    {
      id: 'section', selector: t('prefs-delete'), click: t('prefs-tabs-delete-permissions'),
      title: 'Delete permissions',
      say: 'Deleting is for mistakes, not tidying up. These rules decide who may do it.',
    },
    {
      id: 'read-only', selector: t('delete-perms-readonly'),
      title: 'Owner only',
      say: 'Only the company owner can change these. You can read the rules, but not change them.',
    },
    {
      id: 'who', selector: t('delete-perms-who'), title: 'Who can delete', say: '',
      variants: [
        { when: `${t('delete-perms-who')}[data-mode="default"]`, say: 'Nobody is named yet, so owners and admins can delete. Tick people to switch to your own list.' },
        { when: `${t('delete-perms-who')}[data-mode="named"]`, say: 'Only the people ticked here can delete. Everyone else is told they’re not allowed.' },
      ],
    },
    {
      id: 'confirm', selector: t('delete-perms-confirm'),
      title: 'Confirmation steps',
      say: 'Extra checks for people who are allowed, like typing their password and giving a reason before anything goes.',
    },
    {
      id: 'blocked', selector: t('delete-perms-blocked'),
      title: 'Always blocked',
      say: 'Some records can never be deleted, whoever you are, so your history stays honest.',
    },
  ],
}
