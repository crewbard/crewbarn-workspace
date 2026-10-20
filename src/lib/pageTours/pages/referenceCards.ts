import type { PageTour } from '../types'

/**
 * Catalog & inventory → Reference cards (/reference-cards).
 *
 * Also walks what opens from here: a card (refcard-open), a catalog page
 * it is found on, read as a book (book-viewer), the book's Order panel
 * (book-order) and its Tabs editor (book-tabs-editor). Catalogs themselves
 * have their own page and tour (catalogs.ts). Those parts are lit only while they are open;
 * the few hands-on steps offer "Do it for me" to open one (opening never
 * changes anything). The full tour just shows the page.
 *
 * States the page marks:
 *   refcards-mine / -shared / -retired  data-count = number of cards
 *   refcards-editor   data-card-saved = yes | no
 *   book-order        data-order-for = estimate | stock,
 *                     data-order-state = new | draft | waiting_on_approval | ordered | …,
 *                     data-vendor = set | none
 *   book-tabs-editor  data-tab-count
 */
const t = (id: string) => `[data-tour="${id}"]`
const NO_CARDS = `${t('refcards-mine')}[data-count="0"]`
const HAS_CARDS = `${t('refcards-mine')}:not([data-count="0"])`
const EDITOR = t('refcards-editor')
const NEW_CARD = `${EDITOR}[data-card-saved="no"]`
const CARD = t('refcard-open')
const BOOK = t('book-viewer')
const ORDER = t('book-order')
const TABS = t('book-tabs-editor')

export const PAGE_TOUR: PageTour = {
  id: 'reference-cards',
  route: '^/reference-cards/?$',
  intro: {
    page: 'Reference cards',
    purpose: 'Write down what your shop knows, once. Pick the words and part numbers that open a card, and it pops up wherever they appear, with the catalog page the part is on.',
    covers: ['Finding a card', 'Writing a card', 'Part numbers and pictures', 'Found in a catalog', 'Who sells it', 'The parts cart'],
  },
  steps: [
    // ── The page ──
    {
      id: 'header', selector: t('refcards-header'),
      title: 'Reference cards',
      say: 'The things your crew asks about twice a week, written down once. A word in a job, a note or a call opens the card.',
    },
    {
      id: 'library-link', selector: t('refcards-library-link'),
      title: 'Catalogs live in their own library',
      say: 'Price books and manuals live in the catalog library. You can make cards straight from a catalog page there.',
    },
    {
      id: 'search', selector: t('refcards-search'),
      title: 'Find a card',
      say: 'Type a name, a part number or a catalog to narrow the list. Dashes and spaces in part numbers don’t matter.',
    },
    {
      id: 'mine', title: 'Your cards', say: '',
      variants: [
        {
          when: NO_CARDS, selector: t('refcards-mine'), title: 'Nothing written yet',
          say: 'You haven’t written a card yet. The first one is usually the thing you explain most often.',
        },
        {
          when: HAS_CARDS, selector: t('refcards-mine'),
          say: 'Your cards, with the words and part numbers that open each one. Press a name to read it.',
        },
      ],
    },
    {
      id: 'found-in', selector: t('refcards-found-in'),
      title: 'Found in',
      say: 'Where the part is in your catalogs. Press one to open that catalog at the right page.',
    },
    {
      id: 'shared', selector: t('refcards-shared'),
      title: 'Shared across CrewBarn',
      say: 'Cards CrewBarn has approved for every shop. You can read them; they work the same way as yours.',
    },
    {
      id: 'retired', selector: t('refcards-retired'),
      title: 'Retired',
      say: 'Retired cards open nothing, but they wait here. Bring back makes one live again.',
    },
    {
      id: 'new', selector: t('refcards-new'), when: `!${EDITOR}`,
      title: 'Write a card',
      say: 'New card opens a blank card: a title, the words that open it, what to know, its part numbers and where it is found.',
    },
    {
      id: 'launcher', selector: t('catalogs-launch'), when: `!${BOOK}`,
      title: 'Catalogs from anywhere',
      say: 'Your catalogs are one press away from any page: the book button up top, or Alt C.',
    },

    // ── Writing a card (while the editor is open) ──
    {
      id: 'ed', selector: EDITOR, when: EDITOR,
      title: 'Writing a card', say: 'A saved card. Changes take effect for the whole shop when you press Save.',
      variants: [{ when: NEW_CARD, title: 'A new card', say: 'A new card. Nothing is saved until you press Save.' }],
    },
    { id: 'ed-title', selector: t('refcards-ed-title'), title: 'Title', say: 'What the card is about, in a few words.' },
    { id: 'ed-words', selector: t('refcards-ed-words'), title: 'Words that open it', say: 'Add the words that should open this card. Spelling is forgiving about spaces and dashes.' },
    { id: 'ed-sections', selector: t('refcards-ed-sections'), title: 'What to know', say: 'Write it in sections, each with a heading. Tabs split a long card into parts.' },
    { id: 'ed-names', selector: t('refcards-ed-names'), title: 'Part numbers and other names', say: 'The numbers the part goes by, and what customers or suppliers call it. Someone asking for it by any of these finds this card.' },
    { id: 'ed-flash', selector: t('refcards-ed-names'), when: EDITOR, title: 'Flash words', say: 'These become flash words. Wherever they’re written or said, in a call, a text or a note, they’re underlined and open this part with its stock and suppliers.' },
    { id: 'ed-picture', selector: t('refcards-ed-picture'), title: 'Picture', say: 'What the part looks like. A card made from a catalog brings the picture from the page.' },
    { id: 'ed-found-in', selector: t('refcards-ed-found-in'), title: 'Found in', say: 'The catalog pages this part is on. Link a catalog page adds another.' },
    { id: 'ed-share', selector: t('refcards-ed-share'), title: 'Share it', say: 'Tick this to offer the card to every CrewBarn shop. We review it first, and your copy keeps working either way.' },
    {
      id: 'ed-save', selector: t('refcards-ed-save'), when: EDITOR,
      title: 'Save', say: 'Save puts the card live for your shop. Retire this card stops it opening, and you can bring it back.',
      variants: [{ when: NEW_CARD, say: 'Save puts the card live for your shop. Cancel leaves without making it.' }],
    },

    // ── Reading a card ──
    {
      id: 'open-card', selector: t('refcards-card'), when: (page) => !!page.find(HAS_CARDS) && !page.find(CARD) && !page.find(BOOK) && !page.find(EDITOR),
      title: 'Open a card', say: 'Press a card’s name to read it, just as your crew sees it.',
      yourTurn: 'Open any card. Reading it changes nothing.',
      wait: { appear: CARD }, doIt: t('refcards-card'),
    },
    {
      id: 'card', selector: CARD, when: `${CARD}`,
      title: 'The card', say: 'This is how a card opens from a job or a note: down the right, beside whatever you were reading.',
    },
    { id: 'card-part', selector: t('refcard-part'), when: `!${BOOK}`, title: 'The part', say: 'Its picture, and the part numbers and names it goes by.' },
    {
      id: 'card-files', selector: t('refcard-files'), when: `!${BOOK}`,
      title: 'Found in', say: 'The catalog pages the part is on. Press one to open the book right at that page.',
      yourTurn: 'Open one to look around it.',
      wait: { appear: BOOK }, doIt: `${t('refcard-files')} button`,
    },
    {
      id: 'card-sellers', selector: t('refcard-sellers'), when: `!${BOOK}`, title: 'Who sells this',
      say: 'The suppliers this part has been bought from, what it cost and how long it took. The star is your preferred one.',
      variants: [
        { when: `${t('refcard-sellers')}[data-sellers="none"]`, say: 'Nobody yet. Once the part is ordered from a supplier, they show here with the price and how long it took.' },
      ],
    },
    {
      id: 'card-cart', selector: t('refcard-add-to-cart'), when: `!${BOOK}`, title: 'Add to cart',
      say: 'Add to cart asks for this part: how many, what it’s for and when it’s needed. Whoever orders parts picks the supplier.',
    },
    { id: 'card-tabs', selector: t('refcard-tabs'), when: `!${BOOK}`, title: 'Card tabs', say: 'A long card is split into tabs. What sits above them shows on every tab.' },

    // ── A PDF read as a book ──
    {
      id: 'book', selector: t('book-pages'), when: BOOK,
      title: 'Read like a book', say: 'Two pages side by side, turning like the printed copy. Swipe, or use the arrows below.',
    },
    { id: 'book-edge', selector: t('book-edge-tabs'), title: 'Index tabs', say: 'Coloured tabs down the edge open the book at a chapter, like a printed catalog’s.' },
    { id: 'book-footer', selector: t('book-footer'), when: BOOK, title: 'Pages and zoom', say: 'Type a page number, drag the slider, or zoom in on the fine print.' },
    { id: 'book-find', selector: t('book-find'), title: 'Find', say: 'Find searches every page for a part number or a word. Control F does it too.' },
    {
      id: 'book-order-open', selector: t('book-order-button'), when: `!${ORDER}`,
      title: 'The parts cart', say: 'Order opens the parts cart beside the book, so you can pick parts as you read.',
      yourTurn: 'Open the parts cart. Nothing is ordered by opening it.',
      wait: { appear: ORDER }, doIt: t('book-order-button'),
    },

    // ── The Order panel ──
    {
      id: 'order', selector: ORDER, when: ORDER,
      title: 'The parts cart', say: 'Your parts cart. It stays while you turn pages, and folds down to a bar when you want to read.',
      variants: [
        { when: `${ORDER}[data-order-for="estimate"]`, say: 'This cart is for an estimate. A part can go on the estimate at its sell price, and in the cart only for what your shelves can’t cover.' },
      ],
    },
    {
      id: 'order-vendor', selector: t('book-order-vendor'), title: 'No supplier to pick',
      say: 'You don’t pick a supplier here. Whoever orders parts sees every cart together on Order parts and chooses who each part comes from.',
    },
    { id: 'order-add', selector: t('book-order-add'), title: 'Add a part', say: 'Type a part number or what the part is. The book turns to it with the spot lit up, and your own items come up with how many you already have. You can also press a part number on the page.' },
    {
      id: 'order-find', selector: t('book-order-find'), title: 'Found in the book',
      say: 'Where what you typed turns up in this book. The best match is lit up on its page. Use the arrows, or Enter and Shift Enter, to step through the rest, or press one to go to it. Add puts the part number from that spot in the cart, as many as you typed. Escape clears it.',
    },
    { id: 'order-build', selector: t('book-order-build'), title: 'A build', say: 'A build puts several codes on one line, like a set with its finish and size.' },
    { id: 'order-lines', selector: t('book-order-lines'), title: 'In the cart', say: 'Each part you asked for, how many and what for. Asking for the same part again adds to it. Once it’s on an order, it says which one.' },
    {
      id: 'order-send', selector: t('book-order-send'), title: 'Order parts',
      say: 'How many parts are waiting. Order parts opens the page where they’re ordered.',
    },
    { id: 'order-min', selector: t('book-order-min'), title: 'Folded down', say: 'The cart folded down to a bar. Press it to open it again.' },
    { id: 'order-find-bar', selector: t('book-order-find-bar'), title: 'Matches while folded', say: 'With the cart folded down, step through the matches and add the part from this bar. The X clears the search.' },

    // ── The Tabs editor ──
    {
      id: 'tabs-open', selector: t('book-tabs-button'), when: `!${TABS}`,
      title: 'Edit the tabs', say: 'Tabs lets you name the index tabs and the page each one opens.',
      yourTurn: 'Open the tabs editor. Nothing changes until you save.',
      wait: { appear: TABS }, doIt: t('book-tabs-button'),
    },
    {
      id: 'tabs', selector: TABS, when: TABS,
      title: 'Tabs', say: 'Each tab has a name, a page and a colour. Turn to a page, then add a tab for it.',
      variants: [{ when: `${TABS}[data-tab-count="0"]`, say: 'No tabs yet. Start from what the PDF offers, or turn to a page and add one.' }],
    },
    { id: 'tabs-suggest', selector: t('book-tabs-suggest'), title: 'Start from the PDF', say: 'These are tabs found in the PDF itself: its bookmarks, contents page or headings. Press one to start from it.' },
    { id: 'tabs-add', selector: t('book-tabs-add'), title: 'Add a tab', say: 'Add a tab at the page you’re looking at. Press the colour strip to change its colour.' },
    { id: 'tabs-save', selector: t('book-tabs-save'), title: 'Save tabs', say: 'Save tabs puts them on the book for everyone. Cancel leaves them as they were.' },
  ],
}
