import type { GuidedTour, GuidedTourStep } from '@/lib/guidedTours'

/**
 * Settings tours (owner 10): the Tool Shed, Connect home and areas, Your
 * business pages, Phone/text/email, Automations, the OAuth return pages and
 * every focused one-setting page in pages/settings/FocusedSettingPages.tsx
 * (except the AI and card-payment ones, which owner 11 tours).
 *
 * Steps target data-tour attributes in the page components. The engine
 * skips any step whose target isn't on screen (a tab that isn't open, a
 * part only shown to people who can edit, a save bar that only appears
 * after a change), so those steps are marked optional.
 */

// ── the focused one-setting pages share one layout (components/settings/SettingPage) ──

function focusedSteps(parts: {
  title: string
  intro: string
  control: string
  consequences: string
  scope?: string
  aside?: { title: string; say: string }
}): GuidedTourStep[] {
  const steps: GuidedTourStep[] = [
    { selector: '[data-tour="setting-title"]', title: parts.title, say: parts.intro },
    { selector: '[data-tour="setting-control"]', title: 'Make your choice', say: parts.control },
    { selector: '[data-tour="setting-consequences"]', title: 'What will happen', say: parts.consequences },
  ]
  if (parts.scope) {
    steps.push({ selector: '[data-tour="setting-scope"]', title: 'What it doesn’t touch', say: parts.scope, optional: 'Skip this note' })
  }
  if (parts.aside) {
    steps.push({ selector: '[data-tour="setting-aside"]', title: parts.aside.title, say: parts.aside.say, optional: 'Skip this link' })
  }
  steps.push({
    selector: '[data-tour="setting-savebar"]',
    title: 'Save it',
    say: 'Nothing changes until you press Save change. Cancel puts it back the way it was.',
    optional: 'The save bar shows once you change something',
  })
  return steps
}

const focusedRoadmap = (where: string, after: string) => [
  { title: 'Find the setting', detail: `${where}, or search for it with Find a setting.` },
  { title: 'Pick or set the value', detail: 'The box under it says exactly what will happen.' },
  { title: 'Save change', detail: 'Only someone allowed to change it sees the save bar.' },
  { title: 'See it work', detail: after },
]

export const SETTINGS_TOURS: GuidedTour[] = [
  // ─────────────────────────────────────────────────────────── Tool Shed
  {
    id: 'tool-shed',
    title: 'The Tool Shed',
    description: 'One card for every setting you are allowed to open, which you can search and rearrange.',
    route: /^\/tool-shed\/?$/,
    roadmap: [
      { title: 'Tool Shed menu', detail: 'The dropdown in the top bar lists the same items.' },
      { title: 'This page', detail: 'Search, quick starts, and a card per setting.' },
      { title: 'Customize', detail: 'Hide, re-add and reorder cards. It only changes your browser.' },
      { title: 'Open a card', detail: 'Each card opens its setting page.' },
    ],
    use: {
      say: 'Most company settings are kept on Connect, with the same setting search and a home for every area. Where your settings live decides whether they’re listed here in the app too.',
      go: [{ label: 'Open Connect', to: '/connect' }, { label: 'Where settings live', to: '/tool-shed/settings-location' }],
    },
    steps: [
      { selector: '[data-tour="toolshed-connect-strip"]', title: 'Company settings on Connect', say: 'You’re on one of the Easy layouts, so company settings point you to Connect from here.', optional: 'Only on the Easy layouts' },
      { selector: '[data-tour="toolshed-header"]', title: 'Business setup and controls', say: 'This is where you set up how the shop runs. Everyday work stays in the main menu. Customize lets you rearrange the cards.' },
      { selector: '[data-tour="toolshed-connect-note"]', title: 'Where the rest went', say: 'Your company keeps most settings on CrewBarn Connect, so this page only shows what people open while working. Nothing is missing, it just lives there.', optional: 'Only when settings are kept on Connect' },
      { selector: '[data-tour="toolshed-quickstarts"]', title: 'Quick starts', say: 'Not sure where to begin? These shortcuts cover the usual first jobs. A card only shows links you can open.' },
      { selector: '[data-tour="toolshed-customize"]', title: 'Customize your cards', say: 'Drag cards into the order you like and remove the ones you never use. This only changes your own browser.', optional: 'Shows after you press Customize' },
      { selector: '[data-tour="toolshed-search"]', title: 'Search', say: 'Type what you’re after, like “texts” or “tax”, and the cards filter as you go.' },
      { selector: '[data-tour="toolshed-cards"]', title: 'One card per setting', say: 'Each card is one setting. Click one to open it.' },
    ],
  },

  // ─────────────────────────────────────────────────────────── Connect home
  {
    id: 'connect-home',
    title: 'CrewBarn Connect',
    description: 'The front door of your company settings: what needs fixing, what you pay, and every settings area.',
    route: /^\/connect\/?$/,
    roadmap: [
      { title: 'What Connect is', detail: 'Company settings live here; daily work stays in the app.', step: 0 },
      { title: 'Finding things', detail: 'The rail, Find a setting and Help.', step: 1 },
      { title: 'Needs attention and your plan', detail: 'Fix setup gaps, check seats and price.', step: 5 },
      { title: 'The ten areas', detail: 'What each area holds.', step: 7 },
      { title: 'Back to work', detail: 'Guided setup and Open CrewBarn.', step: 18 },
    ],
    use: {
      say: 'Guided setup walks you through what’s left to set up, one step at a time. Everything you save on Connect applies in the CrewBarn app straight away.',
      go: [{ label: 'Open Guided setup', to: '/onboarding' }],
    },
    steps: [
      { selector: '[data-tour="connect-hero"]', title: 'Your company settings', say: 'This is Connect, where CrewBarn is set up for your company. Customers, jobs and the day’s work stay in the CrewBarn app. This is where you decide how all of that behaves.' },
      { selector: '[data-tour="connect-rail"]', title: 'The ten areas', say: 'The rail on the left lists all ten settings areas. Home brings you back here. A small amber dot means something in that area still needs setting up.', optional: 'On a phone the rail opens from the menu button' },
      { selector: '[data-tour="connect-find"]', title: 'Find a setting', say: 'Don’t know where something lives? Type it in plain words, like texts, tax or logo, and jump straight to it. Control K opens this from anywhere in Connect.', optional: 'On a phone it is in the top bar' },
      { selector: '[data-tour="connect-catalogs"]', title: 'Catalogs', say: 'Catalogs opens every PDF you’ve saved on your reference cards, like price books and spec sheets. The ones you used last are at the top, and each opens on the page you left it.' },
      { selector: '[data-tour="connect-help"]', title: 'Help', say: 'Help explains any setting: what it does, what changes when you save, and what to check first. It’s also where you start the guided tour for the page you’re on.' },
      { selector: '[data-tour="connect-attention"]', title: 'Needs your attention', say: 'CrewBarn checks your connected services here. If something is missing, like customer texting or your logo, it tells you why and gives you a button to fix it. If it’s empty, you’re all set.' },
      { selector: '[data-tour="connect-plan"]', title: 'Your plan', say: 'What you pay each month, and how many seats are in use. Manage plan and seats is where you add people or change your plan.' },
      { selector: '[data-tour="connect-areas"]', title: 'All settings', say: 'Every area as a card, with its groups underneath and how many settings each holds. Click an area to open it, or click a group to jump straight to that part.' },
      { selector: '[data-tour="connect-area-business"]', title: 'Your business', say: 'Your company profile, your logo and colors, your website and customer app, your reviews, and which features are switched on.' },
      { selector: '[data-tour="connect-area-customers"]', title: 'Customers and sites', say: 'How you sort customers, the areas you work in, the equipment you look after for them, and your service agreements.' },
      { selector: '[data-tour="connect-area-workflow"]', title: 'Jobs and workflow', say: 'How a job moves from the first call to closed. Job types and statuses, rules in the field, automations and reminders, your documents, and warranties.' },
      { selector: '[data-tour="connect-area-catalog"]', title: 'Catalog and inventory', say: 'What you sell, your reference cards, how stock is counted and moved, and your labels.' },
      { selector: '[data-tour="connect-area-money"]', title: 'Money', say: 'How you get paid, invoices and tax, pricing and discounts, and your rules for cash.' },
      { selector: '[data-tour="connect-area-team"]', title: 'Team', say: 'Your people and their roles, access and security, time off and pay, and the vans and tools they carry.' },
      { selector: '[data-tour="connect-area-ai"]', title: 'CBI AI', say: 'Which AI does the thinking and your key for it, what CBI is allowed to do, what it has learned, and a record of what it did.' },
      { selector: '[data-tour="connect-area-connections"]', title: 'Connections', say: 'Phone, text and email, the apps and partners you’ve connected, where your files and maps live, and devices like the shop TV and label printer.' },
      { selector: '[data-tour="connect-area-developers"]', title: 'Developers', say: 'API keys, event webhooks and self-hosting. You only need this area if someone is building on CrewBarn for you.' },
      { selector: '[data-tour="connect-area-account"]', title: 'Account and billing', say: 'Your plan and usage, importing and exporting your data, your own encryption key, company files, and the audit log of every change.' },
      { selector: '[data-tour="connect-guided-setup"]', title: 'Guided setup', say: 'This shows how far through setup you are. Click it to pick up where you left off.', optional: 'Skip guided setup' },
      { selector: '[data-tour="connect-open-app"]', title: 'Back to work', say: 'Open CrewBarn takes you back to the app for the day’s work. Your changes here apply there straight away.', optional: 'Skip' },
    ],
  },

  // ─────────────────────────────────────────────────────────── Connect area
  {
    id: 'connect-section',
    title: 'A settings area',
    description: 'One area of your company settings, with a card per group and every setting in plain words.',
    route: /^\/connect\/[^/]+\/?$/,
    roadmap: [
      { title: 'Pick an area', detail: 'From Connect home or the rail.' },
      { title: 'Find the group', detail: 'Jump to a group or search inside the area.' },
      { title: 'Open a setting', detail: 'It opens on its own page, with its neighbours as chips.' },
    ],
    use: {
      say: 'Each setting here takes effect in the CrewBarn app as soon as you save it. Connect home shows anything that still needs your attention.',
      go: [{ label: 'Back to Connect', to: '/connect' }],
    },
    steps: [
      { selector: '[data-tour="connect-area-breadcrumb"]', title: 'Back to Connect', say: 'You can always step back to Connect home from here.' },
      { selector: '[data-tour="connect-area-header"]', title: 'This area', say: 'This is the area, with a count of how many settings and groups it holds.' },
      { selector: '[data-tour="connect-area-filter"]', title: 'Jump or search', say: 'Tap a chip to jump to that group, or type to narrow the list.' },
      { selector: '[data-tour="connect-area-groups"]', title: 'Groups and settings', say: 'Each card is a group. Every setting says what it does in plain words. Click one to open it.' },
    ],
  },

  // ─────────────────────────────────────────────────────────── Company info
  {
    id: 'settings-company-info',
    title: 'Company info',
    description: 'The details that print on your quotes, invoices and emails, your timezone, and who can confirm cash has reached the office.',
    route: /^\/tool-shed\/company-info\/?$/,
    roadmap: [
      { title: 'Sign-up', detail: 'Your company name and trade were set there. The trade can’t be changed later.' },
      { title: 'Company info', detail: 'Name, phone, email, address, website, license and timezone.' },
      { title: 'Brand & logo', detail: 'The look that goes with these details.' },
      { title: 'Templates & forms', detail: 'Where your company details get printed.' },
      { title: 'Cash flow managers', detail: 'Who closes the loop on cash a tech collected.' },
    ],
    use: {
      say: 'Your name, phone, email, address and website fill in the company details on everything in Templates & forms, so your estimates, invoices and emails carry them. Your cash flow managers confirm a tech’s cash or check on the Cash register.',
      go: [{ label: 'Open Templates & forms', to: '/custom-documents' }, { label: 'Go to Cash register', to: '/accounting/cash-drawer' }, { label: 'Open Brand & logo', to: '/tool-shed/brand' }],
    },
    steps: [
      { selector: '[data-tour="company-header"]', title: 'Your company details', say: 'These are the details your customers see on quotes, invoices and emails. Leave a box empty and it just prints nothing.' },
      { selector: '[data-tour="company-details"]', title: 'Business details', say: 'Fill these in once. Every document that uses your company details picks them up. The timezone is the only one you must set.' },
      { selector: '[data-tour="company-name"]', title: 'Company name', say: 'The name printed on your paperwork. Leave it blank and CrewBarn uses the name you signed up with.' },
      { selector: '[data-tour="company-phone"]', title: 'Phone', say: 'The number customers should call. It prints on quotes, invoices and emails.' },
      { selector: '[data-tour="company-email"]', title: 'Email', say: 'The address customers can write back to. It shows on your documents and emails.' },
      { selector: '[data-tour="company-address"]', title: 'Address', say: 'Type it the way you want it printed. Each line stays on its own line.' },
      { selector: '[data-tour="company-website"]', title: 'Website', say: 'Your website address, printed with your other details.' },
      { selector: '[data-tour="company-license"]', title: 'License number', say: 'Your contractor license number. It shows on your documents and to anyone who scans one of your equipment tags. Leave it blank and the tag just shows your company name.' },
      { selector: '[data-tour="company-timezone"]', title: 'Timezone', say: 'Pick the timezone you work in. Your schedule, reminders and documents use it. A service location with its own timezone uses that one for its jobs.' },
      { selector: '[data-tour="company-preview"]', title: 'A rough preview', say: 'This is a sketch of your document header. Your template decides the real layout.', optional: 'Beside the form on wide screens' },
      { selector: '[data-tour="company-cashflow"]', title: 'Cash flow managers', say: 'Tick everyone who actually handles deposits. Only they can mark a tech’s cash or check as received. With nobody ticked, any owner or admin can.' },
      { selector: '[data-tour="company-save"]', title: 'Save changes', say: 'Nothing changes until you press Save changes. Discard puts back what was saved.' },
    ],
  },

  // ─────────────────────────────────────────────────────────── Brand & logo
  {
    id: 'settings-brand',
    title: 'Brand & logo',
    description: 'Your logo and one accent colour for estimates, invoices, emails and the portal.',
    route: /^\/tool-shed\/brand\/?$/,
    roadmap: [
      { title: 'Company info', detail: 'Your details.' },
      { title: 'Brand & logo', detail: 'Your logo and one accent colour.' },
      { title: 'Templates & forms', detail: 'Where the logo and colour appear.' },
      { title: 'Website builder', detail: 'Has its own website colour, and can copy it here.' },
    ],
    use: {
      say: 'Your logo and colour go into the documents and emails in Templates & forms. Your website keeps its own colour, which you set in the website builder.',
      go: [{ label: 'Open Templates & forms', to: '/custom-documents' }, { label: 'Open Your website', to: '/website-builder' }],
    },
    steps: [
      { selector: '[data-tour="brand-header"]', title: 'Your look', say: 'Your logo and colour go on everything a customer gets from you.' },
      { selector: '[data-tour="brand-logo"]', title: 'Logo', say: 'Your logo goes at the top of your documents and emails. A PNG, JPG, WebP or SVG up to 5 MB works, and a transparent background about 600 pixels wide looks best.' },
      { selector: '[data-tour="brand-logo-upload"]', title: 'Upload, replace or remove', say: 'Upload logo picks a file and saves it straight away. Replace swaps it for a new one, and Remove takes it off your documents after you confirm.' },
      { selector: '[data-tour="brand-colour"]', title: 'Brand colour', say: 'One accent colour for your emails and documents, so they look like yours.' },
      { selector: '[data-tour="brand-colour-presets"]', title: 'Pick a colour', say: 'Tap one of these ready-made colours to try it.' },
      { selector: '[data-tour="brand-colour-custom"]', title: 'Or your exact colour', say: 'Use the colour picker, or type your colour code, like #1E40AF, to match your truck or sign exactly.' },
      { selector: '[data-tour="brand-colour-save"]', title: 'Save colour', say: 'The colour only changes once you press Save colour. Clear goes back to no brand colour.' },
    ],
  },

  // ─────────────────────────────────────────────────────────── Where your settings live
  {
    id: 'settings-location',
    title: 'Where your settings live',
    description: 'Keep company settings only on Connect, or list them in the app’s Tool Shed too.',
    route: /^\/tool-shed\/settings-location\/?$/,
    roadmap: [
      { title: 'Connect', detail: 'The home for company settings.' },
      { title: 'This page', detail: 'Keep them only there, or show them in the app too.' },
      { title: 'The app’s Tool Shed', detail: 'Shrinks or grows to match.' },
    ],
    use: {
      say: 'With settings kept on Connect, the Tool Shed only shows what people open mid-job. Open Connect to change everything else.',
      go: [{ label: 'Open Connect', to: '/connect' }, { label: 'Open the Tool Shed', to: '/tool-shed' }],
    },
    steps: focusedSteps({
      title: 'Where your settings live',
      intro: 'Settings are run from Connect, so the app your crew works in stays about the work. If you’d rather have them in both places, say so here.',
      control: 'Pick one. Only here keeps the app’s Tool Shed to things people open mid-job. Here and in the app lists every setting in both places.',
      consequences: 'Read this before you save. It changes as you pick.',
      scope: 'This only changes what’s listed in a menu. No setting is switched off, and nobody loses a permission.',
    }),
  },

  // ─────────────────────────────────────────────────────────── Website builder
  {
    id: 'website-builder',
    title: 'Your website',
    description: 'Answer four questions, let CrewBarn write a draft, pick a look, edit any page, then put it online when you’re ready.',
    route: /^\/website-builder\/?$/,
    roadmap: [
      { title: 'Company info', detail: 'Your phone and address are needed before going live.' },
      { title: 'Basics', detail: 'Say what you do and where. CrewBarn writes a draft.' },
      { title: 'Look', detail: 'Page shape, colour and pictures.' },
      { title: 'Edit', detail: 'Ten tools for every word, picture and Google detail.' },
      { title: 'Go live', detail: 'A checklist, a private preview, then Turn my website on.' },
    ],
    use: {
      say: 'Your phone number and address come from Company info, so fix them there and the site follows. For your own domain, custom HTML and CSS, or the favicon, use the older website page.',
      go: [{ label: 'Open Company info', to: '/tool-shed/company-info' }, { label: 'Older website page', to: '/tool-shed/website' }],
    },
    steps: [
      { selector: '[data-tour="site-header"]', title: 'Your website workshop', say: 'Changes save themselves as a draft. Nothing goes public until you choose to turn the website on.' },
      { selector: '[data-tour="site-steps"]', title: 'Four steps', say: 'Basics, Look, Edit and Go live. You can click any step you’ve already finished.', optional: 'The steps show on wider screens' },
      { selector: '[data-tour="site-already-built"]', title: 'You already have a site', say: 'You’ve already got a site. Carry on to the look, or start the words over if you really want to.', optional: 'Only once a draft exists' },
      { selector: '[data-tour="site-basics"]', title: 'Four quick questions', say: 'Answer four quick questions and CrewBarn writes your first draft. You can change everything afterwards.', optional: 'Only before the first draft' },
      { selector: '[data-tour="site-writing"]', title: 'Writing your website', say: 'This takes a minute or two. You can watch, or come back later. Nothing is lost.', optional: 'Only while the draft is being written' },
      { selector: '[data-tour="site-look"]', title: 'Pick how it looks', say: 'Choose the shape of your home page, your website colour and your pictures. You can change all of it later.', optional: 'On the Look step' },
      { selector: '[data-tour="site-look-layout"]', title: 'The shape of your home page', say: 'Classic leads with what you do, Trust-first puts your reviews near the top, and Split showcase sets a big picture beside the words.', optional: 'On the Look step' },
      { selector: '[data-tour="site-look-colour"]', title: 'Your colour', say: 'Tap a colour pair for your website. It’s for the website only, so your invoices keep their own colour.', optional: 'On the Look step' },
      { selector: '[data-tour="site-look-pictures"]', title: 'Your pictures', say: 'Add a photo across the top, your logo, and the little icon shown on the browser tab.', optional: 'On the Look step' },
      { selector: '[data-tour="site-look-device"]', title: 'Computer or phone', say: 'Switch the preview between a computer and a phone to see how it looks on each.', optional: 'On the Look step' },
      { selector: '[data-tour="site-studio-rail"]', title: 'The editing tools', say: 'Pick a tool. Each one does one job, and it all saves itself.', optional: 'On the Edit step' },
      { selector: '[data-tour="site-tool-colors"]', title: 'Colors', say: 'Pick a quick colour or make your own. A readability check warns you if text would be hard to read. Use this colour on my paperwork too copies it to your invoices and quotes.', optional: 'On the Edit step' },
      { selector: '[data-tour="site-tool-seo"]', title: 'Google & SEO', say: 'How you look in Google results: the heading, the two lines underneath, the words people search for, and your business details for Google. Keep the heading around 60 letters and the two lines around 160.', optional: 'On the Edit step' },
      { selector: '[data-tour="site-tool-pages"]', title: 'Pages', say: 'Change the words on your home page: the lines at the top, the rest of the page, the second button, and the sections further down.', optional: 'On the Edit step' },
      { selector: '[data-tour="site-tool-core"]', title: 'About & contact', say: 'The pages every site gets, like About and Contact. Change the heading, the line under it, the page itself and the sections further down.', optional: 'On the Edit step' },
      { selector: '[data-tour="site-tool-trust"]', title: 'Why they pick you', say: 'Your review count and how fast you answer, something a customer said, your own work photos, and the questions people often ask.', optional: 'On the Edit step' },
      { selector: '[data-tour="site-tool-logo"]', title: 'Logo', say: 'Make a simple logo here in a minute, or upload the one you already have.', optional: 'On the Edit step' },
      { selector: '[data-tour="site-tool-pictures"]', title: 'Pictures', say: 'Swap the main picture, your logo and the site icon, and see where each one shows up.', optional: 'On the Edit step' },
      { selector: '[data-tour="site-tool-services"]', title: 'Services', say: 'One page per service you offer. Add, edit or remove them, with a heading, summary, the words and a web address for each.', optional: 'On the Edit step' },
      { selector: '[data-tour="site-tool-area"]', title: 'Service area', say: 'One page per town you cover, so people searching nearby find you. Add a town and its state, then write the page.', optional: 'On the Edit step' },
      { selector: '[data-tour="site-tool-blog"]', title: 'Blog', say: 'Write short posts with a title, a date and the words. Fresh posts help people find you.', optional: 'On the Edit step' },
      { selector: '[data-tour="site-golive-checklist"]', title: 'Before you go live', say: 'Your pages, phone number and address must be set. A logo is nice but optional. Fix it takes you to the right place.', optional: 'On the Go live step' },
      { selector: '[data-tour="site-golive-actions"]', title: 'Look, then switch it on', say: 'See it first opens a private preview. Turn my website on is the only button that makes anything public.', optional: 'On the Go live step, for people who can change settings' },
      { selector: '[data-tour="site-golive-offline"]', title: 'Take it offline', say: 'This hides your website straight away. Nothing is deleted, and turning it back on puts it back as it was.', optional: 'Only once your website is live' },
    ],
  },

  // ─────────────────────────────────────────────────────────── Old website page
  {
    id: 'website-builder-classic',
    title: 'The older website page',
    description: 'For the few things the new builder sends you here for: page pictures, custom HTML and CSS, domains and the favicon.',
    route: /^\/tool-shed\/website\/?$/,
    roadmap: [
      { title: 'The new builder', detail: 'The main way in, at Your website.' },
      { title: 'This page', detail: 'Page pictures, custom HTML/CSS and adding domains.' },
      { title: 'Publish', detail: 'From here, or from the builder’s Go live step.' },
    ],
    use: {
      say: 'Most editing now happens in Your website. The photos and videos from your jobs that can show on the site are the ones on each job’s files, and your company details come from Company info.',
      go: [{ label: 'Open Your website', to: '/website-builder' }, { label: 'Open Company info', to: '/tool-shed/company-info' }, { label: 'Go to Jobs', to: '/jobs' }],
    },
    steps: [
      { selector: '[data-tour="oldsite-header"]', title: 'The older website page', say: 'Use this page for the few things the new builder sends you here for. The badge shows if the site is live.' },
      { selector: '[data-tour="oldsite-steps"]', title: 'Five steps', say: 'Click any step, or use Back and Next at the bottom.' },
      { selector: '[data-tour="oldsite-step-start"]', title: 'Get started', say: 'Turn the site on, set the map and photo switches, and add your own domain.' },
      { selector: '[data-tour="oldsite-enabled"]', title: 'Website on or off', say: 'This switch decides whether your website is public. Off keeps everything as a draft.', click: '[data-tour="oldsite-step-start"]' },
      { selector: '[data-tour="oldsite-media"]', title: 'Use my photos & videos', say: 'On shows approved photos and videos from your jobs on the site. Keep it to real work photos.', click: '[data-tour="oldsite-step-start"]' },
      { selector: '[data-tour="oldsite-map"]', title: 'Show a map', say: 'On adds a map of your address to the Contact page.', click: '[data-tour="oldsite-step-start"]' },
      { selector: '[data-tour="oldsite-main-link"]', title: 'Main website link', say: 'Already have another website? Put its address here and the footer and Contact page link to it.', click: '[data-tour="oldsite-step-start"]' },
      { selector: '[data-tour="oldsite-verification"]', title: 'Google site verification', say: 'Paste the code Google Search Console gives you to prove the site is yours.', click: '[data-tour="oldsite-step-start"]' },
      { selector: '[data-tour="oldsite-search"]', title: 'Search engines', say: 'Your sitemap and business details for Google are built from what you save. The row underneath shows which company details are filled in.', click: '[data-tour="oldsite-step-start"]' },
      { selector: '[data-tour="oldsite-domains"]', title: 'Domains', say: 'Your free CrewBarn address is always there. Type your own domain and press Add, then point it where the page tells you.', click: '[data-tour="oldsite-step-start"]' },
      { selector: '[data-tour="oldsite-step-design"]', title: 'Template & hero', say: 'Colours, a layout for each page, and the big photo on your home page.' },
      { selector: '[data-tour="oldsite-palette"]', title: 'Color palette', say: 'Pick a ready-made palette or set the accent, dark and highlight colours yourself. Reset to brand color goes back to your brand colour.', click: '[data-tour="oldsite-step-design"]' },
      { selector: '[data-tour="oldsite-layouts"]', title: 'Page layouts', say: 'Choose a layout for each page. The preview follows your pick.', click: '[data-tour="oldsite-step-design"]' },
      { selector: '[data-tour="oldsite-hero"]', title: 'Hero words', say: 'The title, main heading, subheading and the two button labels at the top of your home page.', click: '[data-tour="oldsite-step-design"]' },
      { selector: '[data-tour="oldsite-trust"]', title: 'Trust details', say: 'Your rating, number of reviews, how fast you respond, and a testimonial with who said it.', click: '[data-tour="oldsite-step-design"]' },
      { selector: '[data-tour="oldsite-hero-image"]', title: 'Hero image', say: 'Upload the big photo across the top of your home page. A real photo of your work, team or vans works best.', click: '[data-tour="oldsite-step-design"]' },
      { selector: '[data-tour="oldsite-favicon"]', title: 'Favicon', say: 'The little icon on the browser tab. Upload a square image, or leave it and your logo is used.', click: '[data-tour="oldsite-step-design"]' },
      { selector: '[data-tour="oldsite-step-keywords"]', title: 'Keywords', say: 'These steer what the AI writes.' },
      { selector: '[data-tour="oldsite-keywords"]', title: 'Your keywords', say: 'Type the words people search for, separated by commas, or press the button to have some suggested from your trade, services and area.', click: '[data-tour="oldsite-step-keywords"]' },
      { selector: '[data-tour="oldsite-step-generate"]', title: 'Generate', say: 'This writes your whole site, one section at a time.' },
      { selector: '[data-tour="oldsite-step-editor"]', title: 'Editor & publish', say: 'Pick a page, change the words or its picture, then publish.' },
      { selector: '[data-tour="oldsite-editor-actions"]', title: 'Publish', say: 'Advanced opens the HTML and CSS boxes. Publish puts your saved changes on the live site.', click: '[data-tour="oldsite-step-editor"]' },
      { selector: '[data-tour="oldsite-pages"]', title: 'Your pages', say: 'Every page on the site. Click one to edit it, or press + to add a service page or blog post.', click: '[data-tour="oldsite-step-editor"]' },
      { selector: '[data-tour="oldsite-page-editor"]', title: 'Edit the page', say: 'Change the heading, words and picture. It saves as you type. Rebuild pages with AI rewrites them, and Delete page removes one you added.', click: '[data-tour="oldsite-step-editor"]' },
      { selector: '[data-tour="oldsite-advanced"]', title: 'Custom HTML and CSS', say: 'Add your own HTML block to a page, or CSS for the whole site. Anything unsafe is stripped out when you save.', optional: 'Press Advanced to see this', click: '[data-tour="oldsite-step-editor"]' },
      { selector: '[data-tour="oldsite-footer"]', title: 'Back, Next and Save & publish', say: 'Next doesn’t save. Changes on the first two steps are kept until you press Save & publish, or Publish in the editor.' },
    ],
  },

  // ─────────────────────────────────────────────────────────── Customer app
  {
    id: 'settings-customer-app',
    title: 'Your customer app',
    description: 'Build your own branded phone app that opens straight into your customer portal.',
    route: /^\/tool-shed\/customer-app\/?$/,
    roadmap: [
      { title: 'Brand & logo', detail: 'The app colour starts from your brand colour.' },
      { title: 'Name and icon', detail: 'Then choose what customers can do.' },
      { title: 'Token', detail: 'Buy one or redeem one. One token unlocks up to 3 builds.' },
      { title: 'Build', detail: 'Download the Android and iPhone builds.' },
      { title: 'List it', detail: 'Publish from your own Google Play and Apple accounts.' },
    ],
    use: {
      say: 'Your app opens straight into your customer portal. To bring a customer in, open them in Customers and press Send portal invite.',
      go: [{ label: 'Go to Customers', to: '/customers' }, { label: 'Open Brand & logo', to: '/tool-shed/brand' }],
    },
    steps: [
      { selector: '[data-tour="custapp-header"]', title: 'Your own app', say: 'This is your own app, with your name and your icon. Customers who sign up through it are yours and only see your company.' },
      { selector: '[data-tour="custapp-tokens"]', title: 'A token is waiting', say: 'You’ve got a token ready. Apply it to unlock your builds.', optional: 'Only when a token is waiting' },
      { selector: '[data-tour="custapp-status"]', title: 'Where your app is', say: 'This shows whether your app is paid, building, ready or failed, and how many builds you’ve used.', optional: 'Only after payment' },
      { selector: '[data-tour="custapp-build"]', title: 'Build your app', say: 'Build my app makes fresh Android and iPhone versions. Watch build shows its progress, and Cancel build stops one without using up a build.', optional: 'Only after payment' },
      { selector: '[data-tour="custapp-downloads"]', title: 'Download the builds', say: 'Once a build finishes, download the Android file for Google Play and the iPhone file for the App Store.', optional: 'Only once a build is ready' },
      { selector: '[data-tour="custapp-name"]', title: 'Name and icon', say: 'Give your app a name and a square icon. The name shows under the icon on the phone.' },
      { selector: '[data-tour="custapp-icon"]', title: 'App icon', say: 'Upload a square PNG or JPG, ideally 1024 by 1024. Until you do, the icon is your first letter on your colour.' },
      { selector: '[data-tour="custapp-app-name"]', title: 'App name', say: 'Up to 30 characters. It shows under the icon and in the app stores.' },
      { selector: '[data-tour="custapp-color"]', title: 'App colour', say: 'The colour of the app’s opening screen and header.' },
      { selector: '[data-tour="custapp-features"]', title: 'What’s in the app', say: 'Tick what your customers should be able to do. You can change this and build again.' },
      { selector: '[data-tour="custapp-ios"]', title: 'iPhone', say: 'Only needed for the App Store. You’ll need an Apple developer account. Android needs nothing from you.' },
      { selector: '[data-tour="custapp-ios-ids"]', title: 'Apple IDs', say: 'Paste your Team ID, Key ID and Issuer ID from App Store Connect.' },
      { selector: '[data-tour="custapp-ios-key"]', title: 'Apple private key', say: 'Paste the contents of your .p8 key file. It’s stored encrypted. Once saved, leave it blank to keep it.' },
      { selector: '[data-tour="custapp-save"]', title: 'Save, then buy', say: 'Save first. Once the app has a name and an icon, Buy a token unlocks your builds.' },
      { selector: '[data-tour="custapp-redeem"]', title: 'Have a token?', say: 'Already bought one, or got one from CrewBarn? Type the code and press Apply token.', optional: 'Only before the app is paid for' },
      { selector: '[data-tour="custapp-listing"]', title: 'Listing it on the stores', say: 'Step-by-step help for Google Play and the App Store. You publish under your own accounts, so the app is yours.' },
    ],
  },

  // ─────────────────────────────────────────────────────────── Google reviews
  {
    id: 'settings-google-reviews',
    title: 'Google reviews',
    description: 'Pick your Google listing so customers get asked for a review, and optionally read and reply to reviews here.',
    route: /^\/tool-shed\/google-reviews\/?$/,
    roadmap: [
      { title: 'Company info', detail: 'The search is filled in from it.' },
      { title: 'Find your listing', detail: 'No Google sign-in needed.' },
      { title: 'Ask for reviews', detail: 'After completed jobs, in the invoice email and the portal.' },
      { title: 'Optional', detail: 'Connect your Business Profile to read and reply here.' },
    ],
    use: {
      say: 'Once asking is on, your review link goes out in the invoice email and shows in the customer portal after the job. Send the invoice from Invoices as you normally would.',
      go: [{ label: 'Go to Invoices', to: '/invoices' }],
    },
    steps: [
      { selector: '[data-tour="reviews-header"]', title: 'Google reviews', say: 'Pick your Google listing and CrewBarn can ask customers to review it after a job. The review link is public, so there’s nothing to connect for this part.' },
      { selector: '[data-tour="reviews-listing"]', title: 'Your listing', say: 'The Google listing customers are sent to for a review.' },
      { selector: '[data-tour="reviews-test-link"]', title: 'Test or change it', say: 'Test the review link to make sure it opens your own page. Choose a different listing clears it so you can search again.', optional: 'Once a listing is picked' },
      { selector: '[data-tour="reviews-enable"]', title: 'Ask for reviews', say: 'Tick this and finished jobs carry your review link in the invoice email and the customer portal. Untick it to stop asking.', optional: 'Once a listing is picked' },
      { selector: '[data-tour="reviews-find"]', title: 'Find your business', say: 'Search by name and address, then press This is mine on the right one. Watch for closed duplicates.', optional: 'Only before a listing is picked' },
      { selector: '[data-tour="reviews-connect"]', title: 'Read your reviews here', say: 'Connect your Google Business Profile once and your reviews come into CrewBarn. You’re told when a new one lands and can reply without leaving. Disconnect stops them coming in.' },
      { selector: '[data-tour="reviews-gbp-summary"]', title: 'Your rating', say: 'Your average rating, review count and how many still need an answer. Change listing picks another one, and Pull now fetches the latest reviews.', optional: 'Once your Business Profile is connected' },
      { selector: '[data-tour="reviews-gbp-list"]', title: 'Reply to reviews', say: 'Each review shows here. Type a reply and send it, and it appears on Google under the review.', optional: 'Once your Business Profile is connected' },
    ],
  },

  // ─────────────────────────────────────────────────────────── Google return page
  {
    id: 'settings-google-reviews-connected',
    title: 'Connecting your reviews',
    description: 'Finishes the Google Business Profile sign-in and takes you back to Google reviews.',
    route: /^\/settings\/google-reviews\/connected\/?$/,
    roadmap: [
      { title: 'Google reviews', detail: 'Press Connect Google Business Profile.' },
      { title: 'Google', detail: 'Allow access.' },
      { title: 'This page', detail: 'Finishes the link and sends you back.' },
    ],
    use: {
      say: 'Once you’re connected, your reviews come in on the Google reviews page, where you can read and reply to them.',
      go: [{ label: 'Open Google reviews', to: '/tool-shed/google-reviews' }],
    },
    steps: [
      { selector: '[data-tour="reviews-callback"]', title: 'Finishing up', say: 'One moment while we finish up with Google. If it didn’t connect, nothing was changed, so go back and try again.' },
    ],
  },

  // ─────────────────────────────────────────────────────────── Marketplace
  {
    id: 'settings-marketplace',
    title: 'Marketplace listing',
    description: 'Whether you’re listed on the CrewBarn marketplace, what your customers see, and what your listing says.',
    route: /^\/tool-shed\/marketplace\/?$/,
    roadmap: [
      { title: 'Sign-up', detail: 'Your trade is set there and locked here.' },
      { title: 'Portal visibility', detail: 'Private, Marketplace listed, or Hidden / paused.' },
      { title: 'Customer switches', detail: 'Hide similar trades, or show the marketplace to your customers.' },
      { title: 'Services, area and blurb', detail: 'What your card says and where it shows.' },
      { title: 'Save listing', detail: 'Changes on every tab wait for this.' },
    ],
    use: {
      say: 'Estimate requests from marketplace customers land on the Dispatch board, where you can quote or decline them without leaving the board.',
      go: [{ label: 'Go to Dispatch', to: '/dispatch' }],
    },
    steps: [
      { selector: '[data-tour="market-header"]', title: 'Marketplace listing', say: 'This is how new customers find you on CrewBarn. Turn it on when you’re ready for new-customer requests.' },
      { selector: '[data-tour="market-tabs"]', title: 'Four parts', say: 'Visibility, services, service area and your description.' },
      { selector: '[data-tour="market-visibility-modes"]', title: 'Portal visibility', say: 'Private portal keeps you out of public search. Marketplace listed lets new customers find you and send requests. Hidden / paused stops new requests for a while. Customers you’ve invited keep their portal whichever you pick.', click: '[data-tour="market-tabs-visibility"]' },
      { selector: '[data-tour="market-accepting"]', title: 'Accept new requests', say: 'While you’re Marketplace listed, this lets new customers send you work and estimate requests. Turn it off to stay listed without taking new requests.', click: '[data-tour="market-tabs-visibility"]' },
      { selector: '[data-tour="market-hide-similar"]', title: 'Your trade, in your counties', say: 'On, customers who came to you won’t see other companies in your trade that serve the same counties you do. Everything else on the marketplace stays open to them. It works from your service area, so add your ZIP codes or territories.', click: '[data-tour="market-tabs-visibility"]' },
      { selector: '[data-tour="market-services"]', title: 'Trade and services', say: 'Your trade was set when you signed up and stays locked. Tap the specialties you handle within it so customers can filter for them.', click: '[data-tour="market-tabs-services"]' },
      { selector: '[data-tour="market-county"]', title: 'Add by county', say: 'Type a county and pick it to add all of its zip codes at once.', click: '[data-tour="market-tabs-area"]' },
      { selector: '[data-tour="market-zip"]', title: 'Add a zip code', say: 'Type one zip code and press Add. Remove any zip with its ×. Customers searching a zip only see companies that cover it.', click: '[data-tour="market-tabs-area"]' },
      { selector: '[data-tour="market-blurb"]', title: 'Listing description', say: 'One to three sentences for your card, up to 1,000 characters. Say what makes you different.', click: '[data-tour="market-tabs-blurb"]' },
      { selector: '[data-tour="market-save"]', title: 'Save listing', say: 'Changes on any tab are kept until you press Save listing.' },
    ],
  },

  // ─────────────────────────────────────────────────────────── Modules
  {
    id: 'settings-modules',
    title: 'Build your dashboard',
    description: 'Switch whole areas of CrewBarn on or off for everyone. Nothing is deleted, and the bill doesn’t change.',
    route: /^\/tool-shed\/modules\/?$/,
    roadmap: [
      { title: 'Sign-up', detail: 'Your trade and starting setup.' },
      { title: 'Pick a preset', detail: 'Or tailor the areas yourself.' },
      { title: 'Save dashboard', detail: 'The menus change straight away.' },
      { title: 'Everyone’s menus', detail: 'Only the areas you kept.' },
    ],
    use: {
      say: 'The areas you keep are the ones in everyone’s menus. What each person may open inside them is set by their role.',
      go: [{ label: 'Open Roles', to: '/tool-shed/roles' }, { label: 'Back to the dashboard', to: '/' }],
    },
    steps: [
      { selector: '[data-tour="modules-header"]', title: 'Your dashboard', say: 'Tick what your shop uses. Everything else leaves the menus for everyone. Nothing is deleted, and turning things off doesn’t change your bill.' },
      { selector: '[data-tour="modules-presets"]', title: 'Start with a setup', say: 'Want a head start? Pick a preset. It saves straight away after you confirm.' },
      { selector: '[data-tour="modules-catalog"]', title: 'Make it yours', say: 'Each card below is one area of CrewBarn. Areas marked always on keep the rest working, so they stay on.' },
      { selector: '[data-tour="modules-grid"]', title: 'What each card tells you', say: 'Each card lists what the area includes and where it shows up in the menus. If it needs another area switched on first, or would take others with it, it says so.' },
      { selector: '[data-tour="modules-switch"]', title: 'The switch', say: 'Flip a card’s switch to keep that area or drop it from everyone’s menus. Nothing is deleted, so you can switch it back any time.' },
      { selector: '[data-tour="modules-save"]', title: 'Save dashboard', say: 'Nothing changes until you press Save dashboard. Discard changes puts your switches back the way they were.' },
    ],
  },

  // ─────────────────────────────────────────────────────────── Shop rules
  {
    id: 'settings-shop-rules',
    title: 'Shop Rules',
    description: 'Shop-wide rules on one tabbed page: sender, record numbers, field rules, intake, reminders, GPS check-in, two-factor and delete permissions.',
    route: /^\/tool-shed\/preferences\/?$/,
    roadmap: [
      { title: 'Communication', detail: 'The sender shown here is set there.' },
      { title: 'Shop Rules', detail: 'Pick a tab and set each rule. Most save the moment you change them.' },
      { title: 'Auto-numbering', detail: 'The one tab with a Save button.' },
      { title: 'Automations and Reminders', detail: 'The reminder timeline lives there.' },
    ],
    use: {
      say: 'Your numbering and intake rules apply each time someone makes a new job or estimate. The reminder wording and timing live on the Reminders timeline, and the sender is set on Phone, SMS & email.',
      go: [{ label: 'New job', to: '/jobs/new' }, { label: 'Open Reminders', to: '/tool-shed/automations/reminders' }, { label: 'Phone, SMS & email', to: '/tool-shed/communication' }],
    },
    steps: [
      { selector: '[data-tour="prefs-header"]', title: 'Your shop’s rules', say: 'Switches here save straight away, except the record numbers, which wait for Save.' },
      { selector: '[data-tour="prefs-tabs"]', title: 'Pick a tab', say: 'Pick the area you want to change.' },
      { selector: '[data-tour="prefs-tabs-sender"]', title: 'Outbound sender', say: 'This is what customers see in the “from” line. You change it on the Phone, SMS & email page.', optional: 'Skip the sender' },
      { selector: '[data-tour="prefs-tabs-numbering"]', title: 'Auto-numbering', say: 'These are the next numbers CrewBarn will hand out. Only lower one if you’re sure, then press Save changes.', optional: 'Skip numbering' },
      { selector: '[data-tour="prefs-tabs-field-rules"]', title: 'Field rules', say: 'Rules for jobs in the field, when pay is earned, and vacation. Each change saves as you make it.', optional: 'Skip field rules' },
      { selector: '[data-tour="prefs-tabs-intake"]', title: 'Job intake', say: 'Decide what must be filled in before a job or estimate can be saved.', optional: 'Skip intake' },
      { selector: '[data-tour="prefs-tabs-reminders"]', title: 'Appointment reminders', say: 'Flip reminders on here and set quiet hours. The reminders themselves live on the timeline.', optional: 'Skip reminders' },
      { selector: '[data-tour="prefs-tabs-gps"]', title: 'GPS check-in', say: 'Use techs’ phone locations to make check-in easier. Leaving a site never closes a job by itself.', optional: 'Skip GPS' },
      { selector: '[data-tour="prefs-tabs-team-security"]', title: 'Team security', say: 'Two-factor is always on for web sign-in. Choose which backup methods your team may set up.', optional: 'Skip team security' },
      { selector: '[data-tour="prefs-tabs-delete-permissions"]', title: 'Delete permissions', say: 'Who can delete records, and how they confirm it. Only the owner can change this.', optional: 'Skip delete permissions' },
    ],
  },

  // ─────────────────────────────────────────────────────────── Appearance
  {
    id: 'settings-appearance',
    title: 'Appearance',
    description: 'Your layout, colours and font. They change straight away: the layout for your account, colours and font for this browser.',
    route: /^\/tool-shed\/appearance\/?$/,
    roadmap: [
      { title: 'Layout preview', detail: 'Quick Easy layouts from your avatar menu.' },
      { title: 'This page', detail: 'Every layout, accent, navigation colour, font and size.' },
      { title: 'Back to work', detail: 'The app changes straight away.' },
    ],
    use: {
      say: 'Your choices show up everywhere you work in CrewBarn. Your layout follows you to any computer you sign in on; colours and font stay with this browser. To change what customers see on your paperwork, use Brand & logo.',
      go: [{ label: 'Back to the dashboard', to: '/' }, { label: 'Open Brand & logo', to: '/tool-shed/brand' }],
    },
    steps: [
      { selector: '[data-tour="appearance-header"]', title: 'Make it yours', say: 'Make CrewBarn look the way you like. Your layout follows your account; colours and font stay with this browser. Everything changes right away.' },
      { selector: '[data-tour="appearance-tabs"]', title: 'Layout, Color, Font', say: 'Three tabs. Everything here changes the moment you pick it.' },
      { selector: '[data-tour="appearance-layout-who"]', title: 'Who uses this layout?', say: 'The company’s default layout, and whether you’ve picked your own. Use company default goes back to it. If you can change settings, Company default layout sets it for everyone who hasn’t picked their own.', click: '[data-tour="appearance-tabs-layout"]' },
      { selector: '[data-tour="appearance-layout-options"]', title: 'Layout', say: 'Pick where the menu sits: Focus, the two Easy layouts, a top bar, a side bar, or a slim rail. Click one and it switches straight away, just for you. On a phone, every one folds into a slide-out menu.', click: '[data-tour="appearance-tabs-layout"]' },
      { selector: '[data-tour="appearance-layout-focus"]', title: 'Focus', say: 'Focus is the rail with compact, task-first pages for jobs, customers, estimates and money: one list at a time, and details folded until you open them. The schedule and drag-and-drop calendar work just the same.', click: '[data-tour="appearance-tabs-layout"]' },
      { selector: '[data-tour="appearance-accent"]', title: 'Brand accent', say: 'The colour of your buttons, links and highlights. The sample shows how it looks.', click: '[data-tour="appearance-tabs-color"]' },
      { selector: '[data-tour="appearance-nav-color"]', title: 'Navigation color', say: 'Tints the top bar and side bar. Darker colours keep the menu text easy to read.', click: '[data-tour="appearance-tabs-color"]' },
      { selector: '[data-tour="appearance-nav-custom"]', title: 'Your own colour', say: 'Pick any colour or type its code. Reset goes back to navy, and the note beside it tells you if the menu text will still be readable.', click: '[data-tour="appearance-tabs-color"]' },
      { selector: '[data-tour="appearance-typeface"]', title: 'Typeface', say: 'Choose the font used across CrewBarn. Each card shows what it looks like.', click: '[data-tour="appearance-tabs-font"]' },
      { selector: '[data-tour="appearance-text-size"]', title: 'Text size', say: 'Comfortable, Large or Extra large. The live preview shows what you’ll read all day.', click: '[data-tour="appearance-tabs-font"]' },
    ],
  },

  // ─────────────────────────────────────────────────────────── Shop TV
  {
    id: 'settings-shop-tv',
    title: 'Shop TV',
    description: 'Pair the TVs on your shop wall and design the live boards they show.',
    route: /^\/tool-shed\/shop-tv\/?$/,
    roadmap: [
      { title: 'On the TV', detail: 'Open crewbarn.tv. It shows a six-character code.' },
      { title: 'Add a screen', detail: 'Type that code here and give it a name.' },
      { title: 'Design this screen', detail: 'Boards, cards, look and timing.' },
      { title: 'Watch it update', detail: 'The TV changes within seconds. Unpair it when it’s gone.' },
    ],
    use: {
      say: 'The TV shows today’s jobs, who’s up next and where the crew is, straight from your schedule. Keep Schedule and Dispatch up to date and the wall follows within seconds.',
      go: [{ label: 'Go to Schedule', to: '/schedule' }, { label: 'Go to Dispatch', to: '/dispatch' }],
    },
    steps: [
      { selector: '[data-tour="tv-hero"]', title: 'Put today on the wall', say: 'Put a live board on a TV so anyone in the shop can see who’s out and what’s next. Nobody ever types on the TV.' },
      { selector: '[data-tour="tv-add"]', title: 'Add a screen', say: 'Three steps. Open crewbarn.tv on the TV, type the code it shows, give it a name.', optional: 'Only for people who can change settings' },
      { selector: '[data-tour="tv-screens"]', title: 'Your screens', say: 'Each TV you’ve paired. Green means it’s on now. Amber just means it’s asleep or off the Wi-Fi.', optional: 'Once a screen is paired' },
      { selector: '[data-tour="tv-design"]', title: 'Design this screen', say: 'Everything here saves the moment you change it.', optional: 'Open Design this screen first' },
      { selector: '[data-tour="tv-name"]', title: 'Name', say: 'What you call this TV, like Front office or Workshop. It saves when you click away.', optional: 'Open Design this screen first' },
      { selector: '[data-tour="tv-boards"]', title: 'Boards it plays through', say: 'A screen can rotate through several boards. Click one to edit it, or press + Add a board and start from a ready-made one. You can rename a board or remove it underneath.', optional: 'Open Design this screen first' },
      { selector: '[data-tour="tv-cards"]', title: 'Add a card', say: 'Cards are grouped into People, Jobs, Money and Extras. Click Add to put one on the board. A card marked On is already there.', optional: 'Open Design this screen first' },
      { selector: '[data-tour="tv-arrange"]', title: 'Arrange this board', say: 'Drag a card to move it and pull its corner to resize it. Tap a card for its own controls. Tidy up the board closes the gaps, and Preview full screen shows it as the TV will.', optional: 'Open Design this screen first' },
      { selector: '[data-tour="tv-look"]', title: 'How it looks', say: 'Set how big the TV is so the letters stay readable, the screen resolution, a dark, light or high-contrast background, a moving scene or your own video behind the board, and the text size.', optional: 'Open Design this screen first' },
      { selector: '[data-tour="tv-behaviour"]', title: 'How this screen plays', say: 'How often it changes board, how long lists move, and whether one board fades, slides or cuts to the next.', optional: 'Open Design this screen first' },
      { selector: '[data-tour="tv-moments"]', title: 'Moments that pop up', say: 'Tick what pops up on screen when it happens: a job done, a new job, a payment or a five-star review. Payments never show while money is kept off.', optional: 'Open Design this screen first' },
      { selector: '[data-tour="tv-money"]', title: 'Keep money off this screen', say: 'Ticked by default, so no money figures ever reach the TV. Untick it only if the screen is somewhere customers can’t see it.', optional: 'Open Design this screen first' },
      { selector: '[data-tour="tv-unpair"]', title: 'Unpair', say: 'Unpairing sends the TV back to showing a code. You’ll be asked to confirm.', optional: 'Open Design this screen first' },
    ],
  },

  // ─────────────────────────────────────────────────────────── Communication
  {
    id: 'settings-communication',
    title: 'Phone, SMS & email',
    description: 'How your shop calls, texts and emails customers, in one page with a tab for each piece.',
    route: /^\/tool-shed\/communication\/?$/,
    roadmap: [
      { title: 'Phone setup', detail: 'Pick CrewBarn Hosted or your own Twilio for mobile calling.' },
      { title: 'Net2Phone', detail: 'Optional, for office calls and texts.' },
      { title: 'Transcription and intake', detail: 'If you use them.' },
      { title: 'Customer email', detail: 'Verify a sending domain, or use SMTP as a fallback.' },
      { title: 'Save and test', detail: 'Send a test text and a test email.' },
    ],
    use: {
      say: 'Customer texts and emails come into Messages, calls and their transcripts show in Calls, and calls and texts to your intake line become drafts in the Intake queue.',
      go: [{ label: 'Go to Messages', to: '/communications' }, { label: 'Go to Calls', to: '/calls' }, { label: 'Open Intake queue', to: '/intake' }],
    },
    steps: [
      { selector: '[data-tour="comms-header"]', title: 'Calls, texts and emails', say: 'This is where your calls, texts and emails get set up. Every password you paste here is stored encrypted.' },
      { selector: '[data-tour="comms-tabs"]', title: 'One tab per piece', say: 'Each tab is one piece. The little badge tells you if it’s ready.' },
      // Phone setup
      { selector: '[data-tour="comms-inbox"]', title: 'Messages inbox', say: 'Off, a text or call that creates a job moves onto that job and leaves the inbox. Tick it to keep every message in Messages, even ones attached to a job.', click: '[data-tour="comms-tabs-phone"]' },
      { selector: '[data-tour="comms-mobile-calling"]', title: 'Mobile app calling', say: 'Pick who carries calls from the mobile app: CrewBarn Hosted, or your own Twilio account. This doesn’t change who sends your texts.', click: '[data-tour="comms-tabs-phone"]' },
      { selector: '[data-tour="comms-caller-id"]', title: 'Your caller ID', say: 'Verify the number your customers already know, so mobile-app calls show it. CrewBarn calls that number with a code to confirm it’s yours.', optional: 'With CrewBarn Hosted picked', click: '[data-tour="comms-tabs-phone"]' },
      { selector: '[data-tour="comms-hosted-number"]', title: 'A CrewBarn number', say: 'Rather not verify your own number? Get a separate CrewBarn number for mobile calling instead.', optional: 'With CrewBarn Hosted picked', click: '[data-tour="comms-tabs-phone"]' },
      // BYO Twilio
      { selector: '[data-tour="comms-twilio-card-switch"]', title: 'Your own Twilio', say: 'Switch this on to carry mobile-app calls and texts through your own Twilio account.', optional: 'With BYO Twilio picked on Phone setup', click: '[data-tour="comms-tabs-twilio"]' },
      { selector: '[data-tour="comms-field-twilio_account_sid"]', title: 'Account details', say: 'Paste your Account SID, Auth token and the From number customers will see. Once saved, leave a box blank to keep what’s there.', optional: 'With BYO Twilio picked on Phone setup', click: '[data-tour="comms-tabs-twilio"]' },
      { selector: '[data-tour="comms-field-twilio_voice_api_key_sid"]', title: 'Mobile app calling keys', say: 'Your Voice API Key SID and Secret, and the TwiML App SID, let techs place tracked calls from the app. Set the TwiML App’s voice address to the one shown under it.', optional: 'With BYO Twilio picked on Phone setup', click: '[data-tour="comms-tabs-twilio"]' },
      // Net2Phone
      { selector: '[data-tour="comms-net2phone-card-switch"]', title: 'Net2Phone add-on', say: 'Switch this on to use your own Net2Phone account for office calls, texts, recordings and replies. It works alongside your mobile calling choice.', click: '[data-tour="comms-tabs-net2phone"]' },
      { selector: '[data-tour="comms-field-net2phone_api_key"]', title: 'API key', say: 'The simplest way to connect. Create a key in your Net2Phone portal and paste it here.', click: '[data-tour="comms-tabs-net2phone"]' },
      { selector: '[data-tour="comms-field-net2phone_from_number"]', title: 'From number', say: 'Your Net2Phone line for texts to customers. It’s needed whichever way you connect.', click: '[data-tour="comms-tabs-net2phone"]' },
      { selector: '[data-tour="comms-net2phone-oauth"]', title: 'Advanced sign-in', say: 'Only if you’re not using an API key. Open it to paste a client ID and secret, or an access token and refresh token.', click: '[data-tour="comms-tabs-net2phone"]' },
      { selector: '[data-tour="comms-field-net2phone_callback_url"]', title: 'Callback address', say: 'Copy this address into your Net2Phone webhook settings so incoming calls and texts reach CrewBarn.', optional: 'Shows once Net2Phone is saved', click: '[data-tour="comms-tabs-net2phone"]' },
      { selector: '[data-tour="comms-field-net2phone_require_webhook_key"]', title: 'Require a key in the address', say: 'Adds a secret to the callback address, so anything sent to the plain address is ignored. After saving, copy the new address into Net2Phone.', click: '[data-tour="comms-tabs-net2phone"]' },
      { selector: '[data-tour="comms-field-net2phone_webhook_secret"]', title: 'Signing secret', say: 'Paste the signing secret Net2Phone shows for your webhook. CrewBarn checks every incoming text against it.', click: '[data-tour="comms-tabs-net2phone"]' },
      { selector: '[data-tour="comms-field-net2phone_enforce_webhook_signature"]', title: 'Reject unsigned messages', say: 'Once real calls and texts are arriving with the secret, tick this to drop anything that isn’t signed.', click: '[data-tour="comms-tabs-net2phone"]' },
      // Test messaging
      { selector: '[data-tour="comms-test-sms"]', title: 'Send a test text', say: 'Type your mobile number and an optional message, then press Send test text. It uses what you’ve saved, not what’s still on screen.', click: '[data-tour="comms-tabs-test-sms"]' },
      // Transcription
      { selector: '[data-tour="comms-field-transcription_provider"]', title: 'Who transcribes your calls', say: 'Pick AssemblyAI or OpenAI to turn call recordings into text. The change applies to calls from now on.', click: '[data-tour="comms-tabs-transcription"]' },
      { selector: '[data-tour="comms-field-transcription_assemblyai_api_key"]', title: 'AssemblyAI key', say: 'Paste your AssemblyAI key. Without one, calls are left untranscribed.', optional: 'With AssemblyAI picked', click: '[data-tour="comms-tabs-transcription"]' },
      { selector: '[data-tour="comms-field-transcription_openai_api_key"]', title: 'OpenAI key', say: 'Used for call recordings when OpenAI is picked, and for voice commands to CBI either way.', click: '[data-tour="comms-tabs-transcription"]' },
      { selector: '[data-tour="comms-transcription-test"]', title: 'Test saved key', say: 'Save first, then press Test saved key to check the key works.', click: '[data-tour="comms-tabs-transcription"]' },
      // Intake
      { selector: '[data-tour="comms-intake-enable"]', title: 'Intake line', say: 'Tick this to set one Net2Phone number aside for AI intake. Calls and texts to it become intake drafts.', click: '[data-tour="comms-tabs-intake"]' },
      { selector: '[data-tour="comms-field-net2phone_intake_label"]', title: 'Intake label', say: 'A name for this line so you can tell it apart.', click: '[data-tour="comms-tabs-intake"]' },
      { selector: '[data-tour="comms-field-net2phone_intake_number"]', title: 'Intake number', say: 'The number set aside for intake. Every other number works as normal.', click: '[data-tour="comms-tabs-intake"]' },
      { selector: '[data-tour="comms-intake-advanced"]', title: 'A separate Net2Phone account', say: 'Only if the intake line is on its own Net2Phone account. Open it to add that account’s key and signing secret.', click: '[data-tour="comms-tabs-intake"]' },
      // Email
      { selector: '[data-tour="email-domain"]', title: 'Your email domain', say: 'Send from your own domain so quotes and invoices land in the inbox. Enter your domain, add the records it lists at your domain host, then check them.', click: '[data-tour="comms-tabs-email"]' },
      { selector: '[data-tour="comms-smtp"]', title: 'Your own mail server', say: 'Only for special cases. Manage SMTP opens the host, port, sign-in, encryption, from address, reply-to and from name.', click: '[data-tour="comms-tabs-email"]' },
      { selector: '[data-tour="comms-test-email"]', title: 'Send a test email', say: 'Type your address and press Send test email. It uses your saved setup.', click: '[data-tour="comms-tabs-email-test"]' },
      // Telnyx
      { selector: '[data-tour="comms-telnyx"]', title: 'Telnyx', say: 'Keep your Telnyx account details on file: API key, from number, messaging profile, voice connection and webhook key. Your texts and calls keep using the provider on Phone setup.', click: '[data-tour="comms-tabs-telnyx"]' },
      { selector: '[data-tour="comms-save"]', title: 'Save changes', say: 'Changes on any tab wait here until you press Save changes. Discard puts back what was saved.' },
    ],
  },
  {
    id: 'settings-call-transcription',
    title: 'Call transcription',
    description: 'Who turns your call recordings into text. It opens the Phone, SMS & email page on its transcription tab.',
    route: /^\/tool-shed\/communication\/transcription\/?$/,
    roadmap: [
      { title: 'Calls are recorded', detail: 'Through your phone provider.' },
      { title: 'Pick a transcriber', detail: 'AssemblyAI or OpenAI, with your own key.' },
      { title: 'Save, then test', detail: 'The test uses the saved key.' },
    ],
    use: {
      say: 'Once a key is saved, new call recordings are turned into text you can read in Calls.',
      go: [{ label: 'Go to Calls', to: '/calls' }],
    },
    steps: [
      { selector: '[data-tour="comms-header"]', title: 'Phone, SMS & email', say: 'This is the same page as Phone, SMS & email, opened on the transcription tab.' },
      { selector: '[data-tour="comms-tabs-transcription"]', title: 'Call transcription', say: 'Pick who turns your call recordings into text and paste their key. Without a key, calls are left untranscribed.' },
      { selector: '[data-tour="comms-field-transcription_provider"]', title: 'Who transcribes your calls', say: 'AssemblyAI or OpenAI. The change applies to calls from now on; transcripts already made stay as they are.' },
      { selector: '[data-tour="comms-field-transcription_assemblyai_api_key"]', title: 'AssemblyAI key', say: 'Paste your AssemblyAI key. It’s stored encrypted, and once saved you can leave the box blank to keep it.', optional: 'With AssemblyAI picked' },
      { selector: '[data-tour="comms-field-transcription_openai_api_key"]', title: 'OpenAI key', say: 'Used for call recordings when OpenAI is picked, and for voice commands to CBI either way.' },
      { selector: '[data-tour="comms-save"]', title: 'Save changes', say: 'Press Save changes before you test. The test uses what’s saved.' },
      { selector: '[data-tour="comms-transcription-test"]', title: 'Test saved key', say: 'Press Test saved key to check the key works.' },
    ],
  },

  // ─────────────────────────────────────────────────────────── Email sender
  {
    id: 'settings-email-sender',
    title: 'Where your email comes from',
    description: 'Prove you’re allowed to send from your own domain, so quotes and invoices stay out of spam.',
    route: /^\/tool-shed\/communication\/email\/?$/,
    roadmap: [
      { title: 'Company info and Brand & logo', detail: 'What your emails say.' },
      { title: 'This page', detail: 'Add your domain and the DNS records.' },
      { title: 'Check and test', detail: 'Check outbound DNS, then send a test email.' },
      { title: 'Everything sends from you', detail: 'Invoices, estimates and automations.' },
    ],
    use: {
      say: 'Once your domain checks out, your invoices, estimates and automated emails all go out from it.',
      go: [{ label: 'Go to Invoices', to: '/invoices' }, { label: 'Go to Estimates', to: '/estimates' }, { label: 'Open Automations', to: '/tool-shed/automations' }],
    },
    steps: [
      { selector: '[data-tour="email-sender-header"]', title: 'Your email address', say: 'Your quotes and invoices go out by email. A few DNS records, once, keep them out of the junk folder.' },
      { selector: '[data-tour="email-sender-fallback"]', title: 'Until you do this', say: 'Until you set this up, your email still goes out. It just comes from a CrewBarn address with your name on it.' },
      { selector: '[data-tour="email-domain"]', title: 'Customer email domain', say: 'Your normal inbox isn’t touched. CrewBarn only needs a few records for sending, and customer replies come back into the conversation by themselves.' },
      { selector: '[data-tour="email-domain-mode"]', title: 'Who runs the sending', say: 'Bring your own DNS uses your own Resend account. CrewBarn-managed setup sends through CrewBarn’s account, so there’s no key to paste.', optional: 'Before a domain is set up' },
      { selector: '[data-tour="email-domain-key"]', title: 'Resend API key', say: 'Paste a Resend key that can manage domains. It’s stored encrypted.', optional: 'With Bring your own DNS picked' },
      { selector: '[data-tour="email-domain-name"]', title: 'Business domain', say: 'The domain customers recognise, like yourcompany.com, without anything in front of it.', optional: 'Before a domain is set up' },
      { selector: '[data-tour="email-domain-from"]', title: 'From address', say: 'The address your emails come from. It must be on your domain, and support@ is used if you leave it blank.', optional: 'Before a domain is set up' },
      { selector: '[data-tour="email-domain-create"]', title: 'Create DNS checklist', say: 'This lists the records to add at your domain host, with tips on how to enter them.', optional: 'Before a domain is set up' },
      { selector: '[data-tour="email-domain-actions"]', title: 'Check, test or remove', say: 'Once the records are added, press Check outbound DNS. Send test email sends one to you. Remove email domain goes back to a CrewBarn address after you confirm.', optional: 'Once a domain is set up' },
      { selector: '[data-tour="email-sender-smtp"]', title: 'Your own mail server', say: 'Almost nobody needs this. Use it only if your IT person told you to.' },
    ],
  },

  // ─────────────────────────────────────────────────────────── Twilio
  {
    id: 'settings-twilio-texting',
    title: 'Texting from your own Twilio number',
    description: 'CrewBarn sends your texts by default. This is where you choose to send from your own Twilio number.',
    route: /^\/tool-shed\/communication\/twilio\/?$/,
    roadmap: [
      { title: 'By default', detail: 'CrewBarn sends your texts for you.' },
      { title: 'This page', detail: 'What changes if you use your own Twilio number.' },
      { title: 'The setup', detail: 'Paste three details, send a test, then switch it on.' },
    ],
    use: {
      say: 'Once it’s switched on, the texts you send customers from Messages and the ones your automations send go out from your Twilio number.',
      go: [{ label: 'Go to Messages', to: '/communications' }, { label: 'Open Automations', to: '/tool-shed/automations' }],
    },
    steps: focusedSteps({
      title: 'Your own Twilio number',
      intro: 'By default CrewBarn sends your texts for you. If you already have a Twilio account, your texts can come from your own number instead.',
      control: 'Set up my Twilio number opens a short setup: what it does, your details, then a test.',
      consequences: 'Here’s what happens right now with your setup.',
      scope: 'Only texts to customers. Sign-in codes and staff messages are unchanged.',
    }).filter((s) => s.selector !== '[data-tour="setting-savebar"]'),
  },
  {
    id: 'settings-twilio-setup',
    title: 'Set up your Twilio number',
    description: 'Three steps: read what changes, paste your Twilio details, then test and switch it on.',
    route: /^\/tool-shed\/communication\/twilio\/setup\/?$/,
    roadmap: [
      { title: 'Have your details ready', detail: 'Twilio Account SID, Auth Token and number.' },
      { title: 'What it does', detail: 'What changes and what doesn’t.' },
      { title: 'Your details', detail: 'Paste them, then Save and continue.' },
      { title: 'Test it', detail: 'Text yourself, then tick the box to go live.' },
    ],
    use: {
      say: 'After the test passes and it’s switched on, the texts you send customers from Messages come from your own number. You can see or change the setup on the Twilio page.',
      go: [{ label: 'Go to Messages', to: '/communications' }, { label: 'Your Twilio number', to: '/tool-shed/communication/twilio' }],
    },
    steps: [
      { selector: '[data-tour="wizard-header"]', title: 'About five minutes', say: 'This takes about five minutes. You can switch back to CrewBarn sending your texts any time.' },
      { selector: '[data-tour="wizard-steps"]', title: 'Three steps', say: 'What it does, your details, then a test.' },
      { selector: '[data-tour="wizard-step1"]', title: 'What it does', say: 'Here’s what will change, what won’t, and what you’ll need.', optional: 'On the first step' },
      { selector: '[data-tour="wizard-step2"]', title: 'Your details', say: 'Paste the three details from your Twilio dashboard, then press Save and continue.', optional: 'On the second step' },
      { selector: '[data-tour="wizard-step3"]', title: 'Test it', say: 'Send a test text to your own mobile. No customer is contacted.', optional: 'On the third step' },
      { selector: '[data-tour="wizard-golive"]', title: 'Switch it on', say: 'This stays locked until a test passes. Tick it to send customer texts from your number, untick it to switch back.', optional: 'On the third step' },
    ],
  },

  // ─────────────────────────────────────────────────────────── Automations
  {
    id: 'settings-automations',
    title: 'Automations',
    description: 'Every automatic thing CrewBarn does, as plain sentences with a switch each, and a preview of what gets sent.',
    route: /^\/tool-shed\/automations\/?$/,
    roadmap: [
      { title: 'Phone, SMS & email', detail: 'Make sure texts and email can send.' },
      { title: 'Templates & forms', detail: 'Optional custom wording.' },
      { title: 'Automations', detail: 'Turn ideas on, adjust timing, see what ran.' },
      { title: 'Build your own', detail: 'Anything not in the list.' },
      { title: 'Reminders and Job statuses', detail: 'Where those rules are edited in full.' },
    ],
    use: {
      say: 'The wording of each message is written in Templates & forms. Appointment reminders are timed on the Reminders timeline, and texts and email need to be set up on Phone, SMS & email first.',
      go: [{ label: 'Open Templates & forms', to: '/custom-documents' }, { label: 'Open Reminders', to: '/tool-shed/automations/reminders' }, { label: 'Phone, SMS & email', to: '/tool-shed/communication' }],
    },
    steps: [
      { selector: '[data-tour="auto-header"]', title: 'Things CrewBarn does for you', say: 'These are things CrewBarn does for you, so nobody has to remember. Each one reads like a sentence. Flip it on and it just happens.' },
      { selector: '[data-tour="auto-actions"]', title: 'See what ran, or build your own', say: 'See what ran jumps to the history of what was sent. Build your own starts a new automation from a sentence.' },
      { selector: '[data-tour="auto-autopilot"]', title: 'Autopilot', say: 'This tells you how much is switched on and what CrewBarn sent for you this week.' },
      { selector: '[data-tour="auto-ready"]', title: 'Ready to send', say: 'Shows whether texting, email, message templates and GPS are set up. Click one that needs work to fix it. The Reminders chip turns all appointment reminders on or off.' },
      { selector: '[data-tour="auto-undo"]', title: 'Changed your mind?', say: 'Undo switches it straight back off.', optional: 'Shows after you turn something on' },
      { selector: '[data-tour="auto-filters"]', title: 'Search and filter', say: 'Search, or show only what goes to customers, techs, the office or other apps.' },
      { selector: '[data-tour="auto-groups"]', title: 'One row per automation', say: 'Each row is one automation, grouped by when it happens in a job. The switch turns it on or off, Turn on starts a suggested one, and Edit timing changes when it fires.' },
      { selector: '[data-tour="auto-panel"]', title: 'What happens', say: 'Pick any row to see exactly what it sends, when, and to whom, and what it sent lately.' },
    ],
  },
  {
    id: 'settings-automation-build',
    title: 'Build your own automation',
    description: 'Build or change one automation by filling in the blanks of a sentence.',
    route: /^\/tool-shed\/automations\/build(\/[^/]+)?\/?$/,
    roadmap: [
      { title: 'Automations', detail: 'Find what you want, or start fresh.' },
      { title: 'Fill in the sentence', detail: 'When, wait, how, who, which words.' },
      { title: 'Check the preview', detail: 'This is what would go out.' },
      { title: 'Turn it on', detail: 'Or Save changes on one you already have. Test it on yourself.' },
    ],
    use: {
      say: 'To change the words this automation sends, edit the template in Templates & forms. Your saved automation shows in the Automations list with its switch.',
      go: [{ label: 'Open Templates & forms', to: '/custom-documents' }, { label: 'Back to Automations', to: '/tool-shed/automations' }],
    },
    steps: [
      { selector: '[data-tour="build-header"]', title: 'Fill in the blanks', say: 'Tap any highlighted word to change it, and the message on the right updates as you go.' },
      { selector: '[data-tour="build-ideas"]', title: 'Start from an idea', say: 'Pick an idea to fill in the whole sentence, then change anything you like.', optional: 'Only on a new automation' },
      { selector: '[data-tour="build-sentence"]', title: 'The sentence', say: 'Each highlighted word is a choice. Tap one to change it.' },
      { selector: '[data-tour="build-picker"]', title: 'Choose', say: 'Pick one and it moves you on to the next blank.', optional: 'Tap a highlighted word first' },
      { selector: '[data-tour="build-test"]', title: 'Try it on yourself', say: 'Send one real message to yourself, filled in from a recent job.', optional: 'Only when editing a saved automation' },
      { selector: '[data-tour="build-panel"]', title: 'The preview', say: 'This is the message that would go out, filled in from the template you picked. Templates are written in Templates and Forms.' },
      { selector: '[data-tour="build-save"]', title: 'Turn it on', say: 'Read your sentence one more time, then turn it on, or save your changes.' },
    ],
  },
  {
    id: 'settings-reminder-timeline',
    title: 'Reminders',
    description: 'Every appointment reminder drawn as a pin on a job day: customers on top, techs underneath.',
    route: /^\/tool-shed\/automations\/reminders\/?$/,
    roadmap: [
      { title: 'Reminders switch', detail: 'Turn reminders on for the whole company.' },
      { title: 'This timeline', detail: 'Add, move and word each reminder.' },
      { title: 'Automations', detail: 'See them alongside everything else.' },
    ],
    use: {
      say: 'Reminders only go out while the company-wide reminder switch is on, and only for jobs with a time and a tech on the Schedule. The text and email wording is written in Templates & forms.',
      go: [{ label: 'Reminders switch', to: '/tool-shed/preferences/reminders' }, { label: 'Go to Schedule', to: '/schedule' }, { label: 'Open Templates & forms', to: '/custom-documents' }],
    },
    steps: [
      { selector: '[data-tour="rem-header"]', title: 'A job day, drawn', say: 'Customers hear from you on the top row and techs on the bottom. The switch here turns every reminder on or off.' },
      { selector: '[data-tour="rem-timeline"]', title: 'The timeline', say: 'The last two hours before the job get the most room, because that’s where most reminders go. Add puts a new pin on a row.' },
      { selector: '[data-tour="rem-editor"]', title: 'This reminder', say: 'The sentence at the top reads back what this reminder does. Every change saves straight away.', optional: 'Click a pin first' },
      { selector: '[data-tour="rem-active"]', title: 'On or off', say: 'Switch just this reminder off without deleting it.', optional: 'Click a pin first' },
      { selector: '[data-tour="rem-who"]', title: 'Who hears about it', say: 'The customer or the tech.', optional: 'Click a pin first' },
      { selector: '[data-tour="rem-when"]', title: 'When it goes out', say: 'Before start, if it hasn’t started, on the way, or may be late. The choices change with who it’s for.', optional: 'Click a pin first' },
      { selector: '[data-tour="rem-offset"]', title: 'How far out', say: 'Set the minutes with − and +, or type them. On-the-way and running-late reminders need the tech’s location.', optional: 'Click a pin first' },
      { selector: '[data-tour="rem-channels"]', title: 'How it reaches them', say: 'Pick text, email or a phone app alert. App alerts only go to techs.', optional: 'Click a pin first' },
      { selector: '[data-tour="rem-sms-words"]', title: 'The text wording', say: 'Choose which text template is sent. Templates are written in Templates and Forms, so make or change the wording there.', optional: 'When text is picked' },
      { selector: '[data-tour="rem-email-words"]', title: 'The email wording', say: 'Choose which email template is sent. Templates are written in Templates and Forms, so make or change the wording there.', optional: 'When email is picked' },
      { selector: '[data-tour="rem-delete"]', title: 'Delete it', say: 'Removes this reminder after you confirm.', optional: 'Click a pin first' },
    ],
  },

  // ─────────────────────────────────────────────────────────── GoDaddy return page
  {
    id: 'settings-godaddy-return',
    title: 'Connecting GoDaddy Payments',
    description: 'Finishes connecting GoDaddy Payments and takes you back to Payments.',
    route: /^\/oauth\/godaddy\/?$/,
    roadmap: [
      { title: 'Where card payments go', detail: 'Start the GoDaddy connection.' },
      { title: 'GoDaddy', detail: 'Authorise access.' },
      { title: 'This page', detail: 'Finishes the link.' },
      { title: 'Back on Payments', detail: 'Choose GoDaddy as the card processor.' },
    ],
    use: {
      say: 'Back on Payments, pick GoDaddy as the processor your customers pay by card through.',
      go: [{ label: 'Open Payments', to: '/tool-shed/payments' }, { label: 'Card processor', to: '/tool-shed/payments/card-processor' }],
    },
    steps: [
      { selector: '[data-tour="godaddy-callback"]', title: 'Finishing up', say: 'Hang on a second while we finish connecting GoDaddy Payments. If it didn’t connect, nothing was changed, so go back to Payments and try again.' },
    ],
  },

  // ─────────────────────────────────────────────────────────── Focused one-setting pages
  {
    id: 'setting-warranty-expiring',
    title: 'When a warranty is running out',
    description: 'How many days of notice you get before a warranty ends.',
    route: /^\/tool-shed\/warranty-settings\/expiring\/?$/,
    roadmap: focusedRoadmap('Connect › Jobs & workflow › Warranties', 'Warranties inside the window show as expiring soon on the dashboard.'),
    use: {
      say: 'Warranties inside this window show on the dashboard and on the Warranties page. To email the customer when theirs is running out, turn on the Warranty expiring reminder in Automations.',
      go: [{ label: 'Go to Warranties', to: '/warranties' }, { label: 'Open Automations', to: '/tool-shed/automations' }],
    },
    steps: focusedSteps({
      title: 'Warranty notice',
      intro: 'CrewBarn flags warranties before they end, so you can offer the work again while it’s still covered.',
      control: 'Type a number of days or use − and +. Zero means nothing is flagged early.',
      consequences: 'This setting sends nothing itself. Only the Warranty expiring reminder automation emails customers.',
      scope: 'It changes what’s highlighted. No cover is shortened or extended.',
    }),
  },
  {
    id: 'setting-job-reminders',
    title: 'Reminders before an appointment',
    description: 'Turn appointment reminders on or off for the whole company.',
    route: /^\/tool-shed\/preferences\/reminders\/?$/,
    roadmap: focusedRoadmap('Connect › Jobs & workflow › Automations & reminders', 'Your reminder rules start sending before scheduled visits.'),
    use: {
      say: 'Who gets a reminder, when, and what it says is set on the Reminders timeline. Reminders go to jobs that have a time and a tech on the Schedule.',
      go: [{ label: 'Open Reminders', to: '/tool-shed/automations/reminders' }, { label: 'Go to Schedule', to: '/schedule' }],
    },
    steps: focusedSteps({
      title: 'Appointment reminders',
      intro: 'CrewBarn can message a customer before their appointment, again if the job hasn’t started on time, and once the tech is on the way.',
      control: 'On or Off. Off stops every reminder, whatever rules exist.',
      consequences: 'Only jobs with a scheduled time and an assigned tech get reminders.',
      scope: 'Turning this off keeps your reminder rules. It only stops them sending.',
      aside: { title: 'The reminders themselves', say: 'Who gets a reminder, when, and the words are set on the timeline.' },
    }),
  },
  {
    id: 'setting-cash-collection',
    title: 'Stopping new work when cash isn’t handed in',
    description: 'Whether a tech with cash outstanding can start their next job.',
    route: /^\/tool-shed\/preferences\/cash-collection\/?$/,
    roadmap: focusedRoadmap('Connect › Money › Cash rules', 'A tech who owes cash sees what’s outstanding before their next job.'),
    use: {
      say: 'Cash a tech hands in is confirmed on the Cash register, which frees them to start their next job. To exempt one person, turn off their COD rule in Staff & crews.',
      go: [{ label: 'Go to Cash register', to: '/accounting/cash-drawer' }, { label: 'Open Staff & crews', to: '/tool-shed/staff' }],
    },
    steps: focusedSteps({
      title: 'Cash before new work',
      intro: 'When a tech has finished cash-on-delivery jobs and not handed the money in, CrewBarn can stop them starting anything new until they do.',
      control: 'On or Off. Each card says what your techs will see.',
      consequences: 'People can be exempted on their staff record, which helps while someone is training.',
      scope: 'Only cash-on-delivery jobs. Card and invoiced work is never blocked.',
    }),
  },
  {
    id: 'setting-contract-invoices',
    title: 'Whether contract invoices wait for you',
    description: 'Invoices raised by maintenance contracts either wait as drafts or count straight away.',
    route: /^\/tool-shed\/preferences\/contract-invoices\/?$/,
    roadmap: focusedRoadmap('Connect › Customers & sites › Agreements', 'New contract invoices arrive as drafts or as issued invoices.'),
    use: {
      say: 'Service agreements raise these invoices each billing period. You’ll find them in Invoices, where you issue the drafts and send them.',
      go: [{ label: 'Go to Invoices', to: '/invoices' }, { label: 'Open Service agreements', to: '/maintenance-contracts' }],
    },
    steps: focusedSteps({
      title: 'Contract invoices',
      intro: 'Maintenance contracts raise their own invoices when each billing period starts. Decide whether they wait for you.',
      control: 'On counts them straight away. Off leaves each one as a draft until someone issues it.',
      consequences: 'Either way, nothing is emailed to the customer. Sending an invoice is still something you do.',
      scope: 'Only invoices raised by a maintenance contract. Invoices you make from a job are untouched.',
    }),
  },
  {
    id: 'setting-stalled-jobs',
    title: 'When a job counts as stalled',
    description: 'How many days without activity before a job is flagged.',
    route: /^\/tool-shed\/preferences\/stalled-jobs\/?$/,
    roadmap: focusedRoadmap('Connect › Jobs & workflow › In the field', 'Untouched jobs show up for the office to chase.'),
    use: {
      say: 'Stalled jobs show in the Needs attention panel on the dashboard, which opens your Jobs list so the office can chase them.',
      go: [{ label: 'Back to the dashboard', to: '/' }, { label: 'Go to Jobs', to: '/jobs' }],
    },
    steps: focusedSteps({
      title: 'Stalled jobs',
      intro: 'A job nobody has touched for a while gets flagged so it doesn’t sit forgotten. Choose how long “a while” is for your shop.',
      control: 'Type the number of days or use − and +.',
      consequences: 'Nothing is sent to the customer, and the job isn’t changed. It’s only flagged.',
      scope: 'No job is closed, cancelled or reassigned.',
    }),
  },
  {
    id: 'setting-video-length',
    title: 'How long a field video can be',
    description: 'The longest clip a tech can record on a job.',
    route: /^\/tool-shed\/preferences\/video-length\/?$/,
    roadmap: focusedRoadmap('Connect › Jobs & workflow › In the field', 'The phone app stops recording at the new limit.'),
    use: {
      say: 'Techs record clips on a job from the phone app, and they show on that job’s files once uploaded.',
      go: [{ label: 'Go to Jobs', to: '/jobs' }],
    },
    steps: focusedSteps({
      title: 'Video length',
      intro: 'Longer clips take longer to upload on a bad signal and use more storage, so there’s a limit.',
      control: 'Type the number of seconds or use − and +.',
      consequences: 'Techs can record more than one clip if they need to.',
      scope: 'Only new recordings. Videos already uploaded are untouched.',
    }),
  },
  {
    id: 'setting-auto-check-in',
    title: 'Checking a tech in when they arrive',
    description: 'Whether reaching the job address starts the visit by itself.',
    route: /^\/tool-shed\/preferences\/auto-check-in\/?$/,
    roadmap: focusedRoadmap('Connect › Jobs & workflow › In the field', 'Visits start when the tech arrives. The finer GPS timing lives on Shop Rules › GPS check-in.'),
    use: {
      say: 'The finer timing for arrivals and alerts is on Shop Rules under GPS check-in. Visits that start this way show on the Dispatch board.',
      go: [{ label: 'GPS check-in', to: '/tool-shed/preferences#gps' }, { label: 'Go to Dispatch', to: '/dispatch' }],
    },
    steps: focusedSteps({
      title: 'Automatic check-in',
      intro: 'CrewBarn can notice from the phone’s location that a tech has reached the job and start the visit for them.',
      control: 'On or Off. It needs location turned on in the phone app.',
      consequences: 'The tech can still check in by hand if the location is a little off.',
      scope: 'It only starts visits. It never ends one, and never clocks anybody out.',
    }),
  },
  {
    id: 'setting-late-techs',
    title: 'Flashing Schedule when a tech may be late',
    description: 'Whether the Schedule button flashes when a tech may be late.',
    route: /^\/tool-shed\/preferences\/late-techs\/?$/,
    roadmap: focusedRoadmap('Connect › Jobs & workflow › In the field', 'Schedule flashes for the office. The minutes before a toast live on Shop Rules › GPS check-in.'),
    use: {
      say: 'When it flashes, open Schedule: each late tech is listed at the top with Got it and Open job.',
      go: [{ label: 'Go to Schedule', to: '/schedule' }, { label: 'GPS check-in', to: '/tool-shed/preferences#gps' }],
    },
    steps: focusedSteps({
      title: 'Late techs',
      intro: 'When a tech may be late for a job, the Schedule button flashes red and blue until somebody says they’ve seen it.',
      control: 'On or Off.',
      consequences: 'If nobody answers within a few minutes, a toast pops up on every office screen.',
      scope: 'The tech hears first, with a pop-up and an automated call, then the office. This switch never calls the customer.',
    }),
  },
]
