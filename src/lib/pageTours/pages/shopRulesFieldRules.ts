import type { PageTour } from '../types'

/**
 * Jobs & workflow → Closing a job properly (/tool-shed/preferences#field-rules).
 * Every change on this tab saves straight away. The pay, vacation and clock
 * parts further down belong to other menu entries (#pay, #vacation, #clock).
 *
 *   shop-rule-<key>  data-on = yes | no on the switch rows
 */
const t = (id: string) => `[data-tour="${id}"]`
const on = (key: string) => `${t(`shop-rule-${key}`)}[data-on="yes"]`

export const PAGE_TOUR: PageTour = {
  id: 'shop-rules-field-rules',
  route: '^/tool-shed/preferences/?$',
  hash: 'field-rules',
  intro: {
    page: 'Closing a job properly',
    purpose: 'The rules your crew works to in the field: what a job needs before it can be marked complete, and how quiet jobs get chased.',
    covers: ['Quiet jobs', 'Nudging the tech', 'Finishing properly', 'Proof on every job', 'Invoicing'],
  },
  steps: [
    {
      id: 'header', selector: t('prefs-header'),
      title: 'Shop rules',
      say: 'This is one part of your shop rules: the rules in the field. Every change here saves straight away.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see these rules, but not change them. Ask an owner or admin if something needs updating.',
    },
    {
      id: 'dormant', selector: t('shop-rule-dormant_days'),
      title: 'Quiet jobs',
      say: 'A job with no update for this many days counts as quiet, and shows up for the office to chase.',
    },
    {
      id: 'video', selector: t('shop-rule-max_video_clip_seconds'),
      title: 'Video length',
      say: 'The longest video a tech can record on a job, in seconds.',
    },
    {
      id: 'nudge', selector: t('shop-rule-dormant_tech_nudge_enabled'), title: 'Nudge the tech',
      say: 'Turn this on to text the lead tech when their job goes quiet, asking what’s holding it up.',
      variants: [
        { when: on('dormant_tech_nudge_enabled'), say: 'It’s on: the lead tech gets a text when their job goes quiet. The box below sets how many times before it stops.' },
      ],
    },
    {
      id: 'notes', selector: t('shop-rule-dormant_require_notes_enabled'),
      title: 'A note first',
      say: 'Turn this on and a tech must write an update before working a quiet job again.',
    },
    {
      id: 'cod', selector: t('shop-rule-cod_force_collection_enabled'),
      title: 'Collect first',
      say: 'For customers who pay on the day: the tech must collect before moving on to the next job.',
    },
    {
      id: 'close', selector: t('shop-rule-job_close_blocking_enabled'), title: 'Finish properly',
      say: 'Turn this on and a job can’t be marked complete until its parts and labour are added.',
      variants: [
        { when: on('job_close_blocking_enabled'), say: 'It’s on: a job can’t be marked complete until its parts and labour are added. A job type or customer can set its own rule.' },
      ],
    },
    {
      id: 'proof', selector: t('shop-rule-completion-proof'),
      title: 'Proof on every job',
      say: 'Your company’s standard for finishing a job: a signature, a number of photos, before and after shots, or the client’s own work order. A job type or a customer can ask for more, or less.',
    },
    {
      id: 'invoice', selector: t('shop-rule-invoice_requires_complete'), title: 'Invoice after complete',
      say: 'On, and an invoice can only be made once the job is complete. Money taken earlier counts as a deposit.',
      variants: [
        { when: `${t('shop-rule-invoice_requires_complete')}[data-on="no"]`, say: 'It’s off, so you can invoice a job before it’s complete. Handy for deposits and progress billing.' },
      ],
    },
    {
      id: 'more', selector: t('shop-rule-pay'),
      title: 'More below',
      say: 'Further down are when pay is earned, vacation and clocking in. They have their own pages in Connect.',
    },
  ],
}
