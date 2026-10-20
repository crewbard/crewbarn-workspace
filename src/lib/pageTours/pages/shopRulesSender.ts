import type { PageTour } from '../types'

/**
 * Connections → Outbound sender (/tool-shed/preferences#sender). Read only
 * here; it's set on Phone, SMS & email.
 */
const t = (id: string) => `[data-tour="${id}"]`
const NOT_SET = (id: string) => (page: { text: (s: string) => string }) => page.text(t(id)).includes('Not set')

export const PAGE_TOUR: PageTour = {
  id: 'shop-rules-sender',
  route: '^/tool-shed/preferences/?$',
  hash: 'sender',
  intro: {
    page: 'Outbound sender',
    purpose: 'What customers see in the from line of your emails and texts.',
    covers: ['Email name', 'Email address', 'Text number', 'Where to change them'],
  },
  steps: [
    {
      id: 'section', selector: t('prefs-sender'), click: t('prefs-tabs-sender'),
      title: 'Outbound sender',
      say: 'This shows who your emails and texts come from. It’s for checking only.',
    },
    {
      id: 'name', selector: t('shop-rule-from_email_name'), title: 'From name',
      say: 'The name shown on your emails, usually your company name.',
      variants: [
        { when: NOT_SET('shop-rule-from_email_name'), say: 'No name is set yet, so emails show a general one. Set it on Phone, SMS and email.' },
      ],
    },
    {
      id: 'address', selector: t('shop-rule-from_email_address'), title: 'From address',
      say: 'The email address your emails come from.',
      variants: [
        { when: NOT_SET('shop-rule-from_email_address'), say: 'No address yet, so email comes from a CrewBarn address with your name on it.' },
      ],
    },
    {
      id: 'sms', selector: t('shop-rule-from_sms_number'), title: 'Text number',
      say: 'The number your texts come from.',
      variants: [
        { when: NOT_SET('shop-rule-from_sms_number'), say: 'No texting number yet. Set up texting on Phone, SMS and email.' },
      ],
    },
    {
      id: 'link', selector: t('shop-rule-sender-link'),
      title: 'Change them here',
      say: 'To change any of these, open Configure phone, SMS and email.',
    },
  ],
}
