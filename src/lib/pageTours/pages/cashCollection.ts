import type { PageTour } from '../types'

/**
 * Money → Stopping new work when cash has not been handed in
 * (/tool-shed/preferences/cash-collection). Drawn by the shared
 * focused-setting page.
 *
 * States: setting-control data-setting-value = true | false;
 * settings-read-only; setting-savebar while a change is unsaved.
 */
const t = (id: string) => `[data-tour="${id}"]`
const ON = `${t('setting-control')}[data-setting-value="true"]`
const OFF = `${t('setting-control')}[data-setting-value="false"]`

export const PAGE_TOUR: PageTour = {
  id: 'cash-collection',
  route: '^/tool-shed/preferences/cash-collection/?$',
  intro: {
    page: 'Cash hand-in rule',
    purpose: 'Decide whether a tech who collected cash on a job has to hand it in before starting their next one.',
    covers: ['On or off', 'What it means for your techs', 'Saving'],
  },
  steps: [
    { id: 'title', selector: t('setting-title'), title: 'Cash from the field', say: 'When a tech collects cash on a job, this decides whether they can keep working before it’s handed in.' },
    { id: 'read-only', selector: t('settings-read-only'), title: 'View only', say: 'You can see this setting but not change it. An owner or admin can.' },
    {
      id: 'control', selector: t('setting-control'), title: 'On or off',
      say: 'Pick whether to stop new work until cash is handed in.',
      variants: [
        { when: ON, say: 'It’s on: a tech with cash outstanding can’t start their next job until it’s recorded.' },
        { when: OFF, say: 'It’s off: techs keep working with cash outstanding, and you chase it yourself.' },
      ],
    },
    {
      id: 'consequences', selector: t('setting-consequences'), title: 'What happens',
      say: 'This box says what your techs will see.',
      variants: [
        { when: ON, say: 'A tech who owes cash sees what’s outstanding instead of their next job. Someone in training can be let off on their staff record.' },
        { when: OFF, say: 'Nothing blocks a tech. Uncollected cash still shows in the office.' },
      ],
    },
    { id: 'scope', selector: t('setting-scope'), title: 'Cash jobs only', say: 'It only affects cash-on-delivery jobs. Card and invoiced work is never blocked.' },
    { id: 'save', selector: t('setting-savebar'), title: 'Save it', say: 'Nothing is saved yet. Save change keeps it; Cancel puts it back.' },
  ],
}
