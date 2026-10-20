import type { PageTour } from '../types'

/**
 * Jobs & workflow → How long a field video can be
 * (/tool-shed/preferences/video-length). A focused setting page with a number.
 *
 *   setting-control  data-setting-value = seconds
 */
const t = (id: string) => `[data-tour="${id}"]`
const seconds = (page: { find: (s: string) => HTMLElement | null }) =>
  Number(page.find(t('setting-control'))?.dataset.settingValue ?? NaN)

export const PAGE_TOUR: PageTour = {
  id: 'video-length',
  route: '^/tool-shed/preferences/video-length/?$',
  intro: {
    page: 'How long a field video can be',
    purpose: 'Set the longest video a tech can record on a job. Shorter clips upload faster on a weak signal.',
    covers: ['Seconds per clip', 'What it means', 'What it changes', 'Saving'],
  },
  steps: [
    {
      id: 'title', selector: t('setting-title'),
      title: 'Field videos',
      say: 'Your crew can record short videos on a job. This sets how long each one can be.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see this setting, but not change it. Ask an owner or admin if it needs to change.',
    },
    {
      id: 'control', selector: t('setting-control'), title: 'Seconds per clip',
      say: 'Pick anywhere from five seconds to five minutes, in steps of five.',
      variants: [
        { when: (page) => seconds(page) >= 120, say: 'Clips can run two minutes or more. That’s long enough for a walk-through, but slow to upload from a weak signal.' },
        { when: (page) => seconds(page) <= 30, say: 'Clips stop at thirty seconds or less. Long enough to show the problem, quick to upload from a driveway.' },
      ],
    },
    {
      id: 'what', selector: t('setting-consequences'),
      title: 'With this choice',
      say: 'The phone app stops recording at this length. If they need more, they can record another clip.',
    },
    {
      id: 'scope', selector: t('setting-scope'),
      title: 'New videos only',
      say: 'It applies to new recordings. Videos already uploaded stay as they are.',
    },
    {
      id: 'save', selector: t('setting-savebar'),
      title: 'Save or cancel',
      say: 'Nothing changes until you press Save change. Cancel puts it back the way it was.',
    },
  ],
}
