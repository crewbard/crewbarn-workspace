import type { TutorialData } from './types'

/**
 * Accounting: the Money desk, cash from the truck to the bank, payments and
 * card transactions, money out, bank matching, the books, sales tax and
 * reports, exports, and where it all shows up.
 *
 * Import-free (types aside) so the voice exporter can load it on its own.
 * The walk never posts, records, voids, refunds, matches, closes, exports or
 * saves: panels are opened, looked at and closed with their own Cancel or
 * Close, and inline forms are left unsaved.
 */

const t = (id: string) => `[data-tour=${JSON.stringify(id)}]`

const DESK = '^/accounting/?$'
const REGISTER = '^/accounting/cash-drawer/?$'
const CLASSIC = '^/accounting/cash-drawer/classic/?$'
const CARDS = '^/accounting/card-processor/?$'
const EXP = '^/accounting/expenses/?$'
const EXP_REG = '^/accounting/expenses/register/?$'
const BILLS = '^/accounting/expenses/bills/?$'
const VENDORS = '^/vendors/?$'
const SUBS = '^/sub-payouts/?$'
const BANK = '^/accounting/bank-match/?$'
const BANK_REVIEW = '^/accounting/bank-match/review/?$'
const OVERVIEW = '^/accounting/overview/?$'
const LEDGER = '^/accounting/ledger/?$'
const TAX = '^/accounting/sales-tax/?$'
const REPORTS = '^/accounting/reports/?$'
const BROWSE = '^/accounting/reports/browse/?$'
const SYNC = '^/accounting/sync-mappings/?$'

const DIALOG = '[aria-label="Sales tax detail"]'

export const TUTORIAL: TutorialData = {
  id: 'accounting',
  kicker: 'Accounting · tutorial',
  title: 'Accounting, start to finish',
  film: [
    {
      id: 'desk',
      label: 'The Money desk',
      title: 'One desk for everything that needs you',
      narration:
        'Welcome to Accounting. It opens on the Money desk, a to-do list rather than a report. Cash to check in, invoices nobody sent, late payers, receipts to approve and bank deposits to match all wait here, and you clear them top to bottom.',
    },
    {
      id: 'custody',
      label: 'Cash and checks',
      title: 'Cash has a chain of custody',
      narration:
        'Cash and checks move in steps. A tech collects them, the office counts them in, and they sit in the office drawer until someone takes them to the bank as one numbered deposit. At every step you can see who is holding what.',
    },
    {
      id: 'cards',
      label: 'Card payments',
      title: 'Card money matches itself',
      narration:
        'Card payments come in from your processor and most of them find their invoice on their own. The few that don’t wait in a short list until you attach them to an invoice, or say they aren’t yours.',
    },
    {
      id: 'out',
      label: 'Money out',
      title: 'Receipts, bills and what you owe',
      narration:
        'Money going out is tracked too. Techs’ receipts are approved and paid back, vendor bills wait with their due dates until you pay them, and you can always see what you owe and how late it is.',
    },
    {
      id: 'bank',
      label: 'Bank match',
      title: 'Does the bank agree?',
      narration:
        'Bring in your bank statement and CrewBarn suggests what each line is: a payment, a bill, an expense. Match them, enter the statement’s ending balance, and when the difference is zero the month is reconciled.',
    },
    {
      id: 'books',
      label: 'The books',
      title: 'Every dollar lands in the books',
      narration:
        'Behind the scenes, every invoice, payment, expense and payroll run posts a balanced journal entry. That gives you a real ledger, an income statement and a balance sheet. When a month is reviewed, you close it so nothing changes it later.',
    },
    {
      id: 'answers',
      label: 'Reports',
      title: 'Ask a question, get the answer',
      narration:
        'Reports start from questions, like who owes me money, or how much sales tax do I owe. The answer comes first, the table is underneath, and anything can go out as a PDF or a spreadsheet for your accountant.',
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
    { key: 'desk', label: 'The Money desk' },
    { key: 'cash', label: 'Cash register and drawer' },
    { key: 'payments', label: 'Payments and card transactions' },
    { key: 'spending', label: 'Money out' },
    { key: 'bank', label: 'Bank match' },
    { key: 'books', label: 'Overview and the ledger' },
    { key: 'reports', label: 'Sales tax and reports' },
    { key: 'sync', label: 'Exports and sync mappings' },
    { key: 'used', label: 'Where it shows up' },
  ],
  steps: [
    // ---------- The Money desk ----------
    {
      id: 'desk-tools', chapter: 'desk', route: DESK, open: 'goto:/accounting', selector: t('accounting-tools'),
      title: 'Accounting tools',
      say: 'Accounting opens on the Money desk. At the top, Accounting tools lists every money page in three groups, so nothing is more than a click away. You only see the pages your role allows.',
    },
    {
      id: 'desk-tools-collect', chapter: 'desk', route: DESK, selector: t('accounting-tools-collect'),
      title: 'Collect money',
      say: 'Collect money is everything coming in: Invoices, Cash register, Payments, voids and refunds, Customer credits, and Card transactions.',
    },
    {
      id: 'desk-tools-spend', chapter: 'desk', route: DESK, selector: t('accounting-tools-spend'),
      title: 'Spending and payroll',
      say: 'Spending and payroll is everything going out: expenses, vendor bills, payroll, inventory cost, purchase orders, vendors, and subcontractor payouts.',
    },
    {
      id: 'desk-tools-reconcile', chapter: 'desk', route: DESK, selector: t('accounting-tools-reconcile'),
      title: 'Reconcile and report',
      say: 'Reconcile and report is for checking and closing the books: the Financial overview, Bank match, the General ledger, Sales tax, sync mappings, and Reports.',
    },
    {
      id: 'desk-subnav', chapter: 'desk', route: DESK, selector: `[data-easy-section-tabs], ${t('subnav')}`,
      title: 'The bar along the top',
      say: 'The bar along the top of every Accounting page gets you around too. Depending on your layout it shows every section as a tab, or the main few with the rest under More.',
    },
    {
      id: 'desk-header', chapter: 'desk', route: DESK, selector: t('money-desk-header'),
      title: 'The Money desk',
      say: 'The Money desk itself is a to-do list, not a report. The line under the title counts the things that need you. Anything you only want to look at lives in Reports.',
    },
    {
      id: 'desk-period', chapter: 'desk', route: DESK, selector: t('money-desk-period'),
      title: 'Covering',
      say: 'Covering sets the window for the money totals: Today, This week, This month, Quarter or Custom. It starts on This month, and a week starts on Monday.',
    },
    {
      id: 'desk-dates', chapter: 'desk', route: DESK, selector: t('money-desk-period'), hold: true,
      yourTurn: 'Pick a different window, then press Next.',
      title: 'Try another window',
      say: 'The two dates underneath always show the exact window, and typing a date switches it to Custom. Pick another window. It only changes what you’re looking at.',
    },
    {
      id: 'desk-progress', chapter: 'desk', route: DESK, selector: t('money-desk-progress'),
      title: 'Cleared this visit',
      say: 'Cleared this visit counts what you’ve worked through since you opened the page, and the bar fills as you go. Next to it is money in and money out for your window, and the net. Money in is payments taken, and money out is expenses.',
    },
    {
      id: 'desk-groups', chapter: 'desk', route: DESK, selector: t('money-desk-groups'),
      title: 'The queues',
      say: 'Below are the queues. They ignore the window on purpose, so an invoice that’s ninety days late still shows on Today. Each queue has Select all and a button to clear what you tick, and every action asks you first. We won’t press any of them today.',
    },
    {
      id: 'desk-in', chapter: 'desk', route: DESK, selector: t('money-desk-in'),
      title: 'Money in hand',
      say: 'Money in hand is cash and checks your techs collected. Check in marks them received, so the books match the bag. To count a whole till first, use the Cash register.',
    },
    {
      id: 'desk-bill', chapter: 'desk', route: DESK, selector: t('money-desk-bill'),
      title: 'Finished but not billed',
      say: 'Finished but not billed is draft invoices with a total that were never sent. Send emails each one to the customer.',
    },
    {
      id: 'desk-late', chapter: 'desk', route: DESK, selector: t('money-desk-late'),
      title: 'Late',
      say: 'Late is invoices that were sent, are past due and aren’t paid, with how many days late. Remind sends another email with a link to pay.',
    },
    {
      id: 'desk-approve', chapter: 'desk', route: DESK, selector: t('money-desk-approve'),
      title: 'Spending to approve',
      say: 'Spending to approve is receipts your techs turned in to be paid back. Approve here does the same as approving in the Expense register or in Payroll.',
    },
    {
      id: 'desk-match', chapter: 'desk', route: DESK, selector: t('money-desk-match'),
      title: 'Bank deposits to match',
      say: 'Bank deposits to match is money that landed in the bank, with CrewBarn’s guess at which payments it was. Review opens bank matching, because deciding what a deposit covers is your call.',
    },

    // ---------- Cash register and drawer ----------
    {
      id: 'reg-header', chapter: 'cash', route: REGISTER, open: 'goto:/accounting/cash-drawer', selector: t('register-header'),
      title: 'Cash register',
      say: 'The Cash register is everything physical, before it reaches the bank. The amount at the top right is what’s been collected and not yet checked in.',
    },
    {
      id: 'reg-views', chapter: 'cash', route: REGISTER, selector: t('register-views'),
      title: 'Three piles',
      say: 'There are three views for three piles of money. Tech tills is what’s still out in the trucks. Office drawer is what the office is holding. Work done, no money is finished jobs where nothing was collected.',
    },
    {
      id: 'reg-tills', chapter: 'cash', route: REGISTER, click: t('register-view-tills'), selector: t('register-tills'),
      title: 'Tech tills',
      say: 'Tech tills has a card for each person holding money, with cash and checks split out and every payment listed. To take a till in, type what you actually counted. Take it in warns you if it’s short or over, then marks each payment received.',
    },
    {
      id: 'reg-drawer', chapter: 'cash', route: REGISTER, selector: t('register-view-drawer'),
      wait: { appear: t('register-drawer') }, doIt: t('register-view-drawer'),
      yourTurn: 'Click Office drawer.',
      title: 'Office drawer',
      say: 'Next, what the office is holding. Click Office drawer.',
    },
    {
      id: 'drawer-total', chapter: 'cash', route: REGISTER, click: t('register-view-drawer'), selector: t('drawer-total'),
      title: 'In the drawer right now',
      say: 'In the drawer right now: the total, how many items, how long the oldest has been sitting, and cash and checks on their own. If anything has sat more than sixty days, a note above offers to file it as already banked.',
    },
    {
      id: 'drawer-add', chapter: 'cash', route: REGISTER, click: t('register-view-drawer'), selector: t('drawer-add'),
      title: 'How money gets here',
      say: 'Money gets here two ways: a till counted in, or something the office takes itself, like a check in the mail. For that one, Take a payment on an invoice opens Invoices. Card and bank payments never touch the drawer.',
    },
    {
      id: 'drawer-waiting', chapter: 'cash', route: REGISTER, click: t('register-view-drawer'), selector: t('drawer-waiting'),
      title: 'Waiting to be deposited',
      say: 'Each item is marked JOB if it came off a truck, or OFFICE if it came in here, with how long it’s been held. Tick what you’re taking to the bank, and a Deposit button adds it up. We won’t record one.',
    },
    {
      id: 'drawer-deposits', chapter: 'cash', route: REGISTER, click: t('register-view-drawer'), selector: t('drawer-deposits'),
      title: 'Deposits',
      say: 'Each deposit gets a number and shows as a single line on your bank statement, which is what makes matching possible later. Undo puts its items back in the drawer if the slip was wrong. Nothing is deleted.',
    },
    {
      id: 'reg-uncollected', chapter: 'cash', route: REGISTER, selector: t('register-view-uncollected'),
      wait: { appear: t('register-uncollected') }, doIt: t('register-view-uncollected'),
      yourTurn: 'Click Work done, no money.',
      title: 'Work done, no money',
      say: 'The third view catches money nobody would notice. Click Work done, no money.',
    },
    {
      id: 'unc-list', chapter: 'cash', route: REGISTER, click: t('register-view-uncollected'), selector: t('register-uncollected'),
      title: 'Finished, nothing collected',
      say: 'These are cash-on-delivery jobs that closed with no money in. One that was never invoiced isn’t overdue, so it shows up nowhere else. Invoice it or Open invoice takes you there, and a red Blocking tag means a tech can’t start their next job until it’s settled from Dispatch.',
    },
    {
      id: 'reg-classic', chapter: 'cash', route: REGISTER, selector: t('register-classic'),
      title: 'Voids and refunds',
      say: 'Need to void or refund a payment, fix how it was taken, or handle a dispute? The link under the title opens Payments, voids and refunds. That’s next.',
    },

    // ---------- Payments and card transactions ----------
    {
      id: 'pay-header', chapter: 'payments', route: CLASSIC, open: 'goto:/accounting/cash-drawer/classic', selector: t('classic-drawer-header'),
      title: 'Payments, voids and refunds',
      say: 'This is the detailed record of every payment, and where you fix a single one: void it, refund it, or correct how it was taken.',
    },
    {
      id: 'pay-summary', chapter: 'payments', route: CLASSIC, selector: t('classic-drawer-summary'),
      title: 'The totals',
      say: 'Up top: what you’re owed, what’s been received, what was voided, how many invoices are paid and unpaid, and last month’s sales tax. These add up what’s loaded here. Reports give the full picture.',
    },
    {
      id: 'pay-charts', chapter: 'payments', route: CLASSIC, selector: t('classic-drawer-charts'),
      title: 'Aging and payment types',
      say: 'Receivables aging shows unpaid balances by how late they are, from Current to more than ninety days. Next to it is what you’ve received, by payment type.',
    },
    {
      id: 'pay-register', chapter: 'payments', route: CLASSIC, selector: t('classic-drawer-register'),
      title: 'Tech cash register',
      say: 'The Tech cash register adds it up by who collected it: cash, checks, cards, the net after fees, what they’re still holding, and open net-term balances from their jobs, which the office collects.',
    },
    {
      id: 'pay-tabs', chapter: 'payments', route: CLASSIC, selector: t('classic-drawer-tabs'),
      title: 'Which payments',
      say: 'The tabs pick which payments you see: Pending turnover, Received, Voided, Disputed, and All transactions. Disputed is where card chargebacks show up, marked open, won or lost.',
    },
    {
      id: 'pay-all', chapter: 'payments', route: CLASSIC, selector: t('classic-tab-all'),
      wait: { click: true }, doIt: t('classic-tab-all'),
      yourTurn: 'Click All transactions.',
      title: 'All transactions',
      say: 'Click All transactions to see every payment.',
    },
    {
      id: 'pay-card', chapter: 'payments', route: CLASSIC, click: t('classic-tab-all'), selector: t('payment-card'),
      title: 'One payment',
      say: 'Each payment shows its status and method, the customer, who collected it and when, the check number or card transaction, the fee and the net, and which invoices it paid. One waiting for turnover has a button to verify the cash or check was received.',
    },
    {
      id: 'pay-method', chapter: 'payments', route: CLASSIC, click: t('classic-tab-all'), selector: t('payment-method-change'),
      title: 'Change the method',
      say: 'change, next to the method, corrects how a payment was taken, so it lands in the right column. Card payments that went through your processor keep theirs.',
    },
    {
      id: 'pay-reverse', chapter: 'payments', route: CLASSIC, click: t('classic-tab-all'), selector: t('payment-reverse'),
      wait: { appear: t('payment-reverse-panel') }, doIt: t('payment-reverse'),
      yourTurn: 'Click Void or Refund on any payment.',
      title: 'Undoing a payment',
      say: 'Let’s see how a payment is undone, without doing it. Click Void, or Refund to card, on any payment.',
    },
    {
      id: 'pay-panel', chapter: 'payments', route: CLASSIC, selector: t('payment-reverse-panel'),
      title: 'Void or refund',
      say: 'Void takes the payment back off the invoice it paid, and off any credit it made. A card payment through your processor is refunded instead, which sends the money back to the card and can’t be undone. Either way, give a reason.',
    },
    {
      id: 'pay-cancel', chapter: 'payments', route: CLASSIC, selector: t('payment-reverse-cancel'),
      wait: { gone: t('payment-reverse-panel') }, doIt: t('payment-reverse-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Confirm would do it, and we’ll leave it. Press Cancel.',
    },
    {
      id: 'cards-header', chapter: 'payments', route: CARDS, open: 'goto:/accounting/card-processor', selector: t('processor-header'),
      title: 'Card transactions',
      say: 'Card transactions lists every card charge on your GoDaddy Payments account. Most match themselves. It syncs every hour, and Sync now gets the latest.',
    },
    {
      id: 'cards-states', chapter: 'payments', route: CARDS, selector: t('processor-states'),
      title: 'The counts are the filter',
      say: 'Needs matching, Matched, Refunds and voids, and Ignored. Each row shows when, the amount and any tip, the card, the type, and where it came from.',
    },
    {
      id: 'cards-match', chapter: 'payments', route: CARDS, click: t('processor-state-unmatched'), selector: t('processor-match-open'),
      wait: { appear: t('processor-match') }, doIt: t('processor-match-open'),
      yourTurn: 'Click Match… on any row.',
      title: 'Match one',
      say: 'Needs matching is money that went through GoDaddy without CrewBarn seeing it, like a tap in their own app. Click Match… on a row.',
    },
    {
      id: 'cards-panel', chapter: 'payments', route: CARDS, selector: t('processor-match'),
      title: 'Attach it or ignore it',
      say: 'Attach it to an open invoice. Exact amounts are flagged, or search by invoice number or customer. If the card paid more than the invoice, pick whether the extra is customer credit or a tip. Or ignore it with a reason, and bring it back later. Both ask before they do anything.',
    },
    {
      id: 'cards-close', chapter: 'payments', route: CARDS, selector: t('processor-match-open'),
      wait: { gone: t('processor-match') }, doIt: t('processor-match-open'),
      yourTurn: 'Click Close.',
      title: 'Close it',
      say: 'Press Close to put it away.',
    },

    // ---------- Money out ----------
    {
      id: 'exp-header', chapter: 'spending', route: EXP, open: 'goto:/accounting/expenses', selector: t('expenses-header'),
      title: 'Expenses overview',
      say: 'The Expenses overview is money going out: bills, receipts, reimbursements and what you owe. From and To start on this month.',
    },
    {
      id: 'exp-metrics', chapter: 'spending', route: EXP, selector: t('expenses-metrics'),
      title: 'The numbers',
      say: 'How many expenses, the money out, what’s billable to jobs, reimbursements pending and approved, and what’s open on vendor bills.',
    },
    {
      id: 'exp-categories', chapter: 'spending', route: EXP, selector: t('expenses-categories'),
      title: 'Spend by category',
      say: 'Spend by category shows where the money went, biggest first. Expense report opens the full report.',
    },
    {
      id: 'exp-ap', chapter: 'spending', route: EXP, selector: t('expenses-ap'),
      title: 'AP aging',
      say: 'AP aging is your unpaid vendor bills, sorted by how overdue they are as of the To date. AP report opens it in full.',
    },
    {
      id: 'exp-reimb', chapter: 'spending', route: EXP, selector: t('expenses-reimb'),
      title: 'Reimbursements',
      say: 'Reimbursements groups tech receipts by where they stand. Review in payroll takes you to Payroll, where they’re paid back. The Your team tutorial covers Payroll and payroll profiles in depth.',
    },
    {
      id: 'exp-1099', chapter: 'spending', route: EXP, selector: t('expenses-1099'),
      title: '1099 readiness',
      say: '1099 readiness tracks what you’ve paid subcontractors this tax year, who needs a 1099, and who’s missing a W-9. Filing still goes through your accountant or 1099 provider.',
    },
    {
      id: 'exp-open-register', chapter: 'spending', route: EXP, selector: t('expenses-open-register'),
      wait: { route: EXP_REG }, doIt: t('expenses-open-register'),
      yourTurn: 'Click Open register.',
      title: 'Open the register',
      say: 'Every expense lives in the register. Click Open register.',
    },
    {
      id: 'expreg-header', chapter: 'spending', route: EXP_REG, open: 'goto:/accounting/expenses/register', selector: t('register-exp-header'),
      title: 'Expense register',
      say: 'The Expense register has a row for every expense: fuel, rent, job materials, tech receipts and overhead. The totals above the form add up the rows on this page.',
    },
    {
      id: 'expreg-add', chapter: 'spending', route: EXP_REG, selector: t('register-exp-add'),
      title: 'Add expense',
      say: 'Add expense is one quick line. The date starts as today, and a description and amount are what you have to fill in. Then the vendor, tax, how it was paid, and a receipt or PO number.',
    },
    {
      id: 'expreg-category', chapter: 'spending', route: EXP_REG, selector: t('register-exp-category'), hold: true,
      yourTurn: 'Open Category and pick one, then press Next.',
      title: 'Category',
      say: 'Category is what your reports group by: fuel, parts, tools, subcontractor, rent, insurance, software, vehicle, bank fee and more. Have a look. Nothing is saved until you press Save.',
    },
    {
      id: 'expreg-staff', chapter: 'spending', route: EXP_REG, selector: t('register-exp-staff'),
      title: 'Who spent it',
      say: 'Tech or staff says who spent it. Leave it on Company expense for overhead.',
    },
    {
      id: 'expreg-reimburse', chapter: 'spending', route: EXP_REG, selector: t('register-exp-reimburse'),
      title: 'Reimburse or bill',
      say: 'Reimburse tech means you owe that person back, so it waits for approval. Billable to job marks it as something to charge the customer for. Save would add it. We’ll leave it.',
    },
    {
      id: 'expreg-filters', chapter: 'spending', route: EXP_REG, selector: t('register-exp-filters'),
      title: 'Find and export',
      say: 'Filter by words, dates, category, status, vendor, person or reimbursement. Export visible downloads what’s on screen as a spreadsheet.',
    },
    {
      id: 'expreg-rows', chapter: 'spending', route: EXP_REG, selector: t('register-exp-rows'),
      title: 'Each expense',
      say: 'Each row shows the job, the vendor, receipt links, and a flag: Reimburse, Billable, or Overhead. A receipt waiting on you gets Approve or Reject, an approved one gets Mark reimbursed, and a paid one can be reversed with a reason.',
    },
    {
      id: 'bills-header', chapter: 'spending', route: BILLS, open: 'goto:/accounting/expenses/bills', selector: t('bills-header'),
      title: 'Vendor bills',
      say: 'Vendor bills tracks what you owe suppliers, when it’s due, and when it’s paid.',
    },
    {
      id: 'bills-summary', chapter: 'spending', route: BILLS, selector: t('bills-summary'),
      title: 'What you owe',
      say: 'How many bills are loaded, the open balance, what’s overdue, and what’s been paid. Further down you can search bills and filter them by status and date.',
    },
    {
      id: 'bills-add', chapter: 'spending', route: BILLS, selector: t('bills-add'),
      title: 'Add a bill',
      say: 'Pick a vendor from your list, or type a name. Then the bill number, bill date, due date, category, total, tax, terms like Net 30, and a memo. The bill date and total are required, and Save adds it.',
    },
    {
      id: 'bills-card', chapter: 'spending', route: BILLS, selector: t('bills-card'),
      title: 'One bill',
      say: 'Each bill shows the vendor, its dates, any purchase order it came from, and the total, what’s paid, and the balance.',
    },
    {
      id: 'bills-pay', chapter: 'spending', route: BILLS, selector: t('bills-pay'),
      title: 'Record a payment',
      say: 'While there’s a balance, type an amount, or leave it blank for the whole balance. Record payment asks first, then records a payment dated today. A bill can also be paid from Bank match when the withdrawal shows up.',
    },
    {
      id: 'vendors-header', chapter: 'spending', route: VENDORS, open: 'goto:/vendors', selector: t('vendors-header'),
      title: 'Vendors',
      say: 'Bills and purchase orders point at Vendors, your list of suppliers. Each one shows its phone, email, your account number with them, and whether it’s active.',
    },
    {
      id: 'vendors-new', chapter: 'spending', route: VENDORS, selector: t('vendors-header'),
      wait: { appear: t('vendors-form') }, doIt: 'newVendor',
      yourTurn: 'Click + New Vendor.',
      title: 'A new vendor',
      say: 'Click + New Vendor to see what goes in.',
    },
    {
      id: 'vendors-form', chapter: 'spending', route: VENDORS, selector: t('vendors-form'),
      title: 'Vendor details',
      say: 'Only the name is required. Display name changes what prints on purchase orders. Then contact details, the address, payment terms, your account number, currency and notes. Untick Active to put a vendor aside.',
    },
    {
      id: 'vendors-close', chapter: 'spending', route: VENDORS, selector: t('vendors-form'),
      wait: { gone: t('vendors-form') }, doIt: 'esc',
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Create vendor would save it. Press Cancel to close without adding anyone.',
    },
    {
      id: 'subs', chapter: 'spending', route: SUBS, open: 'goto:/sub-payouts', selector: t('sub-payouts-header'),
      title: 'Subcontractor payouts',
      say: 'Subcontractor payouts shows what you’ve paid your subs and what you still owe, in total, this month, by sub and by invoice. You approve their invoices and mark them paid on Sub reviews.',
    },
    {
      id: 'spend-elsewhere', chapter: 'spending',
      title: 'Covered elsewhere',
      say: 'Three more money-out pages have tutorials of their own. Payroll and Payroll profiles are in the Your team tutorial, and Inventory cost and Purchase orders are in the Inventory tutorial.',
    },

    // ---------- Bank match ----------
    {
      id: 'bank-header', chapter: 'bank', route: BANK, open: 'goto:/accounting/bank-match', selector: t('bank-ws-header'),
      title: 'Bank match',
      say: 'Bank match checks your books against your bank statement. You bring the statement in, and CrewBarn never asks for your bank login. From and To start on this month.',
    },
    {
      id: 'bank-account', chapter: 'bank', route: BANK, selector: t('bank-ws-account'),
      title: 'One account at a time',
      say: 'If you have more than one account, filter to one by its name or last four digits before you close out a statement.',
    },
    {
      id: 'bank-metrics', chapter: 'bank', route: BANK, selector: t('bank-ws-metrics'),
      title: 'Where it stands',
      say: 'How many bank rows, how many are matched and unmatched, the deposits, the withdrawals, and the net.',
    },
    {
      id: 'bank-unmatched', chapter: 'bank', route: BANK, selector: t('bank-ws-unmatched'),
      title: 'Rows needing review',
      say: 'These rows still need a decision: nothing matched yet, or only a suggestion. Match rows opens the review page.',
    },
    {
      id: 'bank-review', chapter: 'bank', route: BANK, selector: t('bank-ws-review'),
      title: 'Start statement review',
      say: 'This saves a statement window with the ending balance from your bank statement, so you can see any difference. Save review asks first. We’ll leave it.',
    },
    {
      id: 'bank-runs', chapter: 'bank', route: BANK, selector: t('bank-ws-runs'),
      title: 'Match status',
      say: 'Match status adds up the rows by where they stand. Below it, Recent reconciliation runs lists your saved reviews and their differences, and further down are recent deposits and withdrawals.',
    },
    {
      id: 'bank-open', chapter: 'bank', route: BANK, selector: t('bank-ws-open-review'),
      wait: { route: BANK_REVIEW }, doIt: t('bank-ws-open-review'),
      yourTurn: 'Click Open review.',
      title: 'Open review',
      say: 'The matching itself happens on the review page. Click Open review.',
    },
    {
      id: 'bankrev-header', chapter: 'bank', route: BANK_REVIEW, open: 'goto:/accounting/bank-match/review', selector: t('bank-review-header'),
      title: 'Review bank matches',
      say: 'Here you bring statement rows in, match each one, and then close the statement.',
    },
    {
      id: 'bankrev-csv', chapter: 'bank', route: BANK_REVIEW, selector: t('bank-review-csv'),
      title: 'Paste your statement',
      say: 'The quickest way in is to paste a CSV from your bank. It reads headers like Date, Description, Amount, Debit, Credit, Memo and Reference, up to a thousand rows. Above it, Add statement row adds one by hand: a positive amount for a deposit, a negative one for a withdrawal.',
    },
    {
      id: 'bankrev-filters', chapter: 'bank', route: BANK_REVIEW, selector: t('bank-review-filters'),
      title: 'Find rows',
      say: 'Filter by words, dates, status and type. It starts on Unmatched for this month. Export visible downloads what you see.',
    },
    {
      id: 'bankrev-row', chapter: 'bank', route: BANK_REVIEW, selector: t('bank-review-row'),
      title: 'One bank row',
      say: 'Each row shows its date, amount, status and type, and once it’s matched, what it’s matched to.',
    },
    {
      id: 'bankrev-suggestions', chapter: 'bank', route: BANK_REVIEW, selector: t('bank-review-suggestions'),
      title: 'Suggestions',
      say: 'Suggestions are CrewBarn’s guesses, with how sure it is: a payment, an expense, a vendor bill, a purchase order, or an invoice with no payment recorded yet. Clicking one asks first. Matching a bill or an invoice records the payment on it too.',
    },
    {
      id: 'bankrev-other', chapter: 'bank', route: BANK_REVIEW, selector: t('bank-review-suggestions'),
      title: 'No match?',
      say: 'No match? Ignore it, or Mark other for things like bank fees and transfers. A withdrawal can become an expense with Create expense, or be split across several with Split. Reset undoes a match.',
    },
    {
      id: 'bankrev-missing', chapter: 'bank', route: BANK_REVIEW, selector: t('bank-review-missing'),
      title: 'Payments not found in bank',
      say: 'This lists payments you received that no deposit has been matched to yet. Usually the deposit just hasn’t been brought in.',
    },
    {
      id: 'bankrev-recon', chapter: 'bank', route: BANK_REVIEW, selector: t('bank-review-recon'),
      title: 'Close the statement',
      say: 'When everything’s matched, save a reconciliation with the statement’s ending balance. Close only works when the difference is zero, and then that period is reconciled.',
    },

    // ---------- Overview and the ledger ----------
    {
      id: 'ov-root', chapter: 'books', route: OVERVIEW, open: 'goto:/accounting/overview', selector: t('accounting-root'),
      title: 'Financial overview',
      say: 'The Financial overview is the charts and totals: money in and out, what you’re owed, taxes, payroll and margin. Something to read, rather than work through.',
    },
    {
      id: 'ov-period', chapter: 'books', route: OVERVIEW, selector: t('accounting-period'),
      title: 'Pick the period',
      say: 'Pick Day, Week, Month, Quarter or Year, or a closed period from the list. Show grids adds tables under the charts, and Export reports opens the report workspace.',
    },
    {
      id: 'ov-metrics', chapter: 'books', route: OVERVIEW, selector: t('accounting-metrics'),
      title: 'The headline numbers',
      say: 'Money in, money out and net cash for the period, then everything you’re owed and what’s overdue.',
    },
    {
      id: 'ov-attention', chapter: 'books', route: OVERVIEW, selector: t('accounting-attention'),
      title: 'Needs attention',
      say: 'Needs attention is a short list: overdue invoices, field cash to check in, drafts to send, and missing W-9s, each with a button to go and deal with it.',
    },
    {
      id: 'ov-workflows', chapter: 'books', route: OVERVIEW, click: t('accounting-tab-close'), selector: t('accounting-workflows'),
      title: 'Close the books',
      say: 'The tabs group the money pages by job: Collect, Spend, Team pay, and Close the books, which lists card transactions, bank matching, the ledger, sales tax and sync mappings.',
    },
    {
      id: 'ov-charts', chapter: 'books', route: OVERVIEW, selector: t('accounting-charts'),
      title: 'Cash flow and books check',
      say: 'Cash flow compares money in and out over time. Books check shows net income, and whether the trial balance and balance sheet balance. Below are panels for the drawer, aging, payment methods, credits, sales tax and 1099s.',
    },
    {
      id: 'gl-header', chapter: 'books', route: LEDGER, open: 'goto:/accounting/ledger', selector: t('ledger-header'),
      title: 'General ledger',
      say: 'The General ledger is the books themselves. Invoices, payments, expenses and payroll all post here as journal entries. Add missing starter accounts fills in any standard accounts you don’t have, and leaves yours alone.',
    },
    {
      id: 'gl-filters', chapter: 'books', route: LEDGER, selector: t('ledger-filters'),
      title: 'Dates',
      say: 'From and To set the window for the income statement, cash flow, detail and journal entries. As of sets the day for the trial balance and balance sheet. Source narrows it to invoices, payments, payroll and so on.',
    },
    {
      id: 'gl-metrics', chapter: 'books', route: LEDGER, selector: t('ledger-metrics'),
      title: 'Does it balance?',
      say: 'Debits and credits, and whether they balance. Then net income, assets, the balance sheet check, and the change in cash.',
    },
    {
      id: 'gl-audit', chapter: 'books', route: LEDGER, selector: t('ledger-posting-audit'),
      title: 'Posting audit',
      say: 'Posting audit looks for anything that should have reached the books and didn’t: invoices, payments, expenses, bills, payroll, write-offs and refunds. Zero missing is what you want before month end.',
    },
    {
      id: 'gl-statements', chapter: 'books', route: LEDGER, selector: t('ledger-statements'),
      title: 'Your statements',
      say: 'Your income statement and balance sheet, then the trial balance your accountant asks for, each with PDF and spreadsheet downloads. Click an account to see every line behind it.',
    },
    {
      id: 'gl-journals', chapter: 'books', route: LEDGER, selector: t('ledger-journals'),
      title: 'Journal entries',
      say: 'Journal entries are the postings themselves. Above them, GL detail lists every line by account, source and status.',
    },
    {
      id: 'gl-manual', chapter: 'books', route: LEDGER, selector: t('ledger-manual-journal'),
      title: 'Manual journal entry',
      say: 'Manual journal entry is for opening balances, corrections and your bookkeeper’s adjustments. Pick an account for each line, a debit or a credit, and Post journal only lights up when both sides match.',
    },
    {
      id: 'gl-shortcuts', chapter: 'books', route: LEDGER, selector: t('ledger-year-end'),
      title: 'Common entries',
      say: 'Year-end close moves the year’s revenue and expenses into retained earnings, in one entry dated December thirty-first. Below it, Owner draw and Sales tax payment post those common entries without building them by hand.',
    },
    {
      id: 'gl-coa', chapter: 'books', route: LEDGER, selector: t('ledger-coa'),
      title: 'Chart of accounts',
      say: 'The chart of accounts lists every active account, with its code, its type, and its normal balance.',
    },
    {
      id: 'gl-periods', chapter: 'books', route: LEDGER, selector: t('ledger-periods'),
      title: 'Closing a month',
      say: 'Accounting periods are how you close the books. Close stops anything new posting into a reviewed month, and Lock holds it firmer. Reopen lets postings in again, so it warns you. Each one asks first, and we won’t press any.',
    },

    // ---------- Sales tax and reports ----------
    {
      id: 'tax-header', chapter: 'reports', route: TAX, open: 'goto:/accounting/sales-tax', selector: t('sales-tax-header'),
      title: 'Sales tax',
      say: 'The Sales tax report is the tax you collected for the state and local tax offices. It counts sent and paid invoices issued in the window.',
    },
    {
      id: 'tax-range', chapter: 'reports', route: TAX, selector: t('sales-tax-range'),
      title: 'The period',
      say: 'It opens on last month. The chips pick This month, Last month, This quarter, Last quarter, or Year to date, and Jump to picks any quarter, month or full year from the last few years.',
    },
    {
      id: 'tax-filing', chapter: 'reports', route: TAX, selector: t('sales-tax-filing'),
      title: 'Filed or not',
      say: 'This box says where the period stands: Not filed yet, Partly paid, Filed and paid, Overpaid, or Nothing due, with any payments recorded for it.',
    },
    {
      id: 'tax-payment', chapter: 'reports', route: TAX, selector: t('sales-tax-payment'),
      title: 'Record what you paid',
      say: 'After you pay the tax office, record it here with the date, the amount and a reference. Post payment writes it to the books and marks the period paid. We’ll leave it.',
    },
    {
      id: 'tax-review', chapter: 'reports', route: TAX, selector: t('sales-tax-review'),
      wait: { appear: DIALOG }, doIt: t('sales-tax-review'),
      yourTurn: 'Click Review report.',
      title: 'Review report',
      say: 'Review report shows every invoice behind the total, with the tax on each. Click it.',
    },
    {
      id: 'tax-review-close', chapter: 'reports', route: TAX, selector: DIALOG,
      wait: { gone: DIALOG }, doIt: `${DIALOG} [aria-label="Close"]`,
      yourTurn: 'Close it.',
      title: 'Every invoice',
      say: 'Download PDF and Spreadsheet are at the top, ready for filing. Close it when you’ve had a look.',
    },
    {
      id: 'tax-report', chapter: 'reports', route: TAX, selector: t('sales-tax-report'),
      title: 'The report',
      say: 'The report itself: gross sales, what was taxable and not, state and local tax, and each tax office with its rate and what you collected. It prints cleanly, too.',
    },
    {
      id: 'rq-header', chapter: 'reports', route: REPORTS, open: 'goto:/accounting/reports', selector: t('reports-front-header'),
      title: 'Reports',
      say: 'Reports asks what you want to know, so you don’t need to know a report’s name to find it.',
    },
    {
      id: 'rq-search', chapter: 'reports', route: REPORTS, selector: t('reports-search'), hold: true,
      yourTurn: 'Type a word like owe or tax, then press Next.',
      title: 'Ask',
      say: 'Search by a question or a report name. Try a word like owe, or tax. Reports you pin show up just below.',
    },
    {
      id: 'rq-questions', chapter: 'reports', route: REPORTS, selector: t('reports-groups'),
      title: 'The questions',
      say: 'Questions are grouped: money coming in, money going out, whether the work is profitable, and staying legal. The report names stay underneath each one.',
    },
    {
      id: 'rq-open', chapter: 'reports', route: REPORTS, selector: t('reports-question-card'),
      wait: { appear: t('report-overlay') }, doIt: t('reports-question-card'),
      yourTurn: 'Click any question.',
      title: 'Open one',
      say: 'Click any question.',
    },
    {
      id: 'rq-overlay', chapter: 'reports', route: REPORTS, selector: t('report-overlay'),
      title: 'The answer first',
      say: 'The answer comes first, and the table you’d export is below it. Change the dates, download a CSV or PDF, or Pin it to the front page.',
    },
    {
      id: 'rq-close', chapter: 'reports', route: REPORTS, selector: `${t('report-overlay')} [aria-label="Close"]`,
      wait: { gone: t('report-overlay') }, doIt: `${t('report-overlay')} [aria-label="Close"]`,
      yourTurn: 'Click the close button.',
      title: 'Back to the questions',
      say: 'Close it to get back to the questions.',
    },
    {
      id: 'rq-browse', chapter: 'reports', route: REPORTS, selector: t('reports-browse-link'),
      title: 'The full workspace',
      say: 'Need more filters? Open the full reports workspace, the same place Browse all reports goes.',
    },
    {
      id: 'br-list', chapter: 'reports', route: BROWSE, open: 'goto:/accounting/reports/browse?layout=browser', selector: t('reports-list'),
      title: 'Browse all reports',
      say: 'Pick a report on the left, like the invoice register, payment register, aging or expenses, and review it on the right. Each one has its own PDF and spreadsheet downloads.',
    },
    {
      id: 'br-saved', chapter: 'reports', route: BROWSE, selector: t('reports-saved-views'),
      title: 'Saved report views',
      say: 'A saved view keeps a report with its dates, filters, rows and layout. Save current view asks for a name.',
    },
    {
      id: 'br-controls', chapter: 'reports', route: BROWSE, selector: t('reports-controls'),
      title: 'Report controls',
      say: 'The dates, and the layout: Left menu, Balanced, Dense or Single column. Move mode lets you drag panels around, and Reset puts them back.',
    },
    {
      id: 'br-filters', chapter: 'reports', route: BROWSE, selector: t('reports-filters'),
      title: 'Filters and download',
      say: 'Filter by words, status, customer or tech, and pick how many rows to show. Filtered spreadsheet downloads every matching row. The guide below explains what the report is for.',
    },

    // ---------- Exports and sync mappings ----------
    {
      id: 'sync-header', chapter: 'sync', route: SYNC, open: 'goto:/accounting/sync-mappings', selector: t('sync-header'),
      title: 'Sync mappings',
      say: 'Sync mappings tell your exports what things are called in your accountant’s software, like which account is checking and which is sales tax.',
    },
    {
      id: 'sync-form', chapter: 'sync', route: SYNC, selector: t('sync-form'),
      title: 'Add mapping',
      say: 'Each mapping links one thing in CrewBarn to one thing outside it. They support exports. They don’t make QuickBooks or Xero the source of truth.',
    },
    {
      id: 'sync-provider', chapter: 'sync', route: SYNC, selector: t('sync-provider'), hold: true,
      yourTurn: 'Open Provider and look, then press Next.',
      title: 'Provider and type',
      say: 'Provider is where it’s going: Accountant export, QuickBooks, Xero or CSV. Type says what you’re mapping: an account, tax code, payment method, item, vendor, customer, class, location or tracking category.',
    },
    {
      id: 'sync-key', chapter: 'sync', route: SYNC, selector: t('sync-key'),
      title: 'The CrewBarn side',
      say: 'The CrewBarn key names your side, like cash colon 1000, tax colon state, or payment colon card.',
    },
    {
      id: 'sync-external', chapter: 'sync', route: SYNC, selector: t('sync-external'),
      title: 'The other side',
      say: 'Then their side: the name, code, or record ID it has over there. Save adds the mapping. We’ll leave it.',
    },
    {
      id: 'sync-xero', chapter: 'sync', route: SYNC, selector: t('sync-xero'),
      title: 'Xero journal export',
      say: 'Xero journal CSV downloads your posted journal entries for the dates you pick, using your Xero account codes wherever you’ve mapped them.',
    },
    {
      id: 'sync-list', chapter: 'sync', route: SYNC, selector: t('sync-filters'),
      title: 'Your mappings',
      say: 'Below are your mappings. Filter by provider, type or status, and Export CSV downloads them. Edit and Delete are on each row.',
    },
    {
      id: 'sync-qb', chapter: 'sync',
      title: 'Connecting QuickBooks',
      say: 'To connect QuickBooks Online itself, go to Tool Shed, then Connected apps. You sign in to QuickBooks, then bring customers, products and services, and invoices across, or push yours to it.',
    },

    // ---------- Where it shows up ----------
    {
      id: 'used-nav', chapter: 'used', route: DESK, open: 'goto:/accounting', selector: t('money-desk-header'),
      title: 'In the menu',
      say: 'In the menu, Money desk shows a number when payments are waiting to be checked in, so you know before you open it.',
    },
    {
      id: 'used-invoices', chapter: 'used',
      title: 'Invoices and credits',
      say: 'Invoices, the invoice page, Receive payment, customer credits and payment terms all feed these pages. The Getting paid tutorial covers them in depth.',
    },
    {
      id: 'used-jobs', chapter: 'used',
      title: 'On jobs',
      say: 'On a job, receipts your techs upload become expenses here, and a cash-on-delivery job that closes with nothing collected stops that tech starting the next one until it’s settled or Dispatch overrides it.',
    },
    {
      id: 'used-settings', chapter: 'used',
      title: 'Payment settings',
      say: 'In Tool Shed, Payments is where you set up your card processor, let customers pay by bank transfer, and Watch your bank, which connects your checking so deposits can mark invoices paid.',
    },
    {
      id: 'used-done', chapter: 'used', route: DESK, open: 'goto:/accounting', selector: t('accounting-tools'),
      title: 'That’s the lot',
      say: 'That’s Accounting, from the Money desk to the books. You can take this tutorial again any time from the button at the top of the page.',
    },
  ],
}
