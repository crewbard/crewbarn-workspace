import type { PageTour } from '../types'

/**
 * Jobs & workflow → Custom fields (/tool-shed/custom-fields).
 * Tabs: Job, Customer, Asset.
 *
 *   custom-fields-tabs   data-entity = work_order | customer | asset
 *   custom-fields-empty  nothing on this tab yet
 *   custom-field-form-*  only while the field editor is open
 */
const t = (id: string) => `[data-tour="${id}"]`
const tab = (entity: string) => `${t('custom-fields-tabs')}[data-entity="${entity}"]`

export const PAGE_TOUR: PageTour = {
  id: 'custom-fields',
  route: '^/tool-shed/custom-fields/?$',
  intro: {
    page: 'Custom fields',
    purpose: 'Add your own boxes to jobs, customers and equipment, for anything CrewBarn doesn’t ask for yet. Each one can also be printed on your documents.',
    covers: ['Jobs, customers or equipment', 'Your fields', 'Adding a field', 'Required or optional', 'On your documents'],
  },
  steps: [
    {
      id: 'header', selector: t('custom-fields-header'),
      title: 'Your own fields',
      say: 'Need to record something extra, like a gate code or a model number? Add it as a custom field.',
    },
    {
      id: 'new', selector: t('custom-fields-new'),
      title: 'New field',
      say: 'New field adds one to the tab you’re on.',
    },
    {
      id: 'tabs', selector: t('custom-fields-tabs'), title: 'Where it shows',
      say: 'Pick where the field lives: on jobs, on customers, or on equipment.',
      variants: [
        { when: tab('work_order'), say: 'You’re on Job. These fields show on the new job form, and can print on that job’s invoice and work order.' },
        { when: tab('customer'), say: 'You’re on Customer. These fields show on the new customer form and the customer’s details.' },
        { when: tab('asset'), say: 'You’re on Asset. These fields show on every piece of equipment you track.' },
      ],
    },
    {
      id: 'empty', selector: t('custom-fields-empty'),
      title: 'None here yet',
      say: 'No fields on this tab yet. Press New field to add one.',
    },
    {
      id: 'table', selector: t('custom-fields-table'),
      title: 'Your fields',
      say: 'Each row shows the field’s name, its tag for documents, its type, and whether it’s required. Press a row to change it.',
    },
    {
      id: 'form-label', selector: t('custom-field-form-label'),
      title: 'Label',
      say: 'The name people see on the form.',
    },
    {
      id: 'form-type', selector: t('custom-field-form-type'),
      title: 'Type',
      say: 'What kind of answer it takes: text, a number, a date, yes or no, or a list to pick from.',
    },
    {
      id: 'form-options', selector: t('custom-field-form-options'),
      title: 'List choices',
      say: 'For a list, add each choice here.',
    },
    {
      id: 'form-customers', selector: t('custom-field-form-customers'),
      title: 'Only for some customers',
      say: 'Leave this empty to ask on every job, or pick customers to ask only on their jobs.',
    },
    {
      id: 'form-before-invoice', selector: t('custom-field-form-before-invoice'),
      title: 'Before invoicing',
      say: 'Tick this to make sure it’s filled in before the job can be invoiced.',
    },
    {
      id: 'form-required', selector: t('custom-field-form-required'),
      title: 'Required and active',
      say: 'Required means the form can’t be saved without it. Untick Active to hide it without losing old answers.',
    },
    {
      id: 'form-documents', selector: t('custom-field-form-documents'),
      title: 'On your documents',
      say: 'Choose whether the answer prints on invoices and other documents.',
    },
  ],
}
