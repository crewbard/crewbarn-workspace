import type { PageTour } from '../types'

/**
 * Jobs & workflow → Flashing Schedule when a tech may be late
 * (/tool-shed/preferences/late-techs). A focused setting page.
 *
 *   setting-control  data-setting-value = true | false
 *   settings-read-only  shown to people who can look but not change it
 *   setting-savebar  only while a change is waiting to be saved
 */
const t = (id: string) => `[data-tour="${id}"]`
const ON = `${t('setting-control')}[data-setting-value="true"]`
const OFF = `${t('setting-control')}[data-setting-value="false"]`

export const PAGE_TOUR: PageTour = {
  id: 'late-techs',
  route: '^/tool-shed/preferences/late-techs/?$',
  intro: {
    page: 'Flashing Schedule when a tech may be late',
    purpose: 'Make the Schedule button flash red and blue when a tech may be late for a job. The tech hears first, so the customer gets a call before they have to call you.',
    covers: ['On or off', 'What it changes', 'Who sees it', 'Saving'],
  },
  steps: [
    {
      id: 'title', selector: t('setting-title'),
      title: 'Late techs',
      say: 'This decides whether the Schedule button flashes when a tech may be late for a job.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see this setting, but not change it. Ask an owner or admin if it needs to change.',
    },
    {
      id: 'control', selector: t('setting-control'), title: 'On or off',
      say: 'Pick On to flash Schedule when a tech may be late, or Off to keep it still.',
      variants: [
        { when: ON, title: 'It’s on', say: 'It’s on. Schedule flashes until somebody in the office presses Got it, and a toast pops up if nobody does.' },
        { when: OFF, title: 'It’s off', say: 'It’s off, so nothing flashes. Late arrivals still show on the schedule cards.' },
      ],
    },
    {
      id: 'what', selector: t('setting-consequences'),
      title: 'With this choice',
      say: 'This box spells out what your choice means, and it changes as you pick.',
    },
    {
      id: 'scope', selector: t('setting-scope'),
      title: 'Who hears about it',
      say: 'The tech hears first, with a red pop-up in the phone app and an automated call. The office is told a few minutes later. This switch never calls the customer; that’s set in Shop Rules under GPS check-in.',
    },
    {
      id: 'save', selector: t('setting-savebar'),
      title: 'Save or cancel',
      say: 'Nothing changes until you press Save change. Cancel puts it back the way it was.',
    },
    {
      id: 'where',
      title: 'Where you’ll see it',
      say: 'On the Schedule button at the top of every screen, and on the Schedule page, where each late tech is listed with Got it and Open job.',
    },
  ],
}
