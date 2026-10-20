import type { PageTour } from '../types'

/**
 * Developers → Self-hosted console (/tool-shed/self-hosted).
 *
 *   self-hosted-quick    data-cf = connected | off (Cloudflare linked)
 *   self-hosted-domains  data-state = empty | list
 *   self-hosted-activate only for people who can edit settings
 */
const t = (id: string) => `[data-tour="${id}"]`
const CF = `${t('self-hosted-quick')}[data-cf="connected"]`

export const PAGE_TOUR: PageTour = {
  id: 'self-hosted',
  route: '^/tool-shed/self-hosted/?$',
  intro: {
    page: 'Self-hosted console',
    purpose: 'Run the office console on your own web address. Your data, logins and keys stay here on CrewBarn. The console just talks to it.',
    covers: ['Quick setup with Cloudflare', 'Doing it by hand', 'Activating a domain', 'Your domains'],
  },
  steps: [
    {
      id: 'header', selector: t('self-hosted-header'),
      title: 'Self-hosted console',
      say: 'One activation token for each web address you run the console on.',
    },
    {
      id: 'quick', selector: t('self-hosted-quick'), title: 'Quick setup',
      say: 'The easy way: connect Cloudflare first, then come back here and CrewBarn sets the console up for you.',
      variants: [
        { when: CF, say: 'Cloudflare is connected, so pick a domain here and CrewBarn sets the console up in your account.' },
      ],
    },
    {
      id: 'manual', selector: t('self-hosted-manual'),
      title: 'Doing it by hand',
      say: 'Prefer your own server? Activate the domain, paste the token into the console, and manage it from here.',
    },
    {
      id: 'level', selector: t('self-hosted-level'),
      title: 'Your level',
      say: 'New tokens follow your subscription, and renew themselves on a schedule.',
    },
    {
      id: 'reveal', selector: t('self-hosted-reveal'),
      title: 'Your activation token',
      say: 'This is shown only once. Paste it into the console’s setup page now.',
    },
    {
      id: 'activate', selector: t('self-hosted-activate'),
      title: 'Activate a domain',
      say: 'Type the address the console will live at, and press Get token.',
    },
    {
      id: 'domains', selector: t('self-hosted-domains'), title: 'Activated domains', say: '',
      variants: [
        { when: `${t('self-hosted-domains')}[data-state="empty"]`, say: 'No domains yet. Activate one above, then install the console.' },
        { when: `${t('self-hosted-domains')}[data-state="list"]`, say: 'Each address, when its token was issued and last seen. Rotate gives it a new token. Revoke stops that console at once.' },
      ],
    },
    {
      id: 'how', selector: t('self-hosted-how'),
      title: 'How it works',
      say: 'Your team signs in with their normal logins, and phone, payment, email and AI keys stay set here, never on your server.',
    },
  ],
}
