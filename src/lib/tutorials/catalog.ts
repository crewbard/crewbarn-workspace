import type { TutorialData } from './types'

/**
 * Catalog & pricing: what you sell and how it's priced, start to finish.
 * Services, products, their categories, tax classes, discounts and the cost
 * model, then where all of it turns up on estimates, jobs and invoices.
 *
 * Kept import-free (types aside) so the voice exporter can load it alone.
 * Nothing here ever saves: every form is walked and left with Cancel.
 */

const t = (id: string) => `[data-tour=${JSON.stringify(id)}]`

const SVC = '^/catalog/services/?$'
const PROD = '^/catalog/products/?$'
const SVCCAT = '^/catalog/categories/?$'
const PRODCAT = '^/catalog/product-categories/?$'
const TAX = '^/catalog/tax-classes/?$'
const DISC = '^/tool-shed/pricing/?$'
const COST = '^/tool-shed/cost-model/?$'

export const TUTORIAL: TutorialData = {
  id: 'catalog',
  kicker: 'Catalog & pricing · tutorial',
  title: 'Your catalog and prices, start to finish',
  film: [
    {
      id: 'two',
      label: 'Two catalogs',
      title: 'Everything you sell, in two lists',
      narration:
        'Everything you sell lives in two lists. Services are the work you charge for, like a tune-up or an hour of labor. Products are the things you hand over or fit, like a water heater or a valve.',
    },
    {
      id: 'price',
      label: 'Price and cost',
      title: 'What they pay, and what it costs you',
      narration:
        'Every item has a customer price, and if you like, what it costs you. The gap between the two is your margin. And when an item has no price, CrewBarn can work one out from its cost and your markup.',
    },
    {
      id: 'tax',
      label: 'Tax classes',
      title: 'Tax, built from its parts',
      narration:
        'A tax class adds up its parts, like state plus county. Give each item its tax class once, and every line it lands on is taxed the same way. Each part remembers who you pay it to.',
    },
    {
      id: 'stock',
      label: 'Stock',
      title: 'Products know when they’re running low',
      narration:
        'Products also carry a reorder point. When what’s on the shelves drops to it, the product turns red and shows up on Needs ordered, ready to go on a purchase order.',
    },
    {
      id: 'warranty',
      label: 'Warranty',
      title: 'Coverage comes along for free',
      narration:
        'Items can carry warranty days: from the manufacturer, from your company, and for the labor. When one is sold on an invoice, the coverage starts on its own, so you always know what’s still covered.',
    },
    {
      id: 'rate',
      label: 'Your rate',
      title: 'Know what an hour has to cost',
      narration:
        'The cost model adds up what it costs to open your doors and divides it by the hours you bill. That gives you a break-even rate, and a target rate with your margin on top. Discounts sit alongside, ready to take off.',
    },
    {
      id: 'lines',
      label: 'On every line',
      title: 'Pick it once, it fills in everywhere',
      narration:
        'Then, on an estimate, a job or an invoice, Search catalog drops the item in with its price, description and tax already filled. No retyping, and no prices made up on the spot.',
    },
    {
      id: 'yourturn',
      label: 'Your turn',
      title: 'Now let’s do it for real',
      narration:
        'That’s the idea. Now let’s do it for real. I’ll step back into the corner and point at each part of the page. When it’s your turn, you click. If you’d rather watch, press Do it for me. We won’t save anything along the way.',
    },
  ],
  chapters: [
    { key: 'services', label: 'Add a service' },
    { key: 'service-edit', label: 'Change a service' },
    { key: 'products', label: 'The product list' },
    { key: 'product-form', label: 'Add a product' },
    { key: 'categories', label: 'Categories' },
    { key: 'tax', label: 'Tax classes' },
    { key: 'discounts', label: 'Discounts' },
    { key: 'cost', label: 'Cost model' },
    { key: 'used', label: 'Where it shows up' },
  ],
  steps: [
    // ---------- Add a service ----------
    {
      id: 'svc-header', chapter: 'services', route: SVC, open: 'goto:/catalog/services', selector: t('svc-header'),
      title: 'Service Catalog',
      say: 'This is your Service Catalog: the work you charge for, like labor, trip charges and inspections. Products have a catalog of their own, and we’ll get there.',
    },
    {
      id: 'svc-search', chapter: 'services', route: SVC, selector: t('svc-search'),
      title: 'Search',
      say: 'Search finds a service by its name, description or part number. Press the slash key anywhere on the page to jump straight here.',
    },
    {
      id: 'svc-table', chapter: 'services', route: SVC, selector: t('svc-table'),
      title: 'Your services',
      say: 'Each row shows the price, the tax it uses, the unit it’s sold by, and whether it’s active. Underneath, it counts how many you have.',
    },
    {
      id: 'svc-new', chapter: 'services', route: SVC, selector: t('svc-new'),
      wait: { appear: t('svc-form') }, doIt: t('svc-new'),
      yourTurn: 'Click + New Service.',
      title: 'Add a service',
      say: 'Let’s add one together. Click New Service. We’ll walk every box, then leave without saving.',
    },
    {
      id: 'svc-name', chapter: 'services', route: SVC, selector: t('svc-f-name'), hold: true,
      yourTurn: 'Type a name, like Standard service call, then press Next.',
      title: 'Name',
      say: 'The name is the only thing you have to fill in. It’s what your team searches for and what shows on the line. Go ahead and type one.',
    },
    {
      id: 'svc-sku', chapter: 'services', route: SVC, selector: t('svc-f-sku'),
      title: 'SKU',
      say: 'A SKU is optional for services. Use one if your team likes short codes.',
    },
    {
      id: 'svc-category', chapter: 'services', route: SVC, selector: t('svc-f-category'),
      title: 'Category',
      say: 'Category groups your services, like Repairs or Maintenance. Pick one from the list.',
    },
    {
      id: 'svc-category-add', chapter: 'services', route: SVC, selector: t('svc-f-category-add'),
      wait: { appear: t('svc-quickcat') }, doIt: t('svc-f-category-add'),
      yourTurn: 'Click + Add new.',
      title: 'Add a category on the spot',
      say: 'Missing the one you need? Add new makes a category right here, without leaving the form. Click it to see.',
    },
    {
      id: 'svc-quickcat', chapter: 'services', route: SVC, selector: t('svc-quickcat'),
      title: 'Quick add category',
      say: 'Type a name and Create and select makes it and picks it for you. It goes at the top level. For sub-categories, use the Service Categories page.',
    },
    {
      id: 'svc-quickcat-cancel', chapter: 'services', route: SVC, selector: t('svc-quickcat-cancel'),
      wait: { gone: t('svc-quickcat') }, doIt: t('svc-quickcat-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Back to the service',
      say: 'We won’t make one now. Click Cancel to get back to the service.',
    },
    {
      id: 'svc-description', chapter: 'services', route: SVC, selector: t('svc-f-description'),
      title: 'Customer description',
      say: 'The customer description is what your customer reads, on invoices and anything else they see.',
    },
    {
      id: 'svc-aliases', chapter: 'services', route: SVC, selector: t('svc-f-aliases'),
      title: 'Search aliases',
      say: 'Search aliases are other names people use for the same thing, like AC tune-up and cooling check. Only your team sees them, and search finds them.',
    },
    {
      id: 'svc-notes', chapter: 'services', route: SVC, selector: t('svc-f-notes'),
      title: 'Manager notes',
      say: 'Manager notes are just for you. Anything worth remembering about this service.',
    },
    {
      id: 'svc-unit', chapter: 'services', route: SVC, selector: t('svc-f-unit'),
      title: 'Unit, quantity, active',
      say: 'The unit label says how it’s sold, like hour, each, visit or mile. It starts at hour. Default quantity is how many land on a line when you add it. And untick Active to retire a service without deleting it.',
    },
    {
      id: 'svc-pricing', chapter: 'services', route: SVC, selector: t('svc-f-pricing'),
      title: 'Pricing',
      say: 'Now the money. Three boxes: what the customer pays, what it costs you, and how it’s taxed.',
    },
    {
      id: 'svc-price', chapter: 'services', route: SVC, selector: t('svc-f-price'),
      title: 'Customer price',
      say: 'Customer price is what goes on the estimate or invoice for one unit.',
    },
    {
      id: 'svc-cost', chapter: 'services', route: SVC, selector: t('svc-f-cost'),
      title: 'Owner cost',
      say: 'Owner cost is optional: what one unit costs you. Customers never see it, but it’s how CrewBarn works out your margin.',
    },
    {
      id: 'svc-tax', chapter: 'services', route: SVC, selector: t('svc-f-tax'),
      title: 'Tax class',
      say: 'Tax class picks which tax this service carries, with its rate shown. No tax means it isn’t taxed. Your tax classes are set up on their own page, near the end.',
    },
    {
      id: 'svc-warranty', chapter: 'services', route: SVC, selector: t('svc-f-warranty'),
      title: 'Labor warranty',
      say: 'Labor warranty days give this service its own labor coverage. Leave it blank, and it follows your company’s labor warranty rule instead.',
    },
    {
      id: 'svc-image', chapter: 'services', route: SVC, selector: t('svc-f-image'),
      title: 'Image',
      say: 'A picture can be added once the service is saved.',
    },
    {
      id: 'svc-save', chapter: 'services', route: SVC, selector: t('svc-save'),
      title: 'Create service',
      say: 'Create service saves it, and it’s ready to pick on estimates, jobs and invoices. We’ll leave it this time.',
    },
    {
      id: 'svc-cancel', chapter: 'services', route: SVC, selector: t('svc-cancel'),
      wait: { gone: t('svc-form') }, doIt: t('svc-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Click Cancel, and nothing is made.',
    },

    // ---------- Change a service ----------
    {
      id: 'svc-edit-open', chapter: 'service-edit', route: SVC, open: 'goto:/catalog/services', selector: t('svc-row-edit'),
      wait: { appear: t('svc-form') }, doIt: t('svc-row-edit'),
      yourTurn: 'Click Edit on any service.',
      title: 'Open one',
      say: 'To change a service, press Edit on its row. Let’s open one, just to look.',
    },
    {
      id: 'svc-edit-form', chapter: 'service-edit', route: SVC, selector: t('svc-form'),
      title: 'Same boxes, filled in',
      say: 'It’s the same form, filled in with what you saved. Change a price here, and new lines use the new price. Lines already on estimates and invoices keep theirs.',
    },
    {
      id: 'svc-edit-image', chapter: 'service-edit', route: SVC, selector: t('svc-f-image'),
      title: 'Add a picture',
      say: 'On a saved service, this is where you add or change its picture.',
    },
    {
      id: 'svc-edit-delete', chapter: 'service-edit', route: SVC, selector: t('svc-delete'),
      title: 'Delete',
      say: 'Delete removes the service, after you confirm. To stop using one but keep its history, untick Active instead.',
    },
    {
      id: 'svc-edit-save', chapter: 'service-edit', route: SVC, selector: t('svc-save'),
      title: 'Save changes',
      say: 'Save changes lights up once you’ve changed something. We’ll leave it.',
    },
    {
      id: 'svc-edit-cancel', chapter: 'service-edit', route: SVC, selector: t('svc-cancel'),
      wait: { gone: t('svc-form') }, doIt: t('svc-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Close it',
      say: 'Click Cancel to close it, untouched.',
    },

    // ---------- The product list ----------
    {
      id: 'prod-header', chapter: 'products', route: PROD, open: 'goto:/catalog/products', selector: t('prod-header'),
      title: 'Product Catalog',
      say: 'Now the Product Catalog: the physical things you sell or use, like parts, equipment and materials. Counting and moving the stock happens in Inventory, but you can see it from here.',
    },
    {
      id: 'prod-search', chapter: 'products', route: PROD, selector: t('prod-search'),
      title: 'Search',
      say: 'Search by name, SKU or part number. The slash key jumps here too.',
    },
    {
      id: 'prod-tiles', chapter: 'products', route: PROD, selector: t('prod-category-tiles'),
      title: 'Shop by category',
      say: 'Each tile is a product category, with how many items it holds, what’s on hand, and whether anything is low or out.',
    },
    {
      id: 'prod-tile', chapter: 'products', route: PROD, selector: t('prod-category-tile'),
      wait: { appear: t('prod-category-showing') }, doIt: t('prod-category-tile'),
      yourTurn: 'Click a category tile.',
      title: 'Narrow the list',
      say: 'Click a tile, and the list below shows just that category.',
    },
    {
      id: 'prod-showing', chapter: 'products', route: PROD, selector: t('prod-category-showing'),
      title: 'Back to everything',
      say: 'This line says which category you’re in. Show all products, or the All products button, brings back the full list.',
    },
    {
      id: 'prod-all', chapter: 'products', route: PROD, selector: t('prod-category-all'),
      wait: { gone: t('prod-category-showing') }, doIt: t('prod-category-all'),
      yourTurn: 'Click All products.',
      title: 'All products',
      say: 'Click All products to see everything again.',
    },
    {
      id: 'prod-table', chapter: 'products', route: PROD, selector: t('prod-table'),
      title: 'Your products',
      say: 'Each row has a picture, the name and SKU, category, price and tax. Print QR makes a label for the shelf or the bin.',
    },
    {
      id: 'prod-stock', chapter: 'products', route: PROD, selector: t('prod-col-stock'),
      title: 'Stock and where it is',
      say: 'Stock shows how many you have and where they are. Red means it’s at or below the reorder point. Click the number to see every spot it’s kept.',
    },
    {
      id: 'prod-row', chapter: 'products', route: PROD, selector: t('prod-row'),
      wait: { appear: t('prod-view') }, doIt: t('prod-row'),
      yourTurn: 'Click any product row.',
      title: 'Open a product',
      say: 'Click any row to see everything about that product. It’s just for looking.',
    },
    {
      id: 'prod-view-top', chapter: 'products', route: PROD, selector: t('prod-view-top'),
      title: 'At a glance',
      say: 'Up top: the picture, the SKU, tags for its part source and category, and the price your customer pays.',
    },
    {
      id: 'prod-view-stock', chapter: 'products', route: PROD, selector: t('prod-view-stock'),
      title: 'In stock',
      say: 'Then how many you have, in each place, and when you reorder. If you’ve entered what it costs you, you’ll also see what that stock is worth.',
    },
    {
      id: 'prod-view-edit', chapter: 'products', route: PROD, selector: t('prod-view-edit'),
      title: 'Edit',
      say: 'Edit opens the full form, if you’re allowed to change the catalog. Everyone else can still look.',
    },
    {
      id: 'prod-view-close', chapter: 'products', route: PROD, selector: t('prod-view-close'),
      wait: { gone: t('prod-view') }, doIt: t('prod-view-close'),
      yourTurn: 'Click Close.',
      title: 'Close',
      say: 'Close it, and let’s add a new product.',
    },

    // ---------- Add a product ----------
    {
      id: 'prod-new', chapter: 'product-form', route: PROD, open: 'goto:/catalog/products', selector: t('prod-new'),
      wait: { appear: t('prod-form') }, doIt: t('prod-new'),
      yourTurn: 'Click + New Product.',
      title: 'New Product',
      say: 'Click New Product. Products have a few more boxes than services, because they live on shelves.',
    },
    {
      id: 'prod-name', chapter: 'product-form', route: PROD, selector: t('prod-f-name'), hold: true,
      yourTurn: 'Type a name, then press Next.',
      title: 'Name',
      say: 'Again, only the name is required. Type one in, like a half-inch brass ball valve.',
    },
    {
      id: 'prod-sku', chapter: 'product-form', route: PROD, selector: t('prod-f-sku'),
      title: 'SKU',
      say: 'Products always get a SKU. Press Generate to make one from the name, or leave it blank and one is made when you save.',
    },
    {
      id: 'prod-source', chapter: 'product-form', route: PROD, selector: t('prod-f-source'),
      title: 'Part source',
      say: 'Part source says whether it’s original equipment or aftermarket. It also goes into a generated SKU.',
    },
    {
      id: 'prod-category', chapter: 'product-form', route: PROD, selector: t('prod-f-category'),
      title: 'Category',
      say: 'Category puts it under one of your product tiles. Add new makes one on the spot, the same as on services.',
    },
    {
      id: 'prod-codes', chapter: 'product-form', route: PROD, selector: t('prod-f-codes'),
      title: 'Barcode and QR',
      say: 'Barcode is the number printed on the box, so a scan finds it. QR code value is an optional code of your own.',
    },
    {
      id: 'prod-short', chapter: 'product-form', route: PROD, selector: t('prod-f-short'),
      title: 'Short description',
      say: 'The short description is what customers see on invoices and stickers. Up to 100 characters. The longer customer description above it is optional extra detail.',
    },
    {
      id: 'prod-bin', chapter: 'product-form', route: PROD, selector: t('prod-f-bin'),
      title: 'Default bin',
      say: 'Default bin is where this lives on the shelf, so your team knows where to put it away. Leave it, and you pick a spot when stock comes in.',
    },
    {
      id: 'prod-internal', chapter: 'product-form', route: PROD, selector: t('prod-f-internal'),
      title: 'Long description',
      say: 'The long description is for your team, and search reads it. Put model numbers, what it fits, and other part numbers here.',
    },
    {
      id: 'prod-notes', chapter: 'product-form', route: PROD, selector: t('prod-f-notes'),
      title: 'Manager notes',
      say: 'Manager notes are just for you.',
    },
    {
      id: 'prod-unit', chapter: 'product-form', route: PROD, selector: t('prod-f-unit'),
      title: 'Unit of measure',
      say: 'Unit of measure is how you count it: each, feet, gallons, and so on. It starts at each. Then the default quantity for a new line, and whether it’s active.',
    },
    {
      id: 'prod-pricing', chapter: 'product-form', route: PROD, selector: t('prod-f-pricing'),
      title: 'Price, cost and tax',
      say: 'Pricing works just like services: the customer price, your cost, and the tax class. Your cost here is also what your stock is valued at.',
    },
    {
      id: 'prod-reorder', chapter: 'product-form', route: PROD, selector: t('prod-f-reorder'),
      title: 'Reorder point',
      say: 'Reorder threshold is the low-water mark. When what you have on hand drops to it, the product turns red and lands on Needs ordered. Reorder quantity is how many you usually buy.',
    },
    {
      id: 'prod-supplier', chapter: 'product-form', route: PROD, selector: t('prod-f-supplier'),
      title: 'Supplier',
      say: 'Supplier name and their part number for it. On Needs ordered, a supplier that matches one of your vendors can be picked for you.',
    },
    {
      id: 'prod-warranty', chapter: 'product-form', route: PROD, selector: t('prod-f-warranty'),
      title: 'Warranty days',
      say: 'Warranty days for the manufacturer, your company, and the labor. When it’s sold on an invoice, that coverage starts. Blank means none, and a labor number here wins over your company’s labor rule.',
    },
    {
      id: 'prod-extension', chapter: 'product-form', route: PROD, selector: t('prod-f-extension'),
      title: 'Selling extended warranty',
      say: 'Tick this if the product is an extended warranty you sell, like a year of extra labor cover. Pick which warranty it extends and by how many days, and it stretches the matching warranties on the same invoice.',
    },
    {
      id: 'prod-stocked', chapter: 'product-form', route: PROD, selector: t('prod-f-stocked'),
      title: 'Stocked item',
      say: 'Stocked item is on by default. Turn it off for one-off or special-order parts you don’t keep on the shelf, so they’re never suggested for reordering.',
    },
    {
      id: 'prod-sn', chapter: 'product-form', route: PROD, selector: t('prod-f-sn'),
      title: 'Serial numbers',
      say: 'Serial number tracking gives every unit its own number when it’s received. Once units exist, it can’t be turned off.',
    },
    {
      id: 'prod-image', chapter: 'product-form', route: PROD, selector: t('prod-f-image'),
      title: 'Picture',
      say: 'On a new product, you can pick a picture now. It uploads when the product is created.',
    },
    {
      id: 'prod-save', chapter: 'product-form', route: PROD, selector: t('prod-save'),
      title: 'Create product',
      say: 'Create product saves it. We’ll leave it this time.',
    },
    {
      id: 'prod-cancel', chapter: 'product-form', route: PROD, selector: t('prod-cancel'),
      wait: { gone: t('prod-form') }, doIt: t('prod-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Click Cancel, and nothing is made.',
    },

    // ---------- Categories ----------
    {
      id: 'svccat-header', chapter: 'categories', route: SVCCAT, open: 'goto:/catalog/categories', selector: t('svccat-header'),
      title: 'Service Categories',
      say: 'Services and products each have their own categories. Here are the service ones. Keeping them apart means the product list your customers see stays products only.',
    },
    {
      id: 'svccat-table', chapter: 'categories', route: SVCCAT, selector: t('svccat-table'),
      title: 'Groups inside groups',
      say: 'A category can sit inside another one. Sub-categories are indented under their parent.',
    },
    {
      id: 'svccat-new', chapter: 'categories', route: SVCCAT, selector: t('svccat-new'),
      wait: { appear: t('svccat-form') }, doIt: t('svccat-new'),
      yourTurn: 'Click + New Category.',
      title: 'New Category',
      say: 'Click New Category to see what goes into one.',
    },
    {
      id: 'svccat-name', chapter: 'categories', route: SVCCAT, selector: t('svccat-f-name'),
      title: 'Name',
      say: 'A name, like Repairs and Maintenance.',
    },
    {
      id: 'svccat-parent', chapter: 'categories', route: SVCCAT, selector: t('svccat-f-parent'),
      title: 'Parent',
      say: 'Pick a parent to tuck it inside another category, or leave it at the top.',
    },
    {
      id: 'svccat-active', chapter: 'categories', route: SVCCAT, selector: t('svccat-f-active'),
      title: 'Active',
      say: 'Untick Active, and the category drops out of the list you pick from on a service.',
    },
    {
      id: 'svccat-cancel', chapter: 'categories', route: SVCCAT, selector: t('svccat-cancel'),
      wait: { gone: t('svccat-form') }, doIt: t('svccat-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Create category would save it. Click Cancel instead.',
    },
    {
      id: 'prodcat-header', chapter: 'categories', route: PRODCAT, open: 'goto:/catalog/product-categories', selector: t('prodcat-header'),
      title: 'Product Categories',
      say: 'Product Categories work the same way, with one extra: a photo.',
    },
    {
      id: 'prodcat-photo', chapter: 'categories', route: PRODCAT, selector: t('prodcat-photo'),
      title: 'The tile’s picture',
      say: 'The square in the Photo column is that category’s picture. Click it to pick one and crop it, and it becomes the tile on the Product Catalog. We’ll leave yours as they are.',
    },
    {
      id: 'prodcat-new', chapter: 'categories', route: PRODCAT, selector: t('prodcat-new'),
      title: 'New Category',
      say: 'New Category asks for the same three things: a name, an optional parent, and whether it’s active.',
    },

    // ---------- Tax classes ----------
    {
      id: 'tax-header', chapter: 'tax', route: TAX, open: 'goto:/catalog/tax-classes', selector: t('tax-header'),
      title: 'Tax Classes',
      say: 'Tax Classes are the tax rates your items carry. Each one is the sum of its parts, kept split so filing is simpler.',
    },
    {
      id: 'tax-table', chapter: 'tax', route: TAX, selector: t('tax-table'),
      title: 'Your tax classes',
      say: 'Each row has the total rate, the area it’s for, and its parts, each with its own rate.',
    },
    {
      id: 'tax-star', chapter: 'tax', route: TAX, selector: t('tax-star'),
      title: 'The default',
      say: 'The filled star marks your default, the tax new invoice lines start with. Clicking a star changes it straight away, so we’ll leave it.',
    },
    {
      id: 'tax-new-open', chapter: 'tax', route: TAX, selector: t('tax-new-button'),
      wait: { appear: t('tax-new') }, doIt: t('tax-new-button'),
      yourTurn: 'Click + New Tax Class.',
      title: 'New Tax Class',
      say: 'Click New Tax Class.',
    },
    {
      id: 'tax-zip', chapter: 'tax', route: TAX, selector: t('tax-new-zip'),
      title: 'Fill it from a ZIP',
      say: 'The quick way: type a ZIP code and press Search. It fills in the state and local rates for you. Always check them before you save.',
    },
    {
      id: 'tax-name', chapter: 'tax', route: TAX, selector: t('tax-field-name'),
      title: 'Name',
      say: 'Name it so your team knows it on sight, like Sales tax, Springfield County.',
    },
    {
      id: 'tax-jurisdiction', chapter: 'tax', route: TAX, selector: t('tax-field-jurisdiction-parent-label-optional'),
      title: 'Jurisdiction',
      say: 'Jurisdiction is an optional label for the area it covers.',
    },
    {
      id: 'tax-components', chapter: 'tax', route: TAX, selector: t('tax-new-components'),
      title: 'The parts',
      say: 'Each part has a name, a rate, its area, and who you pay it to. Add component adds another part, and the cross removes one.',
    },
    {
      id: 'tax-total', chapter: 'tax', route: TAX, selector: t('tax-new-total'),
      title: 'Total rate',
      say: 'The total rate is all the parts added up. That’s what a line is charged. The parts, and who you pay each one to, split your sales tax report.',
    },
    {
      id: 'tax-save', chapter: 'tax', route: TAX, selector: t('tax-new-save'),
      title: 'Create tax class',
      say: 'Create tax class would save it. Not this time.',
    },
    {
      id: 'tax-cancel', chapter: 'tax', route: TAX, selector: t('tax-new-cancel'),
      wait: { gone: t('tax-new') }, doIt: t('tax-new-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Click Cancel.',
    },
    {
      id: 'tax-edit-open', chapter: 'tax', route: TAX, selector: t('tax-row-edit'),
      wait: { appear: t('tax-edit') }, doIt: t('tax-row-edit'),
      yourTurn: 'Click Edit on a tax class.',
      title: 'Open one',
      say: 'Now open one that already exists. Click Edit, just to look.',
    },
    {
      id: 'tax-edit-components', chapter: 'tax', route: TAX, selector: t('tax-edit-components'),
      title: 'Each part saves on its own',
      say: 'Here, each part has its own Save button that shows up once you change it. The total at the top updates as soon as it’s saved.',
    },
    {
      id: 'tax-edit-delete', chapter: 'tax', route: TAX, selector: t('tax-edit-delete'),
      title: 'Delete tax class',
      say: 'Delete tax class removes it, after you confirm.',
    },
    {
      id: 'tax-edit-close', chapter: 'tax', route: TAX, selector: t('tax-edit-close'),
      wait: { gone: t('tax-edit') }, doIt: t('tax-edit-close'),
      yourTurn: 'Click Close.',
      title: 'Close',
      say: 'Click Close. Nothing has changed.',
    },

    // ---------- Discounts ----------
    {
      id: 'disc-header', chapter: 'discounts', route: DISC, open: 'goto:/tool-shed/pricing', selector: t('disc-header'),
      title: 'Discounts',
      say: 'Pricing and discounts, in the Tool Shed, is where your discounts live: a percentage off, or a set dollar amount. Markups and minimum charges live on the Cost Model, which is next.',
    },
    {
      id: 'disc-list', chapter: 'discounts', route: DISC, selector: t('disc-list'),
      title: 'Your discounts',
      say: 'Each discount shows its amount, its code, and whether it’s turned off. Edit and Delete sit on the right.',
    },
    {
      id: 'disc-add', chapter: 'discounts', route: DISC, selector: t('disc-add'),
      wait: { appear: t('disc-form') }, doIt: t('disc-add'),
      yourTurn: 'Click + Add discount.',
      title: 'Add a discount',
      say: 'Click Add discount.',
    },
    {
      id: 'disc-example', chapter: 'discounts', route: DISC, selector: t('disc-form-example'),
      title: 'See what it does',
      say: 'This box shows what your discount does to a hundred-dollar job. It’s only an example. No estimate or invoice changes here.',
    },
    {
      id: 'disc-name', chapter: 'discounts', route: DISC, selector: t('disc-form-name'),
      title: 'Name',
      say: 'Name it the way your team says it, like Senior or Veteran ten percent.',
    },
    {
      id: 'disc-amount', chapter: 'discounts', route: DISC, selector: t('disc-form-amount'),
      title: 'Percent or dollars',
      say: 'Pick a percentage or a fixed amount, then how much comes off.',
    },
    {
      id: 'disc-code', chapter: 'discounts', route: DISC, selector: t('disc-form-code'),
      title: 'Code',
      say: 'A code is optional, like SPRING25, for a deal you advertise.',
    },
    {
      id: 'disc-description', chapter: 'discounts', route: DISC, selector: t('disc-form-description'),
      title: 'Description',
      say: 'Description is for who qualifies, or anything else your team should know.',
    },
    {
      id: 'disc-active', chapter: 'discounts', route: DISC, selector: t('disc-form-active'),
      title: 'Active',
      say: 'Untick Active to retire a discount and keep it on the list.',
    },
    {
      id: 'disc-cancel', chapter: 'discounts', route: DISC, selector: t('disc-cancel'),
      wait: { gone: t('disc-form') }, doIt: t('disc-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Create would save it. Click Cancel to close it.',
    },

    // ---------- Cost model ----------
    {
      id: 'cost-header', chapter: 'cost', route: COST, open: 'goto:/tool-shed/cost-model', selector: t('cost-header'),
      title: 'Company Cost Model',
      say: 'The Company Cost Model. Put in what it really costs to run your business, and it works out the hourly rate you need to charge.',
    },
    {
      id: 'cost-guide-banner', chapter: 'cost', route: COST, selector: t('cost-guide-banner'),
      title: 'Go through it together',
      say: 'Until you’ve been through it, this banner offers eleven short questions. Skip anything you don’t know, and watch your break-even move as you answer.',
    },
    {
      id: 'cost-actions', chapter: 'cost', route: COST, selector: t('cost-actions'),
      title: 'Walk through, or add one',
      say: 'Walk me through it asks those questions one at a time, and saves your answers as you go, so we won’t open it now. Add cost adds a single cost yourself.',
    },
    {
      id: 'cost-metrics', chapter: 'cost', route: COST, selector: t('cost-metrics'),
      title: 'Your numbers',
      say: 'Across the top: your monthly overhead, where it comes from, and your break-even per hour. The green tile is your target rate, break-even with your margin on top.',
    },
    {
      id: 'cost-assumptions', chapter: 'cost', route: COST, selector: t('cost-assumptions'),
      title: 'Pricing assumptions',
      say: 'Pricing assumptions turn your monthly costs into hourly rates.',
    },
    {
      id: 'cost-hours', chapter: 'cost', route: COST, selector: t('cost-field-expected-monthly-billable-hours'),
      title: 'Billable hours',
      say: 'Expected monthly billable hours is the big one: how many hours your team actually charges for in a month. Be honest about it.',
    },
    {
      id: 'cost-margins', chapter: 'cost', route: COST, selector: t('cost-field-gross-margin'),
      title: 'Margins',
      say: 'Gross and net margin are what you aim to keep. They lift your target rate above break-even.',
    },
    {
      id: 'cost-minimums', chapter: 'cost', route: COST, selector: t('cost-field-minimum-service-call'),
      title: 'Minimums',
      say: 'Minimum job profit and minimum service call are your floors: the least you want from any job.',
    },
    {
      id: 'cost-markup', chapter: 'cost', route: COST, selector: t('cost-field-material-markup'),
      title: 'Markups',
      say: 'After-hours x is how much more after-hours work costs, like 1.5. Material markup matters most: when you pick an item with no price onto a line, CrewBarn suggests its cost plus this markup.',
    },
    {
      id: 'cost-save', chapter: 'cost', route: COST, selector: t('cost-assumptions-save'),
      title: 'Save assumptions',
      say: 'Save assumptions updates your rates. We’ll leave it.',
    },
    {
      id: 'cost-breakdown', chapter: 'cost', route: COST, selector: t('cost-breakdown'),
      title: 'Monthly breakdown',
      say: 'Your monthly costs, grouped by type, biggest first.',
    },
    {
      id: 'cost-inventory', chapter: 'cost', route: COST, selector: t('cost-inventory'),
      title: 'What stock costs to hold',
      say: 'This one you don’t type. It takes the value of the stock on your shelves and the yearly rate you set, so it follows your inventory on its own.',
    },
    {
      id: 'cost-entries', chapter: 'cost', route: COST, selector: t('cost-entries'),
      title: 'Every cost',
      say: 'Every cost you’ve added, its monthly amount, and any balance owed. Edit opens one.',
    },
    {
      id: 'cost-add', chapter: 'cost', route: COST, selector: t('cost-add'),
      wait: { appear: t('cost-entry-form') }, doIt: t('cost-add'),
      yourTurn: 'Click + Add cost.',
      title: 'Add a cost',
      say: 'Click Add cost to see what goes into one. Just look this time. Pressing Enter in this form would save it.',
    },
    {
      id: 'cost-entry-name', chapter: 'cost', route: COST, selector: t('cost-field-name'),
      title: 'Name and type',
      say: 'Name the cost, like Shop rent, and pick its type, like facility, vehicle or payroll. Category and trade are optional labels for grouping.',
    },
    {
      id: 'cost-entry-amounts', chapter: 'cost', route: COST, selector: t('cost-field-monthly-amount'),
      title: 'Monthly or yearly',
      say: 'Enter it monthly, or yearly and it’s divided by twelve. For a loan, add the balance, the minimum payment and the interest rate too.',
    },
    {
      id: 'cost-entry-flags', chapter: 'cost', route: COST, selector: t('cost-field-flags'),
      title: 'Fixed and active',
      say: 'Fixed means it stays the same however busy you are. Untick Active to stop counting it without deleting it.',
    },
    {
      id: 'cost-entry-cancel', chapter: 'cost', route: COST, selector: t('cost-entry-cancel'),
      wait: { gone: t('cost-entry-form') }, doIt: t('cost-entry-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Save cost would add it to your overhead. Click Cancel instead.',
    },

    // ---------- Where it shows up ----------
    // Card-only: these live on other pages, so the card explains where to look.
    {
      id: 'used-intro', chapter: 'used', route: SVC, open: 'goto:/catalog/services',
      title: 'Where your catalog gets used',
      say: 'Your catalog doesn’t stay on these pages. Here’s where it shows up, so you know where to look.',
    },
    {
      id: 'used-lines', chapter: 'used', route: SVC,
      title: 'Estimates, jobs and invoices',
      say: 'On an estimate, a job or an invoice, press Search catalog. Add from catalog lists services and products. Pick one, and the price, description and tax fill in on the line.',
    },
    {
      id: 'used-markup', chapter: 'used', route: SVC,
      title: 'No price? Cost plus markup',
      say: 'If an item has no customer price, the line starts at its cost plus your material markup from the Cost Model. You can always change the price on the line.',
    },
    {
      id: 'used-tax', chapter: 'used', route: SVC,
      title: 'Tax on each line',
      say: 'Each line can have its tax class changed. And Add discount on the line items takes a percentage or a dollar amount off the whole thing.',
    },
    {
      id: 'used-warranty', chapter: 'used', route: SVC,
      title: 'Warranties start themselves',
      say: 'When an item with warranty days is sold on an invoice, its coverage starts on its own. You’ll find it all on the Warranties page.',
    },
    {
      id: 'used-stock', chapter: 'used', route: SVC,
      title: 'Inventory and reordering',
      say: 'Products are what Inventory counts, moves and receives. Anything at or below its reorder point shows up on Needs ordered, where you start a purchase order.',
    },
    {
      id: 'used-salestax', chapter: 'used', route: SVC,
      title: 'Sales tax report',
      say: 'The tax your invoices collect shows on the Sales tax report, under Accounting, split by each part and who you pay it to.',
    },
    {
      id: 'used-done', chapter: 'used', route: SVC,
      title: 'That’s the lot',
      say: 'That’s everything, from adding what you sell to pricing it right. You can take this tutorial again any time from the button at the top of the page.',
    },
  ],
}
