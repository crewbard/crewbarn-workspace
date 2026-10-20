import type { PageTour } from '../types'

/**
 * Team → Security & two-factor (/tool-shed/security).
 *
 * The page is the signed-in person's own two-factor, plus links to the
 * company-wide rules for people who can see settings.
 *
 *   my-security-methods  data-2fa = on | off
 *   my-security-totp / my-security-channel  a setup in progress
 *   my-security-recovery  recovery codes, shown once after setup
 */
const t = (id: string) => `[data-tour="${id}"]`
const ON = `${t('my-security-methods')}[data-2fa="on"]`

export const PAGE_TOUR: PageTour = {
  id: 'security',
  route: '^/tool-shed/security/?$',
  intro: {
    page: 'Security & two-factor',
    purpose: 'Protect your own sign-in with a one-time code on top of your password, and find the rules that apply to your whole team.',
    covers: ['Your two-factor', 'Ways to get a code', 'Recovery codes', 'Company rules'],
  },
  steps: [
    {
      id: 'header', selector: t('tenant-security-header'),
      title: 'Security & two-factor',
      say: 'Two-factor means a thief with your password still can’t get in without the code.',
    },
    {
      id: 'mine', selector: t('my-security-header'),
      title: 'This is your own login',
      say: 'Everything in this part protects your own sign-in, the email shown here, not anyone else’s.',
    },
    {
      id: 'recovery', selector: t('my-security-recovery'),
      title: 'Save your recovery codes',
      say: 'Write these down somewhere safe. Each one gets you in once if you lose your phone, and they’re only shown now.',
    },
    {
      id: 'status', selector: t('my-security-methods'), title: 'Two-factor is off', say: '',
      variants: [
        { when: t('my-security-totp'), title: 'Setting up an app', say: 'Scan this code with an authenticator app on your phone, then type the six numbers it shows to finish.' },
        { when: t('my-security-channel'), title: 'Setting up codes', say: 'We send a code to the number or email already on file. Type it in to finish.' },
        { when: ON, selector: t('my-security-enabled'), title: 'Two-factor is on', say: 'Two-factor is on. You’ll be asked for a six-digit code each time you sign in.' },
        { when: t('my-security-off'), selector: t('my-security-off'), say: 'Two-factor is off. Pick a way to get your codes below. It takes about a minute.' },
      ],
    },
    {
      id: 'choose', selector: t('my-security-choose'), title: 'Ways to get a code',
      say: 'An authenticator app is the safest and works with no signal. Email or text send you a code each time you sign in.',
      variants: [
        { when: ON, title: 'Change how you get codes', say: 'Switch to a different way any time, and stay protected while you do. Switching gives you new recovery codes.' },
      ],
    },
    {
      id: 'turn-off', selector: t('my-security-turn-off'),
      title: 'Turning it off',
      say: 'You can turn two-factor off here, unless your company requires it for your account.',
    },
    {
      id: 'rules', selector: t('tenant-security-rules'),
      title: 'Company security rules',
      say: 'Which code methods your team may use, and who can delete records, are set in your shop rules. These links take you there.',
    },
  ],
}
