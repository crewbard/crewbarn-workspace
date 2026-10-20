import type { PageTour } from '../types'

/**
 * Customers & sites → Territories (/tool-shed/territories).
 *
 *   territories-empty  no territories yet
 *   territories-row    data-dispatch = assigned | none
 *   territory-form-*   only while the Add or Edit box is open
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'territories',
  route: '^/tool-shed/territories/?$',
  intro: {
    page: 'Territories',
    purpose: 'Split the area you cover into territories, by county and ZIP code, and choose who dispatches each one.',
    covers: ['Your territories', 'Adding one', 'Counties and ZIP codes', 'Dispatchers'],
  },
  steps: [
    {
      id: 'header', selector: t('territories-header'),
      title: 'Your service areas',
      say: 'A territory is an area you cover. Jobs land in one by their address, and its dispatchers look after them.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see your territories, but not change them. Ask an owner or admin if something needs updating.',
    },
    {
      id: 'add', selector: t('territories-add'),
      title: 'Add territory',
      say: 'Add territory starts a new one. Pick a county and its ZIP codes fill in for you.',
    },
    {
      id: 'empty', selector: t('territories-empty'),
      title: 'None yet',
      say: 'No territories yet. If you work in one area, you may not need any. Add one for each county or area once you grow.',
    },
    {
      id: 'row', selector: t('territories-row'),
      title: 'One territory',
      say: 'Each row shows the county, how many ZIP codes it covers, and who dispatches it. Primary marks your main area.',
    },
    {
      id: 'no-dispatch', selector: `${t('territories-row')}[data-dispatch="none"]`,
      title: 'Nobody dispatching',
      say: 'This one has no dispatcher yet. Press Edit to choose who looks after its jobs.',
    },
    {
      id: 'form-county', selector: t('territory-form-county'),
      title: 'County',
      say: 'Start typing a county and pick it from the list. Its ZIP codes are added for you.',
    },
    {
      id: 'form-zips', selector: t('territory-form-zips'),
      title: 'ZIP codes',
      say: 'A job joins this territory when its address is in one of these ZIP codes. Add or remove any by hand.',
    },
    {
      id: 'form-dispatchers', selector: t('territory-form-dispatchers'),
      title: 'Dispatchers',
      say: 'Tick who dispatches this area. They open Dispatch here by default. Pick more than one for backup.',
    },
    {
      id: 'form-flags', selector: t('territory-form-flags'),
      title: 'Primary and active',
      say: 'Primary marks your main territory. Untick Active to set one aside without deleting it.',
    },
  ],
}
