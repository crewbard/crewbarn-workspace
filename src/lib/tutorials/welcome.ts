import type { TutorialData } from './types'

/**
 * Welcome to CrewBarn: the first thing a new shop sees.
 *
 * The film says what CrewBarn is, then ends on the road through setup. The
 * live part walks every setup step on /onboarding, in order, one chapter per
 * step. This one is different from the other tutorials: the person is
 * setting up their own company, so saving their own setup is the point. But
 * nothing is ever saved for them. "Do it for me" only opens a step, picks a
 * tab or picks a choice; every Save, Apply, Invite and Connect is theirs to
 * press, and a step that waits for one can always be skipped.
 *
 * Kept import-free (types aside) so the voice exporter can load it.
 */

const t = (id: string) => `[data-tour=${JSON.stringify(id)}]`
const stage = (key: string) => t(`onboarding-stage-${key}`)
const shownStep = (key: string) => t(`onboarding-current-${key}`)

const ONB = '^/onboarding/?$'
// `?onboarding=peek` keeps guided setup from covering the page (OnboardingGate).
const CALLS = '^/tool-shed/communication/transcription/?$'

export const TUTORIAL: TutorialData = {
  id: 'welcome',
  kicker: 'Welcome · tutorial',
  title: 'Welcome to CrewBarn',

  film: [
    {
      id: 'barn',
      label: 'Welcome',
      title: 'Your whole company, under one roof',
      narration:
        'Welcome to CrewBarn. Think of it as one barn for your whole company. The phone rings and it becomes a job, the job lands on the schedule, your tech does the work, and you get paid. No sticky notes, and no three different apps.',
    },
    {
      id: 'trade',
      label: 'Your trade',
      title: 'Built for your trade, not a blank screen',
      narration:
        'CrewBarn starts with a pack for your trade: the job types, the steps a job goes through, a starter price list and places to keep stock. Don’t love a name? Change it. Missing something? Add it.',
    },
    {
      id: 'calls',
      label: 'Calls become work',
      title: 'Every call and text becomes work',
      narration:
        'Calls, texts and email land in one shared inbox. Recorded calls turn into text, and CBI, the assistant built into CrewBarn, drafts the job from the conversation: who, where, what and when. Nothing is saved until you say so.',
    },
    {
      id: 'field',
      label: 'In the field',
      title: 'The right tech at the right door',
      narration:
        'The schedule shows the whole day, and every truck on the map. Your techs get the phone app: the gate code before they arrive, photos, parts and a signature before they leave. It even keeps working in basements and dead zones.',
    },
    {
      id: 'paid',
      label: 'Getting paid',
      title: 'Invoice on the spot, get paid faster',
      narration:
        'Then the best part. Invoice right from the job, take a card on the phone, or text a pay link. Payments drop into your books and match up with your bank.',
    },
    {
      id: 'keys',
      label: 'Your own AI',
      title: 'Your own AI, for pennies',
      narration:
        'You bring your own AI keys: Claude or ChatGPT for the thinking, and AssemblyAI to turn phone calls into text. You pay them directly, never us, and most everyday tasks cost less than half a penny each.',
    },
    {
      id: 'road',
      label: 'The road, part one',
      title: 'Your road through setup',
      narration:
        'Here’s the road to getting set up. You’ve already made your account. First comes AI, then where your photos and maps live, then your company’s name and logo, then the starter pack for your trade.',
    },
    {
      id: 'road2',
      label: 'The road, part two',
      title: 'From setup to your first job, to getting paid',
      narration:
        'Then your tools and stock, your crew, your phone, and a quick look at your prices. Choose what CrewBarn chases for you, have a last look, and you’re live: first job, first invoice, first payment.',
    },
    {
      id: 'yourturn',
      label: 'Your turn',
      title: 'Now let’s set it up together',
      narration:
        'That’s the road. Now let’s walk it for real. I’ll step back into the corner and open each step with you. You fill it in and press its own save button, nothing is saved without you, and you can skip anything and come back.',
    },
  ],

  chapters: [
    { key: 'start', label: 'Your setup page' },
    { key: 'beta', label: 'The beta agreement' },
    { key: 'ai', label: 'Let AI help, or do it yourself' },
    { key: 'maps', label: 'Your photos and maps' },
    { key: 'brand', label: 'Make it look like your shop' },
    { key: 'pack', label: 'A pack for your trade' },
    { key: 'tools', label: 'Your tools, trucks and software' },
    { key: 'stock', label: 'What you keep on the shelf' },
    { key: 'crew', label: 'Get your crew in' },
    { key: 'phone', label: 'Your phone, texts and email' },
    { key: 'prices', label: 'What you sell, and for how much' },
    { key: 'chasing', label: 'Quick settings' },
    { key: 'golive', label: 'Have a look, then go' },
    { key: 'next', label: 'What’s next' },
  ],

  steps: [
    // ---------- Your setup page ----------
    {
      id: 'start-header', chapter: 'start', route: ONB, open: 'goto:/onboarding?step=overview', selector: t('onboarding-page-header'),
      title: 'Your setup page',
      say: 'This is your setup page. Every step to get your company ready is here, one decision at a time, and you can stop whenever you like and pick it up later.',
    },
    {
      id: 'start-welcome', chapter: 'start', route: ONB, selector: t('onboarding-watch-welcome'),
      title: 'Watch the welcome',
      say: 'Watch the welcome plays the film you just saw, and then this walk through setup, whenever you want it again.',
    },
    {
      id: 'start-guided', chapter: 'start', route: ONB, selector: t('onboarding-open-guided'),
      title: 'Open guided setup',
      say: 'Open guided setup shows the same steps in a window over the page. Same steps, same saves. Today we’ll use the page itself.',
    },
    {
      id: 'start-continue', chapter: 'start', route: ONB, selector: t('onboarding-continue'),
      title: 'Continue current step',
      say: 'Continue current step jumps to the first step that isn’t done yet. Handy when you come back another day.',
    },
    {
      id: 'start-readiness', chapter: 'start', route: ONB, selector: t('onboarding-readiness'),
      title: 'Launch readiness',
      say: 'Launch readiness fills up as you go. Underneath, it counts what’s in so far: your tools, your staff, your stock locations and your catalog.',
    },
    {
      id: 'start-list', chapter: 'start', route: ONB, selector: t('onboarding-page-stages'),
      title: 'The steps, in order',
      say: 'Here are the steps, in order. Each one says Step and its number, Done when it’s finished, or Locked when it waits for a step above it. Click any of them to open it.',
    },
    {
      id: 'start-current', chapter: 'start', route: ONB, selector: t('onboarding-page-current'),
      title: 'The open step',
      say: 'The step you open shows here: what it’s for, why it matters, and the step itself, with its own amber button that saves it.',
    },
    {
      id: 'start-nav', chapter: 'start', route: ONB, selector: t('onboarding-page-nav'),
      title: 'Back and Next',
      say: 'Back and Next down here just move between steps. They don’t save anything. The step’s own amber button is what saves.',
    },
    {
      id: 'start-how', chapter: 'start',
      title: 'How we’ll do this',
      say: 'Here’s how this works. I open each step with you and point at every choice, and tell you where it shows up later. You fill it in and press save. If you’d rather leave a step for later, press Skip.',
    },

    // ---------- The beta agreement (free test accounts only) ----------
    {
      id: 'beta-open', chapter: 'beta', route: ONB, selector: stage('beta_agreement'),
      wait: { appear: shownStep('beta_agreement') }, doIt: stage('beta_agreement'),
      yourTurn: 'Click Accept the beta agreement in the list.',
      title: 'The beta agreement',
      say: 'Free test accounts start with the beta agreement. Nothing gets set up until it’s accepted. Click it in the list.',
    },
    {
      id: 'beta-terms', chapter: 'beta', route: ONB, selector: t('onboarding-beta-terms'),
      title: 'The terms, in full',
      say: 'The terms are short and all here: what you’re getting, what we’re asking, bringing your own keys, that it’s a beta, your data, no warranty, and how to leave. Have a read.',
    },
    {
      id: 'beta-tick', chapter: 'beta', route: ONB, selector: t('onboarding-beta-tick'), hold: true,
      yourTurn: 'Tick the box once you’ve read it, then press Next.',
      title: 'Say you’ve read it',
      say: 'Tick this box to say you’ve read the agreement and accept it for your company.',
    },
    {
      id: 'beta-accept', chapter: 'beta', route: ONB, selector: t('onboarding-beta-accept'),
      wait: { gone: t('onboarding-beta-accept') },
      yourTurn: 'Press Accept and unlock setup.',
      title: 'Accept and unlock setup',
      say: 'Then press Accept and unlock setup. The rest of the steps open, and we carry on with AI.',
    },

    // ---------- Let AI help, or do it yourself ----------
    {
      id: 'ai-open', chapter: 'ai', route: ONB, open: 'goto:/onboarding?step=ai_setup', selector: stage('ai_setup'),
      wait: { appear: shownStep('ai_setup') }, doIt: stage('ai_setup'),
      yourTurn: 'Click Let AI help, or do it yourself.',
      title: 'Step 1: AI',
      say: 'Step one is AI. Click it in the list.',
    },
    {
      id: 'ai-why', chapter: 'ai', route: ONB, selector: shownStep('ai_setup'),
      title: 'Why AI comes first',
      say: 'AI comes first because it can do a lot of the typing in the steps after it. It’s optional. Skip it and everything can be filled in by hand.',
    },
    {
      id: 'ai-bullets', chapter: 'ai', route: ONB, selector: t('onboarding-current-bullets'),
      title: 'The short version',
      say: 'Every step has a short version like this. Here: you bring your own AI account, nothing runs until you turn it on, and doing it by hand stays an option.',
    },
    {
      id: 'ai-byo', chapter: 'ai', route: ONB, selector: t('onboarding-ai-which'),
      title: 'Your own account, for pennies',
      say: 'You bring an account from an AI company and paste its key here. You pay them directly, never us, and most everyday tasks cost less than half a penny each.',
    },
    {
      id: 'ai-claude', chapter: 'ai', route: ONB, selector: t('onboarding-ai-provider-anthropic'),
      title: 'Claude',
      say: 'Claude is what we recommend. It’s the best at reading photos and messy notes, and it can do things for you, not just write.',
    },
    {
      id: 'ai-chatgpt', chapter: 'ai', route: ONB, selector: t('onboarding-ai-provider-openai'),
      title: 'ChatGPT',
      say: 'ChatGPT is the one a lot of shops already have. An OpenAI key can also turn recorded calls into text.',
    },
    {
      id: 'ai-others', chapter: 'ai', route: ONB, selector: t('onboarding-ai-provider-google'),
      title: 'Gemini and Azure',
      say: 'Gemini is cheapest if you use AI heavily, but it won’t act for you. Azure is only for companies that already run on Microsoft Azure.',
    },
    {
      id: 'ai-pick', chapter: 'ai', route: ONB, selector: t('onboarding-ai-providers'),
      wait: { click: true }, doIt: t('onboarding-ai-provider-anthropic'),
      yourTurn: 'Pick the one you have an account with. Not sure? Pick Claude.',
      title: 'Pick one',
      say: 'Pick the one you’ll use. If you don’t have any of them yet, pick Claude.',
    },
    {
      id: 'ai-getkey', chapter: 'ai', route: ONB, selector: t('onboarding-ai-key'),
      title: 'Get a key',
      say: 'Get a key opens the AI company’s own key page in a new tab. For Claude that’s platform.claude.com: add credit under Billing first, then Settings, API keys, Create key. Copy it right away. It’s only shown once.',
    },
    {
      id: 'ai-getkey-openai', chapter: 'ai', route: ONB, selector: t('onboarding-ai-key'),
      title: 'For ChatGPT',
      say: 'For ChatGPT, the link opens platform.openai.com. Add credit under Billing, then on API keys press Create new secret key, and copy it straight away.',
    },
    {
      id: 'ai-paste', chapter: 'ai', route: ONB, selector: t('onboarding-ai-key-box'), hold: true,
      yourTurn: 'Paste your key in the box, then press Next. No key yet? Press Next anyway.',
      title: 'Paste your key',
      say: 'Paste the key in this box. It’s stored encrypted, and no other company on CrewBarn can see it.',
    },
    {
      id: 'ai-openai', chapter: 'ai', route: ONB, selector: t('onboarding-ai-openai'),
      title: 'An OpenAI key as well',
      say: 'With Claude or Gemini, this second box takes an OpenAI key, and it’s optional. It turns recorded calls into text, and lets your crew talk to CBI out loud. For calls, I’ll show you AssemblyAI on the phone step.',
    },
    {
      id: 'ai-model', chapter: 'ai', route: ONB, selector: t('onboarding-ai-model'),
      title: 'Choose a specific model',
      say: 'Choose a specific model is folded away on purpose. Leave it alone, and CrewBarn uses the one we recommend.',
    },
    {
      id: 'ai-what', chapter: 'ai',
      title: 'What AI does for you',
      say: 'Once it’s on, CBI drafts jobs from calls and texts, reads serial plates and part numbers from photos, and answers questions like who’s free tomorrow at two. You choose which tasks it’s allowed to do, and it never changes anything until a person presses Confirm.',
    },
    {
      id: 'ai-manual', chapter: 'ai', route: ONB, selector: t('onboarding-ai-manual'),
      title: 'Or do it by hand',
      say: 'Rather not use AI? I will do this by hand skips it. You can connect it any time later, under CBI AI in the Tool Shed.',
    },
    {
      id: 'ai-save', chapter: 'ai', route: ONB, selector: t('onboarding-ai-save'),
      wait: { gone: t('onboarding-ai-save') },
      yourTurn: 'Press Save and carry on, or I will do this by hand. Or Skip to come back later.',
      title: 'Save and carry on',
      say: 'When you’re ready, press Save and carry on. It saves your choice and your key, and opens the next step. If the key box is empty, it tells you.',
    },

    // ---------- Where your photos and maps come from ----------
    {
      id: 'maps-open', chapter: 'maps', route: ONB, open: 'goto:/onboarding?step=data_ownership', selector: stage('data_ownership'),
      wait: { appear: shownStep('data_ownership') }, doIt: stage('data_ownership'),
      yourTurn: 'Click Where your photos and maps come from.',
      title: 'Step 2: photos and maps',
      say: 'Step two is where your photos and maps come from. Click it in the list.',
    },
    {
      id: 'maps-why', chapter: 'maps', route: ONB, selector: shownStep('data_ownership'),
      title: 'Why this matters',
      say: 'Job photos and documents need somewhere to live, and the map needs an account of its own. This step decides both.',
    },
    {
      id: 'maps-choice', chapter: 'maps', route: ONB, selector: t('onboarding-maps-choice'),
      title: 'Two ways to do it',
      say: 'There are two ways. Use your own accounts, or let CrewBarn handle it.',
    },
    {
      id: 'maps-own', chapter: 'maps', route: ONB, selector: t('onboarding-maps-own'),
      title: 'Use my own accounts',
      say: 'Use my own accounts is what we recommend. Cloudflare keeps the photos and Google runs the maps. Both are free to start, the bills come to you, and if you ever leave, the files are already yours.',
    },
    {
      id: 'maps-managed', chapter: 'maps', route: ONB, selector: t('onboarding-maps-managed'),
      title: 'Let CrewBarn handle it',
      say: 'Let CrewBarn handle it is quicker to start. There’s nothing to sign up for, CrewBarn bills you for what you use, and you can move to your own accounts later.',
    },
    {
      id: 'maps-pick', chapter: 'maps', route: ONB, selector: t('onboarding-maps-choice'),
      wait: { click: true }, doIt: t('onboarding-maps-own'),
      yourTurn: 'Pick one. I’ll walk through Use my own accounts.',
      title: 'Pick one',
      say: 'Pick the one you want. I’ll walk you through your own accounts, one at a time.',
    },
    {
      id: 'maps-cloudflare', chapter: 'maps', route: ONB, selector: t('onboarding-cloudflare-guide'),
      title: 'Connect Cloudflare',
      say: 'Photos first. One Cloudflare connection can do three jobs: keep your files, put your work dashboard on your own address, and build your website. This box lists the three permissions to check when you make the token.',
    },
    {
      id: 'maps-storage', chapter: 'maps', route: ONB, selector: t('onboarding-storage-guide'),
      title: 'Somewhere to keep photos',
      say: 'Make a free Cloudflare account, then connect it here. CrewBarn makes the storage and fills in the keys for you.',
    },
    {
      id: 'maps-connect', chapter: 'maps', route: ONB, selector: t('onboarding-cloudflare-connect'), hold: true,
      yourTurn: 'Open Connect Cloudflare if you’re ready, come back, then press Set up my storage. Press Next when you’re done, or to do it later.',
      title: 'Connect it',
      say: 'Open Connect Cloudflare makes your token in a new tab. Come back here, press Check connection again if it hasn’t noticed, pick which of your domains to use, and press Set up my storage.',
    },
    {
      id: 'maps-manual', chapter: 'maps', route: ONB, selector: t('onboarding-storage-manual'),
      title: 'Or type the values in',
      say: 'Already have a bucket, or your IT team won’t hand out a token? Or type the values in yourself has the boxes for that.',
    },
    {
      id: 'maps-google', chapter: 'maps', route: ONB, selector: t('onboarding-maps-guide'),
      title: 'Maps and address lookup',
      say: 'Now the maps. They run on your own Google account. This guide draws each screen you’ll see on Google’s website, with the real button names, and links straight to that page.',
    },
    {
      id: 'gmaps-1', chapter: 'maps', route: ONB, click: t('gmaps-tab-1'), selector: t('gmaps-panel'),
      title: '1. Create a project',
      say: 'Step one: open the project page, sign in with the Google account you want billed, press Create project, give it a name like your company and Maps, and press Create.',
    },
    {
      id: 'gmaps-2', chapter: 'maps', route: ONB, click: t('gmaps-tab-2'), selector: t('gmaps-panel'),
      title: '2. Turn on billing',
      say: 'Step two, billing. Google wants a card even though it gives you a free monthly allowance, and most shops stay inside it. Link a billing account, then set a budget alert, so you hear about it long before any surprise.',
    },
    {
      id: 'gmaps-3', chapter: 'maps', route: ONB, click: t('gmaps-tab-3'), selector: t('gmaps-panel'),
      title: '3. Turn on the maps CrewBarn uses',
      say: 'Step three: turn on the five that CrewBarn uses. Maps JavaScript, Places New, Geocoding, Directions and Distance Matrix. Open each one and press Enable.',
    },
    {
      id: 'gmaps-3-why', chapter: 'maps', route: ONB, selector: t('gmaps-panel'),
      title: 'What each one does',
      say: 'Maps JavaScript draws every map, Places is the address search as you type, and Geocoding turns an address into a pin. Directions and Distance Matrix draw routes and find the closest tech on the dispatch map.',
    },
    {
      id: 'gmaps-4', chapter: 'maps', route: ONB, click: t('gmaps-tab-4'), selector: t('gmaps-panel'),
      title: '4. Create the key',
      say: 'Step four: on Credentials, press Create credentials, then API key. Copy it, but don’t paste it anywhere yet. Lock it down first.',
    },
    {
      id: 'gmaps-5', chapter: 'maps', route: ONB, click: t('gmaps-tab-5'), selector: t('gmaps-panel'),
      title: '5. Restrict it',
      say: 'Step five: open the key. Under Application restrictions pick Websites, and add each address on the list. Under API restrictions pick Restrict key, tick the same five, and Save. That stops anyone else running up your bill.',
    },
    {
      id: 'maps-referrers', chapter: 'maps', route: ONB, selector: t('onboarding-maps-referrers'),
      title: 'The addresses to add',
      say: 'These are the exact addresses to add in Google, with Copy buttons: CrewBarn itself, and the shop TV board. Copy each one exactly. A missing one means maps stop working in that place.',
    },
    {
      id: 'maps-domain', chapter: 'maps', route: ONB, selector: t('onboarding-maps-domain'), hold: true,
      yourTurn: 'Type your website’s domain if you have one, like example.com, then press Next.',
      title: 'Your own website',
      say: 'Got your own website? Type just the domain here, and the two lines to add for it show up underneath, ready to copy.',
    },
    {
      id: 'gmaps-6', chapter: 'maps', route: ONB, click: t('gmaps-tab-6'), selector: t('gmaps-panel'),
      title: '6. Paste it into CrewBarn',
      say: 'Step six: come back here with the key.',
    },
    {
      id: 'maps-key', chapter: 'maps', route: ONB, selector: t('onboarding-maps-key'), hold: true,
      yourTurn: 'Paste your Google Maps key, then press Next.',
      title: 'Google Maps key',
      say: 'Paste it in the Google Maps key box. It’s stored encrypted, and nobody else can see it.',
    },
    {
      id: 'maps-where', chapter: 'maps',
      title: 'Where the maps show up',
      say: 'Maps show up all over. The address box fills in as you type, every address gets a pin, the dispatch map draws routes and suggests the closest tech, and the shop TV shows the crew. You can change the key later on Storage and Maps.',
    },
    {
      id: 'maps-save', chapter: 'maps', route: ONB, selector: t('onboarding-maps-save'),
      wait: { gone: t('onboarding-maps-save') },
      yourTurn: 'Press Save and carry on when it’s filled in, or Skip to come back later.',
      title: 'Save and carry on',
      say: 'Save and carry on checks every box and tells you by name if one is empty. With your own accounts, it needs your storage and your Google Maps key.',
    },

    // ---------- Make it look like your shop ----------
    {
      id: 'brand-open', chapter: 'brand', route: ONB, open: 'goto:/onboarding?step=company_profile', selector: stage('company_profile'),
      wait: { appear: shownStep('company_profile') }, doIt: stage('company_profile'),
      yourTurn: 'Click Make it look like your shop.',
      title: 'Step 3: your shop',
      say: 'Step three makes it look like your shop. Click it in the list.',
    },
    {
      id: 'brand-why', chapter: 'brand', route: ONB, selector: shownStep('company_profile'),
      title: 'On everything a customer sees',
      say: 'Your name, number, address and logo go on every invoice, quote and email. Worth getting right before you send the first one.',
    },
    {
      id: 'brand-name', chapter: 'brand', route: ONB, selector: t('onboarding-brand-name'), hold: true,
      yourTurn: 'Check your company name, then press Next.',
      title: 'Your company name',
      say: 'Your company name, exactly as you want it printed. It starts with the name you signed up with.',
    },
    {
      id: 'brand-phone', chapter: 'brand', route: ONB, selector: t('onboarding-brand-phone'), hold: true,
      yourTurn: 'Type the number customers should ring, then press Next.',
      title: 'Phone',
      say: 'The phone number customers should ring. It goes on everything they get, so they can call you back.',
    },
    {
      id: 'brand-email', chapter: 'brand', route: ONB, selector: t('onboarding-brand-email'), hold: true,
      yourTurn: 'Type your office email, then press Next.',
      title: 'Email',
      say: 'Your email address. Quotes and invoices are sent from it.',
    },
    {
      id: 'brand-address', chapter: 'brand', route: ONB, selector: t('onboarding-brand-address'), hold: true,
      yourTurn: 'Type your address, then press Next.',
      title: 'Address',
      say: 'Your shop, or the address you work out of. Add it even if customers never visit. It goes on invoices, and Google uses it to work out where you work.',
    },
    {
      id: 'brand-website', chapter: 'brand', route: ONB, selector: t('onboarding-brand-website'),
      title: 'Website',
      say: 'Website is optional. If you already have one, put it here.',
    },
    {
      id: 'brand-preview', chapter: 'brand', route: ONB, selector: t('onboarding-brand-preview'),
      title: 'What a customer gets',
      say: 'Watch this side as you type. It’s a sketch of the invoice a customer gets, with your name and details at the top, and your color on the band and the Pay this invoice button.',
    },
    {
      id: 'brand-logo', chapter: 'brand', route: ONB, selector: t('onboarding-brand-logo'), hold: true,
      yourTurn: 'Choose your logo file if you have one handy, then press Next.',
      title: 'Your logo',
      say: 'Your logo isn’t required to carry on. A PNG, JPG, WebP or SVG works, and it uploads as soon as you choose it.',
    },
    {
      id: 'brand-color', chapter: 'brand', route: ONB, selector: t('onboarding-brand-color'),
      wait: { click: true }, doIt: '[data-tour="onboarding-brand-color"] button',
      yourTurn: 'Pick a color.',
      title: 'Your color',
      say: 'Pick your color from these eight. It’s used on your invoices, your quotes and your website, so everything matches.',
    },
    {
      id: 'brand-where', chapter: 'brand',
      title: 'Where it shows up',
      say: 'All of this lands on your quotes, invoices, emails, your customer portal and your website. Change it any time later, under Company info and Brand and logo in your settings.',
    },
    {
      id: 'brand-save', chapter: 'brand', route: ONB, selector: t('onboarding-brand-save'),
      wait: { gone: t('onboarding-brand-save') },
      yourTurn: 'Press Save and carry on, or Skip to come back later.',
      title: 'Save and carry on',
      say: 'Press Save and carry on. Name, phone, email and address are needed, and if one is missing, it says which one and why.',
    },

    // ---------- Start with a pack for your trade ----------
    {
      id: 'pack-open', chapter: 'pack', route: ONB, open: 'goto:/onboarding?step=trade_seed', selector: stage('trade_seed'),
      wait: { appear: shownStep('trade_seed') }, doIt: stage('trade_seed'),
      yourTurn: 'Click Start with a pack for your trade.',
      title: 'Step 4: your trade pack',
      say: 'Step four is the starter pack for your trade. Click it in the list.',
    },
    {
      id: 'pack-why', chapter: 'pack', route: ONB, selector: shownStep('trade_seed'),
      title: 'No blank screen',
      say: 'Instead of an empty system, the pack fills in the job types, statuses, services and stock locations a shop like yours usually needs. You see it all before it’s added.',
    },
    {
      id: 'pack-note', chapter: 'pack', route: ONB, selector: t('onboarding-pack-note'),
      title: 'The pack is below',
      say: 'The pack itself is just below this step.',
    },
    {
      id: 'pack-trade', chapter: 'pack', route: ONB, selector: t('onboarding-trade'),
      title: 'Your trade',
      say: 'Your trade was picked when you signed up, and it can’t be changed later. It decides your starter pack. You can still change any job type, stage or message the pack adds.',
    },
    {
      id: 'pack-summary', chapter: 'pack', route: ONB, selector: t('onboarding-pack-summary'),
      title: 'What’s in it',
      say: 'This counts what’s in the pack: job types, the kinds of equipment you work on, catalog items and custom fields.',
    },
    {
      id: 'pack-preview', chapter: 'pack', route: ONB, selector: t('onboarding-pack-preview'),
      title: 'Have a look first',
      say: 'And here’s a peek at each list: job types, service categories, products, inventory locations, equipment types and custom fields.',
    },
    {
      id: 'pack-where', chapter: 'pack',
      title: 'Where it shows up',
      say: 'Job types and statuses show up on every job, the services and products fill your catalog, and the locations are where Inventory keeps your stock. Change or remove any of it afterwards.',
    },
    {
      id: 'pack-apply', chapter: 'pack', route: ONB, selector: t('onboarding-apply-pack'),
      wait: { gone: t('onboarding-apply-pack') },
      yourTurn: 'Press Apply the starter pack when you’re happy with it, or Skip.',
      title: 'Apply the starter pack',
      say: 'Apply the starter pack adds it all to your company for real. It also unlocks the next step, your tools.',
    },

    // ---------- Your tools, trucks and software ----------
    {
      id: 'tools-open', chapter: 'tools', route: ONB, open: 'goto:/onboarding?step=company_assets', selector: stage('company_assets'),
      wait: { appear: shownStep('company_assets') }, doIt: stage('company_assets'),
      yourTurn: 'Click Your tools, trucks and software.',
      title: 'Step 5: your kit',
      say: 'Step five is your tools, trucks and software. Click it in the list.',
    },
    {
      id: 'tools-why', chapter: 'tools', route: ONB, selector: shownStep('company_assets'),
      title: 'The kit your shop owns',
      say: 'This is the kit your shop owns, not the customer’s. Machines, laptops, trucks, safety gear, and the software you pay for every month.',
    },
    {
      id: 'tools-locked', chapter: 'tools', route: ONB, selector: t('onboarding-step-locked'),
      title: 'Still locked?',
      say: 'If it says to finish the steps above first, it opens as soon as the trade pack is applied.',
    },
    {
      id: 'tools-list', chapter: 'tools', route: ONB, selector: t('onboarding-tools'),
      title: 'Suggested for your trade',
      say: 'Here’s what a shop in your trade usually owns, already ticked. You only untick what you don’t have.',
    },
    {
      id: 'tools-count', chapter: 'tools', route: ONB, selector: t('seed-picker-count'),
      title: 'How many are ticked',
      say: 'This counts how many are ticked, and says where the suggestions came from.',
    },
    {
      id: 'tools-all', chapter: 'tools', route: ONB, selector: t('seed-picker-tick-all'),
      title: 'Tick all, or Clear',
      say: 'Tick all and Clear do the whole list at once. Clear is handy when you own only a few.',
    },
    {
      id: 'tools-row', chapter: 'tools', route: ONB, selector: t('seed-picker-row'), hold: true,
      yourTurn: 'Untick what you don’t own, rename anything, then press Next.',
      title: 'One line per item',
      say: 'Each line is a tick and a name. Untick what you don’t own, and click a name to change it.',
    },
    {
      id: 'tools-details', chapter: 'tools', route: ONB, selector: t('seed-picker-details'),
      title: 'Details',
      say: 'Details opens what it is, like a tool, vehicle, software or safety gear, and a notes box for the serial, who has it, anything.',
    },
    {
      id: 'tools-empty', chapter: 'tools', route: ONB, selector: t('seed-picker-empty'),
      title: 'No suggestions?',
      say: 'No suggestions came back for your trade? That’s fine. Add your tools and trucks yourself under Company Tools once you’re in.',
    },
    {
      id: 'tools-where', chapter: 'tools',
      title: 'Where it shows up',
      say: 'These go into Company Tools, where you see who or which truck has each one, and what needs checking. Later, it’s how CrewBarn knows which van can take which job.',
    },
    {
      id: 'tools-save', chapter: 'tools', route: ONB, selector: t('onboarding-tools-save'),
      wait: { gone: t('onboarding-tools-save') },
      yourTurn: 'Press Add these and carry on, or Skip.',
      title: 'Add these and carry on',
      say: 'Add these and carry on adds the ticked ones to Company Tools and opens the next step.',
    },

    // ---------- What you keep on the shelf ----------
    {
      id: 'stock-open', chapter: 'stock', route: ONB, open: 'goto:/onboarding?step=inventory_layout', selector: stage('inventory_layout'),
      wait: { appear: shownStep('inventory_layout') }, doIt: stage('inventory_layout'),
      yourTurn: 'Click What you keep on the shelf.',
      title: 'Step 6: your stock',
      say: 'Step six is what you keep on the shelf. Click it in the list.',
    },
    {
      id: 'stock-why', chapter: 'stock', route: ONB, selector: shownStep('inventory_layout'),
      title: 'Rough counts are fine',
      say: 'CrewBarn suggests what a shop in your trade usually keeps. Tick what you carry, and put in rough counts. Nobody expects a stock take on day one.',
    },
    {
      id: 'stock-locked', chapter: 'stock', route: ONB, selector: t('onboarding-step-locked'),
      title: 'Still locked?',
      say: 'If it’s still locked, it opens once your tools are in.',
    },
    {
      id: 'stock-list', chapter: 'stock', route: ONB, selector: t('onboarding-stock'),
      title: 'Suggested stock',
      say: 'Same list as the tools: everything ticked, untick what you don’t carry.',
    },
    {
      id: 'stock-row', chapter: 'stock', route: ONB, selector: t('seed-picker-row'), hold: true,
      yourTurn: 'Untick what you don’t carry, then press Next.',
      title: 'Tick what you carry',
      say: 'Untick anything you don’t carry, and click a name to change it.',
    },
    {
      id: 'stock-details', chapter: 'stock', route: ONB, selector: t('seed-picker-details'),
      title: 'Counts and reordering',
      say: 'Details holds how many you have, the part number, and two reorder numbers: Tell me when it drops to, and Then order this many.',
    },
    {
      id: 'stock-where', chapter: 'stock',
      title: 'Where it shows up',
      say: 'It all goes into Inventory. A tech can add a part to a job without typing its name, and when something runs low, it lands on the list to order.',
    },
    {
      id: 'stock-save', chapter: 'stock', route: ONB, selector: t('onboarding-stock-save'),
      wait: { gone: t('onboarding-stock-save') },
      yourTurn: 'Press Add these and carry on, or Skip. Stock can wait.',
      title: 'Add these and carry on',
      say: 'Add these and carry on puts the ticked ones in Inventory. Or skip it, and sort stock out another day.',
    },

    // ---------- Get your crew in ----------
    {
      id: 'crew-open', chapter: 'crew', route: ONB, open: 'goto:/onboarding?step=staff', selector: stage('staff'),
      wait: { appear: shownStep('staff') }, doIt: stage('staff'),
      yourTurn: 'Click Get your crew in.',
      title: 'Step 7: your crew',
      say: 'Step seven gets your crew in. Click it in the list.',
    },
    {
      id: 'crew-why', chapter: 'crew', route: ONB, selector: shownStep('staff'),
      title: 'Everyone who needs a login',
      say: 'Office, dispatchers, techs and managers. Anyone who needs to sign in. They pick their own password, and techs use the phone app with the same login.',
    },
    {
      id: 'crew-already', chapter: 'crew', route: ONB, selector: t('onboarding-crew-already'),
      title: 'Already here',
      say: 'Already here lists who’s in so far.',
    },
    {
      id: 'crew-name', chapter: 'crew', route: ONB, selector: t('onboarding-crew-name'), hold: true,
      yourTurn: 'Type their first name, and last name if you like, then press Next.',
      title: 'Who you’re inviting',
      say: 'Invite someone. Their first name, and their last name if you like.',
    },
    {
      id: 'crew-email', chapter: 'crew', route: ONB, selector: t('onboarding-crew-email'), hold: true,
      yourTurn: 'Type their email, then press Next.',
      title: 'Their email',
      say: 'Their own email, not the office one. The invite goes there, so it has to be one they can open.',
    },
    {
      id: 'crew-roles', chapter: 'crew', route: ONB, selector: t('onboarding-crew-roles'),
      wait: { click: true }, doIt: '[data-tour="onboarding-crew-roles"] [role="radio"]',
      yourTurn: 'Pick what they can see.',
      title: 'What they can see',
      say: 'Pick what this person can see. Each card is a role, with a line saying what it covers. A tech can close their job without seeing your margins.',
    },
    {
      id: 'crew-send', chapter: 'crew', route: ONB, selector: t('onboarding-crew-send'), hold: true,
      yourTurn: 'Press Send the invite when it looks right, then Next. Or just press Next.',
      title: 'Send the invite',
      say: 'Send the invite emails them a link to set their own password. You never set it, and you never see it.',
    },
    {
      id: 'crew-result', chapter: 'crew', route: ONB, selector: t('onboarding-crew-result'),
      title: 'Did it arrive?',
      say: 'This says plainly whether the email went. Either way their setup link is here to copy and text them, because the first email often lands in junk.',
    },
    {
      id: 'crew-where', chapter: 'crew',
      title: 'Where they show up',
      say: 'Everyone you invite shows up in Staff and Crews, in the Tool Shed. Skills, crews, time off and roles can all wait until they’re in.',
    },
    {
      id: 'crew-done', chapter: 'crew', route: ONB, selector: t('onboarding-crew-done'),
      wait: { gone: t('onboarding-crew-done') },
      yourTurn: 'Press the button when you’ve invited everyone for now, or Skip.',
      title: 'Done, or later',
      say: 'When you’re finished, press Done, carry on. With nobody in yet, the same button says I will do this later. Invite the rest whenever you like.',
    },

    // ---------- Your phone, texts and email ----------
    {
      id: 'phone-open', chapter: 'phone', route: ONB, open: 'goto:/onboarding?step=communications', selector: stage('communications'),
      wait: { appear: shownStep('communications') }, doIt: stage('communications'),
      yourTurn: 'Click Your phone, texts and email.',
      title: 'Step 8: your phone',
      say: 'Step eight is your phone, texts and email. Click it in the list.',
    },
    {
      id: 'phone-why', chapter: 'phone', route: ONB, selector: shownStep('communications'),
      title: 'Calls and texts in CrewBarn',
      say: 'Calls, texts and replies come into CrewBarn instead of somebody’s personal phone. Worth having working before the first real job.',
    },
    {
      id: 'phone-done', chapter: 'phone', route: ONB, selector: t('onboarding-step-done'),
      title: 'Already done',
      say: 'This one’s already done. You can still change it whenever you like.',
    },
    {
      id: 'phone-intro', chapter: 'phone', route: ONB, selector: t('onboarding-phone-intro'),
      title: 'One number for the crew',
      say: 'Pick one CrewBarn number for your techs to call and text customers from the phone app. Every call and message lands on the customer and the job. Ordinary texts start once the number’s carrier registration is approved.',
    },
    {
      id: 'phone-number', chapter: 'phone', route: ONB, selector: t('onboarding-phone-number'), hold: true,
      yourTurn: 'Choose a number here if you want one now, then press Next.',
      title: 'Your number',
      say: 'Choose your number here. It’s optional, and you can do it later.',
    },
    {
      id: 'phone-links', chapter: 'phone', route: ONB, selector: t('onboarding-stage-links'),
      title: 'Communication settings',
      say: 'Communication settings opens the full page in a new tab: your own Twilio number, email from your own address, and turning calls into text. Let’s look at that last one together.',
    },
    {
      id: 'calls-open', chapter: 'phone', route: CALLS, open: 'goto:/tool-shed/communication/transcription?onboarding=peek', selector: t('comms-transcription'),
      title: 'Call transcription',
      say: 'This is Call transcription. Recorded calls and voicemails turn into text in the conversation, on your own account with the company you choose.',
    },
    {
      id: 'calls-provider', chapter: 'phone', route: CALLS, selector: t('comms-field-transcription_provider'),
      title: 'Who transcribes your calls',
      say: 'AssemblyAI is recommended. It did better on real service calls: it keeps the office and the caller apart, and writes part numbers and prices as digits. OpenAI works too.',
    },
    {
      id: 'calls-getkey', chapter: 'phone', route: CALLS, selector: t('get-key-assemblyai'),
      title: 'Get an AssemblyAI key',
      say: 'Get an AssemblyAI key opens assemblyai.com in a new tab. Sign in, then go to Workspace, Manage, API Keys, and press Create New API Key.',
    },
    {
      id: 'calls-key', chapter: 'phone', route: CALLS, selector: t('comms-field-transcription_assemblyai_api_key'), hold: true,
      yourTurn: 'Paste your AssemblyAI key, then press Next.',
      title: 'Paste it here',
      say: 'Paste it here. It’s encrypted when saved, and AssemblyAI deletes the recording and transcript on its side as soon as CrewBarn has read them.',
    },
    {
      id: 'calls-openai', chapter: 'phone', route: CALLS, selector: t('comms-field-transcription_openai_api_key'),
      title: 'The OpenAI key',
      say: 'The OpenAI key here is used for calls if you pick OpenAI above, and for talking to CBI out loud either way. Its Get a key link opens platform.openai.com.',
    },
    {
      id: 'calls-cost', chapter: 'phone', route: CALLS, selector: t('key-cost-note'),
      title: 'You pay them directly',
      say: 'Same as AI: you pay them directly, and nothing goes through us.',
    },
    {
      id: 'calls-save', chapter: 'phone', route: CALLS, selector: t('comms-save'), hold: true,
      yourTurn: 'If you pasted a key, press Save changes, then press Next.',
      title: 'Save changes',
      say: 'If you pasted a key, press Save changes before we go back. Once it’s saved, Test saved key checks that it works.',
    },
    {
      // Already done: the choices aren't there, the "done" note is, and the wait is met at once.
      id: 'phone-choices', chapter: 'phone', route: ONB, open: 'goto:/onboarding?step=communications', selector: `${t('onboarding-phone-choices')}, ${t('onboarding-step-done')}`,
      wait: { gone: t('onboarding-phone-choices') },
      yourTurn: 'Press Use this number, or Choose a number later.',
      title: 'Finish the phone step',
      say: 'Back on setup. Press Use this number once you’ve chosen one, or Choose a number later. Either one finishes this step.',
    },

    // ---------- Check what you sell, and for how much ----------
    {
      id: 'prices-open', chapter: 'prices', route: ONB, open: 'goto:/onboarding?step=services_pricebook', selector: stage('services_pricebook'),
      wait: { appear: shownStep('services_pricebook') }, doIt: stage('services_pricebook'),
      yourTurn: 'Click Check what you sell, and for how much.',
      title: 'Step 9: your prices',
      say: 'Step nine is a quick look at your prices. Click it in the list.',
    },
    {
      id: 'prices-why', chapter: 'prices', route: ONB, selector: shownStep('services_pricebook'),
      title: 'Go through it once',
      say: 'The pack gave you a starting list of services and prices. Go through it once, so the quotes and invoices your crew builds come out right the first time.',
    },
    {
      id: 'prices-done', chapter: 'prices', route: ONB, selector: t('onboarding-step-done'),
      title: 'Already done',
      say: 'Already done here, because your catalog has items in it. You can still check them any time.',
    },
    {
      id: 'prices-links', chapter: 'prices', route: ONB, selector: t('onboarding-stage-links'),
      title: 'Open your catalog',
      say: 'Service catalog and Product catalog open in a new tab, so this page stays where it is. Come back here when you’re done.',
    },
    {
      id: 'prices-confirm', chapter: 'prices', route: ONB, selector: t('onboarding-confirm-step'),
      wait: { gone: t('onboarding-confirm-step') },
      yourTurn: 'Press My prices are checked when you’re happy, or Skip.',
      title: 'Prices checked',
      say: 'When they look right, press My prices are checked, carry on. Change any of them any time after.',
    },

    // ---------- Quick settings ----------
    {
      id: 'chasing-open', chapter: 'chasing', route: ONB, open: 'goto:/onboarding?step=automations', selector: stage('automations'),
      wait: { appear: shownStep('automations') }, doIt: stage('automations'),
      yourTurn: 'Click Quick settings.',
      title: 'Step 10: quick settings',
      say: 'Step ten is quick settings. Click it in the list.',
    },
    {
      id: 'chasing-why', chapter: 'chasing', route: ONB, selector: shownStep('automations'),
      title: 'Yes or no',
      say: 'Yes or no to each thing CrewBarn can do by itself: reminding a customer the day before, texting back a call you missed, chasing an invoice nobody has paid. Anything a customer gets stays off unless you say yes.',
    },
    {
      id: 'chasing-done', chapter: 'chasing', route: ONB, selector: t('quick-settings'),
      title: 'Your answers',
      say: 'The team ones already have a suggestion filled in. Press Yes or No on any of them, and change your mind later on the Automations page.',
    },
    {
      id: 'chasing-confirm', chapter: 'chasing', route: ONB, selector: t('quick-settings-save'),
      wait: { gone: t('quick-settings-save') },
      yourTurn: 'Press Save my answers and carry on when you’re ready, or Skip.',
      title: 'Save my answers',
      say: 'Then press Save my answers and carry on.',
    },

    // ---------- Have a look, then go ----------
    {
      id: 'golive-open', chapter: 'golive', route: ONB, open: 'goto:/onboarding?step=launch_review', selector: stage('launch_review'),
      wait: { appear: shownStep('launch_review') }, doIt: stage('launch_review'),
      yourTurn: 'Click Have a look, then go.',
      title: 'The last step',
      say: 'Last step: have a look, then go. Click it in the list.',
    },
    {
      id: 'golive-why', chapter: 'golive', route: ONB, selector: shownStep('launch_review'),
      title: 'One last check',
      say: 'A quick pass over everything before real customers turn up. Anything you skipped waits in the Tool Shed, and none of it stops you starting.',
    },
    {
      id: 'golive-readiness', chapter: 'golive', route: ONB, selector: t('onboarding-readiness'),
      title: 'What’s done',
      say: 'Launch readiness shows how far you’ve got, and the list shows any step still waiting.',
    },
    {
      id: 'golive-links', chapter: 'golive', route: ONB, selector: t('onboarding-stage-links'),
      title: 'Open your dashboard',
      say: 'Open dashboard shows your company the way you’ll see it every day.',
    },
    {
      id: 'golive-finish', chapter: 'golive', route: ONB, selector: t('onboarding-confirm-step'),
      wait: { gone: t('onboarding-confirm-step') },
      yourTurn: 'Press Finish setup when you’re ready.',
      title: 'Finish setup',
      say: 'When it feels right, press Finish setup. You can come back and change almost all of it later.',
    },

    // ---------- What’s next ----------
    {
      id: 'next-dashboard', chapter: 'next', route: ONB, open: 'goto:/onboarding',
      title: 'Your dashboard',
      say: 'From here, the dashboard is home: today’s jobs, the money, and what needs you. It’s the first thing you see when you sign in.',
    },
    {
      id: 'next-first-job', chapter: 'next',
      title: 'Your first job',
      say: 'A good first run: add a customer, make a quote, turn it into a job, put it on the schedule, then invoice it and take the payment. That’s the whole road, start to finish.',
    },
    {
      id: 'next-tutorial', chapter: 'next', route: ONB, selector: t('tutorial-launch'),
      title: 'Every page has a tutorial',
      say: 'Every page with a tutorial has this button, the graduation cap with a gold dot. On Jobs it teaches Jobs, on the Schedule it teaches the Schedule.',
    },
    {
      id: 'next-help', chapter: 'next', route: ONB, selector: t('topbar-help'),
      title: 'Help',
      say: 'Help, the question mark, can start the page’s tutorial too. Its Show tutorials on pages box puts the tutorial button on every page that has one. Untick it to hide them.',
    },
    {
      id: 'next-bye', chapter: 'next',
      title: 'Welcome aboard',
      say: 'That’s it. Welcome to CrewBarn. Watch the welcome on the setup page plays this again whenever you like.',
    },
  ],
}
