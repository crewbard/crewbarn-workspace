import type { PageTour } from '../types'

/**
 * Jobs & workflow → Job types (/tool-shed/job-types).
 *
 *   job-types-empty    no job types yet
 *   job-types-summary  data-can-edit = yes | no
 *   job-types-row      data-active = yes | no
 *   job-type-form-*    only while the Add or Edit box is open
 */
const t = (id: string) => `[data-tour="${id}"]`
const VIEW_ONLY = `${t('job-types-summary')}[data-can-edit="no"]`

export const PAGE_TOUR: PageTour = {
  id: 'job-types',
  route: '^/tool-shed/job-types/?$',
  intro: {
    page: 'Job types',
    purpose: 'Each kind of work you do, with its own colour, starting status and usual length, so a new job is half filled in when you pick its type.',
    covers: ['Your job types', 'Adding a type', 'Colour and icon', 'Starting status and length', 'Proof before complete'],
  },
  steps: [
    {
      id: 'header', selector: t('job-types-header'),
      title: 'Job types',
      say: 'Sort your jobs by the kind of work. Picking a type on a new job fills in its starting status and how long it usually takes.',
    },
    {
      id: 'empty', selector: t('job-types-empty'),
      title: 'No job types yet',
      say: 'You haven’t added any job types yet. Press Add your first job type, and think of the three or four kinds of work you do most.',
    },
    {
      id: 'summary', selector: t('job-types-summary'), title: 'A head start for every job',
      say: 'These counts show how many types are active, and how many already have a usual length and a starting status.',
      variants: [
        { when: VIEW_ONLY, say: 'These counts show how many types are active, and how many have a usual length and a starting status. You can look, but not change them.' },
      ],
    },
    {
      id: 'add', selector: t('job-types-add'),
      title: 'Add job type',
      say: 'Add job type makes a new kind of work.',
    },
    {
      id: 'row', selector: t('job-types-row'), title: 'One job type',
      say: 'Each card shows the type’s colour, category, starting status and usual length. Most used marks your busiest one.',
      variants: [
        { when: `!${VIEW_ONLY}`, say: 'Each card shows the type’s colour, category, starting status and usual length. The switch hides it from new jobs, Edit changes it, and Remove deletes it.' },
      ],
    },
    {
      id: 'inactive', selector: `${t('job-types-row')}[data-active="no"]`,
      title: 'Switched off',
      say: 'A faded card is switched off. Old jobs keep it, but it’s not offered on new jobs.',
    },
    {
      id: 'form-name', selector: t('job-type-form-name'),
      title: 'Name',
      say: 'Name the kind of work the way your crew says it.',
    },
    {
      id: 'form-category', selector: t('job-type-form-category'),
      title: 'Category',
      say: 'The category groups similar types together in reports.',
    },
    {
      id: 'form-color', selector: t('job-type-form-color'),
      title: 'Colour and icon',
      say: 'The colour and icon show on the schedule, so you can tell jobs apart at a glance.',
    },
    {
      id: 'form-status', selector: t('job-type-form-status'),
      title: 'Starting status',
      say: 'The status a new job of this type starts in.',
    },
    {
      id: 'form-duration', selector: t('job-type-form-duration'),
      title: 'Usual length',
      say: 'How long this kind of job usually takes. It fills in the length on a new job, and you can still change it.',
    },
    {
      id: 'form-proof', selector: t('job-type-form-proof'),
      title: 'Proof before complete',
      say: 'Choose what a tech must have before finishing this kind of job, like a signature or photos. Default uses your company’s rule.',
    },
    {
      id: 'form-active', selector: t('job-type-form-active'),
      title: 'Active',
      say: 'Leave it active to offer it on new jobs.',
    },
  ],
}
