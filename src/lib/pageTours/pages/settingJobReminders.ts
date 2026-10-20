import type { PageTour } from '../types'

/**
 * Jobs & workflow → Reminders before an appointment
 * (/tool-shed/preferences/reminders). The company switch for reminders; the
 * rules themselves are on the reminder timeline.
 *
 *   setting-control  data-setting-value = true | false
 */
const t = (id: string) => `[data-tour="${id}"]`
const ON = `${t('setting-control')}[data-setting-value="true"]`
const OFF = `${t('setting-control')}[data-setting-value="false"]`

export const PAGE_TOUR: PageTour = {
  id: 'job-reminders',
  route: '^/tool-shed/preferences/reminders/?$',
  intro: {
    page: 'Reminders before an appointment',
    purpose: 'The one switch for appointment reminders: before the visit, when it starts late, and when the tech is on the way.',
    covers: ['On or off', 'What it sends', 'Your rules stay put', 'The reminder timeline'],
  },
  steps: [
    {
      id: 'title', selector: t('setting-title'),
      title: 'Appointment reminders',
      say: 'This is the company switch for reminders. Your customers can hear from you before a visit without anyone remembering to send it.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see this setting, but not change it. Ask an owner or admin if it needs to change.',
    },
    {
      id: 'control', selector: t('setting-control'), title: 'On or off',
      say: 'On, and reminders go out by themselves. Off, and nothing goes out on its own.',
      variants: [
        { when: ON, title: 'Reminders are on', say: 'Reminders are on. Customers hear from you before the visit, if it starts late, and when the tech is on the way.' },
        { when: OFF, title: 'Reminders are off', say: 'Reminders are off, so nothing goes out on its own. Pick On, then Save change, to start sending them.' },
      ],
    },
    {
      id: 'what', selector: t('setting-consequences'),
      title: 'With this choice',
      say: 'This spells out what your choice does. With it on, only jobs with a scheduled time and an assigned tech get reminders.',
    },
    {
      id: 'scope', selector: t('setting-scope'),
      title: 'Your rules stay put',
      say: 'Turning it off keeps your reminder rules saved. It only stops them going out.',
    },
    {
      id: 'timeline', selector: t('setting-aside'),
      title: 'The reminder timeline',
      say: 'This link opens the timeline, where you choose who gets a reminder, when, and what it says.',
    },
    {
      id: 'save', selector: t('setting-savebar'),
      title: 'Save or cancel',
      say: 'Nothing changes until you press Save change. Cancel puts it back the way it was.',
    },
  ],
}
