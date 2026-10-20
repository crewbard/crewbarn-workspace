import type { PageTour } from '../types'

/**
 * CBI AI → Talking to CBI (/tool-shed/ai/voice).
 *
 *   ai-voice-toggle  data-voice = on | off (the saved setting)
 */
const t = (id: string) => `[data-tour="${id}"]`
const TOGGLE = t('ai-voice-toggle')

export const PAGE_TOUR: PageTour = {
  id: 'ai-voice',
  route: '^/tool-shed/ai/voice/?$',
  intro: {
    page: 'Talking to CBI',
    purpose: 'Let your crew ask CrewBarn things out loud in the crew app, handy with full hands or a phone on the dash.',
    covers: ['The wake word', 'On or off for everyone', 'What it needs'],
  },
  steps: [
    {
      id: 'header', selector: t('ai-voice-header'),
      title: 'Talking to CBI',
      say: 'Your crew says Hey CrewBarn, then asks their question.',
    },
    {
      id: 'card', selector: t('ai-voice-card'),
      title: 'How it listens',
      say: 'The phone listens for the wake word by itself, even with no signal, and nothing is sent anywhere while it waits.',
    },
    {
      id: 'toggle', selector: TOGGLE, title: 'On or off for everyone',
      say: 'This switches the wake word on or off for the whole crew.',
      variants: [
        { when: `${TOGGLE}[data-voice="on"]`, title: 'It’s on', say: 'It’s on for everyone. Each person can still turn it off on their own phone.' },
        { when: `${TOGGLE}[data-voice="off"]`, title: 'It’s off', say: 'It’s off, so the crew app doesn’t listen at all. Tick it and save to turn it on.' },
      ],
    },
    {
      id: 'save', selector: t('ai-voice-save'),
      title: 'Save',
      say: 'Save voice settings keeps your change.',
    },
    {
      id: 'footer', selector: t('ai-voice-footer'),
      title: 'What it needs',
      say: 'The wake word needs no key. Turning what’s said after it into text uses an OpenAI key, whichever AI you use for everything else.',
    },
  ],
}
