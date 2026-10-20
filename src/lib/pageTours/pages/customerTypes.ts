import type { PageTour } from '../types'

/**
 * Customers & sites → Customer types (/tool-shed/customer-types).
 * A read-only page: the three types every customer is one of.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'customer-types',
  route: '^/tool-shed/customer-types/?$',
  intro: {
    page: 'Customer types',
    purpose: 'Every customer is a household, a business or a public agency. The type decides which name you need and how they’re billed.',
    covers: ['Residential', 'Commercial', 'Government', 'Tags for everything else'],
  },
  steps: [
    {
      id: 'header', selector: t('customer-types-header'),
      title: 'Three types',
      say: 'You pick a type when you add a customer, and you can change it later on the customer’s Edit Info tab.',
    },
    {
      id: 'residential', selector: t('customer-types-card-residential'),
      title: 'Residential',
      say: 'Residential is a household, billed to a named person. A first and last name are needed.',
    },
    {
      id: 'commercial', selector: t('customer-types-card-commercial'),
      title: 'Commercial',
      say: 'Commercial is a business, billed to the company. It needs a business name, and often has several sites under one account.',
    },
    {
      id: 'government', selector: t('customer-types-card-government'),
      title: 'Government',
      say: 'Government is a public agency, like a city or a school district. It needs the agency’s name, and can be tax exempt.',
    },
    {
      id: 'tags', selector: t('customer-types-tags'),
      title: 'Need another group?',
      say: 'For anything else, like VIP or Recurring, use tags. They label a customer without changing how they’re billed. The Tags link takes you there.',
    },
  ],
}
