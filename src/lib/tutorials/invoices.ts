import type { TutorialData } from './types'

/**
 * Invoices and getting paid: the list, how invoices are made, the invoice
 * page, sending, taking payments, credits, terms, and where it all shows up.
 *
 * Import-free (types aside) so scripts/export-tour-lines.mjs can load it on
 * its own and export every line for voice recording as `invoices.<n>`.
 */

const t = (id: string) => `[data-tour=${JSON.stringify(id)}]`

const LIST = '^/accounting/invoices/?$'
const DETAIL = '^/invoices/[^/]+/?$'
const CREDITS = '^/accounting/customer-credits/?$'
const TERMS = '^/tool-shed/payment-terms/?$'
const TYPES = '^/tool-shed/payment-types/?$'
const PAYMENTS = '^/tool-shed/payments(/.*)?$'
const DESK = '^/accounting/?$'
/** The Focus look (<html data-theme="focus">), for words that differ there. */
const FOCUS = 'html[data-theme="focus"]'
/** In the Focus look an invoice shows one section at a time: these press Charges or Account & actions first. */
const CHARGES = t('invoice-section-charges')
const ACCOUNT = t('invoice-section-overview')

/** Buttons in the View / Print invoice toolbar. */
const RECEIVE_BUTTON = `${t('invoice-print-toolbar')} > button.bg-emerald-600`
const CLOSE_PREVIEW = `${t('invoice-print-toolbar')} button[aria-label="Close"]`

export const TUTORIAL: TutorialData = {
  id: 'invoices',
  kicker: 'Invoices · tutorial',
  title: 'Getting paid, start to finish',

  film: [
    {
      id: 'flow',
      label: 'Work to paid',
      title: 'From finished work to money in the bank',
      narration:
        'Welcome to invoices. Getting paid follows the same path every time: the work gets done, an invoice is made, it goes to the customer, and the payment comes in. CrewBarn keeps track of every step, so you always know what’s still owed.',
    },
    {
      id: 'make',
      label: 'Making one',
      title: 'Invoices come from the work',
      narration:
        'You rarely start an invoice from nothing. Finish a job and its invoice is made for you, with the job’s lines already on it. A maintenance contract bills itself each period. And for a counter sale, you start a new one from the customer’s account.',
    },
    {
      id: 'states',
      label: 'Where it stands',
      title: 'One color tells you where it stands',
      narration:
        'Every invoice wears a color. Gray is a draft nobody has sent. Blue is sent. Amber means part of it is paid. Red is overdue. Green is paid in full. And void is one that was cancelled.',
    },
    {
      id: 'send',
      label: 'Sending',
      title: 'Send it, and follow it up',
      narration:
        'Sending puts the invoice in front of the customer by email, text or print, and the customer portal lets them view it and pay online. If the due date passes, reminders follow up for you, and the Money desk lists every late one in one place.',
    },
    {
      id: 'pay',
      label: 'Receive payment',
      title: 'One payment, as many invoices as it covers',
      narration:
        'When money comes in, Receive payment records it. One check can cover several invoices: tick each one it pays. A tip can go to the tech, and anything left over becomes a credit on the customer’s account.',
    },
    {
      id: 'partial',
      label: 'Partials and credits',
      title: 'Part payments and credits',
      narration:
        'Customers don’t always pay it all at once. Take part of it, and the invoice shows Partial with the rest still owing. Overpay, or pay a deposit before the job is billed, and the extra waits as a credit for their next invoice.',
    },
    {
      id: 'where',
      label: 'Where it shows up',
      title: 'Your invoices show up all over',
      narration:
        'Invoices show up all over CrewBarn: on the job, on the customer’s account, on the Money desk’s to-do list, in your reports, and in bank match when a deposit lands.',
    },
    {
      id: 'yourturn',
      label: 'Your turn',
      title: 'Now let’s do it for real',
      narration:
        'That’s the idea. Now let’s do it for real. I’ll step back into the corner and point at each part of the page. When it’s your turn, you click. We’ll open forms but never save a payment. If you’d rather watch, press Do it for me.',
    },
  ],

  chapters: [
    { key: 'list', label: 'The Invoices list' },
    { key: 'make', label: 'How invoices are made' },
    { key: 'detail', label: 'The invoice page' },
    { key: 'send', label: 'Sending and reminders' },
    { key: 'receive', label: 'Receive payment' },
    { key: 'paid', label: 'Partials, voids and fixes' },
    { key: 'credits', label: 'Customer credits' },
    { key: 'settings', label: 'Terms, types and cards' },
    { key: 'used', label: 'Where it shows up' },
  ],

  steps: [
    // ---------- The Invoices list ----------
    {
      id: 'list-header', chapter: 'list', route: LIST, open: 'goto:/accounting/invoices',
      click: t('invoices-view-cards'), selector: t('invoices-header'),
      title: 'Invoices',
      say: 'This is Invoices, under Accounting. It’s every bill you’ve sent or are about to send, and what’s still owed on each one.',
    },
    {
      id: 'list-easy-cards', chapter: 'list', route: LIST, selector: t('invoices-action-cards'),
      title: 'Quick picks',
      say: 'These four cards are shortcuts: Past due, Not sent yet, Sent to customers, and Paid. Each one shows how many are waiting.',
    },
    {
      id: 'list-tabs', chapter: 'list', route: LIST, selector: t('invoices-tabs'),
      title: 'Where they stand',
      say: 'The tabs sort invoices by where they stand: All, Draft, Sent, Overdue and Paid, each with a live count. Overdue means it was sent, the due date has passed, and money is still owing.',
    },
    {
      id: 'list-search', chapter: 'list', route: LIST, selector: t('invoices-search'),
      title: 'Search',
      say: 'Search finds an invoice by its number or the customer’s name.',
    },
    {
      id: 'list-views', chapter: 'list', route: LIST, selector: t('invoices-view'),
      title: 'Cards or Files',
      say: 'Cards shows each invoice as a card. Files puts them in folders by year and month, like a filing cabinet. We’ll peek at Files in a moment.',
    },
    {
      id: 'list-card', chapter: 'list', route: LIST, selector: t('invoice-card'),
      title: 'One card, one invoice',
      say: 'Each card is one invoice. The invoice number is at the top, with the customer under it.',
    },
    {
      id: 'list-state', chapter: 'list', route: LIST, selector: t('invoice-card-state'),
      title: 'The color tag',
      say: 'The tag and the stripe across the top say where it stands. Gray is Draft, blue is Sent, amber is Partial, red is Overdue, green is Paid, and Void is one that was cancelled.',
    },
    {
      id: 'list-money', chapter: 'list', route: LIST, selector: t('invoice-card-money'),
      title: 'Total and balance',
      say: 'Total is the whole bill. Balance is what’s still owed. It shows in red while money is owing, and says Paid once it’s settled.',
    },
    {
      id: 'list-meta', chapter: 'list', route: LIST, selector: t('invoice-card-meta'),
      title: 'Job and due date',
      say: 'Next is the job it came from, and when it’s due. A due date that has passed turns red. An invoice made without a job says No job attached.',
    },
    {
      id: 'list-next', chapter: 'list', route: LIST, selector: t('invoice-card-next'),
      title: 'The next step',
      say: 'At the bottom is the next step. A draft shows Send, which opens the invoice. A sent one with a balance shows a green Take payment button with the amount, so you can collect right from the list.',
    },
    {
      id: 'list-files', chapter: 'list', route: LIST, click: t('invoices-view-files'), selector: t('invoices-files'),
      title: 'Files',
      say: 'Here’s Files. Each year is a folder showing how many invoices it holds, their total, and what’s still outstanding. Open a year to see its months, and a month to see its invoices. The tabs up top follow whichever folder is open.',
    },
    {
      id: 'list-cards-back', chapter: 'list', route: LIST, click: t('invoices-view-cards'), selector: t('invoices-view'),
      title: 'Back to Cards',
      say: 'Cards brings you back. The list remembers which view you used last.',
    },

    // ---------- How invoices are made ----------
    // No New button on the list: invoices come from jobs, contracts, or the
    // customer's account. These are cards with nothing to point at.
    {
      id: 'make-intro', chapter: 'make', route: LIST, open: 'goto:/accounting/invoices',
      title: 'Where invoices come from',
      say: 'You’ll notice there’s no New button on this list. Invoices come from the work itself. Here are the three ways one gets made.',
    },
    {
      id: 'make-job', chapter: 'make', route: LIST,
      title: 'From a job',
      say: 'From a job. Mark a job Complete on its page and CrewBarn makes the invoice for you, copying the job’s line items onto it. A finished job without one has an Invoice Job button at the top.',
    },
    {
      id: 'make-job-view', chapter: 'make', route: LIST,
      title: 'View invoice',
      say: 'Once it’s made, that button becomes View invoice, and the invoice opens right over the job, so you never leave it. A job gets one invoice.',
    },
    {
      id: 'make-covered', chapter: 'make', route: LIST,
      title: 'Covered visits',
      say: 'If the visit is covered by a service agreement, its fee already pays for the work. The button reads Invoice extra work instead, and it asks before making one.',
    },
    {
      id: 'make-contract', chapter: 'make', route: LIST,
      title: 'From a contract',
      say: 'From a contract. A maintenance contract raises its own invoice when each billing period starts. In Tool Shed, Whether contract invoices wait for you decides if they sit as drafts until someone checks them, or count right away. Either way, nothing is emailed until you send it.',
    },
    {
      id: 'make-new', chapter: 'make', route: LIST,
      title: 'New, from the customer',
      say: 'New, from a customer’s account. Open the customer, go to Records, then Invoices, and press New invoice. Pick one of their jobs to copy its lines, or leave it as a blank invoice for a counter sale and type the lines yourself.',
    },
    {
      id: 'make-new-fields', chapter: 'make', route: LIST,
      title: 'What goes on it',
      say: 'That form has the line items with a tax class, plus Add line, Add fee and Add discount. Then the issue date, a due date with quick picks for Due on receipt, Net 14 and Net 30, notes the customer sees, and the terms.',
    },
    {
      id: 'make-new-save', chapter: 'make', route: LIST,
      title: 'Create, or create and collect',
      say: 'Create invoice saves it as a draft to send later. Create + take payment saves it and opens the payment window straight away, which is handy when the customer is standing right there.',
    },

    // ---------- The invoice page ----------
    {
      id: 'detail-open', chapter: 'detail', route: LIST, open: 'goto:/accounting/invoices',
      click: t('invoices-view-cards'), selector: t('invoice-card'),
      wait: { route: DETAIL }, doIt: 'invoice:open',
      yourTurn: 'Click an invoice card. One with a balance is best.',
      title: 'Open an invoice',
      say: 'Let’s look inside one. Opening an invoice is just for looking, and nothing changes. Click a card, ideally one that still has money owing.',
    },
    {
      id: 'detail-header', chapter: 'detail', route: DETAIL, open: 'invoice:open', selector: t('invoice-header'),
      title: 'The invoice',
      say: 'Here’s the invoice: its number, the job’s title, and its status, which is draft, sent, paid or cancelled. A red Overdue tag shows when it’s past due.',
    },
    {
      id: 'detail-transfer', chapter: 'detail', route: DETAIL, selector: t('invoice-header'),
      title: 'Bank transfer on the way',
      say: 'Sometimes you’ll see a blue tag, Bank transfer on the way. That means the customer told us they sent a transfer. It matches by itself when it lands in your bank feed.',
    },
    {
      id: 'detail-glance', chapter: 'detail', route: DETAIL, selector: t('invoice-glance'),
      title: 'At a glance',
      say: 'At a glance shows the total, the payments recorded, and what’s still to pay.',
    },
    {
      id: 'detail-sections', chapter: 'detail', route: DETAIL, when: FOCUS, selector: t('invoice-sections'),
      title: 'Two sections',
      say: 'In the Focus look, an invoice has two sections. Account & actions has who it’s to, the dates, payments and the buttons. Charges has the lines and totals. I’ll switch between them as we go.',
    },
    {
      id: 'detail-lines', click: CHARGES, chapter: 'detail', route: DETAIL, selector: t('invoice-lines'),
      title: 'Line items',
      say: 'Line items list each part, labor or fee, with the quantity, price, tax and total. You read them here. To change them, change the job or estimate the invoice came from.',
    },
    {
      id: 'detail-totals', click: CHARGES, chapter: 'detail', route: DETAIL, selector: t('invoice-totals'),
      title: 'Totals',
      say: 'Then the subtotal, tax and total. A tax-exempt customer gets a Tax exempt line that takes the tax back off. Once money comes in, you’ll see what’s been paid and the balance due.',
    },
    {
      id: 'detail-notes', click: CHARGES, chapter: 'detail', route: DETAIL, selector: t('invoice-notes'),
      title: 'Notes and terms',
      say: 'Notes and terms, when there are any. Customer notes and terms print on the invoice. Internal notes are for your staff only.',
    },
    {
      id: 'detail-billto', click: ACCOUNT, chapter: 'detail', route: DETAIL, selector: t('invoice-bill-to'),
      title: 'Bill to',
      say: 'Bill to links to the customer’s account. Source job takes you back to the job it came from.',
    },
    {
      id: 'detail-dates', click: ACCOUNT, chapter: 'detail', route: DETAIL, selector: t('invoice-dates'),
      title: 'Dates',
      say: 'Dates shows when it was issued and when it’s due, and adds the day it was sent, paid or cancelled as each one happens.',
    },
    {
      id: 'detail-payment', click: ACCOUNT, chapter: 'detail', route: DETAIL, selector: t('invoice-payment'),
      title: 'Payment',
      say: 'On a paid invoice, this shows how it was paid and any reference, like a check number.',
    },
    {
      id: 'detail-actions', click: ACCOUNT, chapter: 'detail', route: DETAIL, selector: t('invoice-actions'),
      title: 'Actions',
      say: 'Actions holds what you can do with it. The buttons change with its status, and with whether your role can change invoices.',
    },

    // ---------- Sending and reminders ----------
    {
      id: 'send-intro', click: ACCOUNT, chapter: 'send', route: DETAIL, open: 'invoice:open', selector: t('invoice-actions'),
      title: 'Nothing goes out by itself',
      say: 'A new invoice starts as a draft, and nothing reaches the customer until you send it.',
    },
    {
      id: 'send-mark-sent', click: ACCOUNT, chapter: 'send', route: DETAIL, selector: t('invoice-mark-sent'),
      title: 'Mark as sent',
      say: 'On a draft, Mark as sent only changes the status, for one you handed over yourself. It doesn’t email anything.',
    },
    {
      id: 'send-print', click: ACCOUNT, chapter: 'send', route: DETAIL, selector: t('invoice-print'),
      wait: { appear: t('invoice-print-toolbar') }, doIt: t('invoice-print'),
      yourTurn: 'Click View / Print invoice.',
      title: 'View / Print invoice',
      say: 'To really send it, open it the way the customer sees it. Click View / Print invoice.',
    },
    {
      id: 'send-document', chapter: 'send', route: DETAIL, selector: t('invoice-print-toolbar'),
      title: 'What the customer sees',
      say: 'This is the invoice as your customer sees it, in your invoice template when you have one. A paid invoice gets a big PAID stamp across it.',
    },
    {
      id: 'send-email', chapter: 'send', route: DETAIL, selector: t('invoice-print-toolbar'),
      title: 'Email',
      say: 'Email sends it to the customer’s email on file. It’s grayed out when there’s no email. It really sends, so we’ll leave it alone today.',
    },
    {
      id: 'send-text', chapter: 'send', route: DETAIL, selector: t('invoice-print-toolbar'),
      title: 'Text and Print',
      say: 'Text opens your phone’s messages with the customer’s number and a link to view and pay online. Print prints just the invoice, on one clean page.',
    },
    {
      id: 'send-portal', chapter: 'send', route: DETAIL, selector: t('invoice-print-toolbar'),
      title: 'Paying online',
      say: 'That link opens the customer portal. There they can pay by card through your card processor, or by bank transfer if you’ve turned it on. A card payment marks the invoice paid by itself.',
    },
    {
      id: 'send-reminders', chapter: 'send', route: DETAIL,
      title: 'Reminders',
      say: 'If it isn’t paid, reminders follow it up. In Templates and Forms, the Payment reminder moment is set for 7 and 30 days after the due date. And on the Money desk, every late invoice has a Remind button that sends one with a pay link.',
    },

    // ---------- Receive payment ----------
    {
      id: 'receive-open', chapter: 'receive', route: DETAIL, open: 'invoice:preview', selector: RECEIVE_BUTTON,
      wait: { appear: t('receive-payment') }, doIt: RECEIVE_BUTTON,
      yourTurn: 'Click Receive payment.',
      title: 'Receive payment',
      say: 'Receive payment is the full payment window, and it’s here while there’s a balance. Click it. We’ll look at every part and close it without recording anything.',
    },
    {
      id: 'receive-head', chapter: 'receive', selector: t('receive-payment-head'),
      title: 'One customer',
      say: 'A payment belongs to one customer, named under the title. If they’re on NET terms, a blue note warns that only your cash-flow managers can record their payments.',
    },
    {
      id: 'receive-invoices', chapter: 'receive', selector: t('receive-payment-invoices'),
      title: 'Apply payment to',
      say: 'Apply payment to lists every invoice this customer still owes on. Opened from an invoice, only that one is ticked, at its full balance.',
    },
    {
      id: 'receive-split', chapter: 'receive', selector: t('receive-payment-invoices'),
      title: 'One check, several invoices',
      say: 'One check for several invoices? Tick each one it covers. Change any amount to pay part of an invoice. The subtotal adds up as you go.',
    },
    {
      id: 'receive-tip', chapter: 'receive', selector: t('receive-payment-tip'),
      title: 'Tip',
      say: 'A tip goes to a tech. Type an amount and it asks which tech earned it.',
    },
    {
      id: 'receive-credit', chapter: 'receive', selector: t('receive-payment-credit'),
      title: 'Customer credit',
      say: 'Customer credit is for money left over, like an overpayment, or a deposit before there’s an invoice. It waits on their account and applies to their next invoice.',
    },
    {
      id: 'receive-method', chapter: 'receive', selector: t('receive-payment-method'),
      title: 'Method',
      say: 'Method is how they paid, from your payment types. Card via Stripe charges the card now in a new tab, and Card on Smart Terminal sends it to your GoDaddy terminal when you have one. Every other method records money you already have.',
    },
    {
      id: 'receive-reference', chapter: 'receive', selector: t('receive-payment-reference'), hold: true,
      yourTurn: 'Type a pretend check number, then press Next.',
      title: 'Check number or reference',
      say: 'For a check, the check number is required. For anything else, a reference like the last four of a card is optional. Try typing a check number.',
    },
    {
      id: 'receive-notes', chapter: 'receive', selector: t('receive-payment-notes'),
      title: 'Notes',
      say: 'Notes are for your team, if you want to add one.',
    },
    {
      id: 'receive-total', chapter: 'receive', selector: t('receive-payment-total'),
      title: 'Total received',
      say: 'The totals add it all up: what goes on invoices, the tip, and the credit. Total received is what the customer handed over.',
    },
    {
      id: 'receive-record', chapter: 'receive', selector: t('receive-payment-record'),
      title: 'Record payment',
      say: 'Record payment saves it, and the invoices update. When a tech records one, it waits until the office counts it in on the Cash register. That’s a real payment, so we’ll leave it.',
    },
    {
      id: 'receive-cancel', chapter: 'receive', selector: t('receive-payment-cancel'),
      wait: { gone: t('receive-payment') }, doIt: t('receive-payment-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Cancel closes it without recording anything.',
    },
    {
      id: 'receive-close', chapter: 'receive', route: DETAIL, selector: CLOSE_PREVIEW,
      wait: { gone: t('invoice-print-toolbar') }, doIt: CLOSE_PREVIEW,
      yourTurn: 'Close the invoice view.',
      title: 'Close the invoice view',
      say: 'Now close the invoice view to get back to the page.',
    },

    // ---------- Partials, voids and fixes ----------
    {
      id: 'paid-mark', click: ACCOUNT, chapter: 'paid', route: DETAIL, open: 'invoice:open', selector: t('invoice-mark-paid'),
      wait: { appear: t('take-payment') }, doIt: t('invoice-mark-paid'),
      yourTurn: 'Click Mark paid…',
      title: 'Mark paid',
      say: 'Mark paid is the quick way to take one payment on this one invoice. The Take payment button on the list opens the same window. Click Mark paid.',
    },
    {
      id: 'paid-amount', chapter: 'paid', selector: t('take-payment-amount'), hold: true,
      yourTurn: 'Change the amount to less than the balance, then press Next.',
      title: 'Amount received',
      say: 'Amount received starts at the full balance. Change it to a smaller number, and it becomes a part payment.',
    },
    {
      id: 'paid-partial', chapter: 'paid', selector: t('take-payment-amount'),
      title: 'Part payments',
      say: 'A part payment leaves the rest owing. The invoice stays open, shows Partial on the list, and the balance drops by what you took. Take the rest the same way when it comes.',
    },
    {
      id: 'paid-method', chapter: 'paid', selector: t('take-payment-method'),
      title: 'Payment method',
      say: 'Pick how they paid: cash, check, card, bank transfer, Stripe, or other.',
    },
    {
      id: 'paid-reference', chapter: 'paid', selector: t('take-payment-reference'),
      title: 'Reference',
      say: 'Add a check number or transaction ID, if you have one.',
    },
    {
      id: 'paid-date', chapter: 'paid', selector: t('take-payment-date'),
      title: 'Date received',
      say: 'Date received starts at today. Change it if the money came in earlier.',
    },
    {
      id: 'paid-save', chapter: 'paid', selector: t('take-payment-save'),
      title: 'Save payment',
      say: 'Save payment records it. We’ll leave it this time.',
    },
    {
      id: 'paid-cancel', chapter: 'paid', selector: t('take-payment-cancel'),
      wait: { gone: t('take-payment') }, doIt: t('take-payment-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Cancel closes it, and nothing is recorded.',
    },
    {
      id: 'paid-terminal', chapter: 'paid', route: DETAIL, selector: t('invoice-terminal'),
      title: 'Charge on terminal',
      say: 'With a GoDaddy Smart Terminal set up, this sends the balance to the terminal for the customer to tap, and waits until it goes through.',
    },
    {
      id: 'paid-void', chapter: 'paid', route: DETAIL, selector: t('invoice-cancel'),
      title: 'Cancel invoice',
      say: 'Cancel invoice is how you void one. It asks first, and it can’t be undone. After that it can’t be sent or paid, and the list shows it as Void. We won’t press it.',
    },
    {
      id: 'paid-delete', chapter: 'paid', route: DETAIL, selector: t('invoice-delete'),
      title: 'Delete draft',
      say: 'A draft made by mistake can be deleted instead. Once an invoice is sent, cancelling is the way out.',
    },
    {
      id: 'paid-undo', chapter: 'paid', route: DETAIL,
      title: 'Took a payment by mistake?',
      say: 'Recorded a payment by mistake? Payments are voided or refunded on the Cash register’s detailed payments screen. A voided payment puts the balance back on the invoice, so you can collect it again.',
    },
    {
      id: 'paid-apply-credit', chapter: 'paid', route: DETAIL,
      title: 'Using a credit',
      say: 'And when a customer has credit waiting, open their account and go to Records, then Invoices. Available credits has Apply to invoice, which uses it up against something they owe.',
    },

    // ---------- Customer credits ----------
    {
      id: 'credits-header', chapter: 'credits', route: CREDITS, open: 'goto:/accounting/customer-credits',
      selector: t('credits-header'),
      title: 'Customer credits',
      say: 'Customer credits is money that belongs to your customers: overpayments and down payments. This page is for reading. You use a credit from the customer’s account.',
    },
    {
      id: 'credits-filters', chapter: 'credits', route: CREDITS, selector: t('credits-filters'),
      title: 'Find a credit',
      say: 'Search by customer, job or payment reference, and set the dates and status. It starts on Open credits from the last two years. Download PDF and Download spreadsheet give you the whole register.',
    },
    {
      id: 'credits-totals', chapter: 'credits', route: CREDITS, selector: t('credits-totals'),
      title: 'Totals',
      say: 'How many credits there are, their original amount, what’s been applied, what was refunded, and the balance still waiting.',
    },
    {
      id: 'credits-table', chapter: 'credits', route: CREDITS, selector: t('credits-table'),
      title: 'The register',
      say: 'One row per credit, with where it came from and what’s left. Click a customer’s name to open their account and apply it.',
    },

    // ---------- Terms, types and cards ----------
    {
      id: 'terms-header', chapter: 'settings', route: TERMS, open: 'goto:/tool-shed/payment-terms',
      selector: t('payment-terms-header'),
      title: 'Payment terms',
      say: 'Payment terms decide how long a customer has to pay. Each customer can have their own, and the starred one is the default for new customers.',
    },
    {
      id: 'terms-seed', chapter: 'settings', route: TERMS, selector: t('payment-terms-seed'),
      title: 'A quick start',
      say: 'No terms yet? Add common terms adds COD, NET 14, NET 30 and NET 60 in one click.',
    },
    {
      id: 'terms-summary', chapter: 'settings', route: TERMS, selector: t('payment-terms-summary'),
      title: 'Your default',
      say: 'These cards show your default for new customers, and how many terms are active.',
    },
    {
      id: 'terms-table', chapter: 'settings', route: TERMS, selector: t('payment-terms-table'),
      title: 'Your terms',
      say: 'Each term has a name and the days until it’s due. Zero days reads Due on receipt. Edit and Delete are on the right.',
    },
    {
      id: 'terms-star', chapter: 'settings', route: TERMS, selector: t('payment-term-star'),
      title: 'The default star',
      say: 'Click a star to make that term the default. Click the filled star again to clear it.',
    },
    {
      id: 'terms-net', chapter: 'settings', route: TERMS, selector: t('payment-terms-table'),
      title: 'NET accounts',
      say: 'Worth knowing: a customer on a term with any days, like NET 30, becomes a NET account, and only your cash-flow managers can record their payments.',
    },
    {
      id: 'terms-new', chapter: 'settings', route: TERMS, selector: t('payment-terms-new-button'),
      wait: { appear: t('payment-term-form-name') }, doIt: t('payment-terms-new-button'),
      yourTurn: 'Click New term.',
      title: 'New term',
      say: 'Let’s look at a new one. Click New term.',
    },
    {
      id: 'terms-name', chapter: 'settings', route: TERMS, selector: t('payment-term-form-name'), hold: true,
      yourTurn: 'Type a name, like NET 45, then press Next.',
      title: 'Name',
      say: 'Name it the way you’ll pick it on a customer, like NET 45.',
    },
    {
      id: 'terms-days', chapter: 'settings', route: TERMS, selector: t('payment-term-form-days'),
      title: 'Days until due',
      say: 'Days until due, anywhere from 0 to 365. Zero means COD, due on receipt.',
    },
    {
      id: 'terms-description', chapter: 'settings', route: TERMS, selector: t('payment-term-form-description'),
      title: 'Description',
      say: 'A description is optional, a note for your team.',
    },
    {
      id: 'terms-active', chapter: 'settings', route: TERMS, selector: t('payment-term-form-active'),
      title: 'Active',
      say: 'Untick Active to retire a term without deleting it.',
    },
    {
      id: 'terms-save', chapter: 'settings', route: TERMS, selector: t('payment-term-form-save'),
      title: 'Save',
      say: 'Save adds it. We’ll leave it this time.',
    },
    {
      id: 'terms-cancel', chapter: 'settings', route: TERMS, selector: t('payment-term-form-cancel'),
      wait: { gone: t('payment-term-form-name') }, doIt: t('payment-term-form-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Cancel closes it without adding anything.',
    },
    {
      id: 'types-header', chapter: 'settings', route: TYPES, open: 'goto:/tool-shed/payment-types',
      selector: t('payment-types-header'),
      title: 'Payment types',
      say: 'Next door is Payment types: the choices in the payment forms, on the web and in the crew app.',
    },
    {
      id: 'types-builtin', chapter: 'settings', route: TYPES, selector: t('payment-types-builtin'),
      title: 'Built-in types',
      say: 'Switch off the built-in types you never take, so nobody picks them by accident.',
    },
    {
      id: 'types-custom', chapter: 'settings', route: TYPES, selector: t('payment-types-custom'),
      title: 'Your own types',
      say: 'Add your own, like Zelle or Venmo. These are just labels for money you record by hand. Save changes keeps them.',
    },
    {
      id: 'payments-header', chapter: 'settings', route: PAYMENTS, open: 'goto:/tool-shed/payments',
      selector: t('payments-header'),
      title: 'Card processor and bank transfers',
      say: 'Payments is where you connect a card processor and bank transfers. The money goes straight to you. CrewBarn never holds it.',
    },
    {
      id: 'payments-sections', chapter: 'settings', route: PAYMENTS, selector: t('payments-sections'),
      title: 'Four ways in',
      say: 'Stripe and GoDaddy Payments take cards, in the portal and from the office. Bank transfers lets customers pay you bank to bank from the portal. And Watch your bank matches deposits to invoices on its own.',
    },

    // ---------- Where it shows up ----------
    {
      id: 'used-desk', chapter: 'used', route: DESK, open: 'goto:/accounting', selector: t('money-desk-header'),
      title: 'The Money desk',
      say: 'This is the Money desk, your daily to-do list for money. Invoices feed most of it.',
    },
    {
      id: 'used-bill', chapter: 'used', route: DESK, selector: t('money-desk-bill'),
      title: 'Finished but not billed',
      say: 'Finished but not billed lists draft invoices for work that’s done. Send them from right here.',
    },
    {
      id: 'used-late', chapter: 'used', route: DESK, selector: t('money-desk-late'),
      title: 'Late',
      say: 'Late lists sent invoices that are past due. Remind sends the customer a reminder with a pay link.',
    },
    {
      id: 'used-match', chapter: 'used', route: DESK, selector: t('money-desk-match'),
      title: 'Bank deposits to match',
      say: 'Bank deposits to match is money that landed in your bank. Matching one to an invoice records the payment on it.',
    },
    {
      id: 'used-customer', chapter: 'used', route: DESK,
      title: 'On the customer’s account',
      say: 'On a customer’s account, the money strip shows total billed, lifetime paid, balance due and open invoices. Records, then Invoices, lists their invoices, with Receive payment, New invoice, and their statement.',
    },
    {
      id: 'used-job', chapter: 'used', route: DESK,
      title: 'On the job',
      say: 'On a job, View invoice opens its invoice over the job, and Receive payment collects from there. Before it’s invoiced, the button says Take down payment, and that deposit applies to the invoice once it’s made.',
    },
    {
      id: 'used-reports', chapter: 'used', route: DESK,
      title: 'Reports',
      say: 'In Reports, Who owes me money? shows every open balance and how late it is, alongside the invoice reports.',
    },
    {
      id: 'used-more', chapter: 'used', route: DESK,
      title: 'Tax and card charges',
      say: 'The tax on your invoices feeds Sales tax. And card charges from your processor land in Card processor, where any it didn’t recognise can be matched to an invoice.',
    },
    {
      id: 'used-done', chapter: 'used', route: DESK,
      title: 'That’s the lot',
      say: 'That’s getting paid, start to finish. You can take this tutorial again any time from the button at the top of the page.',
    },
  ],
}
