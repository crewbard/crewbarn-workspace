import type { PageTour } from '../types'

/**
 * Connections → Texting from your own Twilio number
 * (/tool-shed/communication/twilio). A focused setting whose control is one
 * button that opens the setup.
 *
 *   setting-control  data-setting-value = true (in use) | false
 *   setting-consequences  says "Nothing changes yet" until details are saved
 */
const t = (id: string) => `[data-tour="${id}"]`
const LIVE = `${t('setting-control')}[data-setting-value="true"]`
const NOT_SET_UP = (page: { text: (s: string) => string }) => page.text(t('setting-consequences')).includes('Nothing changes yet')

export const PAGE_TOUR: PageTour = {
  id: 'twilio-texting',
  route: '^/tool-shed/communication/twilio/?$',
  intro: {
    page: 'Texting from your own Twilio number',
    purpose: 'CrewBarn sends your texts for you by default. If you already have a Twilio account, your texts can come from your own number instead.',
    covers: ['Where your texts come from now', 'The setup', 'What it never changes'],
  },
  steps: [
    {
      id: 'title', selector: t('setting-title'),
      title: 'Your own Twilio number',
      say: 'Twilio is a company that sends texts. You’d have an account with them, not with us, and they bill you directly.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see how texting is set up, but not change it.',
    },
    {
      id: 'state', selector: t('setting-consequences'), title: 'Where texts come from', say: '',
      variants: [
        { when: NOT_SET_UP, title: 'Not set up', say: 'There are no Twilio details saved, so CrewBarn keeps sending your texts. The setup takes about five minutes.' },
        { when: LIVE, title: 'Your number is in use', say: 'Texts to customers come from your own Twilio number, and Twilio bills you for them.' },
        { when: `!${LIVE}`, title: 'Set up, not switched on', say: 'Your Twilio details are saved, but CrewBarn still sends your texts. Run the setup again to test and switch it on.' },
      ],
    },
    {
      id: 'control', selector: t('setting-control'),
      title: 'Set up my Twilio number',
      say: 'This opens a short setup: what it does, your three details from Twilio, and a test text to your own phone.',
    },
    {
      id: 'scope', selector: t('setting-scope'),
      title: 'Only customer texts',
      say: 'Only texts to customers change. Sign-in codes and messages between your own staff stay the same.',
    },
  ],
}
