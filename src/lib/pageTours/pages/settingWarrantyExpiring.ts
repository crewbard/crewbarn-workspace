import type { PageTour } from '../types'

/**
 * Jobs & workflow → When to warn you a warranty is running out
 * (/tool-shed/warranty-settings/expiring).
 *
 *   setting-control  data-setting-value = days of notice (0 = no early warning)
 */
const t = (id: string) => `[data-tour="${id}"]`
const NONE = `${t('setting-control')}[data-setting-value="0"]`

export const PAGE_TOUR: PageTour = {
  id: 'warranty-expiring',
  route: '^/tool-shed/warranty-settings/expiring/?$',
  intro: {
    page: 'When to warn you a warranty is running out',
    purpose: 'Get a heads-up before a customer’s warranty ends, so you can offer the work while it’s still covered.',
    covers: ['Days of notice', 'What gets flagged', 'Emailing the customer', 'Saving'],
  },
  steps: [
    {
      id: 'title', selector: t('setting-title'),
      title: 'Warranty heads-up',
      say: 'CrewBarn can flag warranties before they end. This sets how much notice you get.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see this setting, but not change it. Ask an owner or admin if it needs to change.',
    },
    {
      id: 'control', selector: t('setting-control'), title: 'Days of notice',
      say: 'Pick how many days before the end date a warranty shows as expiring soon.',
      variants: [
        { when: NONE, title: 'No early warning', say: 'It’s set to zero, so nothing is flagged early. Use the plus to get a warning before warranties end.' },
      ],
    },
    {
      id: 'what', selector: t('setting-consequences'),
      title: 'What gets flagged',
      say: 'Those jobs show on the dashboard so someone can act. This setting sends nothing by itself.',
      variants: [
        { when: NONE, say: 'With zero, a warranty simply ends on its date with no warning.' },
      ],
    },
    {
      id: 'scope', selector: t('setting-scope'),
      title: 'The warranties stay the same',
      say: 'It only changes what’s highlighted. No cover is shortened or extended. It’s the same number as on the Warranty settings page.',
    },
    {
      id: 'save', selector: t('setting-savebar'),
      title: 'Save or cancel',
      say: 'Nothing changes until you press Save change. Cancel puts it back the way it was.',
    },
    {
      id: 'email',
      title: 'Emailing the customer',
      say: 'Want the customer told too? Turn on the warranty expiring reminder in Automations, and they’re emailed when their warranty enters this window.',
    },
  ],
}
