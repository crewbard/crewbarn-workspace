import type { PageTour } from '../types'

/**
 * Connections → Where your email comes from (/tool-shed/communication/email).
 *
 *   email-domain  data-state = none | pending | verified
 */
const t = (id: string) => `[data-tour="${id}"]`
const DOMAIN = (s: string) => `${t('email-domain')}[data-state="${s}"]`

export const PAGE_TOUR: PageTour = {
  id: 'email-sender',
  route: '^/tool-shed/communication/email/?$',
  intro: {
    page: 'Where your email comes from',
    purpose: 'Quotes, invoices and job updates go out by email. Proving you’re allowed to send from your own address keeps them out of junk folders. It’s a few records, once.',
    covers: ['Until you do this', 'Your domain', 'The records to add', 'Testing it'],
  },
  steps: [
    {
      id: 'header', selector: t('email-sender-header'),
      title: 'Where your email comes from',
      say: 'Set this up once, and every email you send looks like it comes from you.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see how email is set up, but not change it.',
    },
    {
      id: 'fallback', selector: t('email-sender-fallback'),
      title: 'Until you do this',
      say: 'Email still goes out. It just comes from a CrewBarn address with your name on it, which junk filters like less.',
    },
    {
      id: 'domain', selector: t('email-domain'), title: 'Your domain', say: '',
      variants: [
        { when: DOMAIN('none'), title: 'Add your domain', say: 'Type your website’s domain and the address to send from. Your normal inbox isn’t touched.' },
        { when: DOMAIN('pending'), title: 'Almost there', say: 'Your domain is added, but not checked yet. Add the records below where your domain is hosted.' },
        { when: DOMAIN('verified'), title: 'Sending as you', say: 'Your domain is checked, so customer email comes from your own address.' },
      ],
    },
    {
      id: 'mode', selector: t('email-domain-mode'),
      title: 'Who sends it',
      say: 'Let CrewBarn handle the sending, or use your own sending account if you have one.',
    },
    {
      id: 'name', selector: t('email-domain-name'),
      title: 'Your domain',
      say: 'Just the domain, the part after the at sign in your email address.',
    },
    {
      id: 'from', selector: t('email-domain-from'),
      title: 'Send from',
      say: 'The address customers see in their inbox.',
    },
    {
      id: 'create', selector: t('email-domain-create'),
      title: 'Get my records',
      say: 'This works out the records you need to add next.',
    },
    {
      id: 'summary', selector: t('email-domain-summary'),
      title: 'Your domain and sending',
      say: 'Your domain, and whether sending from it is checked yet.',
    },
    {
      id: 'howto', selector: t('email-domain-howto'),
      title: 'How to add the records',
      say: 'Open the DNS settings wherever your domain lives, add each record exactly as shown, and leave your existing mail records alone.',
    },
    {
      id: 'actions', selector: t('email-domain-actions'), title: 'Check and test',
      say: 'Check outbound DNS looks for your records. Once they’re found, send yourself a test email.',
      variants: [
        { when: DOMAIN('verified'), say: 'Send a test to yourself any time. Remove takes you back to the CrewBarn address.' },
      ],
    },
    {
      id: 'smtp', selector: t('email-sender-smtp'),
      title: 'Your own mail server',
      say: 'Almost nobody needs this. It’s only for companies that must send everything through their own mail server.',
    },
  ],
}
