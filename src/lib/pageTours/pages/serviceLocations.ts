import type { PageTour } from '../types'

/**
 * Customers & sites → Service locations (/tool-shed/service-locations).
 *
 *   locations-empty  data-searching = yes (nothing matches) | no (none yet)
 *   locations-row    data-secured = yes | no
 *   locations-pages  only when there is more than one page
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'service-locations',
  route: '^/tool-shed/service-locations/?$',
  intro: {
    page: 'Service locations',
    purpose: 'Every address you work at, across all your customers, in one list you can search.',
    covers: ['Finding a site', 'What each row shows', 'Opening the customer', 'Adding a site'],
  },
  steps: [
    {
      id: 'header', selector: t('locations-header'),
      title: 'All your sites',
      say: 'This is every place you work, for every customer: houses, buildings, units and more.',
    },
    {
      id: 'search', selector: t('locations-search'),
      title: 'Find a site',
      say: 'Search by nickname, street, city or ZIP code.',
    },
    {
      id: 'empty', selector: t('locations-empty'), title: 'Nothing here yet', say: '',
      variants: [
        { when: `${t('locations-empty')}[data-searching="yes"]`, title: 'No match', say: 'Nothing matches that search. Try part of the street name, or clear the box.' },
        { when: `${t('locations-empty')}[data-searching="no"]`, say: 'No sites yet. They appear here as you add addresses to your customers.' },
      ],
    },
    {
      id: 'row', selector: t('locations-row'),
      title: 'One site',
      say: 'Each row shows the site’s name and address and whose it is. Primary marks a customer’s main address.',
    },
    {
      id: 'secured', selector: `${t('locations-row')}[data-secured="yes"]`,
      title: 'Secured sites',
      say: 'Secured marks a site with access rules, like gate codes or a key on file, that only the right people can see.',
    },
    {
      id: 'open', selector: t('locations-open-customer'),
      title: 'Open customer',
      say: 'Open customer takes you to their record. That’s where you add, edit or switch off their sites.',
    },
    {
      id: 'pages', selector: t('locations-pages'),
      title: 'More pages',
      say: 'Lots of sites are split into pages. Use Previous and Next to move through them.',
    },
  ],
}
