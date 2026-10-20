import type { PageTour } from '../types'

/**
 * Your business → Company info (/tool-shed/company-info).
 *
 * The page marks its state for the tour:
 *   company-details  data-filled = yes | no   (any phone, email or address saved)
 *   company-cashflow data-managers = some | none
 *   company-save     data-dirty = yes | no
 *   settings-read-only shows for people who can look but not change.
 */
const t = (id: string) => `[data-tour="${id}"]`
const READ_ONLY = t('settings-read-only')
const EMPTY = `${t('company-details')}[data-filled="no"]`

export const PAGE_TOUR: PageTour = {
  id: 'company-info',
  route: '^/tool-shed/company-info/?$',
  intro: {
    page: 'Company info',
    purpose: 'The contact details printed on your quotes, invoices and emails. Leave a box empty and nothing prints in its place.',
    covers: ['Your contact details', 'License number and timezone', 'How it looks on paper', 'Who handles collected cash', 'Saving'],
  },
  steps: [
    {
      id: 'header', selector: t('company-header'), title: 'Company info',
      say: 'This is how customers reach you. Whatever you put here prints at the top of your quotes, invoices and emails.',
      variants: [
        {
          when: READ_ONLY, selector: READ_ONLY, title: 'View only',
          say: 'You can look at these details but not change them. If something needs updating, ask an owner or admin.',
        },
      ],
    },
    {
      id: 'details', selector: t('company-details'), title: 'Business details',
      say: 'Your business details. Change any box and the preview on the side updates as you type.',
      variants: [
        {
          when: EMPTY,
          say: 'Nothing is filled in yet, so your paperwork goes out with just your name. A phone number and email are a good place to start.',
        },
      ],
    },
    {
      id: 'name', selector: t('company-name'),
      title: 'Company name',
      say: 'The name on your paperwork. Leave it blank and CrewBarn uses the name you signed up with.',
    },
    {
      id: 'phone', selector: t('company-phone'),
      title: 'Phone',
      say: 'The number customers see. It tidies itself up as you type.',
    },
    {
      id: 'email', selector: t('company-email'),
      title: 'Email',
      say: 'The email address customers see for reaching you.',
    },
    {
      id: 'address', selector: t('company-address'),
      title: 'Address',
      say: 'Type the address the way you want it printed. Each line stays on its own line.',
    },
    {
      id: 'website', selector: t('company-website'),
      title: 'Website',
      say: 'Your website prints under the rest.',
    },
    {
      id: 'license', selector: t('company-license'),
      title: 'License number',
      say: 'If your trade has a license number, put it here. It shows when someone scans one of your equipment tags, so they can see who looks after it.',
    },
    {
      id: 'timezone', selector: t('company-timezone'),
      title: 'Timezone',
      say: 'Your timezone sets the times on your schedule, paperwork and reminders. This is the one box that can’t be left empty.',
    },
    {
      id: 'preview', selector: t('company-preview'),
      title: 'How it looks on paper',
      say: 'This shows how your details sit at the top of a document. Your document template decides the final layout.',
    },
    {
      id: 'cashflow', selector: t('company-cashflow'), title: 'Cash flow managers',
      say: 'Cash flow managers are the people who mark cash or a check your crew collected as received in the office. Tick everyone who handles deposits.',
      variants: [
        {
          when: `${t('company-cashflow')}[data-managers="none"]`,
          say: 'Cash flow managers mark cash or checks your crew collected as received. Nobody is ticked yet, so any owner or admin can do it. Tick the people who handle deposits.',
        },
        {
          when: `${t('company-cashflow')}[data-managers="some"]`,
          say: 'Cash flow managers mark cash or checks your crew collected as received. Only the people ticked here can do it.',
        },
      ],
    },
    {
      id: 'save', selector: t('company-save'), when: `!${READ_ONLY}`, title: 'Save changes',
      say: 'Everything here is up to date. Change something, and Save changes puts it on everything you send from then on.',
      variants: [
        {
          when: `${t('company-save')}[data-dirty="yes"]`,
          say: 'You have changes that aren’t saved yet. Save changes keeps them, and Discard puts everything back.',
        },
      ],
    },
  ],
}
