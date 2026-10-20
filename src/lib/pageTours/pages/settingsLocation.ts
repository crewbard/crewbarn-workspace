import type { PageTour } from '../types'

/**
 * Your business → Where your settings live (/tool-shed/settings-location).
 * Drawn by the shared focused-setting page; its control carries
 * data-setting-value = connect | both, which follows the choice as it's made.
 */
const t = (id: string) => `[data-tour="${id}"]`
const value = (v: string) => `${t('setting-control')}[data-setting-value="${v}"]`

export const PAGE_TOUR: PageTour = {
  id: 'settings-location',
  route: '^/tool-shed/settings-location/?$',
  intro: {
    page: 'Where your settings live',
    purpose: 'Choose whether company settings live only here in Connect, or in the CrewBarn app as well, so your crew’s app stays about the work.',
    covers: ['The two choices', 'What changes', 'Saving'],
  },
  steps: [
    {
      id: 'title', selector: t('setting-title'), title: 'Where your settings live',
      say: 'Company settings are run from Connect, so the app your crew works in stays about the work. If you’d rather have them in both places, you can.',
      variants: [
        {
          when: t('settings-read-only'), selector: t('settings-read-only'), title: 'View only',
          say: 'You can see this choice but not change it. Ask an owner or admin.',
        },
      ],
    },
    {
      id: 'choice', selector: t('setting-control'), title: 'Pick one',
      say: 'Pick only here, on Connect, or here and in the app as well.',
      variants: [
        {
          when: value('connect'),
          say: 'Right now settings live only here, on Connect. The app keeps just what people open mid-job, like stock, catalogs and company files.',
        },
        {
          when: value('both'),
          say: 'Right now every setting is listed here and in the app as well. Handy if one person runs the office and works the schedule too.',
        },
      ],
    },
    {
      id: 'consequences', selector: t('setting-consequences'),
      title: 'With this choice',
      say: 'This box spells out what happens with the choice you’ve picked. It changes as you switch.',
    },
    {
      id: 'scope', selector: t('setting-scope'),
      title: 'Nothing is taken away',
      say: 'This only changes what’s listed in a menu. No setting is switched off, and nobody loses access.',
    },
    {
      id: 'save', selector: t('setting-savebar'),
      title: 'Save change',
      say: 'Nothing is saved yet. Save change keeps your new choice, and Cancel puts it back.',
    },
  ],
}
