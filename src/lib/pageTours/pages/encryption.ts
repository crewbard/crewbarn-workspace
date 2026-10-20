import type { PageTour } from '../types'

/**
 * Account & billing → Data encryption (BYOK) (/tool-shed/encryption).
 *
 * Two states: on (byok-status shows) or off (the warning and set-up show).
 *   byok-provider data-ready = yes | no   (the picked cloud is available)
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'encryption',
  route: '^/tool-shed/encryption/?$',
  intro: {
    page: 'Data encryption',
    purpose: 'Lock your private files with a key you own, kept in your own Google Cloud or Amazon account. It’s for businesses that must hold their own key, and it’s serious: lose the key and those files are gone.',
    covers: ['Whether it’s on', 'The warning', 'Setting up your key', 'Turning it on'],
  },
  steps: [
    {
      id: 'header', selector: t('byok-header'),
      title: 'Your own key',
      say: 'Normally CrewBarn looks after the keys that lock your private files. This page lets you use your own key instead.',
    },

    // ── On ──
    {
      id: 'status', selector: t('byok-status'),
      title: 'It’s on',
      say: 'Your own key is in use. This shows which key and when it was turned on. Disabling it moves your files back to CrewBarn’s keys, but only while your key still works.',
    },

    // ── Off ──
    {
      id: 'warning', selector: t('byok-warning'),
      title: 'Read this first',
      say: 'Please read this first. If you lose or delete your key, your private files are gone for good. Nobody at CrewBarn can get them back. Keep your own backups.',
    },
    {
      id: 'provider', selector: t('byok-provider'), title: 'Where your key lives',
      say: 'Pick the cloud your key is in: Google Cloud or Amazon.',
      variants: [
        {
          when: `${t('byok-provider')}[data-ready="no"]`,
          say: 'Pick the cloud your key is in. The one picked isn’t available for your account yet, so contact CrewBarn support to set it up.',
        },
      ],
    },
    {
      id: 'steps', selector: t('byok-steps'),
      title: 'Setting up your key',
      say: 'These steps show how to make the key in your cloud account and let CrewBarn use it. The links open the right page there.',
    },
    {
      id: 'agreement', selector: t('byok-enable'),
      title: 'The agreement',
      say: 'Read the agreement. It spells out exactly what you’re taking on.',
    },
    {
      id: 'key', selector: t('byok-key'),
      title: 'Turn it on',
      say: 'Paste your key’s name, tick that you understand, then press Enable encryption with my key. We check the key works before anything changes.',
    },
  ],
}
