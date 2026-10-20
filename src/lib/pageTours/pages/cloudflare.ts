import type { PageTour } from '../types'

/**
 * Connections → Connect Cloudflare (/tool-shed/cloudflare).
 *
 *   cloudflare-header  data-cf = connected | off
 *   cloudflare-new     only before any account is linked
 *   cloudflare-domain  once a token is checked (step two)
 *   cloudflare-results after setting up (step three)
 */
const t = (id: string) => `[data-tour="${id}"]`
const ON = `${t('cloudflare-header')}[data-cf="connected"]`

export const PAGE_TOUR: PageTour = {
  id: 'cloudflare',
  route: '^/tool-shed/cloudflare/?$',
  intro: {
    page: 'Connect Cloudflare',
    purpose: 'One connection sets up your website address and your own file storage, with no technical know-how needed.',
    covers: ['What it does', 'New to Cloudflare', 'Connecting your account', 'Your domain', 'The results'],
  },
  steps: [
    {
      id: 'header', selector: t('cloudflare-header'),
      title: 'Connect Cloudflare',
      say: 'Cloudflare is where your web address lives. Connect it once, and CrewBarn does the fiddly parts.',
    },
    {
      id: 'what', selector: t('cloudflare-what'),
      title: 'What it sets up',
      say: 'Your website address, optional file storage in your own account, and your own work dashboard.',
    },
    {
      id: 'status', selector: t('cloudflare-status'), title: 'Not connected yet',
      say: 'Your Cloudflare account isn’t connected yet. Follow the steps below.',
      variants: [
        { when: ON, title: 'Connected', say: 'Your Cloudflare account is connected. The link on the right sets up your own work dashboard.' },
      ],
    },
    {
      id: 'summary', selector: t('cloudflare-summary'),
      title: 'Your connection',
      say: 'The domain you picked, how many are available, and your storage space. Disconnect unlinks it.',
    },
    {
      id: 'new', selector: t('cloudflare-new'),
      title: 'New to Cloudflare?',
      say: 'No account or domain yet? Open this for a free account and buying a domain, step by step.',
    },
    {
      id: 'token', selector: t('cloudflare-token'), title: 'Step one: connect your account',
      say: 'You make a key on Cloudflare’s site with the permissions listed here. Two are filled in for you, and you add three more by hand.',
      variants: [
        { when: ON, title: 'Replace your key', say: 'Check its permissions, or paste a new key to replace the old one. You don’t need to disconnect first.' },
      ],
    },
    {
      id: 'token-actions', selector: t('cloudflare-token-actions'),
      title: 'Make the key',
      say: 'This button opens Cloudflare’s page with the first two permissions ready. Copy the key it gives you, and paste it here.',
    },
    {
      id: 'domain', selector: t('cloudflare-domain'),
      title: 'Step two: your domain',
      say: 'Pick your domain, and choose what to set up on it.',
    },
    {
      id: 'results', selector: t('cloudflare-results'),
      title: 'Step three: done',
      say: 'What was set up, and anything still waiting, like a check that takes a few minutes.',
    },
  ],
}
