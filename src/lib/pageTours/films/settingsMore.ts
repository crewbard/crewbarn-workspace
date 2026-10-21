import type { FilmScene } from '../film'
import type { PageFilm } from './types'

/** Intro films for more settings pages. See ./types.ts and docs/tours/HOW-TO-WRITE-A-PAGE-TOUR.md. */

const name = (say: string, title: string, subtitle?: string, area = 'Settings'): FilmScene =>
  ({ id: 'name', say, visual: { kind: 'title', title, subtitle, area } })
const go = (say = 'Let’s walk through it.', label?: string): FilmScene =>
  ({ id: 'go', say, visual: { kind: 'go', label } })

export const SETTINGS_MORE_FILMS: PageFilm[] = [
  // ── AI ────────────────────────────────────────────────────────────────
  {
    route: '^/tool-shed/ai$',
    film: [
      name('This is CBI, your assistant. Everything about it is set up on this one page.', 'CBI AI', 'Your assistant, your rules', 'AI'),
      { id: 'does', title: 'What it does', say: 'It reads photos and messy notes, drafts texts and jobs, and learns how your company works.', visual: { kind: 'thread', contact: 'CBI', messages: [
        { from: 'us', text: 'Book Jordan Lee for a repair visit Thursday morning.' },
        { from: 'them', text: 'Here is a draft repair visit for Jordan Lee. Check the time and technician before saving or sending a confirmation.' },
      ] } },
      { id: 'parts', title: 'Three parts', say: 'Teach it your way of working, choose the jobs it helps with, and set up the AI behind it.', visual: { kind: 'chips', chips: ['Teach CBI', 'Skills', 'Setup', 'Learning', 'Voice'] } },
      { id: 'steps', title: 'Getting it going', say: 'Three steps get it started: an AI account and key, the main switch, and showing it in your menus.', visual: { kind: 'pipeline', stages: ['Provider', 'Key', 'Switch on', 'In your menus'], card: 'CBI' } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/ai/provider$',
    film: [
      name('Here you pick which AI company does the thinking for your assistant.', 'Which AI does the thinking', undefined, 'AI'),
      { id: 'yours', title: 'Your own account', say: 'You bring your own account, so what it costs goes to them, not to us.', visual: { kind: 'text', headline: 'Your account, your bill', body: 'CrewBarn never marks up what the AI costs.' } },
      { id: 'choices', title: 'Four choices', say: 'Read the current choices and supported features here. Pick your provider, add its key, and test the connection before relying on it.', visual: { kind: 'list', heading: 'AI companies', rows: [
        { title: 'Claude', meta: 'Check supported actions before use', chip: 'Recommended', tone: 'green' },
        { title: 'ChatGPT', meta: 'Check supported actions and transcription', chip: 'Acts', tone: 'blue' },
        { title: 'Gemini', meta: 'Check current supported features', chip: 'Review features', tone: 'gray' },
        { title: 'Azure', meta: 'For companies on Microsoft', chip: 'Review features', tone: 'gray' },
      ] } },
      go('Let’s look at the choices.'),
    ],
  },
  {
    route: '^/tool-shed/ai/key$',
    film: [
      name('A key is what lets CrewBarn use your own AI account. It takes about five minutes.', 'Your AI key', undefined, 'AI'),
      { id: 'steps', title: 'Five minutes', say: 'You get the key on their website, paste it here, test it, then switch AI on.', visual: { kind: 'pipeline', stages: ['Get the key', 'Paste it', 'Test it', 'Turn AI on'], card: 'Your key' } },
      { id: 'paste', title: 'Pasting it', say: 'Paste it in and save. It’s locked away, and nothing runs until you turn it on at the end.', visual: { kind: 'form', fields: [{ label: 'AI company', value: 'Claude' }, { label: 'Key', value: '••••••••••••••••' }], button: 'Save and test' } },
      go('Let’s set it up together.'),
    ],
  },
  {
    route: '^/tool-shed/ai/voice$',
    film: [
      name('Your crew can ask CrewBarn things out loud, handy with full hands or a phone on the dash.', 'Talking to CBI', undefined, 'AI'),
      { id: 'ask', title: 'The wake word', say: 'They say Hey CrewBarn, then ask their question.', visual: { kind: 'thread', contact: 'Crew app', messages: [
        { from: 'us', text: 'Hey CrewBarn, what’s my next job?' },
        { from: 'them', text: 'Next is a repair visit for Jordan Lee at 1:00, twelve minutes away.' },
      ] } },
      { id: 'switch', title: 'For everyone', say: 'One switch turns it on or off for the whole crew. Each person can still turn it off on their own phone.', visual: { kind: 'toggles', heading: 'Voice', rows: [{ label: 'Wake word in the crew app', on: true }] } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/ai/allowed$',
    film: [
      name('Nothing happens unless you allow it. This is where you choose what your assistant may help with.', 'Allowed actions', undefined, 'AI'),
      { id: 'awake', title: 'Awake or asleep', say: 'One main switch wakes it up or puts it to sleep, without losing your choices.', visual: { kind: 'text', headline: 'Asleep means nothing runs', body: 'And nothing is charged.' } },
      { id: 'jobs', title: 'One switch each', say: 'Then turn on just the jobs you want help with. You can change your mind any time.', visual: { kind: 'toggles', heading: 'What AI may do', rows: [
        { label: 'Read photos on a job', on: true }, { label: 'Draft replies to texts', on: true }, { label: 'Turn notes into a job', on: true }, { label: 'Suggest parts to order' },
      ] } },
      { id: 'draft', title: 'It drafts, you send', say: 'It drafts things for you. You still decide what goes out.', visual: { kind: 'thread', contact: 'Taylor Brooks', messages: [
        { from: 'them', text: 'Can someone come look at it this week?' },
        { from: 'us', text: 'Sure, we have Wednesday at 10:00 open. Does that work?' },
      ] } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/ai/learning$',
    film: [
      name('Left on, your assistant learns how your company does things and uses it next time.', 'Learning', undefined, 'AI'),
      { id: 'what', title: 'What it picks up', say: 'Things like what you call your jobs, what you charge, and how you word a text.', visual: { kind: 'chips', chips: ['Job names', 'Your prices', 'How you word a text', 'Customer habits'] } },
      { id: 'where', title: 'Where it may look', say: 'It only looks in the places you tick, and asks you first before it uses what it learned.', visual: { kind: 'toggles', heading: 'Learn from', rows: [
        { label: 'Your corrections', on: true }, { label: 'Texts and emails', on: true }, { label: 'Job notes', on: true }, { label: 'Calls' },
      ] } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/ai/memory$',
    film: [
      name('This is what your assistant thinks it has learned about your company.', 'Memory', undefined, 'AI'),
      { id: 'waiting', title: 'What’s waiting', say: 'Each suggestion waits here until you check it.', visual: { kind: 'list', heading: 'Waiting for you', rows: [
        { title: 'Service calls start at $95', meta: 'From three invoices', chip: 'New', tone: 'amber' },
        { title: 'Riverside Apartments: call the manager first', meta: 'From a job note', chip: 'New', tone: 'amber' },
        { title: 'Say “visit”, not “appointment”', meta: 'From your corrections', chip: 'New', tone: 'amber' },
      ] } },
      { id: 'decide', title: 'Keep, fix or reject', say: 'Look at where it learned it, then keep it, fix it, or throw it out.', visual: { kind: 'pipeline', stages: ['Suggested', 'Checked', 'Kept'], card: 'Service calls start at $95' } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/ai/activity$',
    film: [
      name('Here’s what your assistant has been doing lately, newest first.', 'Activity', undefined, 'AI'),
      { id: 'totals', title: 'Totals', say: 'See how much it did and what it cost at a glance.', visual: { kind: 'tiles', tiles: [
        { label: 'Things done', value: 20 }, { label: 'Cost', value: 1.84, prefix: '$' }, { label: 'Didn’t work', value: 1, tone: 'red' },
      ] } },
      { id: 'each', title: 'Each thing it did', say: 'Each line shows what it did, what it cost, and anything that didn’t work.', visual: { kind: 'list', rows: [
        { title: 'Read a job photo', meta: 'Today, 2:14', chip: '$0.04', tone: 'gray' },
        { title: 'Drafted a text reply', meta: 'Today, 1:52', chip: '$0.01', tone: 'gray' },
        { title: 'Turned a note into a job', meta: 'Today, 11:03', chip: 'Failed', tone: 'red' },
      ] } },
      go(),
    ],
  },

  // ── Communication ─────────────────────────────────────────────────────
  {
    route: '^/tool-shed/communication$',
    film: [
      name('This is how your calls, texts and emails get to your customers.', 'Phone, texts & email', undefined, 'Communication'),
      { id: 'reach', title: 'Every way you talk', say: 'Calls, texts and emails all go out under your company’s name.', visual: { kind: 'thread', contact: 'Morgan Diaz', messages: [
        { from: 'us', text: 'Hi Morgan, your tech is on the way, about 20 minutes out.', channel: 'text' },
        { from: 'them', text: 'Great, thanks!', channel: 'text' },
        { from: 'us', text: 'Your invoice is attached. Thanks for your business.', channel: 'email' },
      ] } },
      { id: 'sections', title: 'One section at a time', say: 'Each section shows whether it’s ready, needs setup, or is off.', visual: { kind: 'list', rows: [
        { title: 'Phone service', meta: 'CrewBarn hosted', chip: 'Ready', tone: 'green' },
        { title: 'Call transcription', meta: 'Recordings to text', chip: 'Needs setup', tone: 'amber' },
        { title: 'Customer email', meta: 'From your own address', chip: 'Ready', tone: 'green' },
        { title: 'Your own phone account', meta: 'Optional', chip: 'Off', tone: 'gray' },
      ] } },
      { id: 'choice', title: 'Easy or your own', say: 'Use CrewBarn’s phone service and we look after it, or bring your own account if you already have one.', visual: { kind: 'chips', chips: ['CrewBarn hosted', 'Bring your own', 'Test a text'] } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/communication/transcription$',
    film: [
      name('Turn call recordings and voicemails into text you can read and search.', 'Call transcription', undefined, 'Communication'),
      { id: 'text', title: 'Calls become words', say: 'Instead of listening back, just read what was said.', visual: { kind: 'thread', contact: 'Voicemail · Chris Park', messages: [
        { from: 'them', text: 'Hi, it’s Chris on Maple Street. The unit is making that noise again. Call me back when you can.', channel: 'call' },
      ] } },
      { id: 'setup', title: 'Your account', say: 'Pick the service that does it, paste your key, and send a test.', visual: { kind: 'form', fields: [{ label: 'Service', value: 'OpenAI' }, { label: 'Key', value: '••••••••••••' }], button: 'Test it' } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/communication/email$',
    film: [
      name('Quotes, invoices and job updates go out by email. This makes them come from your own address.', 'Where your email comes from', undefined, 'Communication'),
      { id: 'junk', title: 'Out of the junk folder', say: 'Proving you’re allowed to send from your address keeps your emails out of junk folders.', visual: { kind: 'text', headline: 'From you, not from us', body: 'office@yourcompany.com' } },
      { id: 'steps', title: 'A few records, once', say: 'Type your domain, add a few records where it’s hosted, then test it.', visual: { kind: 'pipeline', stages: ['Your domain', 'Add the records', 'Check', 'Sending'], card: 'yourcompany.com' } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/communication/twilio$',
    film: [
      name('CrewBarn sends your texts for you. If you have your own Twilio account, they can come from your own number.', 'Texting from your own number', undefined, 'Communication'),
      { id: 'now', title: 'Where texts come from now', say: 'This shows which number your customers see right now.', visual: { kind: 'list', rows: [
        { title: 'CrewBarn number', meta: 'Sending your texts today', chip: 'In use', tone: 'green' },
        { title: 'Your own number', meta: 'Not set up yet', chip: 'Off', tone: 'gray' },
      ] } },
      { id: 'same', title: 'What never changes', say: 'Your messages, threads and reminders stay just as they are. Only the sending number changes.', visual: { kind: 'text', headline: 'Same texts, your number' } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/communication/twilio/setup$',
    film: [
      name('About five minutes to send your texts from your own number.', 'Set up your number', undefined, 'Communication'),
      { id: 'details', title: 'Your details', say: 'Copy a few details from your account into this form.', visual: { kind: 'form', fields: [
        { label: 'Account ID', value: 'AC••••••••4821' }, { label: 'Secret', value: '••••••••••••' }, { label: 'Your number', value: '(555) 201-4477' },
      ], button: 'Send a test text' } },
      { id: 'test', title: 'A test text', say: 'Send yourself a test, then switch it on. You can switch back any time.', visual: { kind: 'thread', contact: 'Your phone', messages: [
        { from: 'us', text: 'Test from your company number. It works!', channel: 'text' },
      ] } },
      go('Let’s set it up.'),
    ],
  },

  // ── Connections ───────────────────────────────────────────────────────
  {
    route: '^/tool-shed/integrations$',
    film: [
      name('Every outside service your company is plugged into, all on one page.', 'Integrations', undefined, 'Connections'),
      { id: 'cards', title: 'At a glance', say: 'Each card shows what it is and whether it’s working.', visual: { kind: 'list', rows: [
        { title: 'File storage', meta: 'Photos and documents', chip: 'Connected', tone: 'green' },
        { title: 'Maps', meta: 'Address search', chip: 'Connected', tone: 'green' },
        { title: 'AI', meta: 'Your assistant', chip: 'Needs a key', tone: 'amber' },
        { title: 'GPS trackers', meta: 'Vehicle locations', chip: 'Off', tone: 'gray' },
      ] } },
      { id: 'kinds', title: 'Click to set up', say: 'Click any card to set it up or change it.', visual: { kind: 'chips', chips: ['Storage', 'Maps', 'AI', 'Email and texting', 'GPS', 'Brand'] } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/connected-apps$',
    film: [
      name('These are the apps you’ve linked to your account, like your bookkeeping software.', 'Connected apps', undefined, 'Connections'),
      { id: 'books', title: 'Your books', say: 'Link QuickBooks and your invoices and payments go over by themselves.', visual: { kind: 'pipeline', stages: ['Invoice sent', 'Paid', 'In your books'], card: 'Invoice 1042' } },
      { id: 'others', title: 'Other connections', say: 'You also get a quick look at everything else you’re connected to.', visual: { kind: 'list', rows: [
        { title: 'QuickBooks', meta: 'Synced 10 minutes ago', chip: 'Connected', tone: 'green' },
        { title: 'Google Calendar', meta: 'Two people', chip: 'Connected', tone: 'green' },
      ] } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/partner-connections$',
    film: [
      name('Partners you’ve invited can ask to pull your work into their own systems.', 'Partner connections', undefined, 'Connections'),
      { id: 'requests', title: 'Requests', say: 'Approve a request here, or turn it down.', visual: { kind: 'list', rows: [
        { title: 'Summit Property Group', meta: 'Wants to see their jobs', chip: 'Waiting', tone: 'amber' },
        { title: 'Northside Builders', meta: 'Active since March', chip: 'Approved', tone: 'green' },
      ] } },
      { id: 'log', title: 'What they did', say: 'See everything a partner has looked at, and cut them off any time.', visual: { kind: 'list', heading: 'Access log', rows: [
        { title: 'Read 4 jobs', meta: 'Northside Builders · Today, 9:12', chip: 'OK', tone: 'green' },
        { title: 'Read 1 invoice', meta: 'Northside Builders · Yesterday', chip: 'OK', tone: 'green' },
      ] } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/storage-maps$',
    film: [
      name('Where your photos and files are kept, and the maps behind address search.', 'Storage & maps', undefined, 'Connections'),
      { id: 'choice', title: 'Ours or yours', say: 'Let CrewBarn handle it, or bring your own accounts.', visual: { kind: 'chips', chips: ['CrewBarn storage', 'Your own storage', 'Google Maps', 'Email and texting'] } },
      { id: 'maps', title: 'Maps', say: 'Maps help your team find every address and see where the work is.', visual: { kind: 'map', pins: [
        { label: '14 Elm St', x: 30, y: 40, tone: 'blue' }, { label: 'Riverside Apts', x: 65, y: 55, tone: 'blue' }, { label: 'Office', x: 50, y: 25, tone: 'green' },
      ] } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/cloudflare$',
    film: [
      name('One connection sets up your website address and your own file storage.', 'Connect Cloudflare', undefined, 'Connections'),
      { id: 'steps', title: 'No know-how needed', say: 'Make a free account if you’re new, connect it, and pick your domain. We do the rest.', visual: { kind: 'pipeline', stages: ['Account', 'Connect', 'Your domain', 'Done'], card: 'yourcompany.com' } },
      { id: 'result', title: 'The results', say: 'When it’s done, you’ll see your website address and storage ready to use.', visual: { kind: 'list', rows: [
        { title: 'Website address', meta: 'yourcompany.com', chip: 'Ready', tone: 'green' },
        { title: 'File storage', meta: 'Your own storage space', chip: 'Ready', tone: 'green' },
      ] } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/shop-tv$',
    film: [
      name('Put today on the wall: a TV anyone in the shop can read from across the room.', 'Shop TV', undefined, 'Connections'),
      { id: 'board', title: 'Who’s out', say: 'It shows who’s out, where they are, and what’s still waiting.', visual: { kind: 'map', pins: [
        { label: 'Sam', x: 20, y: 60, to: { x: 40, y: 35 }, person: true, tone: 'blue' }, { label: 'Alex', x: 70, y: 30, person: true, tone: 'green' }, { label: 'Next job', x: 40, y: 35, tone: 'amber' },
      ] } },
      { id: 'add', title: 'Adding a screen', say: 'Open the TV page on the screen, type the code it shows here, and give it a name. About a minute.', visual: { kind: 'form', fields: [{ label: 'Code on the TV', value: 'K7P2QX' }, { label: 'Name', value: 'Shop floor' }], button: 'Add screen' } },
      go(),
    ],
  },

  // ── Developers ────────────────────────────────────────────────────────
  {
    route: '^/tool-shed/api-tokens$',
    film: [
      name('Tokens are long-lasting keys that let your own systems talk to CrewBarn.', 'API tokens', undefined, 'Developers'),
      { id: 'list', title: 'Your tokens', say: 'Each one carries your permissions, so give it a name you’ll remember.', visual: { kind: 'list', rows: [
        { title: 'Office spreadsheet', meta: 'Used today', chip: 'Active', tone: 'green' },
        { title: 'Old website form', meta: 'Not used in 3 months', chip: 'Revoked', tone: 'gray' },
      ] } },
      { id: 'make', title: 'Making one', say: 'Name it, make it, and copy it straight away. Revoke it the moment you don’t need it.', visual: { kind: 'form', fields: [{ label: 'Name', value: 'Reporting tool' }], button: 'Make token' } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/api-endpoints$',
    film: [
      name('Every way your own systems can read or change your CrewBarn data.', 'API endpoint guide', undefined, 'Developers'),
      { id: 'find', title: 'Find what you need', say: 'Search for what you want to do, like listing your jobs.', visual: { kind: 'list', search: 'jobs', rows: [
        { title: 'List jobs', meta: 'Reads your jobs', chip: 'Read', tone: 'blue' },
        { title: 'Create a job', meta: 'Adds a new job', chip: 'Write', tone: 'purple' },
        { title: 'Update a job', meta: 'Changes a job', chip: 'Write', tone: 'purple' },
      ] } },
      { id: 'copy', title: 'Copy the example', say: 'Each one shows what to send and what comes back. Copy the example and put in your token.', visual: { kind: 'text', headline: 'Copy, paste, add your token' } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/webhooks$',
    film: [
      name('Tell your own systems the moment something happens, like a new job or a paid invoice.', 'Webhooks', undefined, 'Developers'),
      { id: 'how', title: 'How it works', say: 'When something you picked happens, a signed message goes to your address.', visual: { kind: 'pipeline', stages: ['Invoice paid', 'Message sent', 'Your system'], card: 'Invoice 1042' } },
      { id: 'list', title: 'Your endpoints', say: 'Green is working, red is failing. Send a test or read the log any time.', visual: { kind: 'list', rows: [
        { title: 'Accounting sync', meta: 'Invoices paid', chip: 'Working', tone: 'green' },
        { title: 'Team chat', meta: 'New jobs', chip: 'Failing', tone: 'red' },
      ] } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/self-hosted$',
    film: [
      name('Run the office console on your own web address.', 'Self-hosted console', undefined, 'Developers'),
      { id: 'safe', title: 'Your data stays put', say: 'Your data, logins and keys stay here. The console on your address just talks to it.', visual: { kind: 'text', headline: 'office.yourcompany.com', body: 'Same console, your address.' } },
      { id: 'how', title: 'Two ways', say: 'Set it up in a few clicks with Cloudflare, or do it by hand, then activate your domain.', visual: { kind: 'chips', chips: ['Quick setup', 'By hand', 'Activate a domain', 'Your domains'] } },
      go(),
    ],
  },

  // ── Inventory ─────────────────────────────────────────────────────────
  {
    route: '^/tool-shed/label-printer$',
    film: [
      name('Send labels straight to a roll printer on this computer, at the right size.', 'Label printer', undefined, 'Inventory'),
      { id: 'steps', title: 'Getting connected', say: 'Install the small print helper, connect, and pick your printer.', visual: { kind: 'pipeline', stages: ['Install', 'Connect', 'Pick printer', 'Test label'], card: 'Shelf label' } },
      { id: 'optional', title: 'It’s optional', say: 'Without it, labels still print through the normal print window.', visual: { kind: 'text', headline: 'Optional, but quicker' } },
      go(),
    ],
  },

  // ── Money ─────────────────────────────────────────────────────────────
  {
    route: '^/tool-shed/payments$',
    film: [
      name('This is how your customers pay you, by card or straight into your bank.', 'Payments', undefined, 'Money'),
      { id: 'paid', title: 'Paid to you', say: 'The money goes to you. CrewBarn never holds it.', visual: { kind: 'money', title: 'Invoice 1042', lines: [{ label: 'Repair visit', amount: 185 }, { label: 'Parts', amount: 64.5 }], stamp: 'Paid' } },
      { id: 'ways', title: 'Ways to get paid', say: 'Take cards through Stripe or GoDaddy, let customers pay by bank transfer, and watch your bank for deposits.', visual: { kind: 'list', rows: [
        { title: 'Stripe', meta: 'Cards', chip: 'Connected', tone: 'green' },
        { title: 'GoDaddy Payments', meta: 'Cards', chip: 'Not set up', tone: 'gray' },
        { title: 'Bank transfer', meta: 'Straight to your account', chip: 'On', tone: 'green' },
        { title: 'Watch your bank', meta: 'Spots deposits', chip: 'Off', tone: 'gray' },
      ] } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/payments/card-processor$',
    film: [
      name('If you can take cards more than one way, pick the one that charges your customers.', 'Where card payments go', undefined, 'Money'),
      { id: 'pick', title: 'The choice', say: 'Pick one and save. Every card payment goes through it, straight to you.', visual: { kind: 'toggles', heading: 'Takes the card', rows: [{ label: 'Stripe', on: true }, { label: 'GoDaddy Payments' }] } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/payments/bank-transfer$',
    film: [
      name('Let customers pay straight into your bank account from their portal.', 'Pay by bank transfer', undefined, 'Money'),
      { id: 'details', title: 'Your bank details', say: 'Switch it on and add your bank details. Nobody takes a cut, but it’s slower than a card.', visual: { kind: 'form', fields: [{ label: 'Account name', value: 'Your Company LLC' }, { label: 'Routing number', value: '•••••4410' }, { label: 'Account number', value: '•••••8832' }], button: 'Save' } },
      { id: 'invoice', title: 'On invoices', say: 'Your invoices then show how to pay by bank, and you mark it paid when the money lands.', visual: { kind: 'money', title: 'Invoice 1043', lines: [{ label: 'Yearly service', amount: 240 }], stamp: 'Bank transfer' } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/payments/watch-bank$',
    film: [
      name('Connect your business checking and CrewBarn spots each deposit for you.', 'Watch your bank', undefined, 'Money'),
      { id: 'match', title: 'Deposit to invoice', say: 'It works out which invoice a deposit was for, and marks it paid.', visual: { kind: 'pipeline', stages: ['Deposit lands', 'Matched', 'Marked paid'], card: '$249.50' } },
      { id: 'expect', title: 'Money you’re expecting', say: 'You can see what you’re still waiting for.', visual: { kind: 'list', rows: [
        { title: 'Invoice 1043', meta: 'Taylor Brooks · Due Friday', chip: '$240', tone: 'amber' },
        { title: 'Invoice 1039', meta: 'Riverside Apartments', chip: 'Matched', tone: 'green' },
      ] } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/payment-types$',
    film: [
      name('These are the ways your team can record a payment by hand.', 'Payment types', undefined, 'Money'),
      { id: 'list', title: 'What your team sees', say: 'Switch off the ones you never take, so nobody picks them by mistake.', visual: { kind: 'toggles', heading: 'Payment types', rows: [{ label: 'Cash', on: true }, { label: 'Check', on: true }, { label: 'Zelle', on: true }, { label: 'Money order' }] } },
      { id: 'own', title: 'Your own types', say: 'Add your own too, like a house account.', visual: { kind: 'form', fields: [{ label: 'New type', value: 'House account' }], button: 'Add' } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/payment-terms$',
    film: [
      name('Payment terms say when an invoice is due.', 'Payment terms', undefined, 'Money'),
      { id: 'terms', title: 'Your terms', say: 'On receipt, in fifteen days, in thirty. Pick the one new customers start with.', visual: { kind: 'list', rows: [
        { title: 'Due on receipt', chip: 'Default', tone: 'blue' }, { title: 'Net 15', meta: 'Due in 15 days' }, { title: 'Net 30', meta: 'Due in 30 days' },
      ] } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/pricing$',
    film: [
      name('These are the discounts you can put on estimates and invoices.', 'Pricing & discounts', undefined, 'Money'),
      { id: 'list', title: 'Your discounts', say: 'A discount is a percentage off, or a set dollar amount.', visual: { kind: 'list', rows: [
        { title: 'Senior discount', meta: 'Percent off', chip: '10%', tone: 'green' },
        { title: 'Returning customer', meta: 'Dollars off', chip: '$25', tone: 'green' },
      ] } },
      { id: 'apply', title: 'On a bill', say: 'Add one to a bill and the total takes care of itself.', visual: { kind: 'money', title: 'Estimate 318', lines: [{ label: 'Replacement', amount: 420 }, { label: 'Senior discount', amount: -42 }], stamp: '' } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/cost-model$',
    film: [
      name('Put in what it really costs to run your business, and see the hourly rate you need.', 'Cost model', undefined, 'Money'),
      { id: 'costs', title: 'Your costs', say: 'Add your monthly costs, like trucks, insurance and the office.', visual: { kind: 'money', title: 'Monthly overhead', lines: [{ label: 'Trucks and fuel', amount: 2400 }, { label: 'Insurance', amount: 850 }, { label: 'Office and phones', amount: 1100 }], stamp: '' } },
      { id: 'rate', title: 'Your rate', say: 'It works out break-even and a target that covers modeled costs, profit and a separate growth reserve. Check company insurance shares are counted once. Save your assumptions, then read the updated rates and warnings.', visual: { kind: 'tiles', tiles: [
        { label: 'Monthly overhead', value: 4350, prefix: '$' }, { label: 'Break-even', value: 48, prefix: '$', suffix: '/hr' }, { label: 'Target rate', value: 85, prefix: '$', suffix: '/hr', tone: 'green' },
      ] } },
      go(),
    ],
  },

  // ── Preferences (shop rules sections) ─────────────────────────────────
  {
    route: '^/tool-shed/preferences$', hash: 'intake',
    film: [
      name('Choose what must be filled in before a new job or estimate can be saved.', 'New job & estimate intake', undefined, 'Shop rules'),
      { id: 'rules', title: 'What’s required', say: 'Fewer rules means faster booking. More means fewer gaps later.', visual: { kind: 'toggles', heading: 'Required to save', rows: [{ label: 'A work site', on: true }, { label: 'A date and time', on: true }, { label: 'A crew member' }, { label: 'A description', on: true }] } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/preferences$', hash: 'numbering',
    film: [
      name('Set the next number for your customers, jobs, estimates, invoices and orders.', 'Auto-numbering', undefined, 'Shop rules'),
      { id: 'next', title: 'The next numbers', say: 'Handy when you’re carrying on from another system.', visual: { kind: 'form', fields: [{ label: 'Next job', value: '5001' }, { label: 'Next estimate', value: '1200' }, { label: 'Next invoice', value: '3400' }], button: 'Save' } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/preferences$', hash: 'field-rules',
    film: [
      name('These are the rules your crew works to in the field.', 'Closing a job properly', undefined, 'Shop rules'),
      { id: 'finish', title: 'Finishing properly', say: 'Decide what a job needs before it can be marked complete.', visual: { kind: 'toggles', heading: 'Before complete', rows: [{ label: 'Photos of the work', on: true }, { label: 'Customer signature', on: true }, { label: 'Collect payment on the day' }] } },
      { id: 'quiet', title: 'Quiet jobs', say: 'And how quiet jobs get chased, with a nudge to the tech.', visual: { kind: 'thread', contact: 'Sam', messages: [{ from: 'us', text: 'The Oak Street job hasn’t had an update in 3 days. What’s holding it up?', channel: 'text' }] } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/preferences$', hash: 'delete-permissions',
    film: [
      name('Decide who can delete company records, and how they prove it’s really them.', 'Delete permissions', undefined, 'Shop rules'),
      { id: 'who', title: 'Who can delete', say: 'Tick the people allowed, and add checks like a password and a reason.', visual: { kind: 'toggles', heading: 'Allowed to delete', rows: [{ label: 'Pat, owner', on: true }, { label: 'Jamie, office', on: true }, { label: 'Ask for their password', on: true }, { label: 'Ask for a reason', on: true }] } },
      go('Deleting is for mistakes. Let’s walk through it.'),
    ],
  },
  {
    route: '^/tool-shed/preferences$', hash: 'pay',
    film: [
      name('Decide when a job counts toward someone’s commission or bonus.', 'When pay is earned', undefined, 'Shop rules'),
      { id: 'when', title: 'Invoiced or paid', say: 'Once it’s invoiced, or once the customer has paid. You choose.', visual: { kind: 'pipeline', stages: ['Done', 'Invoiced', 'Paid'], card: 'Commission earned', stopAt: 2 } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/preferences$', hash: 'vacation',
    film: [
      name('How many vacation days your staff build up over a year of full-time work.', 'Vacation earned', undefined, 'Shop rules'),
      { id: 'days', title: 'Days per year', say: 'Set it for hourly and salaried staff, and it adds up as they work.', visual: { kind: 'tiles', tiles: [{ label: 'Hourly', value: 10, suffix: ' days' }, { label: 'Salaried', value: 15, suffix: ' days', tone: 'green' }] } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/preferences$', hash: 'clock',
    film: [
      name('Clock a tech in when their phone reaches a scheduled job, and out when they leave.', 'Clock in and out by GPS', undefined, 'Shop rules'),
      { id: 'arrive', title: 'Hours add up on their own', say: 'They drive up, they’re clocked in. Nobody has to remember.', visual: { kind: 'map', pins: [{ label: 'Alex', x: 20, y: 70, to: { x: 65, y: 35 }, person: true, tone: 'blue' }, { label: 'Scheduled job', x: 65, y: 35, tone: 'green' }], route: true } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/preferences$', hash: 'sender',
    film: [
      name('This is what customers see in the from line of your emails and texts.', 'Outbound sender', undefined, 'Shop rules'),
      { id: 'from', title: 'From you', say: 'Your company name, your email address, and your text number.', visual: { kind: 'form', fields: [{ label: 'Email name', value: 'Your Company' }, { label: 'Email address', value: 'office@yourcompany.com' }, { label: 'Text number', value: '(555) 201-4477' }] } },
      go(),
    ],
  },

  // ── Preferences (single settings) ─────────────────────────────────────
  {
    route: '^/tool-shed/preferences/auto-check-in$',
    film: [
      name('Let the phone notice when a tech reaches the job, and start the visit for them.', 'Checking in on arrival', undefined, 'Shop rules'),
      { id: 'arrive', title: 'Honest arrival times', say: 'Arrival times stay honest, without anyone remembering to tap.', visual: { kind: 'map', pins: [{ label: 'Sam', x: 25, y: 65, to: { x: 70, y: 30 }, person: true, tone: 'blue' }, { label: 'Repair visit', x: 70, y: 30, tone: 'green' }], route: true } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/preferences/late-techs$',
    film: [
      name('Make the Schedule button flash when a tech may be late for a job.', 'When a tech may be late', undefined, 'Shop rules'),
      { id: 'call', title: 'Call first', say: 'The tech hears first, with a pop-up and a phone call. Then the office, so the customer hears from you before they have to call.', visual: { kind: 'calendar', visits: [
        { day: 1, slot: 0, label: 'Repair · Sam', tone: 'green' }, { day: 1, slot: 1, label: 'Install · Sam', tone: 'red' }, { day: 2, slot: 0, label: 'Service · Alex', tone: 'blue' },
      ] } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/preferences/stalled-jobs$',
    film: [
      name('Choose how long a job can sit untouched before it’s flagged.', 'When a job is stalled', undefined, 'Shop rules'),
      { id: 'flag', title: 'Nothing forgotten', say: 'Past that many days it gets a flag, so nothing slips through. It’s only a flag; nothing else changes.', visual: { kind: 'list', rows: [
        { title: 'Replace unit', meta: 'Morgan Diaz · No update in 6 days', chip: 'Stalled', tone: 'red' },
        { title: 'Repair visit', meta: 'Chris Park · Updated today', chip: 'In progress', tone: 'blue' },
      ] } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/preferences/video-length$',
    film: [
      name('Set the longest video a tech can record on a job.', 'Field video length', undefined, 'Shop rules'),
      { id: 'short', title: 'Short uploads fast', say: 'Shorter clips upload faster on a weak signal.', visual: { kind: 'tiles', tiles: [{ label: 'Longest clip', value: 60, suffix: ' sec', tone: 'blue' }] } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/preferences/reminders$',
    film: [
      name('One switch for appointment reminders, so customers hear from you without anyone remembering.', 'Appointment reminders', undefined, 'Shop rules'),
      { id: 'sends', title: 'What it sends', say: 'Before the visit, if it starts late, and when the tech is on the way.', visual: { kind: 'thread', contact: 'Jordan Lee', messages: [
        { from: 'us', text: 'Reminder: your visit is tomorrow between 9 and 11.', channel: 'text' },
        { from: 'us', text: 'Sam is on the way, about 15 minutes out.', channel: 'text' },
      ] } },
      { id: 'switch', title: 'On or off', say: 'Turning it off keeps your reminder rules saved. It just stops them going out.', visual: { kind: 'toggles', rows: [{ label: 'Send appointment reminders', on: true }] } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/preferences/contract-invoices$',
    film: [
      name('Service agreements raise their own invoices each billing period.', 'Contract invoices', undefined, 'Shop rules'),
      { id: 'choice', title: 'Drafts or straight away', say: 'Choose whether those invoices wait as drafts for you, or count straight away.', visual: { kind: 'pipeline', stages: ['Billing period', 'Draft', 'Sent'], card: 'Monthly service', stopAt: 1 } },
      go(),
    ],
  },
  {
    route: '^/tool-shed/preferences/cash-collection$',
    film: [
      name('Decide whether a tech who collected cash has to hand it in before their next job.', 'Cash hand-in rule', undefined, 'Shop rules'),
      { id: 'hand', title: 'Cash comes back first', say: 'Turn it on and the next job waits until the cash is handed in.', visual: { kind: 'money', title: 'Cash collected', lines: [{ label: 'Repair visit · Chris Park', amount: 150 }], stamp: 'Handed in' } },
      go(),
    ],
  },
]
