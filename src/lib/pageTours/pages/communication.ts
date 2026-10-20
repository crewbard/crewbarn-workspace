import type { PageTour } from '../types'

/**
 * Connections → Phone, SMS & email (/tool-shed/communication).
 *
 * Nine sections, picked from the side list; the tour opens each one, which
 * only changes what is shown. The page marks its state on comms-body:
 *   data-provider = twilio_hosted | twilio_byo | none
 *   data-twilio = ready | setup     data-net2phone = active | setup | off
 *   data-sms = ready | none         data-smtp = ready | none
 *   data-intake = on | off
 * email-domain: data-state = none | pending | verified
 */
const t = (id: string) => `[data-tour="${id}"]`
const tab = (id: string) => t(`comms-tabs-${id}`)
const body = (attr: string, v: string) => `${t('comms-body')}[data-${attr}="${v}"]`
const DOMAIN = (s: string) => `${t('email-domain')}[data-state="${s}"]`

export const PAGE_TOUR: PageTour = {
  id: 'communication',
  route: '^/tool-shed/communication/?$',
  intro: {
    page: 'Phone, SMS & email',
    purpose: 'How calls, texts and emails get to your customers. Use CrewBarn’s phone service, or bring your own, and set up email from your own address.',
    covers: ['Phone setup', 'Your own Twilio or Net2Phone', 'Testing a text', 'Call transcription', 'Intake line', 'Customer email'],
  },
  steps: [
    {
      id: 'header', selector: t('comms-header'),
      title: 'Phone, SMS & email',
      say: 'Sign-in codes stay separate from all of this, and every password or key you save is locked away.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see how things are set up, but not change them.',
    },
    {
      id: 'tabs', selector: t('comms-tabs'),
      title: 'Sections',
      say: 'One section at a time. The small label on each says whether it’s ready, needs setup, or is off.',
    },

    // ── Phone setup ──
    {
      id: 'inbox', selector: t('comms-inbox'), click: tab('phone'), waitMs: 1200,
      title: 'Messages inbox',
      say: 'Normally, a text that turns into a job moves onto that job and leaves the inbox. Tick this to keep every thread in Messages too.',
    },
    {
      id: 'calling', selector: t('comms-mobile-calling'), title: 'Mobile calling',
      say: 'Pick how calls from the phone app are carried. This doesn’t change who sends your texts.',
      variants: [
        { when: body('provider', 'twilio_hosted'), say: 'Calls from the phone app go through CrewBarn’s own phone service. We set it up and look after it for you.' },
        { when: body('provider', 'twilio_byo'), say: 'Calls from the phone app go through your own Twilio account. Its details are in the BYO Twilio section.' },
      ],
    },
    {
      id: 'choices', selector: t('comms-provider-choices'),
      title: 'Hosted or your own',
      say: 'CrewBarn Hosted is the easy one. Bring your own Twilio if you already have an account and number.',
    },
    {
      id: 'caller-id', selector: t('comms-caller-id'),
      title: 'Your caller ID',
      say: 'The number customers see when your crew calls them from the app.',
    },
    {
      id: 'hosted-number', selector: t('comms-hosted-number'),
      title: 'A CrewBarn number',
      say: 'Optional. Get a CrewBarn phone number for your company if you don’t have one to bring.',
    },

    // ── BYO Twilio ──
    {
      id: 'twilio', selector: t('comms-twilio-card'), click: tab('twilio'), waitMs: 1200, title: 'Your own Twilio',
      say: 'Your Twilio account details for calls and texts. Everything you paste is locked away.',
      variants: [
        { when: t('comms-twilio-off'), selector: t('comms-twilio-off'), title: 'Your own Twilio isn’t picked', say: 'Your own Twilio isn’t picked right now. Choose it in Phone setup first, then come back to enter its details.' },
        { when: body('twilio', 'ready'), title: 'Twilio is ready', say: 'Your Twilio account is set up and ready. The switch at the top turns it on or off.' },
        { when: body('twilio', 'setup'), title: 'Twilio needs setup', say: 'Still to do: your account details, a number, and a voice key. The link at the top opens the right page on Twilio.' },
      ],
    },

    // ── Net2Phone ──
    {
      id: 'net2phone', selector: t('comms-net2phone-card'), click: tab('net2phone'), waitMs: 1200, title: 'Net2Phone',
      say: 'An optional office phone service you own, for texting, web calling and recordings.',
      variants: [
        { when: body('net2phone', 'active'), title: 'Net2Phone is on', say: 'Net2Phone is on and handling your office texts and calls.' },
        { when: body('net2phone', 'setup'), title: 'Net2Phone needs details', say: 'Net2Phone is switched on but still needs a from number and its login details.' },
        { when: body('net2phone', 'off'), title: 'Net2Phone is off', say: 'Net2Phone is off. Only turn it on if your office already uses it.' },
      ],
    },
    {
      id: 'net2phone-connect', selector: t('comms-net2phone-oauth'),
      title: 'Connect Net2Phone',
      say: 'Sign in to Net2Phone here to link your account.',
    },

    // ── Test text ──
    {
      id: 'test-sms', selector: t('comms-test-sms'), click: tab('test-sms'), waitMs: 1200, title: 'Send a test text',
      say: 'Send one text to your own phone to make sure everything works. Nothing is saved.',
      variants: [
        { when: body('sms', 'none'), title: 'Texting isn’t set up yet', say: 'Texting isn’t set up yet, so there’s nothing to test. Finish Phone setup first.' },
      ],
    },

    // ── Transcription ──
    {
      id: 'transcription', selector: t('comms-transcription'), click: tab('transcription'), waitMs: 1200,
      title: 'Call transcription',
      say: 'Turns call recordings and voicemails into text, on your own account. AssemblyAI is the one we recommend.',
    },
    {
      id: 'transcription-test', selector: t('comms-transcription-test'),
      title: 'Test it',
      say: 'Save first, then test. The test uses the key you saved.',
    },

    // ── Intake line ──
    {
      id: 'intake', selector: t('comms-intake'), click: tab('intake'), waitMs: 1200, title: 'Intake automation',
      say: 'A second line just for new requests. Texts, photos and calls to it become draft jobs for you to check.',
      variants: [
        { when: body('intake', 'on'), title: 'The intake line is on', say: 'The intake line is on. What comes in becomes a draft in your Intake queue, and nothing becomes a job until someone checks it.' },
      ],
    },
    {
      id: 'intake-enable', selector: t('comms-intake-enable'),
      title: 'Switch it on',
      say: 'Tick this to start turning what comes in on that line into drafts.',
    },
    {
      id: 'intake-advanced', selector: t('comms-intake-advanced'),
      title: 'Advanced',
      say: 'The finer details for that line. Most shops never need to open this.',
    },

    // ── Email ──
    {
      id: 'email', selector: t('email-domain'), click: tab('email'), waitMs: 1200, title: 'Customer email',
      say: 'Send email from your own business address, without touching your normal inbox.',
      variants: [
        { when: DOMAIN('none'), title: 'Use your own address', say: 'Your email comes from a CrewBarn address with your name on it. Add your own domain so it comes from you and stays out of junk folders.' },
        { when: DOMAIN('pending'), title: 'Almost there', say: 'Your domain is added, but its records aren’t checked yet. Add the records shown here where your domain is hosted, then press Check outbound DNS.' },
        { when: DOMAIN('verified'), title: 'Sending as you', say: 'Your domain is verified, so customer email comes from your own address.' },
      ],
    },
    {
      id: 'smtp', selector: t('comms-smtp'),
      title: 'Your own mail server',
      say: 'Only if your company must send through its own mail server, like Gmail or Office 365. Most shops never need it.',
    },
    {
      id: 'email-test', selector: t('comms-test-email'), click: tab('email-test'), waitMs: 1200,
      title: 'Test customer email',
      say: 'Send a real test email to yourself, using what’s saved.',
    },

    // ── Telnyx ──
    {
      id: 'telnyx', selector: t('comms-telnyx'), click: tab('telnyx'), waitMs: 1200,
      title: 'Telnyx',
      say: 'Keep your Telnyx details on file here, if you use them.',
    },

    // ── Save ──
    {
      id: 'save', selector: t('comms-save'),
      title: 'Save changes',
      say: 'Most changes here wait for Save changes. Discard puts everything back.',
    },
  ],
}
