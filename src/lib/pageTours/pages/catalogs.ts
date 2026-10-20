import type { PageTour } from '../types'

/**
 * Catalog & inventory → Catalogs (/catalogs).
 *
 * The catalog library, and what opens from it: a catalog read as a book
 * (book-viewer) and its Cards panel (book-cards), where reference cards
 * are made from a page. The Order panel and the Tabs editor are walked in
 * the Reference cards tour; here they get one step each.
 *
 * States the page marks:
 *   catalogs-shelf    data-count = number of the shop's own catalogs
 *   book-cards        data-cards-mode = pick | page, data-selection = yes | no
 */
const t = (id: string) => `[data-tour="${id}"]`
const EMPTY = `${t('catalogs-shelf')}[data-count="0"]`
const HAS_BOOKS = `${t('catalogs-shelf')}:not([data-count="0"])`
const BOOK = t('book-viewer')
const CARDS = t('book-cards')
const PICKED = `${CARDS}[data-selection="yes"]`

export const PAGE_TOUR: PageTour = {
  id: 'catalogs',
  route: '^/catalogs/?$',
  intro: {
    page: 'Catalogs',
    purpose: 'Your price books and manuals, read like the printed copy. Share them with customers, order from the page, and make reference cards from the parts in them.',
    covers: ['Adding a catalog', 'Your shelf', 'Sharing with customers', 'Reading a catalog', 'Making cards from a page'],
  },
  steps: [
    // ── The page ──
    {
      id: 'header', selector: t('catalogs-header'),
      title: 'Catalogs',
      say: 'Every catalog your shop keeps, in one place. Each one opens as a book with tabs down the edge.',
    },
    {
      id: 'add', selector: t('catalogs-add'), when: `!${t('catalogs-upload')}`,
      title: 'Add a catalog',
      say: 'Add a supplier’s price book, a parts list or a manual as a PDF. No reference card needed.',
    },
    {
      id: 'upload', selector: t('catalogs-upload'),
      title: 'Upload it',
      say: 'Choose the PDF, give it a name, and say who it is from. Its cover and page count are filled in for you.',
    },
    { id: 'search', selector: t('catalogs-search'), title: 'Find a catalog', say: 'Type part of a name or a supplier to narrow the shelf.' },
    {
      id: 'shelf', title: 'Your shelf', say: '',
      variants: [
        { when: EMPTY, selector: t('catalogs-shelf'), title: 'Nothing on the shelf yet', say: 'No catalogs yet. The first one is usually the price book you reach for most.' },
        { when: HAS_BOOKS, selector: t('catalogs-shelf'), say: 'Your catalogs, the ones opened most recently first.' },
      ],
    },
    {
      id: 'book-card', selector: t('catalogs-book'),
      title: 'One catalog',
      say: 'Its cover, who it is from, how many pages, whether its tabs are set, and how many reference cards point into it.',
    },
    { id: 'share', selector: t('catalogs-share'), title: 'Share with customers', say: 'Turn this on to let your customers browse it in their portal and send you an order from it. Only share a catalog you are allowed to.' },
    { id: 'edit', selector: t('catalogs-edit'), title: 'Rename it', say: 'Change its name, or who it is from.' },
    { id: 'delete', selector: t('catalogs-delete'), title: 'Delete it', say: 'Removes the catalog. Cards that pointed into it stay; only the link to it goes.' },
    { id: 'shared', selector: t('catalogs-shared'), title: 'Shared across CrewBarn', say: 'Catalogs other shops have shared with everyone. You can read them and make cards from them.' },
    {
      id: 'launcher', selector: t('catalogs-launch'), when: `!${BOOK}`,
      title: 'From anywhere',
      say: 'The book button up top, or Alt C, opens any catalog without leaving the page you are on.',
    },

    // ── Reading one ──
    {
      id: 'open', selector: t('catalogs-open'), when: (page) => !!page.find(HAS_BOOKS) && !page.find(BOOK),
      title: 'Open a catalog', say: 'Press a cover to open the catalog.',
      yourTurn: 'Open any catalog. Opening it changes nothing.',
      wait: { appear: BOOK }, doIt: t('catalogs-open'),
    },
    { id: 'book', selector: t('book-pages'), when: BOOK, title: 'Read like a book', say: 'Pages side by side, turning like the printed copy. Swipe, or use the arrows below.' },
    { id: 'book-find', selector: t('book-find'), title: 'Find', say: 'Find searches every page for a part number or a word.' },
    { id: 'book-order', selector: t('book-order-button'), title: 'Order', say: 'Order opens the parts cart beside the book, so you can pick parts as you read. Whoever orders parts chooses the suppliers.' },
    { id: 'book-tabs', selector: t('book-tabs-button'), title: 'Tabs', say: 'Name the index tabs down the edge and the page each one opens.' },

    // ── Making cards ──
    {
      id: 'cards-open', selector: t('book-cards-button'), when: (page) => !!page.find(BOOK) && !page.find(CARDS),
      title: 'Make reference cards', say: 'Cards turns a part on the page into a reference card, so it opens wherever its number comes up.',
      yourTurn: 'Open the Cards panel. Nothing is made until you say so.',
      wait: { appear: CARDS }, doIt: t('book-cards-button'),
    },
    {
      id: 'cards', selector: CARDS, when: CARDS,
      title: 'Pick a part', say: 'Press a part number on the page, or drag a box around the part, its number and its name.',
      variants: [{ when: PICKED, title: 'Your pick', say: 'What you picked: its picture, its number and its name. Change anything that is off.' }],
    },
    { id: 'cards-make', selector: t('book-cards-make'), title: 'Make a reference card', say: 'Opens the card ready to check: the number, the name, this catalog and page, and the picture. Save puts it live.' },
    {
      id: 'cards-page', selector: t('book-cards-page-tab'), when: CARDS,
      title: 'A whole page at once', say: 'Whole page lists every part number on the page. Tick the ones you want and make a card for each.',
    },
    { id: 'cards-find', selector: t('book-cards-find'), title: 'Find part numbers', say: 'Reads the page for anything that looks like a part number.' },
    { id: 'cards-list', selector: t('book-cards-list'), title: 'Tick the ones you want', say: 'Numbers that already have a card are marked. Ticking one of those links your card to this page instead of making a second one.' },
    { id: 'cards-many', selector: t('book-cards-make-many'), title: 'Make them', say: 'Makes the cards, each linked to this catalog and page.' },
  ],
}
