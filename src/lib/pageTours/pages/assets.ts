import type { PageTour } from '../types'
import { FOCUS } from '../theme'

/**
 * Daily work → Assets (/assets). One asset opens in a window on this page
 * (also /assets?id=…), so its steps play when that window is open.
 *
 * States: asset-plan-coverage data-covered = yes | no. assets-no-types shows
 * before any asset types exist.
 *
 * Focus look: a Rows / Location tree switch (assets-view, buttons
 * assets-view-rows / -tree with aria-pressed); Rows, a plain list, is the
 * default there.
 */
const t = (id: string) => `[data-tour="${id}"]`
const COVER = t('asset-plan-coverage')

export const PAGE_TOUR: PageTour = {
  id: 'assets',
  route: '^/assets/?$',
  intro: {
    page: 'Assets',
    purpose: 'The equipment you look after for your customers, with its photos, documents and full service history.',
    covers: ['Finding equipment', 'One piece of equipment', 'Covered by a plan', 'Service history', 'Building a service agreement'],
  },
  steps: [
    { id: 'header', selector: t('assets-header'), title: 'Assets', say: 'The equipment you look after, at your customers’ properties.' },
    { id: 'no-types', selector: t('assets-no-types'), title: 'Set up types first', say: 'Before adding equipment, set up the kinds you work on. It only takes a minute.' },
    { id: 'new', selector: t('assets-new'), title: 'New asset', say: 'Add a piece of equipment, or scan its label.' },
    { id: 'filters', selector: t('assets-filters'), title: 'Find it', say: 'Search by name, code or serial number, or narrow by type, property or group.' },
    { id: 'view', when: FOCUS, selector: t('assets-view'), title: 'Rows or Location tree', say: 'Rows lists every piece of equipment. Location tree groups it by property.' },
    {
      id: 'list', selector: t('assets-list'), title: 'Your equipment', say: 'Grouped by property. Click any item to open it.',
      variants: [
        { when: `${t('assets-view-rows')}[aria-pressed="true"]`, say: 'Every piece of equipment in one list. Click any item to open it.' },
      ],
    },

    // ── One asset (the window) ──
    {
      id: 'coverage', selector: COVER, title: 'Service plan', say: '',
      variants: [
        { when: `${COVER}[data-covered="yes"]`, title: 'Covered by plan', say: 'This one is covered by a service plan. Click the plan’s name to open the agreement.' },
        { when: `${COVER}[data-covered="no"]`, title: 'Not on a plan', say: 'This one isn’t on a service plan yet.' },
      ],
    },
    {
      id: 'build', selector: t('assets-build-agreement'), title: 'Build service agreement', say: 'Build a service agreement for this equipment: what’s covered, how often, and the price.',
      variants: [
        { when: `${COVER}[data-covered="no"]`, say: 'Want to look after it on a schedule? Build service agreement writes one up for this equipment.' },
      ],
    },
    { id: 'details', selector: t('assets-edit'), title: 'The details', say: 'Name, type, where it is, and its serial and model.' },
    { id: 'photos', selector: t('asset-photos'), title: 'Photos and documents', say: 'Photos, manuals and documents, and the parts installed in it.' },
    { id: 'history', selector: t('asset-history'), title: 'Service history', say: 'Every quote and job that touched it, parts put in, and what techs noted on site, newest first. Add a note just above.' },
  ],
}
