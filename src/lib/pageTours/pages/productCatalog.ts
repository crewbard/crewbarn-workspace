import type { PageTour } from '../types'

/**
 * Catalog & inventory → Product catalog (/catalog/products).
 *
 * States the steps follow:
 *   - category tiles show only when there are active product categories;
 *     a picked category shows prod-category-showing;
 *   - list with rows (prod-table) or empty (prod-empty);
 *   - New Product / Edit only for people who can change the catalog;
 *   - a product open to look at (prod-view), or the form open: new (no
 *     Delete) or saved (prod-delete). Those steps play only while open.
 */
const t = (id: string) => `[data-tour="${id}"]`
const FORM = t('prod-form')
const VIEW = t('prod-view-top')
const EDITING = t('prod-delete')
const searching = (page: { find: (s: string) => HTMLElement | null }) =>
  !!((page.find(`${t('prod-search')} input`) as HTMLInputElement | null)?.value ?? '').trim()

export const PAGE_TOUR: PageTour = {
  id: 'product-catalog',
  route: '^/catalog/products/?$',
  intro: {
    page: 'Product catalog',
    purpose: 'The physical things you sell or use: parts, equipment and materials, with what they cost you, what you charge, and how many you have.',
    covers: ['Shop by category', 'Your products and stock', 'A product up close', 'Adding one', 'Reordering and suppliers'],
  },
  steps: [
    {
      id: 'header', selector: t('prod-header'),
      title: 'Product catalog',
      say: 'Your product catalog: the parts and materials you sell or use. Counting and moving stock happens in Inventory, but you can see it from here.',
    },
    {
      id: 'search', selector: t('prod-search'),
      title: 'Search',
      say: 'Search by name, SKU or part number. Use the quick filters to find low stock, out-of-stock items or missing prices. No price means check the item before quoting. Where Fits is available, narrow products to the equipment they fit. Clear filters if an item seems missing.',
    },
    {
      id: 'tiles', selector: t('prod-category-tiles'), when: t('prod-category-tile'),
      title: 'Shop by category',
      say: 'Each tile is a product category, with how many items it holds and whether anything is low or out. Press one to show just that category.',
    },
    {
      id: 'showing', selector: t('prod-category-showing'),
      title: 'One category',
      say: 'You’re looking at one category. Show all products, or the All products button, brings back the full list.',
    },
    {
      id: 'list', title: 'Your products', say: '',
      variants: [
        {
          when: (page) => !!page.find(t('prod-empty')) && searching(page), selector: t('prod-empty'),
          say: 'Nothing matches that search. Clear the search box to see everything again.',
        },
        {
          when: t('prod-empty'), selector: t('prod-empty'),
          title: 'No products yet',
          say: 'No products yet. Add the parts you use most, or bring a list in from Import data.',
        },
        {
          when: t('prod-table'), selector: t('prod-table'),
          say: 'Each row has a picture, the name and SKU, category, price and tax. Print QR makes a label for the shelf or bin.',
        },
      ],
    },
    {
      id: 'stock', selector: t('prod-col-stock'),
      title: 'Stock and where it is',
      say: 'Stock shows how many you have. Red means it’s at or below the reorder point. Press the number to see every spot it’s kept.',
    },
    {
      id: 'count', selector: t('prod-count'),
      title: 'How many',
      say: 'This line counts your products, or how many match your search.',
    },
    {
      id: 'row', selector: t('prod-row'), when: `!${VIEW}`,
      title: 'Open a product',
      say: 'Press any row to see everything about that product. It’s just for looking.',
    },
    {
      id: 'new', selector: t('prod-new'), when: `!${FORM}`,
      title: 'Add a product',
      say: 'New Product opens the form. Only the name is required; a SKU is made for you if you leave it blank.',
    },

    // ── A product open to look at ──
    { id: 'view-top', selector: t('prod-view-top'), title: 'At a glance', say: 'Up top: the picture, the SKU, its part source and category, and the price your customer pays.' },
    { id: 'view-cart', selector: t('prod-add-to-cart'), title: 'Order more', say: 'Order more puts it in the parts cart, for stock or a job. Whoever orders parts picks the supplier.' },
    { id: 'view-labels', selector: t('prod-view-labels'), title: 'Print labels', say: 'Opens the label sheet for this product in a new tab.' },
    { id: 'view-stock-po', selector: t('prod-view-stock-from-po'), title: 'Add stock from PO', say: 'Takes you to Bins with the purchase-order window open, so what came in goes into a bin and is logged as received.' },
    { id: 'view-stock', selector: t('prod-view-stock'), title: 'In stock', say: 'How many you have in each place, the shop and each van, bin by bin, and when you reorder. With a cost entered, you also see what that stock is worth.' },
    { id: 'view-open-pos', selector: t('prod-view-open-pos'), title: 'Open purchase orders', say: 'Orders with some of this still to come in, from whom and when it is due.' },
    { id: 'view-movements', selector: t('prod-view-movements'), title: 'Recent movements', say: 'The last few times it was received, used, moved or counted. All movements opens the full log for this product.' },
    { id: 'view-sellers', selector: t('prod-who-sells'), title: 'Who sells this', say: 'The suppliers you’ve bought it from, their part numbers, what it cost and how long it took. Star your preferred one and Order parts picks them first.' },
    {
      id: 'view-edit', selector: t('prod-view-edit'), when: VIEW,
      title: 'Edit', say: 'Edit opens the full form to change this product.',
    },

    // ── The form, while it's open ──
    {
      id: 'form', selector: FORM, when: FORM,
      title: 'New product', say: 'A new product. Only the name is required. Nothing is saved until you press Create product.',
      variants: [{ when: EDITING, title: 'A saved product', say: 'A saved product, filled in with what you have. Nothing changes until you press Save changes.' }],
    },
    { id: 'sku', selector: t('prod-f-sku'), title: 'SKU', say: 'Products always get a SKU. Press Generate to make one from the name.' },
    { id: 'category', selector: t('prod-f-category'), title: 'Category', say: 'Category puts it under one of your product tiles.' },
    { id: 'codes', selector: t('prod-f-codes'), title: 'Barcode and QR', say: 'The barcode on the box, so a scan finds it, and an optional QR value of your own.' },
    { id: 'short', selector: t('prod-f-short'), title: 'Short description', say: 'The short description is what customers see on invoices and stickers.' },
    { id: 'bin', selector: t('prod-f-bin'), title: 'Default bin', say: 'Where this lives on the shelf, so your team knows where to put it away.' },
    { id: 'pricing', selector: t('prod-f-pricing'), title: 'Price, cost and tax', say: 'Enter the customer price, your cost and the tax class. Check missing prices before quoting. Your cost also values stock. After saving, reopen the product and try it on a draft estimate to check price and tax.' },
    { id: 'fits', selector: t('prod-f-fits'), title: 'What it fits', say: 'When your trade has a fitment profile, add the equipment or vehicle details this product fits. Review draft fitment details before relying on them, then save the product and check it with the Fits filter.' },
    { id: 'reorder', selector: t('prod-f-reorder'), title: 'Reorder point', say: 'When what’s on hand drops to the reorder point, the product turns red and lands on Needs ordered.' },
    { id: 'supplier', selector: t('prod-f-supplier'), title: 'Supplier', say: 'Who you buy it from and their part number. A supplier that matches one of your vendors is picked for you when you order.' },
    { id: 'warranty', selector: t('prod-f-warranty'), title: 'Warranty', say: 'Warranty days from the maker, your company and the labor. Coverage starts when it’s sold on an invoice.' },
    { id: 'stocked', selector: t('prod-f-stocked'), title: 'Stocked item', say: 'Turn this off for special-order parts you don’t keep on the shelf, so they’re never suggested for reordering.' },
    { id: 'sn', selector: t('prod-f-sn'), title: 'Serial numbers', say: 'Track a serial number for every unit as it’s received.' },
    {
      id: 'save', selector: t('prod-save'), when: FORM,
      title: 'Create product', say: 'Create product saves it. Cancel leaves without making anything.',
      variants: [{ when: EDITING, title: 'Save changes', say: 'Save changes keeps your edits. Delete removes the product after you confirm.' }],
    },
  ],
}
