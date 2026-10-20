import type { PageTour } from '../types'

/**
 * Connections → Call transcription (/tool-shed/communication/transcription).
 * The Phone, SMS & email page opened on its Call transcription section.
 *
 *   comms-body  data-transcription = key | none (a key is saved for the chosen service)
 */
const t = (id: string) => `[data-tour="${id}"]`
const KEY = `${t('comms-body')}[data-transcription="key"]`

export const PAGE_TOUR: PageTour = {
  id: 'call-transcription',
  route: '^/tool-shed/communication/transcription/?$',
  intro: {
    page: 'Call transcription',
    purpose: 'Turn call recordings and voicemails into text you can read and search, on your own account with the service you choose.',
    covers: ['Who transcribes', 'Your key', 'Testing it'],
  },
  steps: [
    {
      id: 'card', selector: t('comms-transcription'), click: t('comms-tabs-transcription'), waitMs: 1200, title: 'Call transcription',
      say: 'No key is saved yet, so calls aren’t turned into text. Pick a service and paste its key.',
      variants: [
        { when: KEY, say: 'A key is saved, so new calls and voicemails are turned into text. It’s separate from your AI helper.' },
      ],
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see how transcription is set up, but not change it.',
    },
    {
      id: 'provider', selector: t('comms-field-transcription_provider'),
      title: 'Who transcribes your calls',
      say: 'AssemblyAI is what we recommend. It keeps the office and the caller apart better, and writes part numbers and prices as numbers.',
    },
    {
      id: 'assembly-key', selector: t('comms-field-transcription_assemblyai_api_key'),
      title: 'Your AssemblyAI key',
      say: 'Paste the key from AssemblyAI. The link above takes you to it. A saved key shows as dots.',
    },
    {
      id: 'openai-key', selector: t('comms-field-transcription_openai_api_key'),
      title: 'Your OpenAI key',
      say: 'Paste an OpenAI key here. It’s also used for spoken CBI commands, whichever service does your calls.',
    },
    {
      id: 'save', selector: t('comms-save'),
      title: 'Save first',
      say: 'Press Save changes before you test, because the test uses the saved key.',
    },
    {
      id: 'test', selector: t('comms-transcription-test'),
      title: 'Test it',
      say: 'This checks that the saved key works.',
    },
    {
      id: 'where',
      title: 'Where you’ll see it',
      say: 'Transcripts show on each call in Messages, and feed your Intake queue.',
    },
  ],
}
