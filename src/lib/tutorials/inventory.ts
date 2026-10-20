import type { TutorialData } from './types'

/**
 * Inventory: where stock lives, how much is where, how it comes in and moves,
 * who moved it, how it gets reordered, and where it shows up elsewhere.
 *
 * Import-free (types aside) so the voice exporter can load it on its own.
 * The walk never saves: forms are opened, looked at and closed with their own
 * Cancel, Done or Close.
 */

const t = (id: string) => '[data-tour=' + JSON.stringify(id) + ']'

const INV = '^/inventory/?$'
const POS = '^/purchase-orders/?$'
const NEEDS = '^/purchase-orders/needs-ordered/?$'
const PO_NEW = '^/purchase-orders/new/?$'
const PO = '^/purchase-orders/(?!new/?$|needs-ordered/?$)[^/]+/?$'
const PRINTER = '^/tool-shed/label-printer/?$'
const COST = '^/accounting/inventory-cost/?$'

export const TUTORIAL: TutorialData = {
  id: 'inventory',
  kicker: 'Inventory · tutorial',
  title: 'Inventory, start to finish',
  film: [
    {
      id: 'places',
      label: 'Where it lives',
      title: 'Every part has a home',
      narration:
        'Welcome to Inventory. Your stock lives in places: a warehouse, each truck, anywhere you keep parts. Inside each place are bins, like a rack, its shelves, and the bins on them, so every part has an exact home.',
    },
    {
      id: 'counts',
      label: 'How much',
      title: 'How much is in each spot',
      narration:
        'For each item in each spot, CrewBarn keeps the count: what’s on hand, what’s set aside for jobs, and what’s left to use. Tell a truck how many it should carry, and you’ll see when it runs short.',
    },
    {
      id: 'moves',
      label: 'Who moved it',
      title: 'Every move has a name on it',
      narration:
        'Stock never changes quietly. Receiving it, loading it on a truck, using it on a job, or writing it off each leaves a movement with the name of the person who did it. Nothing in that record is edited, so a mistake is fixed with a new movement.',
    },
    {
      id: 'labels',
      label: 'Label and scan',
      title: 'Label it once, scan it every time',
      narration:
        'Print QR labels for your bins and for the parts in them. Scan a bin and you see everything inside it. Scan a part and CrewBarn knows exactly which one it is, and where it lives.',
    },
    {
      id: 'reorder',
      label: 'Reordering',
      title: 'Low stock turns into an order',
      narration:
        'Give a product a reorder point. When stock drops to it, the item shows up on Needs ordered. Tick what you want, pick the supplier, and a draft purchase order is started for you.',
    },
    {
      id: 'receive',
      label: 'Receiving',
      title: 'Receive it into the right bin',
      narration:
        'When the delivery arrives, open the order, enter what came, and say where it goes. The stock lands in those bins, tracked items get their own serial numbers, and the order remembers what’s still to come.',
    },
    {
      id: 'explain',
      label: 'Shortfalls',
      title: 'Anything off gets explained',
      narration:
        'Sometimes a tech uses a part the count says isn’t there, or buys one on the job. That waits in Reconciliation until a manager explains it, so your counts and your books stay honest.',
    },
    {
      id: 'yourturn',
      label: 'Your turn',
      title: 'Now let’s do it for real',
      narration:
        'That’s the idea. Now let’s do it for real, on your own pages. I’ll step back into the corner and point at each part. When it’s your turn, you click. If you’d rather watch, press Do it for me.',
    },
  ],
  chapters: [
    { key: 'home', label: 'The page and locations' },
    { key: 'bins', label: 'Bins and shelves' },
    { key: 'stock', label: 'Stock levels' },
    { key: 'moving', label: 'Receive and move stock' },
    { key: 'trail', label: 'Units, movements, reconciliation' },
    { key: 'ordering', label: 'Ordering what’s low' },
    { key: 'po', label: 'A purchase order' },
    { key: 'labels', label: 'Labels and stock rules' },
    { key: 'used', label: 'Where it shows up' },
  ],
  steps: [
    // ---------- The page and locations ----------
    {
      id: 'home-header', chapter: 'home', route: INV, open: 'goto:/inventory?tab=locations', selector: t('inv-header'),
      title: 'Inventory',
      say: 'This is Inventory. It answers three questions: where your stock lives, how much is in each spot, and what moved. Every change here is tied to the person who made it.',
    },
    {
      id: 'home-receive', chapter: 'home', route: INV, selector: t('inv-receive-button'),
      title: 'Stock in',
      say: '+ Stock in is the one way stock comes in: from a purchase order, a counter pickup (or the stock you start with), or a count correction. We’ll open it a little later. Next to it, Reconciliation queue shows a number when used stock is waiting for an explanation.',
    },
    {
      id: 'home-search', chapter: 'home', route: INV, selector: t('inv-global-search'), hold: true,
      yourTurn: 'Type two letters of a part you carry, then press Next.',
      title: 'Search everything',
      say: 'Search finds items, SKUs, serial numbers, bins and locations all at once, from two letters on. Click a result and it takes you to the right tab. Give it a try.',
    },
    {
      id: 'home-tabs', chapter: 'home', route: INV, selector: t('inv-tabs'),
      title: 'One tab for each part',
      say: 'Each tab is one part of the picture: Stock, Bins, Units, Movements, Reconciliation, Locations and Settings. We’ll go through them in the order you’d set things up.',
    },
    {
      id: 'loc-tab', chapter: 'home', route: INV, click: t('inv-tab-locations'), selector: t('inv-locations'),
      title: 'Locations',
      say: 'Locations are the big places stock lives: a warehouse, each truck, anywhere else. Everything else sits inside one of these.',
    },
    {
      id: 'loc-table', chapter: 'home', route: INV, click: t('inv-tab-locations'), selector: t('inv-locations-table'),
      title: 'Your locations',
      say: 'Each row shows the type, the name, the tech it’s assigned to, the town, how many bins it holds, and what the stock in it is worth at your cost. Edit on a row changes it.',
    },
    {
      id: 'loc-new', chapter: 'home', route: INV, click: t('inv-tab-locations'), selector: t('inv-location-new'),
      wait: { appear: t('inv-location-form') }, doIt: t('inv-location-new'),
      yourTurn: 'Click + New Location.',
      title: 'Add a location',
      say: 'Let’s look at a new one. Click + New Location. Nothing is made until you press Create.',
    },
    {
      id: 'loc-basics', chapter: 'home', route: INV, selector: t('inv-location-basics'),
      title: 'Name and type',
      say: 'Give it a name, like Main Warehouse or Truck 1, and pick its type: Warehouse, Truck or Other. The name is the only thing you have to fill in. The address and notes below are optional, and unticking Active puts a place aside without deleting it.',
    },
    {
      id: 'loc-footer', chapter: 'home', route: INV, selector: t('inv-location-footer'),
      title: 'Create it',
      say: 'Create location saves it. We’ll leave it this time. Deleting a location later asks for your password and a reason, so there’s always a record of who did it and why.',
    },
    {
      id: 'loc-cancel', chapter: 'home', route: INV, selector: t('inv-location-cancel'),
      wait: { gone: t('inv-location-form') }, doIt: t('inv-location-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Press Cancel to close it without making anything.',
    },

    // ---------- Bins and shelves ----------
    {
      id: 'bins-tab', chapter: 'bins', route: INV, open: 'goto:/inventory?tab=bins', click: t('inv-tab-bins'), selector: t('inv-bins'),
      title: 'Bins',
      say: 'Bins are the containers inside a location: racks, shelves, cabinets, drawers, bins, sections and trays. Stock sits in bins, so anyone can walk straight to it. The filters find a bin by name, code, barcode, location or kind.',
    },
    {
      id: 'bins-build', chapter: 'bins', route: INV, click: t('inv-tab-bins'), selector: t('inv-bins-build'),
      wait: { appear: t('inv-structure-builder') }, doIt: t('inv-bins-build'),
      yourTurn: 'Click Build structure.',
      title: 'Build structure',
      say: 'Setting up a rack one bin at a time is slow. Build structure lays out a whole set of shelving in one go. Click it.',
    },
    {
      id: 'build-place', chapter: 'bins', route: INV, selector: t('inv-structure-place'), hold: true,
      yourTurn: 'Pick a place, then press Next.',
      title: 'Build it inside',
      say: 'First, pick the place to build it in. Nothing is picked for you, so a rack never lands in the wrong place by accident.',
    },
    {
      id: 'build-shapes', chapter: 'bins', route: INV, selector: t('inv-structure-shapes'),
      title: 'Start from a shape',
      say: 'Start from a shape, like a warehouse rack, a cabinet with drawers, or a service truck. Then rename anything to match what you call it. Your saved shapes live here too, ready to build in one click, and you can copy a rack you already have.',
    },
    {
      id: 'build-layers', chapter: 'bins', route: INV, selector: t('inv-structure-layers'),
      title: 'Layers',
      say: 'Each card is one layer, from the outside in. Set how many there are, how they’re numbered, and a short code in front. Holds stock marks the layers where parts actually sit, and Add a deeper layer goes one level further.',
    },
    {
      id: 'build-preview', chapter: 'bins', route: INV, selector: t('inv-structure-preview'),
      title: 'See it before it’s made',
      say: 'Here’s exactly what you’ll get, drawn the way the Bins screen will show it. Tap any spot to change its name, code, how many fit or its rows, and use Add another to copy a shelf with the next codes. Undo takes back any step. Underneath, you see the label the smallest spot will get, and any codes you already have, which are skipped, never overwritten.',
    },
    {
      id: 'build-cancel', chapter: 'bins', route: INV, selector: t('inv-structure-cancel'),
      wait: { gone: t('inv-structure-builder') }, doIt: t('inv-structure-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Close the builder',
      say: 'Create, at the bottom of the preview, makes every spot at once, and each one stays editable afterwards. We won’t create anything now. Press Cancel to close the builder.',
    },
    {
      id: 'bins-new', chapter: 'bins', route: INV, click: t('inv-tab-bins'), selector: t('inv-bins-new'),
      wait: { appear: t('inv-bin-form') }, doIt: t('inv-bins-new'),
      yourTurn: 'Click + New Bin.',
      title: 'One bin at a time',
      say: 'For a single bin, there’s + New Bin. Click it.',
    },
    {
      id: 'binform-where', chapter: 'bins', route: INV, selector: t('inv-bin-form-where'),
      title: 'Where and what',
      say: 'Pick the location, or make a new one right from that list, and what the bin is, like a shelf or a drawer.',
    },
    {
      id: 'binform-names', chapter: 'bins', route: INV, selector: t('inv-bin-form-names'),
      title: 'Name and code',
      say: 'Give it a name, a short code, or both. The code goes on picking lists, and the name is what people say. If it already has a barcode or QR sticker, add that underneath so scanning it finds this bin.',
    },
    {
      id: 'binform-close', chapter: 'bins', route: INV, selector: t('inv-bin-form-close'),
      wait: { gone: t('inv-bin-form') }, doIt: t('inv-bin-form-close'),
      yourTurn: 'Click Done.',
      title: 'Done',
      say: 'Save & add child saves this bin and starts the next one inside it, so you can go rack, shelf, bin without closing. Save & close saves and finishes. Done closes it without saving, so press Done.',
    },
    {
      id: 'bins-location', chapter: 'bins', route: INV, click: t('inv-tab-bins'), selector: t('inv-bin-location'),
      wait: { appear: t('inv-bin-node') }, doIt: t('inv-bin-location'),
      yourTurn: 'Click a location to open it.',
      title: 'The tree',
      say: 'Below is the tree. Each location shows how many bins it has and how much is stored in it. Click one to open it.',
    },
    {
      id: 'bins-node', chapter: 'bins', route: INV, selector: t('inv-bin-node'),
      wait: { appear: t('inv-bin-detail') }, doIt: t('inv-bin-node'),
      yourTurn: 'Click a bin.',
      title: 'A bin',
      say: 'Each bin shows its code, how many units are in it and everything under it, and how full it is when you have set how many fit. Click one to see it on the right, with big buttons for labels, adding a row and receiving stock. Right-click a bin, or press and hold on a phone, for the same buttons.',
    },
    {
      id: 'bins-contents', chapter: 'bins', route: INV, selector: t('inv-bin-contents'),
      wait: { appear: t('inv-bin-contents-modal') }, doIt: t('inv-bin-contents'),
      yourTurn: 'Click Open catalog.',
      title: 'Contents',
      say: 'Open catalog shows everything stored in a bin and below it. Click Open catalog.',
    },
    {
      id: 'bins-contents-close', chapter: 'bins', route: INV, selector: t('inv-bin-contents-modal'),
      wait: { gone: t('inv-bin-contents-modal') }, doIt: t('inv-bin-contents-close'),
      yourTurn: 'Click Close.',
      title: 'What’s inside',
      say: 'First the bins inside it, then every item, with its tracked units, its quantity, and exactly which bin it’s in. Press Close when you’re done looking.',
    },

    // ---------- Stock levels ----------
    {
      id: 'stock-tab', chapter: 'stock', route: INV, open: 'goto:/inventory?tab=stock', click: t('inv-tab-stock'), selector: t('inv-stock-levels'),
      title: 'Stock',
      say: 'Stock is the count: how much of each item is in each spot, grouped by place. Up top, ⇄ Transfer stock moves things between bins and trucks, and + Stock in brings stock in. The chips show only what is Low, Out or Held for jobs.',
    },
    {
      id: 'stock-scan', chapter: 'stock', route: INV, click: t('inv-tab-stock'), selector: t('inv-stock-toolbar'),
      title: 'Filter or scan',
      say: 'Filter by item, location or bin, or scan instead: a barcode gun works anywhere on this tab, and Scan uses your camera. Scan a bin to see everything inside it, or a part to jump straight to it.',
    },
    {
      id: 'stock-table', chapter: 'stock', route: INV, click: t('inv-tab-stock'), selector: t('inv-stock-table'),
      title: 'The count',
      say: 'Each row is one item in one spot: On hand is what’s there, Held for jobs is set aside, and Free to use is what’s left. Keep at least is what the spot is meant to hold; the tag says OK, Low or Out.',
    },
    {
      id: 'stock-edit', chapter: 'stock', route: INV, click: t('inv-tab-stock'), selector: t('inv-stock-row'),
      wait: { appear: t('inv-stock-panel') }, doIt: t('inv-stock-row'),
      yourTurn: 'Click any row.',
      title: 'Open a row',
      say: 'Click a row to see its details: the figures, Transfer, Where else is it, its recent history and its QR code.',
    },
    {
      id: 'stock-panel-edit', chapter: 'stock', route: INV, selector: t('inv-stock-panel-edit'),
      wait: { appear: t('inv-stock-form') }, doIt: t('inv-stock-panel-edit'),
      yourTurn: 'Click Edit levels.',
      title: 'Edit levels',
      say: 'Edit levels opens the row’s form. We won’t save anything.',
    },
    {
      id: 'sform-item', chapter: 'stock', route: INV, selector: t('inv-stock-form-item'),
      title: 'The item',
      say: 'The item. Edit opens its full catalog details without leaving here. + Add stock opens this same form empty, where you search for a product or make one with + New product.',
    },
    {
      id: 'sform-where', chapter: 'stock', route: INV, selector: t('inv-stock-form-where'),
      title: 'Where it is',
      say: 'The location, and the bin picked from your tree. On a row that already exists these are fixed. To move stock, use a transfer, so the move is recorded.',
    },
    {
      id: 'sform-qty', chapter: 'stock', route: INV, selector: t('inv-stock-form-qty'),
      title: 'On hand and held for jobs',
      say: 'Free to use is on hand minus held for jobs. For serial-tracked items, on hand is counted from the units themselves, so it can’t be typed. When your shop requires purchase orders, raising it here is refused.',
    },
    {
      id: 'sform-par', chapter: 'stock', route: INV, selector: t('inv-stock-form-par'),
      title: 'Keep at least',
      say: 'Keep at least is what this truck or shelf is meant to hold. Drop below it and it shows on that location’s restock list. Leave it blank if this spot doesn’t stock it, and put 0 if it should carry none.',
    },
    {
      id: 'sform-qr', chapter: 'stock', route: INV, selector: t('inv-stock-form-qr'),
      title: 'Print QR',
      say: 'Print QR prints one label for each one on hand, so every item carries its own code. It opens the print screen in a new tab.',
    },
    {
      id: 'sform-return', chapter: 'stock', route: INV, selector: t('inv-stock-form-return'),
      title: 'Return to vendor',
      say: 'Return sends stock back to the supplier. Pick a reason, how many, the vendor and their RMA number, and upload their return label. The stock comes off with a write-off movement, and the label prints at 4 by 6.',
    },
    {
      id: 'sform-cancel', chapter: 'stock', route: INV, selector: t('inv-stock-form-cancel'),
      wait: { gone: t('inv-stock-form') }, doIt: t('inv-stock-form-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Save, delete or cancel',
      say: 'Save changes saves the row, and Delete asks for your password and a reason first. Press Cancel to close it without changing anything.',
    },

    // ---------- Receive and move stock ----------
    {
      id: 'recv-open', chapter: 'moving', route: INV, open: 'goto:/inventory?tab=stock', selector: t('inv-receive-button'),
      wait: { appear: t('inv-stockin-menu') }, doIt: t('inv-receive-button'),
      yourTurn: 'Click + Stock in.',
      title: 'Getting stock in',
      say: 'Purchase orders are the main way stock comes in, and we’ll get to those. Click + Stock in to see the three ways in.',
    },
    {
      id: 'recv-counter', chapter: 'moving', route: INV, selector: t('inv-stockin-counter'),
      wait: { appear: t('inv-receive-modal') }, doIt: t('inv-stockin-counter'),
      yourTurn: 'Click Counter pickup.',
      title: 'A counter pickup',
      say: 'For a counter pickup or the stock you start with, pick Counter pickup. If your shop requires purchase orders it is greyed out, unless an owner or admin has allowed you the override in Staff.',
    },
    {
      id: 'recv-item', chapter: 'moving', route: INV, selector: t('inv-receive-item'),
      title: 'Which item',
      say: 'Search for the product by name or SKU. Picking one fills in what it usually costs. Then Put it in picks the exact bin from your tree.',
    },
    {
      id: 'recv-qty', chapter: 'moving', route: INV, selector: t('inv-receive-qty'),
      title: 'How many, and the cost',
      say: 'How many came, and what you paid for each one. That cost is what your stock is valued at.',
    },
    {
      id: 'recv-footer', chapter: 'moving', route: INV, selector: t('inv-receive-footer'),
      title: 'Receive it',
      say: 'Add the supplier and the invoice or packing slip number above, so anyone can trace it later. Receive stock records it as a Receive movement, under your name. If it came on a purchase order, receive it on the order instead.',
    },
    {
      id: 'recv-cancel', chapter: 'moving', route: INV, selector: t('inv-receive-cancel'),
      wait: { gone: t('inv-receive-modal') }, doIt: t('inv-receive-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'We’ll leave it. Press Cancel.',
    },
    {
      id: 'xfer-open', chapter: 'moving', route: INV, click: t('inv-tab-stock'), selector: t('inv-transfer-button'),
      wait: { appear: t('inv-transfer') }, doIt: t('inv-transfer-button'),
      yourTurn: 'Click ⇄ Transfer stock.',
      title: 'Moving stock',
      say: 'Moving stock is a transfer, like loading a truck from the warehouse. Click ⇄ Transfer stock.',
    },
    {
      id: 'xfer-slots', chapter: 'moving', route: INV, selector: t('inv-transfer'),
      title: 'From and to',
      say: 'Pick where it’s coming from and where it’s going: a location, and a bin inside it if you like. Then tick what you’re moving from the stock listed underneath, and change the quantities, which start at what’s available.',
    },
    {
      id: 'xfer-close', chapter: 'moving', route: INV, selector: t('inv-transfer'),
      wait: { gone: t('inv-transfer') }, doIt: 'esc',
      yourTurn: 'Press Cancel.',
      title: 'Transfer',
      say: 'Transfer records each line as a Transfer movement, with your name and the reason, and serial-tracked items move one at a time. If a line can’t move, it tells you which ones already did. Press Cancel to close it without moving anything.',
    },

    // ---------- Units, movements, reconciliation ----------
    {
      id: 'units', chapter: 'trail', route: INV, open: 'goto:/inventory?tab=units', click: t('inv-tab-units'), selector: t('units-header'),
      title: 'Units',
      say: 'Units lists every serial-tracked item on its own, with its serial, its status and where it is. They’re made when you receive a serial-tracked product, and for these items the count is the number marked available. Filter them by serial, item, location or status.',
    },
    {
      id: 'units-table', chapter: 'trail', route: INV, click: t('inv-tab-units'), selector: t('units-table'),
      title: 'Move or set aside',
      say: 'Installed at links to the customer, their equipment and the job. Move puts a unit in another bin and records a transfer, while Damaged, Lost and Restore each need a written reason, saved on the unit with the date. Installed and sold units are locked.',
    },
    {
      id: 'moves-tab', chapter: 'trail', route: INV, click: t('inv-tab-movements'), selector: t('moves-header'),
      title: 'Movements',
      say: 'Movements is the record of every stock change, with the person who made it. Rows are never edited, so a mistake is fixed with a new movement. Filter by type, like Receive, Transfer, Install or Write off, or by item, location and dates.',
    },
    {
      id: 'moves-table', chapter: 'trail', route: INV, click: t('inv-tab-movements'), selector: t('moves-table'),
      title: 'Who did what',
      say: 'Each row says when, what kind, which item and serial, how many, from where to where, and why. The last column, Created by, is the person who did it.',
    },
    {
      id: 'moves-open', chapter: 'trail', route: INV, click: t('inv-tab-movements'), selector: t('moves-table'),
      wait: { appear: t('moves-detail') }, doIt: `${t('moves-table')} tbody tr`,
      yourTurn: 'Click any row.',
      title: 'Open one',
      say: 'Click a row for the whole story.',
    },
    {
      id: 'moves-detail', chapter: 'trail', route: INV, selector: t('moves-detail'),
      title: 'The whole story',
      say: 'Everything about that move: the item, from and to, the reason, the supplier and cost, the job and customer it went to, when it was created and applied, and by whom.',
    },
    {
      id: 'moves-close', chapter: 'trail', route: INV, selector: t('moves-detail-close'),
      wait: { gone: t('moves-detail') }, doIt: t('moves-detail-close'),
      yourTurn: 'Click Close.',
      title: 'Close it',
      say: 'Close it to get back.',
    },
    {
      id: 'recon-tab', chapter: 'trail', route: INV, click: t('inv-tab-reconciliation'), selector: t('recon-header'),
      title: 'Reconciliation',
      say: 'Reconciliation is where shortfalls wait: a part used while the count said none, or a part a tech bought on a job. The count is already adjusted. What’s missing is why.',
    },
    {
      id: 'recon-status', chapter: 'trail', route: INV, click: t('inv-tab-reconciliation'), selector: t('recon-status'),
      title: 'Pending and resolved',
      say: 'Pending is what still needs an explanation. The others show what was resolved, and how.',
    },
    {
      id: 'recon-table', chapter: 'trail', route: INV, click: t('inv-tab-reconciliation'), selector: t('recon-table'),
      title: 'Explain it',
      say: 'Pick what really happened: Retroactive receive if you had it but never logged it, or Write off if it’s gone. A write-in can also become a real product with Convert to stock. Each one takes a note, and the explanation stays with the row.',
    },

    // ---------- Ordering what's low ----------
    {
      id: 'po-list', chapter: 'ordering', route: POS, open: 'goto:/purchase-orders', selector: t('po-header'),
      title: 'Purchase Orders',
      say: 'Purchase Orders lists every order to your suppliers, from draft to delivered.',
    },
    {
      id: 'po-filters', chapter: 'ordering', route: POS, selector: t('po-filters'),
      title: 'Search and filter',
      say: 'Search by PO number or vendor, pick a status, or tick Show archived for older ones. An order is a Draft, then Ordered, Partially received, Received and Completed, or Cancelled.',
    },
    {
      id: 'po-table', chapter: 'ordering', route: POS, selector: `${t('po-table')}, ${t('po-cards')}`,
      title: 'Your orders',
      say: 'Each order shows its number, status, vendor, order date, expected delivery and total.',
    },
    {
      id: 'needs-open', chapter: 'ordering', route: POS, selector: t('po-needs-link'),
      wait: { route: NEEDS }, doIt: t('po-needs-link'),
      yourTurn: 'Click Needs Ordered.',
      title: 'Needs Ordered',
      say: 'The easiest place to start an order is Needs Ordered. Click it.',
    },
    {
      id: 'needs-header', chapter: 'ordering', route: NEEDS, open: 'goto:/purchase-orders/needs-ordered', selector: t('needs-header'),
      title: 'Running low',
      say: 'This lists every stocked item at or below its reorder point. When nothing is, you’ll see an all clear instead.',
    },
    {
      id: 'needs-table', chapter: 'ordering', route: NEEDS, selector: t('needs-table'), hold: true,
      yourTurn: 'Tick a row or two, then press Next.',
      title: 'Pick and adjust',
      say: 'Each row shows the supplier, what’s on hand, the threshold, and an order quantity filled in for you, with the cost. Tick what you want and change any quantity. Ticking doesn’t order anything.',
    },
    {
      id: 'needs-create', chapter: 'ordering', route: NEEDS, selector: t('needs-create'),
      title: 'Start the order',
      say: 'Create PO from selected asks for the vendor, and picks it for you when every ticked item names the same supplier. Then it makes one draft order with all of them on it. We’ll leave it this time.',
    },
    {
      id: 'new-open', chapter: 'ordering', route: POS, open: 'goto:/purchase-orders', selector: t('po-new-link'),
      wait: { route: PO_NEW }, doIt: t('po-new-link'),
      yourTurn: 'Click + New PO.',
      title: 'Start from scratch',
      say: 'You can also start an order from scratch. Click + New PO.',
    },
    {
      id: 'new-header', chapter: 'ordering', route: PO_NEW, open: 'goto:/purchase-orders/new', selector: t('po-new-header'),
      title: 'A new order',
      say: 'A new order starts as a draft. You fill in the top here, and add what you’re ordering on the next screen.',
    },
    {
      id: 'new-vendor', chapter: 'ordering', route: PO_NEW, selector: t('po-new-vendor'), hold: true,
      yourTurn: 'Pick a vendor, then press Next.',
      title: 'Vendor',
      say: 'The vendor is the only thing you must pick. They come from your Vendors list, so add a new supplier there first.',
    },
    {
      id: 'new-vendor-order', chapter: 'ordering', route: PO_NEW, selector: t('po-new-vendor-order'),
      title: 'Their order number',
      say: 'Their order number, if they gave you one. It’s printed on the labels, and kept on each tracked item you receive.',
    },
    {
      id: 'new-dates', chapter: 'ordering', route: PO_NEW, selector: t('po-new-dates'),
      title: 'Dates',
      say: 'The order date starts as today, so add when you expect it to arrive. Below that go tax and shipping, which are added on top of the lines, and notes for your team.',
    },
    {
      id: 'new-cancel', chapter: 'ordering', route: PO_NEW, selector: t('po-new-cancel'),
      wait: { route: POS }, doIt: t('po-new-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Create PO saves the draft and opens it, ready for its lines. We won’t make one now. Cancel takes you back without making anything.',
    },

    // ---------- A purchase order ----------
    {
      id: 'po-open', chapter: 'po', route: POS, open: 'goto:/purchase-orders', selector: t('po-row'),
      wait: { route: PO }, doIt: t('po-row'),
      yourTurn: 'Click any order.',
      title: 'Open an order',
      say: 'Let’s open an order, just to look. Click any one.',
    },
    {
      id: 'po-header', chapter: 'po', route: PO, open: `first:${t('po-row')}`, selector: t('po-detail-header'),
      title: 'This order',
      say: 'At the top: the number, its status, the vendor, their order number, and the estimate or job it came from, if there is one.',
    },
    {
      id: 'po-status', chapter: 'po', route: PO, selector: t('po-detail-status'),
      title: 'Status',
      say: 'Change the status as the order moves along, like Ordered when you place it. Picking one saves straight away, so we won’t touch it. Delete asks for your password and a reason.',
    },
    {
      id: 'po-headercard', chapter: 'po', route: PO, selector: t('po-detail-headercard'),
      title: 'Header',
      say: 'The header holds their order number, the dates, the subtotal, tax, shipping and total, and your notes. Edit changes them.',
    },
    {
      id: 'po-lines', chapter: 'po', route: PO, selector: t('po-detail-lines'),
      title: 'Line items',
      say: 'Line items are what you’re ordering, with how many were ordered and how many have come in. Once a line is received, Labels prints stickers for it.',
    },
    {
      id: 'po-addline', chapter: 'po', route: PO, selector: t('po-add-line'),
      wait: { appear: t('po-new-line') }, doIt: t('po-add-line'),
      yourTurn: 'Click + Add line.',
      title: 'Add a line',
      say: 'Click + Add line to see how a line goes on.',
    },
    {
      id: 'po-newline', chapter: 'po', route: PO, selector: t('po-new-line'),
      title: 'Catalog or one-off',
      say: 'Search your catalog, so the cost fills in and receiving knows exactly what it is, or type a description for a one-off. + New product adds it to your catalog right here, and Add line saves it.',
    },
    {
      id: 'po-newline-cancel', chapter: 'po', route: PO, selector: t('po-new-line-cancel'),
      wait: { gone: t('po-new-line') }, doIt: t('po-new-line-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Press Cancel to close it without adding anything.',
    },
    {
      id: 'po-lowstock', chapter: 'po', route: PO, selector: t('po-low-stock-button'),
      wait: { appear: t('po-detail-lowstock') }, doIt: t('po-low-stock-button'),
      yourTurn: 'Click ⚠ Low stock.',
      title: 'Add from low stock',
      say: '⚠ Low stock adds lines straight from your low stock list. Click it.',
    },
    {
      id: 'po-lowstock-cancel', chapter: 'po', route: PO, selector: t('po-detail-lowstock'),
      wait: { gone: t('po-detail-lowstock') }, doIt: t('po-lowstock-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Pick what’s low',
      say: 'Tick the items, adjust the quantities, and Add to PO puts them all on this order. You can filter by name, SKU or supplier. Press Cancel to close it without adding anything.',
    },
    {
      id: 'po-receive', chapter: 'po', route: PO, selector: t('po-detail-receive'),
      title: 'Receive the delivery',
      say: 'When the delivery arrives, you receive it here. Take part of an order now and the rest later. This stays until everything is in.',
    },
    {
      id: 'po-receive-into', chapter: 'po', route: PO, selector: t('po-receive-into'),
      title: 'Receive into',
      say: 'Receive into sends the whole delivery to one location and bin. Leave it, and each item goes to its default bin from the catalog.',
    },
    {
      id: 'po-receive-lines', chapter: 'po', route: PO, selector: t('po-receive-lines'),
      title: 'What came',
      say: 'Each line shows what was ordered, what’s in, and what’s left, and you type how many came in Receive now. Pick bin sends one line somewhere else. A typed-in line needs Link / Create item first, so the stock knows what it is.',
    },
    {
      id: 'po-receive-fill', chapter: 'po', route: PO, selector: t('po-receive-fill'),
      title: 'Fill remaining',
      say: 'When the whole order came, Fill remaining fills in every line for you.',
    },
    {
      id: 'po-receive-submit', chapter: 'po', route: PO, selector: t('po-receive-submit'),
      title: 'Receive selected',
      say: 'Receive selected puts the stock in those bins, records it under your name, and gives tracked items their serial numbers. If an item already sits in another bin, it asks whether to merge or start a new spot. We’ll leave it.',
    },

    // ---------- Labels and stock rules ----------
    {
      id: 'labels-where', chapter: 'labels', route: PRINTER, open: 'goto:/tool-shed/label-printer',
      title: 'Where labels come from',
      say: 'Labels print from four places: Labels on a bin, Print QR on a stock row, Labels on a received order line, and a product in your catalog. Each one opens the print screen in a new tab.',
    },
    {
      id: 'labels-studio', chapter: 'labels', route: PRINTER,
      title: 'The print screen',
      say: 'The print screen asks a few things in order: what gets a label, what you’re printing on, a label printer, a sticker sheet or plain paper, and how many of each. The preview shows what will come out. Where items are tracked, each one gets its own code, so a scan says exactly which one left the shelf.',
    },
    {
      id: 'lp-header', chapter: 'labels', route: PRINTER, selector: t('lp-header'),
      title: 'Label printer',
      say: 'Label printer is optional. Without it, labels print through the normal print window. With it, labels go straight to a roll printer on this computer, at the right size.',
    },
    {
      id: 'lp-install', chapter: 'labels', route: PRINTER, selector: t('lp-install'),
      title: 'Install the Print Bridge',
      say: 'To set it up, download the Print Bridge, run it, and leave its window open. Then press I have started it, look again.',
    },
    {
      id: 'lp-pair', chapter: 'labels', route: PRINTER, selector: t('lp-pair'),
      title: 'Connect this computer',
      say: 'Type the six-digit code from the Print Bridge window and press Connect. You only do this once on each computer.',
    },
    {
      id: 'lp-connected', chapter: 'labels', route: PRINTER, selector: t('lp-connected'),
      title: 'Pick the printer',
      say: 'Pick the printer, and leave What it speaks on Work it out from the name unless a test label doesn’t come out. Print a test label checks the size.',
    },
    {
      id: 'rules-tab', chapter: 'labels', route: INV, open: 'goto:/inventory?tab=settings', click: t('inv-tab-settings'), selector: t('inv-rules'),
      title: 'Stock rules',
      say: 'Settings holds your stock rules: how strict CrewBarn is about where stock sits and how it’s counted. You need Edit inventory to change them.',
    },
    {
      id: 'rule-bin', chapter: 'labels', route: INV, click: t('inv-tab-settings'), selector: t('inv-rule-require-bin'),
      title: 'Require a bin',
      say: 'Require bin assignment means every stock row has to say which bin it’s in. Leave it off for a simpler setup.',
    },
    {
      id: 'rule-unrecorded', chapter: 'labels', route: INV, click: t('inv-tab-settings'), selector: t('inv-rule-unrecorded-stock'),
      title: 'Using unrecorded stock',
      say: 'This lets a tech use a part even when the count says zero. The shortfall goes to Reconciliation for a manager to explain. Turned off, it’s refused.',
    },
    {
      id: 'rule-tracking', chapter: 'labels', route: INV, click: t('inv-tab-settings'), selector: t('inv-rule-unit-tracking'),
      title: 'One code per item',
      say: 'Stock fingerprint or QR tracking gives every physical item its own code, and stocked parts on jobs have to be scanned. That’s how CrewBarn proves which exact item moved.',
    },
    {
      id: 'rule-po', chapter: 'labels', route: INV, click: t('inv-tab-settings'), selector: t('inv-rule-require-po'),
      title: 'Require purchase orders',
      say: 'This turns off + Add stock and + Receive stock, so stock only comes in through a received purchase order. It’s off to start with.',
    },
    {
      id: 'rule-writein', chapter: 'labels', route: INV, click: t('inv-tab-settings'), selector: t('inv-rule-write-in'),
      title: 'Write-ins',
      say: 'Write-in items let a tech add a part they bought on the job. It still gets tracked, and lands in Reconciliation, where it can become real stock.',
    },
    {
      id: 'rule-lock', chapter: 'labels', route: INV, click: t('inv-tab-settings'), selector: t('inv-rule-lock-store'),
      title: 'Lock the store',
      say: 'Lock the store decides who moves stock. Off, a tech scans a part onto their truck and the scan is the record. On, only people with Edit inventory move it, and the tech scans each item to confirm they got it.',
    },
    {
      id: 'rule-van', chapter: 'labels', route: INV, click: t('inv-tab-settings'), selector: t('inv-rule-watch-van'),
      title: 'Watch van stock',
      say: 'Watch van stock never blocks anyone. When one tech uses a part from another tech’s truck, it asks for one to be sent back from the shop, and it flags when a tech’s own truck was empty.',
    },
    {
      id: 'rule-serial', chapter: 'labels', route: INV, click: t('inv-tab-settings'), selector: t('inv-rule-show-sn'),
      title: 'Serial numbers',
      say: 'Show serial-number tracking turns the serial features on across the catalog and inventory. A rule above it lets techs type a serial by hand when they install a part on equipment.',
    },
    {
      id: 'rules-save', chapter: 'labels', route: INV, click: t('inv-tab-settings'), selector: t('inv-rules-save'),
      title: 'Save changes',
      say: 'Changes wait here until you press Save changes, and Discard puts them back. We’ll leave your rules as they are.',
    },

    // ---------- Where it shows up ----------
    {
      id: 'used-cost', chapter: 'used', route: COST, open: 'goto:/accounting/inventory-cost', selector: t('inv-cost-header'),
      title: 'Inventory & PO Cost',
      say: 'Inventory shows up in Accounting, too. Inventory & PO Cost shows what your stock is worth and what you spent on orders, for the dates you pick.',
    },
    {
      id: 'used-metrics', chapter: 'used', route: COST, selector: t('inv-cost-metrics'),
      title: 'The headline numbers',
      say: 'Up top: your stock’s value at cost, how much of it is available, how many are on hand, and what you spent on orders.',
    },
    {
      id: 'used-spend', chapter: 'used', route: COST, selector: t('inv-cost-spend'),
      title: 'Where the money went',
      say: 'PO spend breaks down what you bought by item, vendor, category or order. Next to it, Value by location shows what’s sitting in each warehouse and truck.',
    },
    {
      id: 'used-jobs', chapter: 'used', route: COST,
      title: 'On jobs and estimates',
      say: 'On jobs and estimates, Scan part adds a part to the line items by scanning its label. Parts used on a job come off the shelf or truck as a movement linked to that job and customer.',
    },
    {
      id: 'used-catalog', chapter: 'used', route: COST,
      title: 'In the Product catalog',
      say: 'In the Product catalog, each product has a default bin, a reorder threshold and quantity, and its supplier. Those decide what shows on Needs Ordered and where received stock goes. Its Stock column turns red at or below the reorder point.',
    },
    {
      id: 'used-catalogs', chapter: 'used', route: COST,
      title: 'Supplier catalogs',
      say: 'Supplier catalogs, opened from Catalogs at the top of the page, can start a draft purchase order right from a page. Each line shows what you already have, so nobody orders what’s already on the truck.',
    },
    {
      id: 'used-assets', chapter: 'used', route: COST,
      title: 'Equipment and assets',
      say: 'When a tracked part is installed on a customer’s equipment, it shows on that equipment in Customer assets, and as installed on Units. Your own tools and vehicles in Company assets can be assigned to a truck or location.',
    },
    {
      id: 'used-done', chapter: 'used', route: INV, open: 'goto:/inventory', selector: t('inv-header'),
      title: 'That’s the lot',
      say: 'That’s everything, from places and bins to counts, moves, orders and labels. You can take this tutorial again any time from the button at the top of the page.',
    },
  ],
}
