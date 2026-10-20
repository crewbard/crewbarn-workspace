import type { PageTour } from '../types'

/**
 * Your business → Modules (/tool-shed/modules).
 *
 * The page marks its state for the tour:
 *   modules-grid data-all-on = yes | no
 *   modules-save data-dirty = yes | no
 *   modules-read-only shows for people who can look but not change.
 *   modules-placement is the first area's Work navigation shortcut choice
 *   (Show in Work / Hide from Work); areas with no pages of their own have none.
 */
const t = (id: string) => `[data-tour="${id}"]`
const READ_ONLY = t('modules-read-only')

export const PAGE_TOUR: PageTour = {
  id: 'modules',
  route: '^/tool-shed/modules/?$',
  intro: {
    page: 'Modules',
    purpose: 'Switch whole parts of CrewBarn on or off for everyone, so your crew only sees what your business uses. Nothing is deleted, and it doesn’t change your bill.',
    covers: ['Starting from a setup', 'Switching areas on and off', 'Shortcuts in Work', 'What depends on what', 'Saving'],
  },
  steps: [
    {
      id: 'header', selector: t('modules-header'),
      title: 'Build your dashboard',
      say: 'Tick what your business uses. Everything else leaves the menus and the phone apps for everyone. The number shows how many areas are on.',
    },
    {
      id: 'read-only', selector: READ_ONLY,
      title: 'View only',
      say: 'You can look, but only someone allowed to change settings can switch areas on or off.',
    },
    {
      id: 'presets', selector: t('modules-presets'),
      title: 'Start with a setup',
      say: 'Not sure where to start? Pick a setup that fits how you work. You’ll be asked first, it saves straight away, and you can change anything after.',
    },
    {
      id: 'catalog', selector: t('modules-catalog'), title: 'Make it yours',
      say: 'Every area of CrewBarn is listed below. Some are switched off.',
      variants: [
        {
          when: `${t('modules-grid')}[data-all-on="yes"]`,
          say: 'Every area of CrewBarn is listed below, and right now they’re all on. Switch off any your business doesn’t use.',
        },
      ],
    },
    {
      id: 'switch', selector: t('modules-switch'),
      title: 'Switch an area',
      say: 'Each area has a switch, a line on what it does, and where it shows up. Areas marked always on hold the rest of CrewBarn together.',
    },
    {
      id: 'placement', selector: t('modules-placement'),
      title: 'Work navigation shortcut',
      say: 'For an area that’s on, Show in Work keeps its shortcut in the work menus, and Hide from Work takes it out to keep them short. Its settings stay in Connect, and nobody’s access changes.',
    },
    {
      id: 'depends', selector: t('modules-grid'),
      title: 'What depends on what',
      say: 'Some areas need another one on. If so, the card says which. Switching one off also tells you what else goes with it.',
    },
    {
      id: 'save', selector: t('modules-save'), when: `!${READ_ONLY}`, title: 'Save dashboard',
      say: 'Switches you flip, and shortcuts you show or hide, wait here until you press Save dashboard.',
      variants: [
        {
          when: `${t('modules-save')}[data-dirty="yes"]`,
          say: 'You have changes that aren’t saved yet. Save dashboard puts them in place for everyone, and Discard changes puts them back.',
        },
      ],
    },
  ],
}
