import type { PageTour } from '../types'

/**
 * Jobs & workflow → Auto-numbering (/tool-shed/preferences#numbering).
 * The only shop rules tab with a save bar.
 *
 *   shop-rule-numbering-warning  a number set lower than the current next
 *   prefs-save                   data-dirty = yes | no
 */
const t = (id: string) => `[data-tour="${id}"]`
const DIRTY = `${t('prefs-save')}[data-dirty="yes"]`

export const PAGE_TOUR: PageTour = {
  id: 'shop-rules-numbering',
  route: '^/tool-shed/preferences/?$',
  hash: 'numbering',
  intro: {
    page: 'Auto-numbering',
    purpose: 'Set the next number for customers, jobs, estimates, invoices and purchase orders. Handy when you’re carrying on from another system.',
    covers: ['The next numbers', 'Going backwards', 'Saving'],
  },
  steps: [
    {
      id: 'header', selector: t('prefs-header'),
      title: 'Shop rules',
      say: 'This is one part of your shop rules: how your record numbers are made.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see these numbers, but not change them. Ask an owner or admin if something needs updating.',
    },
    {
      id: 'section', selector: t('prefs-numbering'),
      title: 'The next number',
      say: 'Each box is the very next number that kind of record gets. They count up by themselves as you work.',
    },
    {
      id: 'job', selector: t('shop-rule-next_work_order_number'),
      title: 'Jobs',
      say: 'Moving over from another system? Start here just after your last job number, so nothing repeats.',
    },
    {
      id: 'invoice', selector: t('shop-rule-next_invoice_number'),
      title: 'Invoices',
      say: 'The same goes for invoices. Your accountant will thank you for a number that carries on.',
    },
    {
      id: 'warning', selector: t('shop-rule-numbering-warning'),
      title: 'Going backwards',
      say: 'Careful: you’ve set a number lower than the next one. That can make two records share a number. It’s allowed, but only do it on purpose.',
    },
    {
      id: 'save', selector: t('prefs-save'), title: 'Save changes',
      say: 'Unlike the other shop rules, numbers wait for Save changes, so a typo doesn’t take effect.',
      variants: [
        { when: DIRTY, say: 'You have unsaved changes. Save changes keeps them, and Discard puts the numbers back.' },
      ],
    },
  ],
}
