import type { TutorialData } from './types'

/**
 * Setting up the business: Connect home, company info, brand, phone, texts
 * and email, getting paid, payment types, the customer app and service
 * locations. Walks every page and stops before anything is saved.
 *
 * Kept import-free (types aside) so the voice exporter can load it.
 */

const t = (id: string) => `[data-tour=${JSON.stringify(id)}]`
/**
 * A tab on a settings rail. The rail names each tab `<rail>-<section>` at
 * run time (SettingsSectionNav), so the marker is built here the same way.
 */
const tab = (rail: string, section: string) => t(`${rail}-${section}`)

const HOME = '^/connect/?$'
const AREA = '^/connect/[a-z]+/?$'
const COMPANY = '^/tool-shed/company-info/?$'
const BRAND = '^/tool-shed/brand/?$'
const COMMS = '^/tool-shed/communication(/transcription)?/?$'
const TWILIO = '^/tool-shed/communication/twilio/?$'
const WIZARD = '^/tool-shed/communication/twilio/setup/?$'
const EMAIL = '^/tool-shed/communication/email/?$'
const PAYMENTS = '^/tool-shed/payments/?$'
const PROCESSOR = '^/tool-shed/payments/card-processor/?$'
const BANK = '^/tool-shed/payments/bank-transfer/?$'
const WATCH = '^/tool-shed/payments/watch-bank/?$'
const TYPES = '^/tool-shed/payment-types/?$'
const APP = '^/tool-shed/customer-app/?$'
const LOCATIONS = '^/tool-shed/service-locations/?$'

export const TUTORIAL: TutorialData = {
  id: 'business-setup',
  kicker: 'Setting up your business · tutorial',
  title: 'Your business, set up start to finish',

  film: [
    {
      id: 'areas',
      label: 'Connect',
      title: 'One place for how your business is set up',
      narration:
        'Welcome to Connect. This is where your business gets set up, once, so the rest of CrewBarn knows who you are. Settings are grouped into areas, like Your business, Money and Connections. The everyday work stays in the CrewBarn app.',
    },
    {
      id: 'identity',
      label: 'Who you are',
      title: 'Type it once, it prints everywhere',
      narration:
        'Your company name, phone, address and license number go in once. Add your logo and a brand colour, and every quote, invoice and email your customers get carries them. Leave a box empty, and nothing prints in its place.',
    },
    {
      id: 'reach',
      label: 'Phone and texts',
      title: 'How your calls and texts go out',
      narration:
        'Out of the box, CrewBarn sends your texts for you. If you already have a Twilio number, texts can come from your own number instead. You can also add your own office phone service, and pick who turns call recordings into text.',
    },
    {
      id: 'email',
      label: 'Your email',
      title: 'Email from your own address, not the junk folder',
      narration:
        'Quotes and invoices go out by email. Until you set up your domain, they come from a CrewBarn address with your name on it. Add a few records to your domain, once, and they come from your own address, and stay out of the junk folder.',
    },
    {
      id: 'paid',
      label: 'Getting paid',
      title: 'The money goes to you',
      narration:
        'Pick the card processor that charges your customers, Stripe or GoDaddy Payments. Offer bank transfer if you like. And when CrewBarn watches your bank, a deposit that lands gets matched to its invoice and marked paid. CrewBarn never holds the money.',
    },
    {
      id: 'types',
      label: 'Payment types',
      title: 'Cash, check, Zelle: what your team can record',
      narration:
        'Payment types are the ways your team records a payment by hand, on the web and in the crew app. When a tech collects cash, it waits until one of your cash flow managers marks it received in the office.',
    },
    {
      id: 'app',
      label: 'Your app',
      title: 'Your own app, with your name on it',
      narration:
        'You can even have your own app in the Play Store and App Store, with your name and icon. It opens straight into your customer portal, and customers who sign up through it only ever see your company.',
    },
    {
      id: 'yourturn',
      label: 'Your turn',
      title: 'Now let’s set it up for real',
      narration:
        'That’s the idea. Now let’s walk the real pages. I’ll step back into the corner and point at each part. When it’s your turn, you click. We won’t save anything along the way. If you’d rather watch, press Do it for me.',
    },
  ],

  chapters: [
    { key: 'home', label: 'Connect home' },
    { key: 'company', label: 'Company info' },
    { key: 'brand', label: 'Brand & logo' },
    { key: 'comms', label: 'Phone, texts & email' },
    { key: 'own', label: 'Your own number and email' },
    { key: 'payments', label: 'Getting paid' },
    { key: 'types', label: 'Payment types' },
    { key: 'app', label: 'Customer app' },
    { key: 'used', label: 'Sites, and where it all shows up' },
  ],

  steps: [
    // ---------- Connect home ----------
    {
      id: 'home-hero', chapter: 'home', route: HOME, open: 'goto:/connect', selector: t('connect-hero'),
      title: 'Connect',
      say: 'This is Connect, home for everything about how CrewBarn is set up for your company. The day-to-day work stays in the CrewBarn app.',
    },
    {
      id: 'home-attention', chapter: 'home', route: HOME, selector: t('connect-attention'),
      title: 'Needs your attention',
      say: 'Needs your attention lists setup CrewBarn can check for you, like turning on customer texts or adding your logo. Each one has a button that goes straight to the fix.',
    },
    {
      id: 'home-plan', chapter: 'home', route: HOME, selector: t('connect-plan'),
      title: 'Your plan',
      say: 'Your plan shows what you pay each month and how many seats are in use. Manage plan and seats is where you change it.',
    },
    {
      id: 'home-areas', chapter: 'home', route: HOME, selector: t('connect-areas'),
      title: 'All settings',
      say: 'All settings is the map. Settings sit in areas, like Your business, Customers and sites, Money, and Connections. Each area is split into groups.',
    },
    {
      id: 'home-area-card', chapter: 'home', route: HOME, selector: t('connect-area-business'),
      title: 'An area',
      say: 'Each card is one area. The lines under its name jump straight to one group inside it.',
    },
    {
      id: 'home-rail', chapter: 'home', route: HOME, selector: t('connect-rail'),
      title: 'The rail',
      say: 'The same areas run down the left, so you can hop between them from any page. A small amber dot means something in that area still needs setting up.',
    },
    {
      id: 'home-find', chapter: 'home', route: HOME, selector: t('connect-find'),
      title: 'Find a setting',
      say: 'Find a setting searches every setting by name and description. Control K opens it from anywhere.',
    },
    {
      id: 'home-guided', chapter: 'home', route: HOME, selector: t('connect-guided-setup'),
      title: 'Guided setup',
      say: 'Guided setup walks a new company through the first steps, and shows how many are done.',
    },
    {
      id: 'home-open-business', chapter: 'home', route: HOME, selector: t('connect-area-business'),
      wait: { route: '^/connect/business' }, doIt: 'goto:/connect/business',
      yourTurn: 'Click Your business.',
      title: 'Open an area',
      say: 'Let’s start with who you are. Click Your business.',
    },
    {
      id: 'area-header', chapter: 'home', route: AREA, selector: t('connect-area-header'),
      title: 'An area page',
      say: 'An area page starts with its name, what it covers, and how many settings are in it.',
    },
    {
      id: 'area-filter', chapter: 'home', route: AREA, selector: t('connect-area-filter'),
      title: 'Jump or search',
      say: 'These chips jump to a group, and the box finds a setting inside this area.',
    },
    {
      id: 'area-group', chapter: 'home', route: AREA, selector: t('connect-group-company-profile'),
      title: 'A group',
      say: 'Each group is a card, and every setting in it has a line saying what it does. Company profile holds what makes your paperwork look like yours.',
    },
    {
      id: 'area-open-company', chapter: 'home', route: AREA, selector: t('connect-setting-company-info'),
      wait: { route: COMPANY }, doIt: 'goto:/tool-shed/company-info',
      yourTurn: 'Click Company info.',
      title: 'Open a setting',
      say: 'Click Company info to open it.',
    },

    // ---------- Company info ----------
    {
      id: 'company-header', chapter: 'company', route: COMPANY, open: 'goto:/tool-shed/company-info', selector: t('company-header'),
      title: 'Company info',
      say: 'Company info is the contact details printed on your quotes, invoices and emails. Leave a box empty, and nothing prints in its place.',
    },
    {
      id: 'company-name', chapter: 'company', route: COMPANY, selector: t('company-name'), hold: true,
      yourTurn: 'Type a name in the box and watch the preview, then press Next.',
      title: 'Company name',
      say: 'Company name. Leave it blank and CrewBarn uses the name you signed up with. Try typing a name, and watch the preview on the side change. Nothing is saved.',
    },
    {
      id: 'company-phone', chapter: 'company', route: COMPANY, selector: t('company-phone'),
      title: 'Phone',
      say: 'Phone is the number customers see on your paperwork. It tidies itself up as you type.',
    },
    {
      id: 'company-email', chapter: 'company', route: COMPANY, selector: t('company-email'),
      title: 'Email',
      say: 'Email is the address customers see for reaching you.',
    },
    {
      id: 'company-address', chapter: 'company', route: COMPANY, selector: t('company-address'),
      title: 'Address',
      say: 'Type the address the way you want it printed. Each line stays on its own line.',
    },
    {
      id: 'company-website', chapter: 'company', route: COMPANY, selector: t('company-website'),
      title: 'Website',
      say: 'Your website prints under the rest.',
    },
    {
      id: 'company-license', chapter: 'company', route: COMPANY, selector: t('company-license'),
      title: 'License number',
      say: 'Your contractor license number shows to anyone who scans one of your asset tags, so an inspector can see who services that equipment. Leave it blank and the tag just names your company.',
    },
    {
      id: 'company-timezone', chapter: 'company', route: COMPANY, selector: t('company-timezone'),
      title: 'Timezone',
      say: 'Timezone sets the times on your schedule, documents and reminders. A service location with its own timezone uses that one for its jobs instead. This one can’t be left empty.',
    },
    {
      id: 'company-preview', chapter: 'company', route: COMPANY, selector: t('company-preview'),
      title: 'Document header preview',
      say: 'This shows how your details sit at the top of a document. It’s only an illustration. Your document template decides the real layout.',
    },
    {
      id: 'company-cashflow', chapter: 'company', route: COMPANY, selector: t('company-cashflow'),
      title: 'Cash flow managers',
      say: 'Cash flow managers are the people allowed to mark cash or a check a tech collected as received in the office. Tick everyone who handles deposits. With nobody ticked, any owner or admin can do it.',
    },
    {
      id: 'company-save', chapter: 'company', route: COMPANY, selector: t('company-save'),
      title: 'Save changes',
      say: 'This bar tells you if you have unsaved changes. Discard puts everything back. Save changes would put your new details on everything you send, so we’ll leave it this time.',
    },

    // ---------- Brand & logo ----------
    {
      id: 'brand-header', chapter: 'brand', route: BRAND, open: 'goto:/tool-shed/brand', selector: t('brand-header'),
      title: 'Brand & logo',
      say: 'Brand and logo. Your logo and colour go on the estimates, invoices and emails your customers get.',
    },
    {
      id: 'brand-logo', chapter: 'brand', route: BRAND, selector: t('brand-logo-upload'),
      title: 'Your logo',
      say: 'Upload logo takes a PNG, JPG, WebP or SVG up to 5 megabytes. A transparent background about 600 pixels wide looks best. It uploads the moment you pick a file, so we won’t press it now.',
    },
    {
      id: 'brand-logo-replace', chapter: 'brand', route: BRAND, selector: t('brand-logo'),
      title: 'Replace or remove',
      say: 'Once you have one, Replace logo swaps it, and Remove takes it off after you confirm. Until there’s a logo, your paperwork goes out without one.',
    },
    {
      id: 'brand-colour', chapter: 'brand', route: BRAND, selector: t('brand-colour-presets'), hold: true,
      yourTurn: 'Click a colour, then press Next.',
      title: 'Brand colour',
      say: 'Your brand colour is the accent in customer emails and documents. Pick one of these, or any colour with the picker or a colour code. Go ahead and click one.',
    },
    {
      id: 'brand-colour-save', chapter: 'brand', route: BRAND, selector: t('brand-colour-save'),
      title: 'Save colour',
      say: 'Save colour keeps it. Clear goes back to no colour, and that one saves straight away. We’ll leave both.',
    },
    {
      id: 'brand-where', chapter: 'brand', route: BRAND,
      title: 'Where your brand shows up',
      say: 'Your logo is pulled into your templates’ design, so it matches everywhere you send. Your customer app starts from this colour, and the website builder shares it, so a change in one place shows in the other.',
    },

    // ---------- Phone, texts & email ----------
    {
      id: 'comms-header', chapter: 'comms', route: COMMS, open: 'goto:/tool-shed/communication', selector: t('comms-header'),
      title: 'Phone, texts and email',
      say: 'This page decides how calls and texts go out, and how email reaches your customers. Sign-in codes stay separate, and every key or password saved here is encrypted.',
    },
    {
      id: 'comms-tabs', chapter: 'comms', route: COMMS, selector: t('comms-tabs'),
      title: 'The parts of the page',
      say: 'The page is split into parts: phone setup, your own Twilio, Net2Phone, testing, call transcription, intake, customer email and Telnyx. The label on each says where it stands, like Ready or Setup needed.',
    },
    {
      id: 'comms-inbox', chapter: 'comms', route: COMMS, click: tab('comms-tabs', 'phone'), selector: t('comms-inbox'),
      title: 'Messages inbox',
      say: 'Phone setup starts with the Messages inbox. It’s off to start with, so a text or call that becomes a job moves onto that job and leaves the inbox. Tick it if Messages should be the one place every message lands.',
    },
    {
      id: 'comms-calling', chapter: 'comms', route: COMMS, click: tab('comms-tabs', 'phone'), selector: t('comms-mobile-calling'),
      title: 'Mobile calling',
      say: 'This picks how calls from the mobile app are carried. CrewBarn Hosted uses CrewBarn’s Twilio account and is managed for you. BYO Twilio uses your own account.',
    },
    {
      id: 'comms-choices', chapter: 'comms', route: COMMS, selector: t('comms-provider-choices'),
      title: 'Picking one',
      say: 'Clicking a card only marks it as picked. Nothing changes until you save, and it doesn’t change who sends your texts when Net2Phone is connected.',
    },
    {
      id: 'comms-caller-id', chapter: 'comms', route: COMMS, selector: t('comms-caller-id'),
      title: 'Caller ID',
      say: 'With CrewBarn Hosted, verify the number your customers already know, so it shows when a tech calls from the app.',
    },
    {
      id: 'comms-hosted-number', chapter: 'comms', route: COMMS, selector: t('comms-hosted-number'),
      title: 'A CrewBarn number',
      say: 'Or buy a separate CrewBarn number just for app calls, if you’d rather not verify your own. It shows the monthly cost first.',
    },
    {
      id: 'comms-twilio', chapter: 'comms', route: COMMS, click: tab('comms-tabs', 'twilio'), selector: `${t('comms-twilio-card')}, ${t('comms-twilio-off')}`,
      title: 'BYO Twilio',
      say: 'BYO Twilio holds your own Twilio details: the Account SID, the auth token, the number texts come from, and the voice keys that let techs call from the app. If BYO isn’t picked on Phone setup, it tells you.',
    },
    {
      id: 'comms-net2phone', chapter: 'comms', route: COMMS, click: tab('comms-tabs', 'net2phone'), selector: t('comms-net2phone-card'),
      title: 'Net2Phone',
      say: 'Net2Phone is an add-on for your own office phone service: customer texts, web calling, recordings and replies. The switch turns it on, and an API key and a From number are all most shops need.',
    },
    {
      id: 'comms-test-sms', chapter: 'comms', route: COMMS, click: tab('comms-tabs', 'test-sms'), selector: t('comms-test-sms'),
      title: 'Test messaging',
      say: 'Test messaging sends one text, through your saved setup, to a number you type. Only that number gets it, and nothing is saved.',
    },
    {
      id: 'comms-transcription', chapter: 'comms', route: COMMS, click: tab('comms-tabs', 'transcription'), selector: t('comms-transcription'),
      title: 'Call transcription',
      say: 'Call transcription turns call and voicemail recordings into text. AssemblyAI is recommended, or pick OpenAI. It runs on your own account with them, so you paste their key here.',
    },
    {
      id: 'comms-transcription-test', chapter: 'comms', route: COMMS, selector: t('comms-transcription-test'),
      title: 'Test saved key',
      say: 'Test saved key checks the saved key is accepted. It waits while you have unsaved changes, because it uses what’s saved.',
    },
    {
      id: 'comms-intake', chapter: 'comms', route: COMMS, click: tab('comms-tabs', 'intake'), selector: t('comms-intake'),
      title: 'Intake automation',
      say: 'Intake automation sets aside one Net2Phone number for AI intake. Any call or text to it goes into the intake flow, and what it pulls out follows the trade you picked at sign-up.',
    },
    {
      id: 'comms-email', chapter: 'comms', route: COMMS, click: tab('comms-tabs', 'email'), selector: t('email-domain'),
      title: 'Customer email',
      say: 'Customer email starts with your sending domain. It has a simpler page of its own, and we’ll walk it in a minute.',
    },
    {
      id: 'comms-smtp', chapter: 'comms', route: COMMS, selector: t('comms-smtp'),
      title: 'SMTP fallback',
      say: 'Below it, Manage SMTP opens the fields for sending through your own mail server, like Gmail or Office 365. Most shops never need it.',
    },
    {
      id: 'comms-test-email', chapter: 'comms', route: COMMS, click: tab('comms-tabs', 'email-test'), selector: t('comms-test-email'),
      title: 'Test customer email',
      say: 'Test customer email sends a real message to the address you type, using your saved email setup.',
    },
    {
      id: 'comms-telnyx', chapter: 'comms', route: COMMS, click: tab('comms-tabs', 'telnyx'), selector: t('comms-telnyx'),
      title: 'Telnyx',
      say: 'Telnyx just keeps your Telnyx account details on file. Your texts and calls still go through what you picked on Phone setup.',
    },
    {
      id: 'comms-save', chapter: 'comms', route: COMMS, selector: t('comms-save'),
      title: 'Save changes',
      say: 'Save changes saves every part of this page at once, and Discard throws your edits away. Nothing you click here takes effect until you save, so we’ll leave it.',
    },

    // ---------- Your own number and email ----------
    {
      id: 'twilio-open', chapter: 'own', route: TWILIO, open: 'goto:/tool-shed/communication/twilio', selector: t('setting-title'),
      title: 'Texting from your own number',
      say: 'There’s an easier way to set up your own Twilio number. By default CrewBarn sends your texts. With your own Twilio account, they can come from your number instead.',
    },
    {
      id: 'twilio-consequences', chapter: 'own', route: TWILIO, selector: t('setting-consequences'),
      title: 'What happens',
      say: 'This box says what happens right now, in plain words. With no Twilio details saved, nothing changes yet.',
    },
    {
      id: 'twilio-scope', chapter: 'own', route: TWILIO, selector: t('setting-scope'),
      title: 'Only customer texts',
      say: 'It only touches texts to customers. Sign-in codes and staff messages stay as they are.',
    },
    {
      id: 'twilio-start', chapter: 'own', route: TWILIO, selector: t('setting-control'),
      wait: { route: WIZARD }, doIt: 'goto:/tool-shed/communication/twilio/setup',
      yourTurn: 'Click Set up my Twilio number.',
      title: 'Start the setup',
      say: 'Set up my Twilio number opens a short setup. Let’s look inside. Nothing is saved on the first step.',
    },
    {
      id: 'wizard-header', chapter: 'own', route: WIZARD, selector: t('wizard-header'),
      title: 'About five minutes',
      say: 'It takes about five minutes, and you can switch back to CrewBarn sending your texts any time.',
    },
    {
      id: 'wizard-steps', chapter: 'own', route: WIZARD, selector: t('wizard-steps'),
      title: 'Three steps',
      say: 'Three steps: what it does, your details, then a test. This bar shows where you are.',
    },
    {
      id: 'wizard-step1', chapter: 'own', route: WIZARD, selector: t('wizard-step1'),
      title: 'What it does',
      say: 'First, what it will and won’t do, and what you’ll need: a Twilio account with a number you own, and the Account SID and auth token from your Twilio dashboard.',
    },
    {
      id: 'wizard-continue', chapter: 'own', route: WIZARD, selector: t('wizard-step1'),
      wait: { appear: t('wizard-step2') }, doIt: `${t('wizard-step1')} > div:last-child > button:last-child`,
      yourTurn: 'Click Continue.',
      title: 'Continue',
      say: 'Click Continue to see the next step.',
    },
    {
      id: 'wizard-step2', chapter: 'own', route: WIZARD, selector: t('wizard-step2'),
      title: 'Your details',
      say: 'Your details: the Account SID, the auth token, and the number customers will see. Each box says where to find it. Save and continue would save them, so we’ll stop here.',
    },
    {
      id: 'wizard-test', chapter: 'own', route: WIZARD,
      title: 'Then a test',
      say: 'After that, you send yourself a test text. Only you get it. Turning it on for customers is a separate tick box, and it stays locked until a test passes.',
    },
    {
      id: 'wizard-cancel', chapter: 'own', route: WIZARD, selector: t('wizard-step2'),
      wait: { route: TWILIO }, doIt: `${t('wizard-step2')} > div:last-child > button:first-child`,
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Cancel takes you back without saving anything. Click Cancel.',
    },
    {
      id: 'email-open', chapter: 'own', route: EMAIL, open: 'goto:/tool-shed/communication/email', selector: t('email-sender-header'),
      title: 'Where your email comes from',
      say: 'Now email. Quotes, invoices and job updates go out by email. Proving you’re allowed to send from your own address keeps them out of the junk folder. It’s a few records on your domain, once.',
    },
    {
      id: 'email-fallback', chapter: 'own', route: EMAIL, selector: t('email-sender-fallback'),
      title: 'Until you do',
      say: 'Until then, email still goes out, from a CrewBarn address with your name on it. That works. It’s just more likely to be filtered.',
    },
    {
      id: 'email-mode', chapter: 'own', route: EMAIL, selector: t('email-domain-mode'),
      title: 'Two ways to set it up',
      say: 'Bring your own DNS is recommended, and uses your own Resend account. CrewBarn-managed setup sends through CrewBarn’s account, so you don’t need one.',
    },
    {
      id: 'email-key', chapter: 'own', route: EMAIL, selector: t('email-domain-key'),
      title: 'Resend key',
      say: 'Your own DNS needs a Resend key that can manage domains. There’s a link to make one, and it’s stored encrypted.',
    },
    {
      id: 'email-domain', chapter: 'own', route: EMAIL, selector: t('email-domain-name'), hold: true,
      yourTurn: 'Type your business domain, then press Next.',
      title: 'Business domain',
      say: 'Type the domain your customers know, like acmeservices.com, not a subdomain. Your normal inbox isn’t touched. CrewBarn only adds records for sending.',
    },
    {
      id: 'email-from', chapter: 'own', route: EMAIL, selector: t('email-domain-from'),
      title: 'From address',
      say: 'The From address has to be on that domain. Left blank, it’s support at your domain.',
    },
    {
      id: 'email-create', chapter: 'own', route: EMAIL, selector: t('email-domain-create'),
      title: 'Create DNS checklist',
      say: 'Create DNS checklist sets it up and lists the records to add wherever your domain is hosted. We’ll leave it this time.',
    },
    {
      id: 'email-actions', chapter: 'own', route: EMAIL, selector: t('email-domain-actions'),
      title: 'Check and test',
      say: 'With a domain set up, Check outbound DNS looks for your records, and Send test email sends a real one to you. Remove email domain goes back to the CrewBarn address.',
    },
    {
      id: 'email-smtp', chapter: 'own', route: EMAIL, selector: t('email-sender-smtp'),
      title: 'Your own mail server',
      say: 'And if your company sends everything through its own mail server, this opens the way to set that up. Almost nobody needs it.',
    },

    // ---------- Getting paid ----------
    {
      id: 'pay-header', chapter: 'payments', route: PAYMENTS, open: 'goto:/tool-shed/payments', selector: t('payments-header'),
      title: 'Payments',
      say: 'Payments. Cards go through the processor you use, and bank transfers go straight to your account. The money goes to you. CrewBarn never holds it.',
    },
    {
      id: 'pay-tabs', chapter: 'payments', route: PAYMENTS, selector: t('payments-sections'),
      title: 'Four parts',
      say: 'Four parts: Stripe, GoDaddy Payments, Bank transfers, and Watch your bank. The last two also have simpler pages of their own, and we’ll use those.',
    },
    {
      id: 'pay-stripe', chapter: 'payments', route: PAYMENTS, click: tab('payments-tabs', 'stripe'), selector: t('payments-stripe'),
      title: 'Stripe',
      say: 'Stripe takes cards in the customer portal and from the office, plus Tap to Pay on the tech’s phone. The badge says if it’s on, off, or needs a few more details.',
    },
    {
      id: 'pay-stripe-actions', chapter: 'payments', route: PAYMENTS, selector: t('payments-stripe-actions'),
      title: 'Connect Stripe',
      say: 'Connect Stripe opens Stripe’s own setup and brings you back here. Refresh status checks it again.',
    },
    {
      id: 'pay-pick', chapter: 'payments', route: PAYMENTS, selector: t('payments-processor-pick'),
      title: 'Card payments go to',
      say: 'With both connected, this picks which one takes the next card. It changes the moment you click, so only click when you mean it.',
    },
    {
      id: 'pay-godaddy', chapter: 'payments', route: PAYMENTS, click: tab('payments-tabs', 'godaddy'), selector: t('payments-godaddy'),
      title: 'GoDaddy Payments',
      say: 'GoDaddy Payments takes cards in the portal, and can send a payment to a GoDaddy Smart Terminal. If it isn’t switched on for your account, it says so here.',
    },
    {
      id: 'pay-godaddy-devices', chapter: 'payments', route: PAYMENTS, selector: t('payments-godaddy-devices'),
      title: 'Devices',
      say: 'Once connected, tick the Smart Terminals a customer can tap, and say whose phone each other device is, so a charge lands on the right job by itself.',
    },
    {
      id: 'proc-open', chapter: 'payments', route: PROCESSOR, open: 'goto:/tool-shed/payments/card-processor', selector: t('setting-title'),
      title: 'Where card payments go',
      say: 'Where card payments go. When you have more than one way to take a card, this picks the one that charges your customers.',
    },
    {
      id: 'proc-control', chapter: 'payments', route: PROCESSOR, selector: t('setting-control'), hold: true,
      yourTurn: 'Click the other choice if you can, then press Next.',
      title: 'Stripe or GoDaddy',
      say: 'Each choice says what you get. One you haven’t connected yet is grayed out, with the reason. Try clicking the other one, and watch the box below change.',
    },
    {
      id: 'proc-consequences', chapter: 'payments', route: PROCESSOR, selector: t('setting-consequences'),
      title: 'With this choice',
      say: 'With this choice spells out what changes: paying from the portal, cards taken in the office, and whether techs use Tap to Pay or the Smart Terminal.',
    },
    {
      id: 'proc-scope', chapter: 'payments', route: PROCESSOR, selector: t('setting-scope'),
      title: 'Only new charges',
      say: 'Only new charges change. Payments you’ve already taken keep their records and their refunds.',
    },
    {
      id: 'proc-savebar', chapter: 'payments', route: PROCESSOR, selector: t('setting-savebar'),
      wait: { gone: t('setting-savebar') }, doIt: `${t('setting-savebar')} button`,
      yourTurn: 'Click Cancel.',
      title: 'Nothing is saved yet',
      say: 'When you change it, this bar says nothing is saved yet. Save change would make it real. Cancel puts it back, so click Cancel.',
    },
    {
      id: 'bank-open', chapter: 'payments', route: BANK, open: 'goto:/tool-shed/payments/bank-transfer', selector: t('bank-transfer-header'),
      title: 'Pay by bank transfer',
      say: 'Pay by bank transfer. Customers pick it in the portal and see your bank details. It goes bank to bank, so nobody takes a cut, but it’s slower than a card.',
    },
    {
      id: 'bank-toggle', chapter: 'payments', route: BANK, selector: t('bank-transfer-toggle'),
      title: 'Offer it',
      say: 'This switch offers it to customers. It won’t show in the portal until the account numbers are filled in.',
    },
    {
      id: 'bank-details', chapter: 'payments', route: BANK, selector: t('bank-transfer-details'),
      title: 'Your bank details',
      say: 'Your bank, the name on the account, and the routing and account numbers.',
    },
    {
      id: 'bank-instructions', chapter: 'payments', route: BANK, selector: t('bank-transfer-instructions'),
      title: 'Anything else',
      say: 'Add anything else they should know, like allow two to three working days.',
    },
    {
      id: 'bank-invoice', chapter: 'payments', route: BANK, selector: t('bank-transfer-invoice'),
      title: 'On invoices too',
      say: 'Print them on invoices too puts the details on emailed and printed invoices, not just the portal.',
    },
    {
      id: 'bank-consequences', chapter: 'payments', route: BANK, selector: t('bank-transfer-consequences'),
      title: 'What happens',
      say: 'Here’s how it goes. The customer presses I’ve sent it, and that’s a promise, not a payment. The invoice is marked paid when the money lands, by you, or on its own if CrewBarn watches your bank.',
    },
    {
      id: 'bank-save', chapter: 'payments', route: BANK, selector: t('bank-transfer-save'),
      title: 'Save',
      say: 'Save keeps it all. We’ll leave it.',
    },
    {
      id: 'bank-encrypted', chapter: 'payments', route: BANK, selector: t('bank-transfer-encrypted'),
      title: 'Kept safe',
      say: 'The numbers are stored encrypted, and only the last four are ever shown back, even to whoever typed them.',
    },
    {
      id: 'watch-open', chapter: 'payments', route: WATCH, open: 'goto:/tool-shed/payments/watch-bank', selector: t('watch-bank-header'),
      title: 'Watch your bank',
      say: 'Watch your bank. Connect your business checking, and CrewBarn sees each deposit, works out which invoice it was for, and marks it paid.',
    },
    {
      id: 'watch-stripe', chapter: 'payments', route: WATCH, selector: t('watch-bank-stripe-note'),
      title: 'Read only',
      say: 'Stripe only does the connecting. You don’t need a Stripe account, no money moves through them, and CrewBarn can only read the list of deposits.',
    },
    {
      id: 'watch-status', chapter: 'payments', route: WATCH, selector: `${t('watch-bank-status')}, ${t('watch-bank-off')}`,
      title: 'What it’s watching',
      say: 'This says which account it’s watching and when it last looked. If bank watching isn’t switched on for your account yet, CrewBarn support can turn it on.',
    },
    {
      id: 'watch-actions', chapter: 'payments', route: WATCH, selector: t('watch-bank-actions'),
      title: 'Connect or check',
      say: 'Connect your bank opens your bank’s own sign-in. Once connected, Check now looks right away, and Stop watching disconnects it.',
    },
    {
      id: 'watch-expected', chapter: 'payments', route: WATCH, selector: t('watch-bank-expected'),
      title: 'Said they’ve sent it',
      say: 'These customers pressed I’ve sent it. They stay unpaid until the money turns up.',
    },

    // ---------- Payment types ----------
    {
      id: 'types-header', chapter: 'types', route: TYPES, open: 'goto:/tool-shed/payment-types', selector: t('payment-types-header'),
      title: 'Payment types',
      say: 'Payment types are the ways your team can record a payment by hand, on the web and in the crew app. They don’t connect a card processor.',
    },
    {
      id: 'types-preview', chapter: 'types', route: TYPES, selector: t('payment-types-preview'),
      title: 'What your team sees',
      say: 'This strip shows the choices your team gets when they record a payment.',
    },
    {
      id: 'types-builtin', chapter: 'types', route: TYPES, selector: t('payment-types-builtin'),
      title: 'Built-in types',
      say: 'Switch off any built-in type you never take. Other is always on. And the card types hide in the crew app once a card processor is connected.',
    },
    {
      id: 'types-add', chapter: 'types', route: TYPES, selector: t('payment-types-add'), hold: true,
      yourTurn: 'Type Zelle and press Add, then press Next.',
      title: 'Add your own',
      say: 'Add the ways your customers really pay, like Zelle, Venmo or a house account. Try it: type Zelle and press Add.',
    },
    {
      id: 'types-preview-again', chapter: 'types', route: TYPES, selector: t('payment-types-preview'),
      title: 'Shows up straight away',
      say: 'Anything you add lands in the preview straight away, marked as unsaved.',
    },
    {
      id: 'types-save', chapter: 'types', route: TYPES, selector: t('payment-types-save'),
      title: 'Save changes',
      say: 'Save changes would put it on every payment form. We’ll leave it.',
    },
    {
      id: 'types-discard', chapter: 'types', route: TYPES, selector: t('payment-types-discard'),
      wait: { gone: t('payment-types-discard') }, doIt: t('payment-types-discard'),
      yourTurn: 'Click Discard.',
      title: 'Discard',
      say: 'Let’s not keep the practice one. Discard throws away what you haven’t saved.',
    },

    // ---------- Customer app ----------
    {
      id: 'app-header', chapter: 'app', route: APP, open: 'goto:/tool-shed/customer-app', selector: t('custapp-header'),
      title: 'Your customer app',
      say: 'Your customer app. Your own app in the Play Store and App Store, with your name and icon, opening straight into your customer portal. Customers who sign up through it only see your company.',
    },
    {
      id: 'app-tokens', chapter: 'app', route: APP, selector: t('custapp-tokens'),
      title: 'A token is waiting',
      say: 'A token is waiting for you. Use this token puts it toward your builds.',
    },
    {
      id: 'app-name', chapter: 'app', route: APP, selector: t('custapp-app-name'),
      title: 'App name',
      say: 'Step one is the name and icon. The name starts as your company name, and it’s what shows under the icon and in the stores. Up to 30 characters.',
    },
    {
      id: 'app-icon', chapter: 'app', route: APP, selector: t('custapp-icon'),
      title: 'App icon',
      say: 'Upload a square PNG or JPG, 1024 pixels is best. It uploads the moment you pick it.',
    },
    {
      id: 'app-color', chapter: 'app', route: APP, selector: t('custapp-color'),
      title: 'Brand color',
      say: 'Brand color starts as your brand colour, and colors the splash screen and the header.',
    },
    {
      id: 'app-style', chapter: 'app', route: APP, selector: t('custapp-style'),
      title: 'App style',
      say: 'Pick how the app looks: classic tabs, big tiles, a dashboard of what matters now, or a bottom bar like the apps on their phone. Each one is drawn in your colour with your icon. You can switch any time, even after it is in the stores, and installed apps change the next time they open.',
    },
    {
      id: 'app-try', chapter: 'app', route: APP, selector: t('custapp-try'),
      title: 'Try your app',
      say: 'Try your app opens the real app on a phone, with made-up customers and jobs. Tap around, switch styles and sections, and see it change straight away. Nothing is sent, and it costs no build.',
    },
    {
      id: 'app-features', chapter: 'app', route: APP, selector: t('custapp-features'),
      title: 'What’s in the app',
      say: 'Step two: tick what customers can do in the app. You can change it and build again.',
    },
    {
      id: 'app-ios', chapter: 'app', route: APP, selector: t('custapp-ios'),
      title: 'iPhone',
      say: 'Step three is only for iPhone. Apple needs a key from your own Apple developer account. Android needs nothing from you.',
    },
    {
      id: 'app-save', chapter: 'app', route: APP, selector: t('custapp-save'),
      title: 'Saved as you go, then buy',
      say: 'Your choices save themselves as you make them. Buy a token unlocks building, and one token covers three builds. We’ll leave that for now.',
    },
    {
      id: 'app-redeem', chapter: 'app', route: APP, selector: t('custapp-redeem'),
      title: 'Have a token?',
      say: 'If you bought a token, or CrewBarn gave you one, enter it here.',
    },
    {
      id: 'app-status', chapter: 'app', route: APP, selector: t('custapp-status'),
      title: 'Your build',
      say: 'Once it’s paid, this shows your build, your download links, and a code for trying it on an Android phone first.',
    },
    {
      id: 'app-listing', chapter: 'app', route: APP, selector: t('custapp-listing'),
      title: 'Listing it on the stores',
      say: 'Then you list it on the stores from your own accounts, so it’s yours. These steps walk you through Google Play and the App Store.',
    },

    // ---------- Sites, and where it all shows up ----------
    {
      id: 'loc-header', chapter: 'used', route: LOCATIONS, open: 'goto:/tool-shed/service-locations', selector: t('locations-header'),
      title: 'Service locations',
      say: 'Service locations lists every site across all your customers: houses, buildings and units.',
    },
    {
      id: 'loc-search', chapter: 'used', route: LOCATIONS, selector: t('locations-search'),
      title: 'Find a site',
      say: 'Search by nickname, street, city or ZIP.',
    },
    {
      id: 'loc-row', chapter: 'used', route: LOCATIONS, selector: `${t('locations-row')}, ${t('locations-empty')}`,
      title: 'One site',
      say: 'Each site shows its address, tags like Primary, Secured or Inactive, and the customer it belongs to.',
    },
    {
      id: 'loc-open', chapter: 'used', route: LOCATIONS, selector: t('locations-open-customer'),
      title: 'Open customer',
      say: 'Sites are added and edited on the customer’s own page, under Locations, along with things like gate codes. Open customer takes you there.',
    },
    {
      id: 'used-paperwork', chapter: 'used', route: LOCATIONS,
      title: 'On everything you send',
      say: 'Your company details and logo fill in the top of your quotes, invoices and emails, through your templates. Change them once in Connect, and every new one picks it up.',
    },
    {
      id: 'used-cash', chapter: 'used', route: LOCATIONS,
      title: 'Money desk and Cash register',
      say: 'Cash flow managers matter on the Money desk and the Cash register. When a tech collects cash or a check, it waits there until one of them marks it received.',
    },
    {
      id: 'used-portal', chapter: 'used', route: LOCATIONS,
      title: 'The customer portal',
      say: 'Your card processor, bank transfer details and customer app all meet in the customer portal, where customers pay you.',
    },
    {
      id: 'used-messages', chapter: 'used', route: LOCATIONS,
      title: 'Messages and calls',
      say: 'Your phone and texting setup decides what lands in Messages, and how techs call customers from the app.',
    },
    {
      id: 'used-bank-match', chapter: 'used', route: LOCATIONS,
      title: 'Bank match',
      say: 'Deposits from a watched bank land in Bank match, under Money, and match to their invoices on their own.',
    },
    {
      id: 'used-done', chapter: 'used', route: HOME, open: 'goto:/connect', selector: t('connect-areas'),
      title: 'That’s the lot',
      say: 'And that’s your business, set up. Come back to Connect any time to change something, and take this tutorial again from the Tutorial button at the top.',
    },
  ],
}
