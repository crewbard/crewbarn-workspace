import type { PageTour } from '../types'

/**
 * Connections → Twilio setup wizard (/tool-shed/communication/twilio/setup).
 * Three cards: what it does, your details, test it. Only the card the
 * person is on is on the page; the others are skipped.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'twilio-setup',
  route: '^/tool-shed/communication/twilio/setup/?$',
  intro: {
    page: 'Set up your Twilio number',
    purpose: 'About five minutes to send customer texts from your own Twilio number. You can switch back to CrewBarn sending them any time.',
    covers: ['What it does', 'Your details', 'A test text', 'Switching it on'],
  },
  steps: [
    {
      id: 'header', selector: t('wizard-header'),
      title: 'Your own Twilio number',
      say: 'Texts come from your number, and replies still land in your CrewBarn inbox.',
    },
    {
      id: 'steps', selector: t('wizard-steps'),
      title: 'Three short steps',
      say: 'What it does, your details, and a test. Cancel works at every step.',
    },
    {
      id: 'step1', selector: t('wizard-step1'),
      title: 'What it does, and what it won’t',
      say: 'It changes customer texts only. Sign-in codes and staff messages stay with CrewBarn, and nobody is texted while you set it up.',
    },
    {
      id: 'next', when: t('wizard-step1'),
      title: 'Have these ready',
      say: 'From your Twilio dashboard you’ll need your Account SID, an Auth token, and the number customers will see. Press Continue when you have them.',
    },
    {
      id: 'step2', selector: t('wizard-step2'),
      title: 'Your details',
      say: 'Paste the three details from Twilio. The Auth token is locked away and never shown again.',
    },
    {
      id: 'step3', selector: t('wizard-step3'),
      title: 'Send yourself a test',
      say: 'Type your own mobile number and send a test. It only goes to you, never to a customer.',
    },
    {
      id: 'go-live', selector: t('wizard-golive'),
      title: 'Switch it on',
      say: 'Once the test works, tick this to send customer texts from your number. Untick it to go back to CrewBarn.',
    },
  ],
}
