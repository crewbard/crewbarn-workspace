import type { PageFilm } from './types'

/** Intro films for accounting pages. See ./types.ts and docs/tours/HOW-TO-WRITE-A-PAGE-TOUR.md. */
export const ACCOUNTING_FILMS: PageFilm[] = [
  {
    route: '^/accounting/?$',
    film: [
      { id: 'name', say: 'This is the Money desk: every money job that needs you, in one place.', visual: { kind: 'title', title: 'Money desk', area: 'Accounting', subtitle: 'Your money to-do list' } },
      {
        id: 'todo', title: 'What needs you', say: 'It’s a to-do list, not a report. Work down it from the top, and it empties as you go.',
        visual: { kind: 'list', heading: 'Needs you', rows: [
          { title: 'Invoice 1042', meta: 'Harbor View Apartments · 45 days late', chip: 'Overdue', tone: 'red' },
          { title: 'Cash from Sam', meta: '$320 collected Tuesday', chip: 'Count in', tone: 'amber' },
          { title: 'Draft invoice', meta: 'Chen residence · repair visit', chip: 'Send', tone: 'blue' },
        ] },
      },
      {
        id: 'period', title: 'Money in and out', say: 'Pick a stretch of time, and see what came in, what went out, and what’s left.',
        visual: { kind: 'tiles', tiles: [
          { label: 'Money in', value: 18450, prefix: '$', tone: 'green' },
          { label: 'Money out', value: 11200, prefix: '$', tone: 'red' },
          { label: 'Net', value: 7250, prefix: '$', tone: 'blue' },
        ] },
      },
      { id: 'tools', title: 'Every money tool', say: 'Every accounting page is linked here too, grouped by collecting, spending and reconciling.', visual: { kind: 'chips', heading: 'Accounting tools', chips: ['Invoices', 'Cash register', 'Expenses', 'Payroll', 'Bank match', 'Reports'] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/accounting/overview/?$',
    film: [
      { id: 'name', say: 'This is your Financial overview: your money at a glance.', visual: { kind: 'title', title: 'Financial overview', area: 'Accounting' } },
      {
        id: 'numbers', title: 'The headline numbers', say: 'Money in, money out, and what customers still owe you, for the dates you pick.',
        visual: { kind: 'tiles', tiles: [
          { label: 'Money in', value: 42300, prefix: '$', tone: 'green' },
          { label: 'Money out', value: 27900, prefix: '$', tone: 'red' },
          { label: 'Owed to you', value: 8600, prefix: '$', tone: 'amber' },
          { label: 'Overdue', value: 2150, prefix: '$', tone: 'red' },
        ] },
      },
      {
        id: 'attention', title: 'Needs attention', say: 'Anything worth chasing shows up here, each with a button to go sort it.',
        visual: { kind: 'list', heading: 'Needs attention', rows: [
          { title: '3 overdue invoices', meta: 'Oldest 52 days', chip: 'Chase', tone: 'red' },
          { title: 'Cash to check in', meta: '2 techs holding money', chip: 'Count in', tone: 'amber' },
          { title: 'Drafts not sent', meta: '4 invoices', chip: 'Send', tone: 'blue' },
        ] },
      },
      { id: 'look', title: 'Look, don’t do', say: 'This page is for looking. The day-to-day to-do list lives on the Money desk.', visual: { kind: 'text', headline: 'A view, not a to-do list', body: 'Charts and tables of where your money stands.' } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/accounting/bank-match/?$',
    film: [
      { id: 'name', say: 'This is Bank match: lining your bank statement up with your books.', visual: { kind: 'title', title: 'Bank match', area: 'Accounting' } },
      {
        id: 'totals', title: 'Where you stand', say: 'See how many bank rows there are, how many are matched, and what’s still waiting.',
        visual: { kind: 'tiles', tiles: [
          { label: 'Bank rows', value: 128 },
          { label: 'Matched', value: 117, tone: 'green' },
          { label: 'Waiting', value: 11, tone: 'amber' },
        ] },
      },
      {
        id: 'close', title: 'Close a statement', say: 'Type in your statement’s dates and ending balance, and it tells you if everything balances.',
        visual: { kind: 'form', fields: [
          { label: 'Statement from', value: 'Sep 1' },
          { label: 'Statement to', value: 'Sep 30' },
          { label: 'Ending balance', value: '$24,810.55' },
        ], button: 'Save review' },
      },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/accounting/bank-match/review/?$',
    film: [
      { id: 'name', say: 'This is where you go through your bank rows, one by one.', visual: { kind: 'title', title: 'Review bank matches', area: 'Accounting' } },
      {
        id: 'rows', title: 'Every row needs an answer', say: 'Most rows come with a guess already made. You just check it and accept.',
        visual: { kind: 'list', heading: 'Bank rows', rows: [
          { title: 'Deposit $1,240.00', meta: 'Sep 12 · Mobile deposit', chip: 'Suggested', tone: 'blue' },
          { title: 'Card payout $865.50', meta: 'Sep 13 · Card processor', chip: 'Matched', tone: 'green' },
          { title: 'Withdrawal $212.18', meta: 'Sep 14 · Supply house', chip: 'Open', tone: 'amber' },
        ] },
      },
      {
        id: 'answer', title: 'Say what it was', say: 'A customer payment, a deposit, an expense, or something else. Money going out can become an expense in one step.',
        visual: { kind: 'chips', heading: 'This row was…', chips: ['Customer payment', 'Deposit', 'Expense', 'Split it', 'Ignore'] },
      },
      { id: 'paste', title: 'No bank connection?', say: 'Add a row from your statement by hand, or paste your bank’s download and they all come in at once.', visual: { kind: 'text', headline: 'Paste your statement', body: 'Every row lands here, ready to match.' } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/accounting/card-processor/?$',
    film: [
      { id: 'name', say: 'This is Card transactions: every card charge your processor took.', visual: { kind: 'title', title: 'Card transactions', area: 'Accounting' } },
      {
        id: 'charges', title: 'Nothing goes missing', say: 'Charges taken on a terminal or in another app land here, so none slip out of your books.',
        visual: { kind: 'list', heading: 'Card charges', rows: [
          { title: '$485.00 · Visa ending 4421', meta: 'Taken by Alex · Sep 18', chip: 'Matched', tone: 'green' },
          { title: '$129.00 · Mastercard ending 0087', meta: 'Taken by Sam · Sep 18', chip: 'Unmatched', tone: 'amber' },
          { title: '$60.00 · Refund', meta: 'Sep 17', chip: 'Refund', tone: 'purple' },
        ] },
      },
      {
        id: 'match', title: 'Attach it to an invoice', say: 'Most match themselves. For the rest, you pick the invoice it was for, and it’s done.',
        visual: { kind: 'pipeline', stages: ['Charge', 'Unmatched', 'Pick invoice', 'Matched'], card: '$129.00' },
      },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/accounting/cash-drawer/?$',
    film: [
      { id: 'name', say: 'This is the Cash register: following cash and checks from the field to the bank.', visual: { kind: 'title', title: 'Cash register', area: 'Accounting' } },
      {
        id: 'tills', title: 'What your techs are holding', say: 'Each person holding cash or checks gets a card. Count it, type what you counted, and take it in.',
        visual: { kind: 'list', heading: 'Tech tills', rows: [
          { title: 'Sam', meta: '2 cash payments · 1 check', chip: '$540', tone: 'amber' },
          { title: 'Alex', meta: '1 cash payment', chip: '$180', tone: 'amber' },
          { title: 'Jordan', meta: 'Counted in this morning', chip: 'Clear', tone: 'green' },
        ] },
      },
      {
        id: 'deposit', title: 'From drawer to bank', say: 'Tick what you’re taking to the bank, and it becomes one deposit, easy to match later.',
        visual: { kind: 'pipeline', stages: ['Collected', 'Counted in', 'In the drawer', 'Deposited'], card: '$720 cash and checks' },
      },
      { id: 'uncollected', title: 'Never collected', say: 'Finished cash jobs where nobody took the money show up too, so you can chase them.', visual: { kind: 'text', headline: 'Done, but not paid', body: 'Catch them before they’re forgotten.' } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/accounting/cash-drawer/classic/?$',
    film: [
      { id: 'name', say: 'This is every payment your team has taken, sorted by where it stands.', visual: { kind: 'title', title: 'Every payment', area: 'Accounting' } },
      {
        id: 'status', title: 'By status', say: 'Waiting to be handed in, received, voided or disputed. Confirm the money once you have it.',
        visual: { kind: 'list', heading: 'Payments', rows: [
          { title: '$250.00 cash', meta: 'Sam · Invoice 1051', chip: 'Waiting', tone: 'amber' },
          { title: '$410.00 check', meta: 'Alex · Invoice 1048', chip: 'Received', tone: 'green' },
          { title: '$95.00 card', meta: 'Jordan · Invoice 1039', chip: 'Disputed', tone: 'red' },
        ] },
      },
      {
        id: 'fix', title: 'Fix or reverse', say: 'Wrong payment method? Change it. Need to undo one? Void or refund puts the balance back on the invoice.',
        visual: { kind: 'money', title: 'Invoice 1048', lines: [{ label: 'Repair visit', amount: 410 }, { label: 'Check payment', amount: -410 }], stamp: 'Refunded' },
      },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/accounting/customer-credits/?$',
    film: [
      { id: 'name', say: 'This is Customer credits: money you’re holding for your customers.', visual: { kind: 'title', title: 'Customer credits', area: 'Accounting' } },
      { id: 'kinds', title: 'Where credits come from', say: 'Overpayments, deposits paid up front, and refunds all land in one register.', visual: { kind: 'chips', chips: ['Overpayment', 'Deposit', 'Used on an invoice', 'Refunded'] } },
      {
        id: 'register', title: 'What’s left', say: 'Each credit shows who it belongs to and what’s left. Use it on an invoice, refund it, or keep it on purpose.',
        visual: { kind: 'list', heading: 'Credit register', rows: [
          { title: 'Chen residence', meta: 'Overpaid invoice 1033', chip: '$45 left', tone: 'amber' },
          { title: 'Park Street Cafe', meta: 'Deposit for new install', chip: '$500 left', tone: 'blue' },
          { title: 'Harbor View Apartments', meta: 'Used on invoice 1050', chip: 'Closed', tone: 'gray' },
        ] },
      },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/accounting/expenses/?$',
    film: [
      { id: 'name', say: 'This is Expenses: where your money goes.', visual: { kind: 'title', title: 'Expenses', area: 'Accounting' } },
      {
        id: 'totals', title: 'The totals', say: 'What you spent, what you can bill back to customers, and receipts waiting to be paid back.',
        visual: { kind: 'tiles', tiles: [
          { label: 'Spent', value: 9840, prefix: '$', tone: 'red' },
          { label: 'Billable', value: 1720, prefix: '$', tone: 'green' },
          { label: 'To pay back', value: 260, prefix: '$', tone: 'amber' },
        ] },
      },
      {
        id: 'categories', title: 'Spend by category', say: 'Your biggest kinds of spending come first, so you can see where it all goes.',
        visual: { kind: 'list', heading: 'By category', rows: [
          { title: 'Parts and materials', chip: '$4,210', tone: 'blue' },
          { title: 'Fuel', chip: '$1,880', tone: 'blue' },
          { title: 'Tools', chip: '$960', tone: 'blue' },
        ] },
      },
      { id: 'more', title: 'Bills and tax forms', say: 'Bills you owe your suppliers, and which contractors will need a tax form at year end.', visual: { kind: 'chips', chips: ['Bills you owe', 'Reimbursements', '1099 readiness'] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/accounting/expenses/bills/?$',
    film: [
      { id: 'name', say: 'This is Vendor bills: what you owe your suppliers.', visual: { kind: 'title', title: 'Vendor bills', area: 'Accounting' } },
      {
        id: 'add', title: 'Add a bill', say: 'Type in the supplier, the bill number, when it’s due and the amount.',
        visual: { kind: 'form', fields: [
          { label: 'Vendor', value: 'Metro Supply Co.' },
          { label: 'Bill number', value: 'MS-20817' },
          { label: 'Due', value: 'Oct 15' },
          { label: 'Amount', value: '$1,384.20' },
        ], button: 'Add bill' },
      },
      {
        id: 'list', title: 'Your bills', say: 'Each bill shows what’s been paid and what’s still owed, with overdue ones easy to spot.',
        visual: { kind: 'list', heading: 'Open bills', rows: [
          { title: 'Metro Supply Co.', meta: 'Due Oct 15', chip: '$1,384', tone: 'blue' },
          { title: 'City Equipment Rental', meta: 'Due Sep 30', chip: 'Overdue', tone: 'red' },
          { title: 'Northside Fleet Fuel', meta: 'Paid Sep 20', chip: 'Paid', tone: 'green' },
        ] },
      },
      { id: 'pay', title: 'Record a payment', say: 'Record what you paid. Part payments are fine, and the balance updates.', visual: { kind: 'money', title: 'Metro Supply Co.', lines: [{ label: 'Bill MS-20817', amount: 1384.2 }, { label: 'Paid', amount: -1384.2 }], stamp: 'Paid' } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/accounting/expenses/register/?$',
    film: [
      { id: 'name', say: 'This is the Expense register: everything your business spent, one line each.', visual: { kind: 'title', title: 'Expense register', area: 'Accounting' } },
      {
        id: 'add', title: 'Add an expense', say: 'The date, the amount, where it was spent and what it was for. It’s recorded straight away.',
        visual: { kind: 'form', fields: [
          { label: 'Amount', value: '$86.40' },
          { label: 'Vendor', value: 'Corner Hardware' },
          { label: 'Category', value: 'Parts and materials' },
          { label: 'Paid by', value: 'Sam' },
        ], button: 'Add expense' },
      },
      { id: 'payback', title: 'Paying someone back', say: 'If someone on your team paid with their own money, tick a box and it goes to payroll to be paid back.', visual: { kind: 'toggles', heading: 'This expense', rows: [{ label: 'Bill it to the customer', on: false }, { label: 'Pay them back', on: true }] } },
      {
        id: 'rows', title: 'Every expense', say: 'Every expense with its receipt, category and status, ready to filter and download.',
        visual: { kind: 'list', heading: 'Expenses', search: 'fuel', rows: [
          { title: 'Fuel · $62.15', meta: 'Alex · Sep 19', chip: 'Recorded', tone: 'green' },
          { title: 'Fuel · $58.90', meta: 'Jordan · Sep 18', chip: 'Pay back', tone: 'amber' },
        ] },
      },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/accounting/inventory-cost/?$',
    film: [
      { id: 'name', say: 'This is Inventory cost: what your stock is worth, and what you spent buying it.', visual: { kind: 'title', title: 'Inventory and PO cost', area: 'Accounting' } },
      {
        id: 'value', title: 'Your stock’s value', say: 'What everything on your shelves and trucks cost you, and how much of it is free to use.',
        visual: { kind: 'tiles', tiles: [
          { label: 'Stock value', value: 23600, prefix: '$', tone: 'blue' },
          { label: 'Free to use', value: 19850, prefix: '$', tone: 'green' },
          { label: 'Spent on orders', value: 6420, prefix: '$', tone: 'amber' },
        ] },
      },
      {
        id: 'where', title: 'Where it sits', say: 'See the value in each warehouse and each truck, plus your latest purchase orders.',
        visual: { kind: 'list', heading: 'Value by location', rows: [
          { title: 'Main warehouse', chip: '$16,200', tone: 'blue' },
          { title: 'Truck 1 · Sam', chip: '$3,950', tone: 'blue' },
          { title: 'Truck 2 · Alex', chip: '$3,450', tone: 'blue' },
        ] },
      },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/accounting/ledger/?$',
    film: [
      { id: 'name', say: 'This is the General ledger: your books, kept for you.', visual: { kind: 'title', title: 'General ledger', area: 'Accounting' } },
      { id: 'posts', title: 'It posts itself', say: 'Every invoice, payment, expense and payroll run lands here as proper bookkeeping, on its own.', visual: { kind: 'pipeline', stages: ['Invoice', 'Payment', 'Journal entry', 'Your books'], card: 'Invoice 1052' } },
      {
        id: 'statements', title: 'Your statements', say: 'Your income statement and balance sheet are ready for any dates you pick.',
        visual: { kind: 'tiles', tiles: [
          { label: 'Revenue', value: 61200, prefix: '$', tone: 'green' },
          { label: 'Expenses', value: 44800, prefix: '$', tone: 'red' },
          { label: 'Profit', value: 16400, prefix: '$', tone: 'blue' },
        ] },
      },
      { id: 'tools', title: 'Bookkeeper tools', say: 'And when your bookkeeper needs them, the tools to adjust, correct and close the year are here too.', visual: { kind: 'chips', chips: ['Manual entry', 'Owner draw', 'Sales tax payment', 'Close a month', 'Year-end close'] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/accounting/payroll/?$',
    film: [
      { id: 'name', say: 'This is Payroll: what your team earned, checked before it goes in the books.', visual: { kind: 'title', title: 'Payroll', area: 'Accounting' } },
      {
        id: 'preview', title: 'Check before posting', say: 'See what each person would be paid for the period. Looking changes nothing.',
        visual: { kind: 'list', heading: 'This period', rows: [
          { title: 'Sam', meta: '42 hours · 18 jobs', chip: '$1,890', tone: 'blue' },
          { title: 'Alex', meta: '40 hours · 15 jobs', chip: '$1,720', tone: 'blue' },
          { title: 'Jordan', meta: 'Commission · 11 jobs', chip: '$2,140', tone: 'blue' },
        ] },
      },
      {
        id: 'profit', title: 'Who’s making you money', say: 'Revenue, labor and margin for each tech, side by side.',
        visual: { kind: 'tiles', tiles: [
          { label: 'Revenue', value: 28400, prefix: '$', tone: 'green' },
          { label: 'Payroll cost', value: 5750, prefix: '$', tone: 'red' },
          { label: 'Margin', value: 80, suffix: '%', tone: 'blue' },
        ] },
      },
      { id: 'post', title: 'Post and lock', say: 'Once it looks right, post the period and it’s locked. Nothing is paid out from here.', visual: { kind: 'pipeline', stages: ['Pick dates', 'Check', 'Post', 'Locked'], card: 'Sep 1 to Sep 15' } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/accounting/payroll/profiles/?$',
    film: [
      { id: 'name', say: 'This is Payroll profiles: how each person on your team gets paid.', visual: { kind: 'title', title: 'Payroll profiles', area: 'Accounting' } },
      { id: 'types', title: 'How they’re paid', say: 'Hourly, salary, commission, or a mix of them.', visual: { kind: 'chips', chips: ['Hourly', 'Salary', 'Commission', 'A mix'] } },
      {
        id: 'rules', title: 'Their pay rules', say: 'Set their rate, and which parts of a job count toward their commission, like labor or parts.',
        visual: { kind: 'form', fields: [
          { label: 'Person', value: 'Jordan' },
          { label: 'Pay type', value: 'Hourly plus commission' },
          { label: 'Hourly rate', value: '$24.00' },
          { label: 'Commission', value: '10% of labor' },
        ], button: 'Save' },
      },
      {
        id: 'schedule', title: 'Their work week', say: 'Add the days and hours they normally work, so payroll knows their weekly hours.',
        visual: { kind: 'calendar', visits: [
          { day: 0, slot: 0, span: 3, label: '8 to 4', tone: 'blue' },
          { day: 1, slot: 0, span: 3, label: '8 to 4', tone: 'blue' },
          { day: 2, slot: 0, span: 3, label: '8 to 4', tone: 'blue' },
          { day: 3, slot: 0, span: 3, label: '8 to 4', tone: 'blue' },
          { day: 4, slot: 0, span: 2, label: '8 to 12', tone: 'blue' },
        ] },
      },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/accounting/reports/?$',
    film: [
      { id: 'name', say: 'This is Reports, asked as plain questions.', visual: { kind: 'title', title: 'What do you want to know?', area: 'Reports' } },
      {
        id: 'ask', title: 'Ask', say: 'Type a few words, like who owes me, and the matching questions stay.',
        visual: { kind: 'list', heading: 'Questions', search: 'who owes', rows: [
          { title: 'Who owes me money?', meta: 'Money in', chip: 'Open', tone: 'blue' },
          { title: 'Which invoices are overdue?', meta: 'Money in', chip: 'Open', tone: 'blue' },
        ] },
      },
      { id: 'groups', title: 'Grouped by topic', say: 'Questions are grouped by what they’re about, and your saved views sit at the top.', visual: { kind: 'chips', chips: ['Money in', 'Money out', 'Your team', 'Your stock'] } },
      { id: 'answer', title: 'The answer first', say: 'Open one and the answer comes first, with the table behind it ready to download.', visual: { kind: 'text', headline: 'You’re owed $8,600', body: '12 customers · 3 overdue' } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/accounting/reports/browse/?$',
    film: [
      { id: 'name', say: 'This is every report by name, ready to download.', visual: { kind: 'title', title: 'Every report', area: 'Reports' } },
      {
        id: 'pick', title: 'Pick a report', say: 'Choose a report from the list, the way your bookkeeper would ask for it.',
        visual: { kind: 'list', heading: 'Reports', rows: [
          { title: 'Sales by customer', chip: 'Date range', tone: 'gray' },
          { title: 'Money owed by age', chip: 'Single day', tone: 'gray' },
          { title: 'Payments received', chip: 'Date range', tone: 'gray' },
        ] },
      },
      {
        id: 'filters', title: 'Dates and filters', say: 'Set the dates, narrow it to a customer or a tech, then download it as a PDF or a spreadsheet.',
        visual: { kind: 'form', fields: [
          { label: 'Dates', value: 'Last quarter' },
          { label: 'Tech', value: 'Everyone' },
          { label: 'Status', value: 'Paid' },
        ], button: 'Download' },
      },
      { id: 'saved', title: 'Save it for next time', say: 'Save a report with its filters, and open it again in one press.', visual: { kind: 'text', headline: 'Saved views', body: 'Your favourite reports, one press away.' } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/accounting/sales-tax/?$',
    film: [
      { id: 'name', say: 'This is Sales tax: what your invoices collected, and what you owe.', visual: { kind: 'title', title: 'Sales tax', area: 'Accounting' } },
      {
        id: 'period', title: 'The filing period', say: 'Pick a month, a quarter, or your own dates, and see the tax collected, split the way you file it.',
        visual: { kind: 'money', title: 'July to September', lines: [{ label: 'State tax', amount: 1842.6 }, { label: 'County tax', amount: 307.1 }], stamp: '' },
      },
      { id: 'status', title: 'Filed or not', say: 'It shows at a glance whether the period is filed and paid, partly paid, or still owed.', visual: { kind: 'pipeline', stages: ['Collected', 'Filed', 'Paid'], card: 'Q3', stopAt: 1 } },
      { id: 'record', title: 'Record a payment', say: 'Once you’ve filed, record what you paid, and it goes into your books against what you owe.', visual: { kind: 'form', fields: [{ label: 'Period', value: 'July to September' }, { label: 'Paid on', value: 'Oct 20' }, { label: 'Amount', value: '$2,149.70' }], button: 'Record payment' } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
  {
    route: '^/accounting/sync-mappings/?$',
    film: [
      { id: 'name', say: 'This is Sync mappings: matching your books to your accounting software.', visual: { kind: 'title', title: 'Sync mappings', area: 'Accounting' } },
      { id: 'pair', title: 'Pair them up', say: 'Each mapping pairs something here with its name in the other system, so exports land in the right place.', visual: { kind: 'text', headline: 'Service income → 4000 Service Revenue', body: 'Same thing, two names.' } },
      {
        id: 'add', title: 'Add a mapping', say: 'Pick the system, what you’re mapping, and its name or code over there.',
        visual: { kind: 'form', fields: [
          { label: 'System', value: 'Your accounting app' },
          { label: 'Type', value: 'Tax code' },
          { label: 'Here', value: 'State sales tax' },
          { label: 'Over there', value: 'TAX-ST' },
        ], button: 'Save mapping' },
      },
      { id: 'export', title: 'Accounts, codes and items', say: 'Map your accounts, tax codes, payment methods and items, then download your journal entries ready to import.', visual: { kind: 'chips', heading: 'What you can map', chips: ['Accounts', 'Tax codes', 'Payment methods', 'Items'] } },
      { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
    ],
  },
]
