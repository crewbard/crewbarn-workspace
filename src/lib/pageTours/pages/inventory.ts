import type { PageTour } from '../types'

/**
 * Catalog & inventory → Inventory (/inventory), and Inventory settings,
 * which lands on its Settings tab (/inventory?tab=settings). The stand-alone
 * Units, Movements and Reconciliation pages play the same tour; the parts
 * that aren't on them are skipped.
 *
 * The tour walks the tab that is open (one tab's parts are on screen at a
 * time), after the header, search and tabs.
 *
 * States the page marks:
 *   inv-queue-button    data-pending = yes | no
 *   inv-receive-button, inv-stock-add  data-require-po = yes | no
 *   inv-locations-empty, inv-bins-nolocations, inv-bins-empty, inv-bins-nomatch,
 *   inv-stock-nolocations, inv-stock-empty (data-filtered), units-empty,
 *   moves-empty (data-filtered), recon-empty (data-status)
 *   inv-rules           data-can-edit = yes | no
 *   inv-rule-*          data-on = yes | no
 */
const t = (id: string) => `[data-tour="${id}"]`
const rule = (id: string, on: 'yes' | 'no') => `${t(id)}[data-on="${on}"]`
const REQUIRE_PO = `${t('inv-receive-button')}[data-require-po="yes"]`

export const PAGE_TOUR: PageTour = {
  id: 'inventory',
  route: '^/inventory(/(movements|reconciliations|units))?/?$',
  intro: {
    page: 'Inventory',
    purpose: 'Where your stock lives, how much is in each spot, and what moved. Every change is kept with the name of the person who made it.',
    covers: ['Search and getting stock in', 'Locations and bins', 'Stock levels', 'Units and movements', 'Reconciliation', 'Stock rules'],
  },
  steps: [
    // ── Header ──
    {
      id: 'header', selector: t('inv-header'),
      title: 'Inventory',
      say: 'Inventory answers three questions: where your stock lives, how much is in each spot, and what moved.',
    },
    {
      id: 'queue', selector: t('inv-queue-button'), title: 'Reconciliation queue',
      say: 'Reconciliation queue is where used stock waits for an explanation. It’s clear right now.',
      variants: [
        { when: `${t('inv-queue-button')}[data-pending="yes"]`, say: 'The number on Reconciliation queue is stock that was used but needs an explanation. Press it to sort them out.' },
      ],
    },
    {
      id: 'receive', selector: t('inv-receive-button'), title: 'Receive stock',
      say: 'Receive stock is for stock that turns up without a purchase order, like a counter pickup or what you start with.',
      variants: [
        { when: REQUIRE_PO, say: 'Receive stock is greyed out because your shop requires purchase orders. Stock comes in by receiving the order.' },
      ],
    },
    {
      id: 'search', selector: t('inv-global-search'),
      title: 'Search everything',
      say: 'Search finds items, serial numbers, bins and locations at once. Press a result to jump to the right tab.',
    },
    {
      id: 'tabs', selector: t('inv-tabs'),
      title: 'One tab for each part',
      say: 'Locations, bins, stock levels, units, movements, reconciliation and settings. We’ll walk the tab that’s open; press another and start the tour again to see that one.',
    },

    // ── Locations ──
    {
      id: 'locations', title: 'Locations', say: '',
      variants: [
        { when: t('inv-locations-empty'), selector: t('inv-locations-empty'), title: 'No locations yet', say: 'No locations yet. Start here: add your shop or warehouse, then each truck.' },
        { when: t('inv-locations-table'), selector: t('inv-locations-table'), say: 'Locations are the big places stock lives: a warehouse, each truck. Each row shows who it’s assigned to, how many bins it has, and what its stock is worth.' },
      ],
    },
    {
      id: 'location-new', selector: t('inv-location-new'),
      title: 'Add a location',
      say: 'New Location asks for a name and a type: warehouse, truck or other. The address is optional.',
    },

    // ── Bins ──
    {
      id: 'bins', selector: t('inv-bins'), when: t('inv-bins'),
      title: 'Bins',
      say: 'Bins are the racks, shelves and drawers inside a location, so anyone can walk straight to a part.',
      variants: [
        { when: t('inv-bins-nolocations'), selector: t('inv-bins-nolocations'), say: 'Bins live inside locations, so add a location first on the Locations tab.' },
      ],
    },
    { id: 'bins-build', selector: t('inv-bins-build'), title: 'Build structure', say: 'Build structure lays out a whole rack or cabinet in one go, from a shape you rename to match.' },
    { id: 'bins-new', selector: t('inv-bins-new'), title: 'One at a time', say: 'New Bin adds a single bin, in a location or inside another bin.' },
    { id: 'bins-filters', selector: t('inv-bins-filters'), title: 'Find a bin', say: 'Find a bin by name, code or barcode, or pick a location. The chips show only racks, shelves, bins or rows, or just the empty spots. List and Racks switch between the tree and a picture of each rack.' },
    {
      id: 'bins-list', title: 'Your bins', say: '',
      variants: [
        { when: t('inv-bins-nomatch'), selector: t('inv-bins-nomatch'), say: 'No bins match those filters. Clear them to see the whole tree.' },
        { when: t('inv-bins-empty'), selector: t('inv-bins-empty'), say: 'No bins yet. Build structure is the quick way to start.' },
        { when: t('inv-bin-location'), selector: t('inv-bin-location'), say: 'The tree: each location with its racks, shelves, bins and rows, and how much is stored inside. Press one to open it.' },
      ],
    },
    { id: 'bin-node', selector: t('inv-bin-node'), title: 'A bin', say: 'Each bin shows its code and what’s in it. Click it for its details, or right-click (press and hold on a phone) for quick actions: add stock from a purchase order, add a row, print labels and more.' },

    // ── Stock levels ──
    {
      id: 'stock', selector: t('inv-stock-levels'), when: t('inv-stock-levels'),
      title: 'Stock levels',
      say: 'Stock levels is the count: how much of each item is in each spot.',
      variants: [
        { when: t('inv-stock-nolocations'), selector: t('inv-stock-nolocations'), say: 'There’s nowhere to count stock yet. Add a location on the Locations tab first.' },
      ],
    },
    { id: 'transfer', selector: t('inv-transfer-button'), title: 'Transfer stock', say: 'Transfer stock moves parts between places, like loading a truck from the shop. Every move is recorded.' },
    {
      id: 'stock-add', selector: t('inv-stock-add'), title: 'Add stock',
      say: 'Add stock records what’s on a shelf by hand.',
      variants: [{ when: `${t('inv-stock-add')}[data-require-po="yes"]`, say: 'Add stock is off because your shop requires purchase orders for new stock.' }],
    },
    { id: 'stock-toolbar', selector: t('inv-stock-toolbar'), title: 'Filter or scan', say: 'Filter by item, location or bin. A barcode scanner works anywhere on this tab, and Scan uses your camera.' },
    {
      id: 'stock-list', title: 'The count', say: '',
      variants: [
        { when: `${t('inv-stock-empty')}[data-filtered="yes"]`, selector: t('inv-stock-empty'), say: 'Nothing matches those filters. Clear them to see every count.' },
        { when: t('inv-stock-empty'), selector: t('inv-stock-empty'), say: 'No stock counted yet. Receive stock, add it by hand, or receive a purchase order.' },
        { when: t('inv-stock-table'), selector: t('inv-stock-table'), say: 'Each row is one item in one spot: on hand, held for jobs, and free to use. Keep at least is what that spot is meant to hold; the tag says OK, Low or Out.' },
      ],
    },
    { id: 'stock-edit', selector: t('inv-stock-row'), title: 'Open a row', say: 'Click a row for its details: edit levels, transfer, print its QR code, see where else it is and its history.' },

    // ── Units ──
    { id: 'units', selector: t('units-header'), title: 'Units', say: 'Units lists every serial-tracked item on its own, with its serial number, its status and where it is.' },
    { id: 'units-filters', selector: t('units-filters'), title: 'Find a unit', say: 'Filter by serial, item, location or status.' },
    {
      id: 'units-list', title: 'Your units', say: '',
      variants: [
        { when: `${t('units-empty')}[data-filtered="yes"]`, selector: t('units-empty'), say: 'No units match those filters.' },
        { when: t('units-empty'), selector: t('units-empty'), say: 'No units yet. They’re made when a serial-tracked product is received.' },
        { when: t('units-table'), selector: t('units-table'), say: 'Move puts a unit in another bin. Damaged, Lost and Restore each need a reason. Installed and sold units are locked.' },
      ],
    },

    // ── Movements ──
    { id: 'moves', selector: t('moves-header'), title: 'Movements', say: 'Movements is the record of every stock change and who made it. Rows are never edited; a mistake is fixed with a new movement.' },
    { id: 'moves-filters', selector: t('moves-filters'), title: 'Filter', say: 'Filter by type, item, location or dates.' },
    {
      id: 'moves-list', title: 'Who did what', say: '',
      variants: [
        { when: `${t('moves-empty')}[data-filtered="yes"]`, selector: t('moves-empty'), say: 'No movements match those filters.' },
        { when: t('moves-empty'), selector: t('moves-empty'), say: 'No movements yet. Every receive, transfer and use will show up here.' },
        { when: t('moves-table'), selector: t('moves-table'), say: 'When, what kind, which item, how many, from where to where, and who did it. Press a row for the whole story.' },
      ],
    },

    // ── Reconciliation ──
    { id: 'recon', selector: t('recon-header'), title: 'Reconciliation', say: 'Shortfalls wait here: a part used while the count said none, or one a tech bought on a job. The count is already fixed; what’s missing is why.' },
    { id: 'recon-status', selector: t('recon-status'), title: 'Pending and resolved', say: 'Pending still needs an explanation. The others show what was resolved, and how.' },
    {
      id: 'recon-list', title: 'Explain it', say: '',
      variants: [
        { when: `${t('recon-empty')}[data-status="pending"]`, selector: t('recon-empty'), say: 'Nothing waiting. Every shortfall has been explained.' },
        { when: t('recon-empty'), selector: t('recon-empty'), say: 'Nothing was resolved this way yet.' },
        { when: t('recon-table'), selector: t('recon-table'), say: 'Pick what really happened: we had it but never logged it, or it’s gone. Each one takes a short note.' },
      ],
    },

    // ── Settings (stock rules) ──
    {
      id: 'rules', selector: t('inv-rules'), when: t('inv-rules'),
      title: 'Stock rules', say: 'Your stock rules: how strict CrewBarn is about where stock sits and how it’s counted.',
      variants: [
        { when: `${t('inv-rules')}[data-can-edit="no"]`, say: 'Your stock rules. You can read them here; changing them needs permission to edit inventory.' },
      ],
    },
    {
      id: 'rule-bin', selector: t('inv-rule-require-bin'), title: 'Require a bin',
      say: 'Off: stock can sit in a location without a bin, which keeps things simple.',
      variants: [{ when: rule('inv-rule-require-bin', 'yes'), say: 'On: every stock row has to say which bin it’s in.' }],
    },
    {
      id: 'rule-unrecorded', selector: t('inv-rule-unrecorded-stock'), title: 'Using unrecorded stock',
      say: 'Off: a tech can’t use a part the count says isn’t there.',
      variants: [{ when: rule('inv-rule-unrecorded-stock', 'yes'), say: 'On: a tech can use a part even when the count says zero. The shortfall goes to Reconciliation to explain.' }],
    },
    {
      id: 'rule-tracking', selector: t('inv-rule-unit-tracking'), title: 'One code per item',
      say: 'Turn this on to give every physical item its own code, and have stocked parts scanned on jobs.',
      variants: [{ when: rule('inv-rule-unit-tracking', 'yes'), say: 'On: every physical item has its own code, and stocked parts on jobs are scanned, so you know exactly which one moved.' }],
    },
    {
      id: 'rule-po', selector: t('inv-rule-require-po'), title: 'Require purchase orders',
      say: 'Off: stock can be added by hand or received without an order.',
      variants: [{ when: rule('inv-rule-require-po', 'yes'), say: 'On: stock only comes in by receiving a purchase order. Adding it by hand is turned off.' }],
    },
    { id: 'rule-writein', selector: t('inv-rule-write-in'), title: 'Write-ins', say: 'Write-ins let a tech add a part they bought on the job. It lands in Reconciliation, where it can become real stock.' },
    { id: 'rule-lock', selector: t('inv-rule-lock-store'), title: 'Lock the store', say: 'Off, a tech’s scan moves stock onto their truck. On, only people who can edit inventory move it, and the tech confirms each item.' },
    { id: 'rule-van', selector: t('inv-rule-watch-van'), title: 'Watch van stock', say: 'Never blocks anyone. It asks for a part to be sent back when one tech uses another tech’s stock.' },
    {
      id: 'rule-reorder', selector: t('inv-rule-auto-reorder'), title: 'Order low stock automatically',
      say: 'Turn this on and low items go onto a draft purchase order for their vendor. Nothing is sent until you mark it ordered.',
      variants: [{ when: rule('inv-rule-auto-reorder', 'yes'), say: 'On: low items go onto a draft purchase order for their vendor. Nothing is sent until you check it and mark it ordered.' }],
    },
    { id: 'rule-van-par', selector: t('inv-rule-van-par'), title: 'Restock vans to par', say: 'When a van carries less than it should, the shop is asked to send the difference.' },
    { id: 'rule-serial', selector: t('inv-rule-show-sn'), title: 'Serial numbers', say: 'Shows the serial-number features across your catalog and inventory.' },
    { id: 'rules-save', selector: t('inv-rules-save'), title: 'Save changes', say: 'Changes wait here until you press Save changes. Discard puts them back.' },
  ],
}
