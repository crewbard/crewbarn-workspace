import type { PageTour } from '../types'

/**
 * Jobs & workflow → Checking a tech in when they arrive
 * (/tool-shed/preferences/auto-check-in). A focused setting page.
 *
 *   setting-control  data-setting-value = true | false
 *   settings-read-only  shown to people who can look but not change it
 *   setting-savebar  only while a change is waiting to be saved
 */
const t = (id: string) => `[data-tour="${id}"]`
const ON = `${t('setting-control')}[data-setting-value="true"]`
const OFF = `${t('setting-control')}[data-setting-value="false"]`

export const PAGE_TOUR: PageTour = {
  id: 'auto-check-in',
  route: '^/tool-shed/preferences/auto-check-in/?$',
  intro: {
    page: 'Checking a tech in when they arrive',
    purpose: 'Let the phone notice when a tech reaches the job and start the visit for them, so arrival times are honest without anyone remembering.',
    covers: ['On or off', 'What it changes', 'What it never does', 'Saving'],
  },
  steps: [
    {
      id: 'title', selector: t('setting-title'),
      title: 'Automatic check-in',
      say: 'This one setting decides whether a visit starts by itself when the tech pulls up, or when they press check in.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see this setting, but not change it. Ask an owner or admin if it needs to change.',
    },
    {
      id: 'control', selector: t('setting-control'), title: 'On or off',
      say: 'Pick On to start visits from the phone’s location, or Off to keep check-in by hand.',
      variants: [
        { when: ON, title: 'It’s on', say: 'It’s on. Reaching the job address starts the visit, and the tech can still check in by hand if the location is a little off.' },
        { when: OFF, title: 'It’s off', say: 'It’s off, so techs press check in themselves. Pick On to let the phone do it when they arrive.' },
      ],
    },
    {
      id: 'what', selector: t('setting-consequences'),
      title: 'With this choice',
      say: 'This box spells out what your choice means, and it changes as you pick.',
      variants: [
        { when: ON, say: 'It needs location turned on in the phone app. Without that, nothing changes and the tech checks in as before.' },
      ],
    },
    {
      id: 'scope', selector: t('setting-scope'),
      title: 'What it never does',
      say: 'It only starts visits. It never ends one, and it never clocks anybody out.',
    },
    {
      id: 'save', selector: t('setting-savebar'),
      title: 'Save or cancel',
      say: 'Nothing changes until you press Save change. Cancel puts it back the way it was.',
    },
    {
      id: 'where',
      title: 'Where you’ll see it',
      say: 'On each job’s visit times, and on the schedule, where arrivals show up as they happen.',
    },
  ],
}
