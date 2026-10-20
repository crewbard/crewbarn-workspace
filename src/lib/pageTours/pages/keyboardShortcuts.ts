import type { PageTour } from '../types'

/**
 * Account menu → Keyboard shortcuts (/me/keyboard-shortcuts).
 *
 *   kbd-header           the page heading
 *   kbd-toggle           Use keyboard shortcuts, Print cheat sheet, Reset all
 *   kbd-print            Print cheat sheet
 *   kbd-reset-all        Reset all to the usual keys (greyed out with nothing changed)
 *   kbd-group-open       Open fast
 *   kbd-group-goto       Go to (G then a letter)
 *   kbd-group-new        New (N then a letter)
 *   kbd-group-record     On a record
 *   kbd-row              one shortcut; data-shortcut = its name
 *   kbd-change           a row's Change button
 *   kbd-conflict         a row whose keys clash with another's
 *
 * The tour only points: it never presses Change, so nothing is saved.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'keyboard-shortcuts',
  route: '^/me/keyboard-shortcuts/?$',
  intro: {
    page: 'Keyboard shortcuts',
    purpose: 'Get around CrewBarn without reaching for the mouse. Search everything, jump to a page, or start a new job with a couple of keys, and set the keys up your way.',
    covers: ['Turning them on or off', 'Search and CBI', 'Going to a page', 'Starting something new', 'Changing a key', 'The cheat sheet'],
  },
  film: [
    { id: 'name', say: 'These are your keyboard shortcuts. A couple of keys, and you’re there.', visual: { kind: 'title', title: 'Keyboard shortcuts', subtitle: 'Fewer clicks, every day' } },
    { id: 'search', title: 'Search everything', say: 'Control K finds any job, customer, estimate, invoice, page or setting. Or hand your question straight to CBI.', visual: { kind: 'list', heading: 'Search everything', search: 'smith', rows: [{ title: 'Jordan Smith', meta: 'Customer', chip: 'Open', tone: 'blue' }, { title: 'Repair at Smith office', meta: 'Job', chip: 'Scheduled', tone: 'amber' }, { title: 'Ask CBI: smith', meta: 'CBI', chip: 'Ask', tone: 'purple' }] } },
    { id: 'goto', title: 'Go to, and new', say: 'Press G, then a letter, to jump to a page. N, then a letter, starts something new.', visual: { kind: 'chips', heading: 'Two keys away', chips: ['G J  Jobs', 'G S  Schedule', 'G C  Customers', 'N J  New job', 'N E  New estimate'] } },
    { id: 'yours', title: 'Make them yours', say: 'Change any key, turn one off, or turn them all off. Your keys follow you to any computer you sign in on.', visual: { kind: 'toggles', heading: 'Your shortcuts', rows: [{ label: 'Use keyboard shortcuts', on: true }, { label: 'Search everything', on: true }, { label: 'Ask CBI anything', on: true }] } },
    { id: 'go', say: 'Let’s walk through the page.', visual: { kind: 'go', label: 'Keyboard shortcuts' } },
  ],
  steps: [
    {
      id: 'header', selector: t('kbd-header'), title: 'Keyboard shortcuts',
      say: 'Every shortcut in CrewBarn is listed here, with the keys you have right now.',
    },
    {
      id: 'toggle', selector: t('kbd-toggle'), title: 'On or off',
      say: 'Turn them all off here if keys keep doing things you didn’t mean. The buttons all still work either way.',
    },
    {
      id: 'print', selector: t('kbd-print'), title: 'Print cheat sheet',
      say: 'Print a one page cheat sheet of your keys to keep by the screen.',
    },
    {
      id: 'open', selector: t('kbd-group-open'), title: 'Open fast',
      say: 'These work from any page. Control K searches everything, Alt Space asks CBI, slash jumps to the page’s search box, and the question mark opens Help.',
    },
    {
      id: 'goto', selector: t('kbd-group-goto'), title: 'Go to',
      say: 'Press G, let go, then the letter. G then J is Jobs, G then S is the Schedule. A little G shows at the bottom while it waits for the letter.',
    },
    {
      id: 'new', selector: t('kbd-group-new'), title: 'New',
      say: 'N, then a letter, starts something new: a job, an estimate, a customer, a to-do and more.',
    },
    {
      id: 'record', selector: t('kbd-group-record'), title: 'On a record',
      say: 'On a job, estimate, customer or invoice, E edits it and M opens its messages. The square brackets step to the previous or next one in the list you came from.',
    },
    {
      id: 'change', selector: t('kbd-change'), title: 'Change a key',
      say: 'Press Change, then press the new keys. If they clash with another shortcut, or your browser already uses them, it tells you before anything is saved.',
      variants: [
        { when: t('kbd-conflict'), selector: t('kbd-conflict'), title: 'A clash', say: 'This one shares its keys with another shortcut, so only one of them will work. Press Change on one of them to fix it.' },
      ],
    },
    {
      id: 'reset', selector: t('kbd-reset-all'), title: 'Back to the usual keys',
      say: 'Changed your mind? Reset puts every shortcut back the way it came.',
    },
  ],
}
