import type { GuidedTour } from '@/lib/guidedTours'

/**
 * Money area tours (owner 06): the Money desk, cash register and classic
 * drawer, payroll, sales tax, reports, the accounting overview and the
 * close-the-books pages under /accounting.
 *
 * Steps target data-tour attributes in the page components. The engine
 * skips any step whose target isn't on screen (Easy-theme-only parts,
 * groups with nothing in them, controls a role can't use), so those steps
 * are marked optional and the rest still run.
 */
export const MONEY_TOURS: GuidedTour[] = [
  // ------------------------------------------------------------- Money desk
  {
    id: 'money-desk',
    title: 'Your money desk',
    description: 'A to-do list for money: cash to check in, work to bill, late invoices, receipts to approve and deposits to match.',
    route: /^\/accounting\/?$/,
    roadmap: [
      { title: 'Money moves in the field', detail: 'Techs collect payments, finish jobs and submit receipts. Deposits land in the bank.' },
      { title: 'Open Accounting', detail: 'The Money desk is the first thing you see.' },
      { title: 'Work top to bottom', detail: 'Check in cash, send drafts, remind late payers, approve receipts, then open bank match.' },
      { title: 'Go deeper when you need to', detail: 'Reports are for reading. Cash register, Invoices, Payroll and Bank match are for the detail work.' },
    ],
    use: {
      say: 'Each group hands you on to the page that finishes the job. Cash you check in moves to the office drawer on the Cash register, approved receipts wait in Payroll to be paid back, and deposits are matched in Review bank matches.',
      go: [
        { label: 'Go to Cash register', to: '/accounting/cash-drawer' },
        { label: 'Open Payroll', to: '/accounting/payroll' },
        { label: 'Review bank matches', to: '/accounting/bank-match/review' },
      ],
    },
    steps: [
      { selector: '[data-tour="accounting-tools"]', title: 'Every money page in one place', say: 'This card is your map of the whole money area, in three groups. You only see the links you have access to.' },
      { selector: '[data-tour="money-desk-header"]', title: 'What needs you today', say: 'The line under the title tells you how many things need you. If it says nothing needs you, the desk is clear.' },
      { selector: '[data-tour="money-desk-period"]', title: 'Pick the window', say: 'This sets the window for the money-in and money-out totals. It doesn’t hide anything in the to-do list, so old late invoices always stay visible.' },
      { selector: '[data-tour="money-desk-progress"]', title: 'Watch it clear', say: 'This bar fills as you clear items during this visit. Next to it are money in, money out and the net for the window you picked.' },
      { selector: '[data-tour="money-desk-in"]', title: 'Money in hand', say: 'Cash and checks your techs collected that the office hasn’t counted yet. Check them in so the books match the bag.', optional: 'Nothing to check in right now' },
      { selector: '[data-tour="money-desk-bill"]', title: 'Finished but not billed', say: 'Draft invoices for work that’s done that nobody sent. Send them and they become money owed to you.', optional: 'No drafts waiting' },
      { selector: '[data-tour="money-desk-late"]', title: 'Late invoices', say: 'Sent, past due and still unpaid. Remind emails the customer again with a pay link.', optional: 'Nothing late right now' },
      { selector: '[data-tour="money-desk-approve"]', title: 'Spending to approve', say: 'Receipts your team submitted for reimbursement. Approving them queues the money to pay back in Payroll.', optional: 'No receipts waiting' },
      { selector: '[data-tour="money-desk-match"]', title: 'Bank deposits to match', say: 'Deposits that landed in the bank but aren’t tied to payments yet. Matching takes judgement, so this sends you to the review screen.', optional: 'No deposits waiting' },
      { selector: '[data-tour="money-desk-clear"]', title: 'All clear', say: 'When every group is empty you’ll see a green note. Nice work.', optional: 'The desk still has work in it' },
    ],
  },

  // ---------------------------------------------------------- Cash register
  {
    id: 'cash-register',
    title: 'The cash register',
    description: 'Follow physical cash and checks from the truck to the bank, and catch finished jobs nobody collected on.',
    route: /^\/accounting\/cash-drawer\/?$/,
    roadmap: [
      { title: 'Money is collected', detail: 'A tech or the office records a cash or check payment on a job or invoice.' },
      { title: 'Tech tills', detail: 'Count what each person hands in and take it in.' },
      { title: 'Office drawer', detail: 'Pick what you’re taking to the bank and record one numbered deposit.' },
      { title: 'Work done, no money', detail: 'Catch finished COD jobs nobody collected on.' },
      { title: 'Bank match', detail: 'The deposit shows up on the statement, ready to match.' },
    ],
    use: {
      say: 'Each deposit you record here is one line on your bank statement, ready to match in Review bank matches. If you want techs to hand cash in before they start their next job, turn that on in Tool Shed under Cash rules.',
      go: [
        { label: 'Review bank matches', to: '/accounting/bank-match/review' },
        { label: 'Open cash rule', to: '/tool-shed/preferences/cash-collection' },
      ],
    },
    steps: [
      { selector: '[data-tour="register-header"]', title: 'From the truck to the bank', say: 'This page follows physical money from the truck to the bank. The description changes with each view, so you always know which pile you’re looking at.' },
      { selector: '[data-tour="register-total"]', title: 'What’s still floating around', say: 'On the tills and drawer views this is money collected but not checked in. On the last view it’s money never collected.' },
      { selector: '[data-tour="register-classic"]', title: 'Voids and refunds', say: 'Need to void or refund a payment, fix its method or look at a dispute? That’s on the detailed payments screen, one click from here.' },
      { selector: '[data-tour="register-views"]', title: 'Three piles', say: 'Three piles, three buttons. Tech tills is where you start.' },
      { selector: '[data-tour="register-tills"]', title: 'Count it in', say: 'One card per person holding money. Count what they hand you and type it in. Take it in checks your count against what’s expected and asks you to confirm, then marks each payment received at its recorded amount.', optional: 'Open Tech tills to see this' },
      { selector: '[data-tour="register-drawer"]', title: 'The office drawer', say: 'Everything the office is physically holding. Tick what you’re taking to the bank and record it as one deposit. Undo is right there if you got it wrong.', optional: 'Open Office drawer to see this' },
      { selector: '[data-tour="register-uncollected"]', title: 'Work done, no money', say: 'COD jobs the crew closed with nothing collected. They never show up as overdue, so this list is the only place you’ll see them.', optional: 'Open Work done, no money to see this' },
    ],
  },

  // ------------------------------------------------ Cash drawer (classic)
  {
    id: 'cash-drawer-classic',
    title: 'Payments, voids and refunds',
    description: 'The detailed payment screen: confirm, void, refund or correct a single payment.',
    route: /^\/accounting\/cash-drawer\/classic\/?$/,
    roadmap: [
      { title: 'Payments come in', detail: 'From the field, the counter, the portal or the card processor.' },
      { title: 'Confirm or void', detail: 'Confirm each pending payment here, or void it.' },
      { title: 'Fix it later', detail: 'Received cash or checks can still be voided, and card payments refunded.' },
      { title: 'History', detail: 'The tabs give you received, voided, disputed and all payments.' },
    ],
    use: {
      say: 'When a payment is more than the invoice, the extra becomes a credit you’ll find on Customer credits. A void reopens the balance on the invoice, so check Invoices afterwards to collect it again.',
      go: [
        { label: 'Open Customer credits', to: '/accounting/customer-credits' },
        { label: 'Go to Invoices', to: '/accounting/invoices' },
        { label: 'Back to Cash register', to: '/accounting/cash-drawer' },
      ],
    },
    steps: [
      { selector: '[data-tour="classic-drawer-header"]', title: 'The detailed payment screen', say: 'Use this page when you need to void, refund or correct a single payment. The link at the top takes you back to the Cash register.' },
      { selector: '[data-tour="cash-count"]', title: 'Count the cash', say: 'A scratch pad for counting bills and coins. It saves nothing. It just tells you if you’re over or short.', optional: 'Only in the Easy themes' },
      { selector: '[data-tour="classic-drawer-summary"]', title: 'Quick totals', say: 'Totals from the records loaded on this screen. They aren’t an audited ledger balance.' },
      { selector: '[data-tour="classic-drawer-charts"]', title: 'Who owes you, and how you got paid', say: 'Receivables by how late they are, and what you’ve received by payment type.' },
      { selector: '[data-tour="classic-drawer-tabs"]', title: 'Pending first', say: 'Pending turnover is what needs a decision. The other tabs are history.' },
      { selector: '[data-tour="classic-drawer-register"]', title: 'Tech cash register', say: 'Every payment grouped by who collected it. On hand is cash or checks still with that person.' },
      { selector: '[data-tour="classic-drawer-cards"]', title: 'One card per payment', say: 'The buttons change with the payment’s status: confirm, void, refund to card, or change the method.', optional: 'No payments in this tab' },
    ],
  },

  // ---------------------------------------------------------------- Payroll
  {
    id: 'payroll',
    title: 'Payroll & tech profit',
    description: 'Review a pay period, check leave and reimbursements, post the closeout and record what you paid.',
    route: /^\/accounting\/payroll\/?$/,
    roadmap: [
      { title: 'Rules and hours come in', detail: 'Pay rules from Payroll profiles, hours from the time clock, revenue from invoiced jobs, leave from Time off.' },
      { title: 'Check the period', detail: 'Pick the dates, then read the preview, leave and reimbursements.' },
      { title: 'Post the closeout', detail: 'Post payroll closeout writes the period to the general ledger.' },
      { title: 'Pay and print', detail: 'Open the posted closeout to record payments, print the packet or download pay stubs.' },
      { title: 'Reimbursements', detail: 'These are paid out separately from the reimbursements table.' },
    ],
    use: {
      say: 'Payroll reads each person’s pay rules from Payroll profiles and their leave from Tool Shed › Time off, so fix those first if a number looks wrong. Once you post, the closeout lands in the General ledger as a journal entry.',
      go: [
        { label: 'Open Payroll profiles', to: '/accounting/payroll/profiles' },
        { label: 'Open Time off', to: '/tool-shed/time-off' },
        { label: 'Go to General ledger', to: '/accounting/ledger' },
      ],
    },
    steps: [
      { selector: '[data-tour="payroll-actions"]', title: 'Downloads and posting', say: 'Everything you can download or post for this period is up here. Posting is the last step, and its confirm shows the same Total to post as the preview below.' },
      { selector: '[data-tour="payroll-jump"]', title: 'Jump down the page', say: 'Shortcuts to each section below.', optional: 'Only in the Easy themes' },
      { selector: '[data-tour="payroll-timeoff-warning"]', title: 'Time off to check', say: 'Some leave isn’t paid automatically. Check it before you post.', optional: 'No manual leave in this period' },
      { selector: '[data-tour="payroll-filters"]', title: 'Set the pay period', say: 'Every section on the page follows these dates. You can also narrow to one person or pay type.' },
      { selector: '[data-tour="payroll-metrics"]', title: 'The period at a glance', say: 'People, jobs, revenue, payroll cost, leave, expenses and margin for these dates.' },
      { selector: '[data-tour="payroll-preview"]', title: 'Check before posting', say: 'This is what the run will pay, worked out the same way the post will. Jobs nobody invoiced are listed first, because they pay nobody until they’re billed.' },
      { selector: '[data-tour="payroll-leave"]', title: 'PTO balances', say: 'Sick, vacation and PTO for each person, clipped to this period.' },
      { selector: '[data-tour="payroll-closeouts"]', title: 'Posted payroll', say: 'Every posted run in this range. Click one to record what you paid, print the packet or download pay stubs.' },
      { selector: '[data-tour="payroll-profit"]', title: 'Profit by tech', say: 'Revenue against everything each person costs, so you can see margin by tech.' },
      { selector: '[data-tour="payroll-reimbursements"]', title: 'Reimbursements', say: 'Money your team spent that you owe back. Approve it, then mark it paid once it’s in their pay. If the server refuses, you’ll see why at the top of the page.' },
      { selector: '[data-tour="payroll-shortcuts"]', title: 'Setup that feeds payroll', say: 'Links to staff, pay profiles, time off, expenses and the tech reports.' },
    ],
  },

  // -------------------------------------------------------- Payroll profiles
  {
    id: 'payroll-profiles',
    title: 'Payroll profiles',
    description: 'Set how each person is paid so payroll and profitability can work out labor cost and margin.',
    route: /^\/accounting\/payroll\/profiles\/?$/,
    roadmap: [
      { title: 'Staff are added', detail: 'People are created in Tool Shed › Staff.' },
      { title: 'Set their pay', detail: 'Pick a person and set their pay rules and schedule.' },
      { title: 'Test it', detail: 'The calculator tries the rule before you save.' },
      { title: 'Payroll uses it', detail: 'Payroll previews, closeouts and the tech report use these rules from then on.' },
    ],
    use: {
      say: 'The rules you save here are what Payroll uses to work out each run, and what the Tech performance report uses for margin. New people are added in Tool Shed › Staff before they show up here.',
      go: [
        { label: 'Go to Payroll', to: '/accounting/payroll' },
        { label: 'Tech performance report', to: '/accounting/reports/browse?layout=browser&report=tech-performance' },
        { label: 'Open Staff', to: '/tool-shed/staff' },
      ],
    },
    steps: [
      { selector: '[data-tour="pay-profiles-header"]', title: 'How each person is paid', say: 'Set how each person is paid so the money pages can work out labor cost and margin.' },
      { selector: '[data-tour="pay-profiles-staff"]', title: 'Pick a person', say: 'Find the person you want to change. The badge shows whether they’re included in payroll reports.' },
      { selector: '[data-tour="pay-profiles-tabs"]', title: 'Rates and tabs', say: 'Their current rates are on one line. Switch between pay rules and the weekly schedule.', optional: 'Pick a person first' },
      { selector: '[data-tour="pay-profiles-rules"]', title: 'Pay rules', say: 'Choose how they are paid. For salary, check the yearly total: twice a month is 24 payments; every two weeks is 26. Changing the amount period preserves the yearly salary; enter a new amount to change pay. Choose actual payment dates separately. Check health insurance shares and whether the company cost is already included. The calculator does not include territory bonuses.', optional: 'Open Pay rules to see this' },
      { selector: '[data-tour="pay-profiles-schedule"]', title: 'Work schedule', say: 'Click hours on or off for each day. Weekly hours update to match.', optional: 'Open Work schedule to see this' },
      { selector: '[data-tour="pay-profiles-save"]', title: 'Save', say: 'Press Save profile and wait for confirmation or an error. Reopen the person and check salary, payment dates and insurance. Review the payroll preview before posting: saving a profile does not post pay or deduct insurance. If you can only view staff, Save is hidden.', optional: 'Pick a person first' },
    ],
  },

  // ---------------------------------------------------------------- Sales tax
  {
    id: 'sales-tax',
    title: 'Sales tax report',
    description: 'The totals your return asks for, the payment you sent, and whether each period is settled.',
    route: /^\/accounting\/sales-tax\/?$/,
    roadmap: [
      { title: 'Invoices carry tax', detail: 'Sent and paid invoices with tax feed this report.' },
      { title: 'Pick the period', detail: 'Read the totals and the jurisdiction split.' },
      { title: 'Review report', detail: 'See every invoice behind the number and download the PDF or spreadsheet.' },
      { title: 'Post payment', detail: 'Record what you remitted. The period then shows as Filed and paid.' },
      { title: 'Carry over', detail: 'The owed-across-all-periods line carries over between years.' },
    ],
    use: {
      say: 'The tax on each invoice line comes from your Tax classes, and the jurisdiction split here comes from the parts that make up each class. A payment you post shows up in the General ledger as a journal entry.',
      go: [
        { label: 'Open Tax classes', to: '/catalog/tax-classes' },
        { label: 'Go to General ledger', to: '/accounting/ledger' },
        { label: 'Go to Invoices', to: '/accounting/invoices' },
      ],
    },
    steps: [
      { selector: '[data-tour="sales-tax-header"]', title: 'Money you hold for the tax agency', say: 'This is tax you collected for your state and local agencies. It never belonged to you, so this page keeps it in view until it’s paid.' },
      { selector: '[data-tour="sales-tax-range"]', title: 'Pick the filing period', say: 'Last month is picked for you. Use the chips, jump to a quarter or month, or type dates.' },
      { selector: '[data-tour="sales-tax-filing"]', title: 'Is this period paid?', say: 'This tells you whether the period is settled, and lists any payments already filed for it.', optional: 'Still loading' },
      { selector: '[data-tour="sales-tax-payment"]', title: 'Record the payment', say: 'Enter what you paid and press Post payment. You’ll confirm the amount first, and it posts a journal entry from Sales Tax Payable to Checking (1010). Only people who can edit invoices see this form.', optional: 'Nothing to post, or you can only view' },
      { selector: '[data-tour="sales-tax-review"]', title: 'Review report', say: 'Every invoice behind this total, with the tax on each, plus the PDF and spreadsheet.', optional: 'Still loading' },
      { selector: '[data-tour="sales-tax-report"]', title: 'The part you copy onto the return', say: 'Sales totals, the tax summary and the jurisdiction split. It prints cleanly on its own.' },
    ],
  },

  // ------------------------------------------------------------------ Reports
  {
    id: 'reports',
    title: 'Reports',
    description: 'Every report, asked as a plain question. The answer comes first, then the rows.',
    route: /^\/accounting\/reports\/?$/,
    roadmap: [
      { title: 'Your work fills the books', detail: 'Invoices, payments, expenses, POs, payroll and the bank.' },
      { title: 'Ask a question', detail: 'Get the answer first, then the detail.' },
      { title: 'Pin what you use', detail: 'Saved views show at the top.' },
      { title: 'Need every filter?', detail: 'Open the full reports workspace.' },
    ],
    use: {
      say: 'Each answer opens in the Report workspace, where you can download the PDF or spreadsheet and save a view. Saved views are shared with your team and show up here as pinned.',
      go: [
        { label: 'Open Report workspace', to: '/accounting/reports/browse' },
        { label: 'Overview & charts', to: '/accounting/overview' },
      ],
    },
    steps: [
      { selector: '[data-tour="reports-front-header"]', title: 'Reports as questions', say: 'Reports are listed as questions, so you don’t need to know report names. The names are still shown under each card.' },
      { selector: '[data-tour="reports-search"]', title: 'Search', say: 'Type a word like “tax” or “who owes”. Report names like ar-aging work too.' },
      { selector: '[data-tour="reports-pinned"]', title: 'Your pinned views', say: 'Views you pinned show up here so you can open them in one click.', optional: 'No pinned views yet' },
      { selector: '[data-tour="reports-questions"]', title: 'Pick a question', say: 'Pick the question closest to what you want to know. The small grey names underneath open each report it’s built from.' },
      { selector: '[data-tour="reports-browse-link"]', title: 'The full workspace', say: 'Need every filter and grouping? The full workspace is one click away.' },
    ],
  },

  // ---------------------------------------------------------- Report browser
  {
    id: 'reports-browse',
    title: 'Report workspace',
    description: 'Every report with every filter, saved views, and PDF and spreadsheet downloads.',
    route: /^\/accounting\/reports\/browse\/?$/,
    roadmap: [
      { title: 'Arrive', detail: 'From the Reports questions page, or a saved or shared link.' },
      { title: 'Pick a report', detail: 'Left menu shows one report at a time with live data. It’s the default.' },
      { title: 'Filter and download', detail: 'Set the dates and filters, then download the PDF, the spreadsheet or the filtered rows.' },
      { title: 'Save the view', detail: 'Saved views are shared with your team.' },
    ],
    use: {
      say: 'Views you save here show up pinned at the top of Reports for everyone on your team. For charts instead of files, use Overview & charts, and the General ledger has the trial balance and statements.',
      go: [
        { label: 'Back to Reports', to: '/accounting/reports' },
        { label: 'Overview & charts', to: '/accounting/overview' },
        { label: 'Go to General ledger', to: '/accounting/ledger' },
      ],
    },
    steps: [
      { selector: '[data-tour="reports-root"]', title: 'The full report workspace', say: 'This is for pulling files to save or send to your bookkeeper. Charts are on Overview & charts.' },
      { selector: '[data-tour="reports-saved-views"]', title: 'Saved views', say: 'Save the report, dates and filters you use often. Saved views are shared with your team.' },
      { selector: '[data-tour="reports-controls"]', title: 'Dates and layout', say: 'Left menu is the easiest way to work: pick one report and its data loads. As-of reports like aging, inventory value and 1099 get their own As of date here.' },
      { selector: '[data-tour="reports-filters"]', title: 'Filters', say: 'Narrow the rows. These filters also shape the filtered spreadsheet.' },
      { selector: '[data-tour="reports-guide"]', title: 'What this report is for', say: 'A plain-language note on the selected report.' },
      { selector: '[data-tour="reports-panels"]', title: 'Pick a report', say: 'Pick a report on the left. Each panel has its own download buttons and a few extra filters where they matter.' },
    ],
  },

  // ---------------------------------------------------------------- Overview
  {
    id: 'accounting-overview',
    title: 'Overview & charts',
    description: 'Step back and read the numbers for a period: cash, receivables, the books check, the drawer, credits, tax and 1099s.',
    route: /^\/accounting\/overview\/?$/,
    roadmap: [
      { title: 'Daily work happens elsewhere', detail: 'The Money desk handles the to-dos. Here you read the numbers.' },
      { title: 'Pick the period', detail: 'Then scan the metric cards and Needs attention.' },
      { title: 'Choose the job', detail: 'Collect, Spend, Team pay or Close the books takes you to the right page.' },
      { title: 'Drill in', detail: 'Every chart and panel links through to its detail page.' },
    ],
    use: {
      say: 'This page is for reading. To act on what it shows, use the Money desk for today’s to-dos, Invoices to chase what customers owe, and the General ledger to check and close the books.',
      go: [
        { label: 'Open Money desk', to: '/accounting' },
        { label: 'Go to Invoices', to: '/accounting/invoices' },
        { label: 'Go to General ledger', to: '/accounting/ledger' },
      ],
    },
    steps: [
      { selector: '[data-tour="accounting-period"]', title: 'Choose the window', say: 'Choose how wide a window you want, and which period. Closed years and quarters open as fixed, final numbers.' },
      { selector: '[data-tour="accounting-metrics"]', title: 'The headline numbers', say: 'Money in, money out and net for the period, plus what customers owe and what’s overdue.' },
      { selector: '[data-tour="accounting-attention"]', title: 'Needs attention', say: 'A short money to-do list. Each row has a button that takes you where to fix it.' },
      { selector: '[data-tour="accounting-workflows"]', title: 'Pick the job you’re doing', say: 'Collect, Spend, Team pay or Close the books. Each one lists the pages for that job.' },
      { selector: '[data-tour="accounting-charts"]', title: 'Cash flow and the books check', say: 'Money in against money out over recent periods, and a quick health check on the ledger. Click either one for the detail.' },
      { selector: '[data-tour="accounting-panels"]', title: 'Drawer, aging and invoices', say: 'Each card links to the page where you act on it.' },
      { selector: '[data-tour="accounting-panels-2"]', title: 'Credits, tax and 1099s', say: 'Credits you’re holding, tax you collected last month, and where you stand on 1099s.' },
      { selector: '[data-tour="accounting-grids"]', title: 'The same numbers as tables', say: 'If you prefer rows to charts, turn on Show grids.', optional: 'Grids are hidden' },
    ],
  },

  // ---------------------------------------------------------------- Credits
  {
    id: 'customer-credits',
    title: 'Customer credits',
    description: 'Money you’re holding for customers: what’s been applied, refunded, and what’s left.',
    route: /^\/accounting\/customer-credits\/?$/,
    roadmap: [
      { title: 'A credit is created', detail: 'A customer overpays or pays a deposit.' },
      { title: 'See every credit', detail: 'Here you see each credit and its remaining balance.' },
      { title: 'Apply or refund elsewhere', detail: 'Credits are applied or refunded from the customer’s invoices and payments.' },
      { title: 'Hand it off', detail: 'Download the register for month-end or your bookkeeper.' },
    ],
    use: {
      say: 'To use a credit, open the customer and go to Records › Invoices, where Available credits has an Apply to invoice button. A credit is made when a customer pays more than an invoice or pays a deposit up front.',
      go: [
        { label: 'Go to Customers', to: '/customers' },
        { label: 'Go to Invoices', to: '/accounting/invoices' },
      ],
    },
    steps: [
      { selector: '[data-tour="credits-header"]', title: 'Money that belongs to customers', say: 'This is money that belongs to your customers until it’s used or refunded. This page is for reading; you apply or refund credits from their invoices and payments.' },
      { selector: '[data-tour="credits-filters"]', title: 'Find a credit', say: 'Filter by date and status, search for a customer or reference, and download the register.' },
      { selector: '[data-tour="credits-totals"]', title: 'Totals', say: 'How much credit there is, what’s been used, and what’s still sitting there.' },
      { selector: '[data-tour="credits-table"]', title: 'The register', say: 'One row per credit. Click a customer to open their record.' },
    ],
  },

  // ---------------------------------------------------------- Card processor
  {
    id: 'card-processor',
    title: 'Card transactions',
    description: 'Every charge on your card processor. Match the leftovers to an invoice, or ignore ones that aren’t yours.',
    route: /^\/accounting\/card-processor\/?$/,
    roadmap: [
      { title: 'Cards are charged', detail: 'In the field, at the counter or on the virtual terminal.' },
      { title: 'CrewBarn syncs hourly', detail: 'It matches what it recognises by itself.' },
      { title: 'Clear Needs matching', detail: 'Attach each leftover to an open invoice, or ignore it.' },
      { title: 'It flows on', detail: 'Matched card payments feed payments, deposits and bank match.' },
    ],
    use: {
      say: 'Once you match a charge, it counts as a payment on that invoice, so you’ll see it on Invoices and in Payments, voids and refunds. The card processor itself is connected in Tool Shed › Payments.',
      go: [
        { label: 'Go to Invoices', to: '/accounting/invoices' },
        { label: 'Payments, voids and refunds', to: '/accounting/cash-drawer/classic' },
        { label: 'Open Payments setup', to: '/tool-shed/payments' },
      ],
    },
    steps: [
      { selector: '[data-tour="processor-header"]', title: 'Every card charge', say: 'Every card charge your processor saw. Anything CrewBarn didn’t recognise waits here for you. Sync now pulls the latest.' },
      { selector: '[data-tour="processor-states"]', title: 'Counts are the filter', say: 'These counts are also the filter. Start with Needs matching.' },
      { selector: '[data-tour="processor-table"]', title: 'One row per charge', say: 'The card, type and where it came from. Match… opens the matching panel under a row.', optional: 'Nothing in this list' },
      { selector: '[data-tour="processor-match"]', title: 'Match or ignore', say: 'Pick the invoice this charge paid and confirm. If it isn’t yours, give a reason and ignore it; you can bring it back later.', optional: 'Open Match… on a row to see this' },
    ],
  },

  // ---------------------------------------------------------------- Expenses
  {
    id: 'expenses-workspace',
    title: 'Bills, expenses & receipts',
    description: 'Where the money went for a period, what’s aging, and who’s waiting to be paid back.',
    route: /^\/accounting\/expenses\/?$/,
    roadmap: [
      { title: 'Spending is recorded', detail: 'In the Expense register, on jobs or from bank rows. Bills go in Vendor bills.' },
      { title: 'Check the totals', detail: 'See what you spent and what’s aging.' },
      { title: 'Act', detail: 'Go to the register, bills or payroll to do something about it.' },
    ],
    use: {
      say: 'To add or fix a single expense, use the Expense register. Bills you owe vendors go in Vendor bills, and approved reimbursements are paid back from Payroll.',
      go: [
        { label: 'Open Expense register', to: '/accounting/expenses/register' },
        { label: 'Open Vendor bills', to: '/accounting/expenses/bills' },
        { label: 'Go to Payroll', to: '/accounting/payroll' },
      ],
    },
    steps: [
      { selector: '[data-tour="expenses-header"]', title: 'Pick the dates', say: 'Pick a date range to see where the money went.' },
      { selector: '[data-tour="expenses-metrics"]', title: 'The totals', say: 'Count, money out, what you can bill back, and what you owe your team and vendors.' },
      { selector: '[data-tour="expenses-categories"]', title: 'Spend by category', say: 'Your top spending categories for the range.' },
      { selector: '[data-tour="expenses-ap"]', title: 'AP aging', say: 'Open vendor bills by how old they are.' },
      { selector: '[data-tour="expenses-recent"]', title: 'Recent expenses', say: 'The latest expenses in the range.' },
      { selector: '[data-tour="expenses-reimb"]', title: 'Reimbursements', say: 'What your team is waiting to be paid back.' },
      { selector: '[data-tour="expenses-1099"]', title: '1099 readiness', say: 'Subcontractor totals for the tax year. You still file through your accountant or 1099 provider.' },
      { selector: '[data-tour="expenses-shortcuts"]', title: 'Where to go next', say: 'Shortcuts to bills, the register, receipts and the reports.' },
    ],
  },

  // ------------------------------------------------------------ Vendor bills
  {
    id: 'vendor-bills',
    title: 'Vendor bills',
    description: 'What you owe vendors, when it’s due, and what you’ve paid.',
    route: /^\/accounting\/expenses\/bills\/?$/,
    roadmap: [
      { title: 'A bill arrives', detail: 'Parts, rent, a subcontractor or anything else.' },
      { title: 'Add it', detail: 'Enter its total and due date here.' },
      { title: 'Pay it', detail: 'Record payments as you pay. The balance and status update.' },
      { title: 'It flows on', detail: 'A/P aging, the ledger and bank match pick it up.' },
    ],
    use: {
      say: 'Vendors you save in Vendors can be picked when you add a bill. Open bills feed the AP aging on the Expenses overview, and a bill payment can be matched to its bank line in Review bank matches.',
      go: [
        { label: 'Open Vendors', to: '/vendors' },
        { label: 'Expenses overview', to: '/accounting/expenses' },
        { label: 'Review bank matches', to: '/accounting/bank-match/review' },
      ],
    },
    steps: [
      { selector: '[data-tour="bills-header"]', title: 'What you owe', say: 'This is what you owe, when it’s due, and what you’ve paid.' },
      { selector: '[data-tour="bills-summary"]', title: 'Totals', say: 'These totals cover the bills currently loaded by your filter.' },
      { selector: '[data-tour="bills-add"]', title: 'Add a bill', say: 'Pick a saved vendor or type a name, fill in the amounts, and save.' },
      { selector: '[data-tour="bills-filters"]', title: 'Filters', say: 'Search and narrow the list.' },
      { selector: '[data-tour="bills-list"]', title: 'Record a payment', say: 'One card per bill. Type an amount, or leave it blank to pay the full balance. You’ll confirm first, and it’s dated today.' },
    ],
  },

  // -------------------------------------------------------- Expense register
  {
    id: 'expense-register',
    title: 'Expense register',
    description: 'Every dollar that goes out, plus reimbursement decisions.',
    route: /^\/accounting\/expenses\/register\/?$/,
    roadmap: [
      { title: 'Someone spends money', detail: 'A tech on fuel, or the office on rent.' },
      { title: 'Record it', detail: 'Add it here, or it arrives from a job receipt or a bank row.' },
      { title: 'Decide on reimbursements', detail: 'Approve or reject, then mark reimbursed (or do it in Payroll).' },
      { title: 'It flows on', detail: 'Expenses feed reports, the ledger and bank match.' },
    ],
    use: {
      say: 'Approved reimbursements wait in Payroll, where you mark them paid with the person’s pay. Receipts added on a job land here too, and each expense can be matched to its bank line in Review bank matches.',
      go: [
        { label: 'Go to Payroll', to: '/accounting/payroll' },
        { label: 'Review bank matches', to: '/accounting/bank-match/review' },
        { label: 'Expense report', to: '/accounting/reports/browse?layout=browser&report=expense-register' },
      ],
    },
    steps: [
      { selector: '[data-tour="register-exp-header"]', title: 'Every dollar out', say: 'Every dollar that goes out, in one list.' },
      { selector: '[data-tour="register-exp-summary"]', title: 'Totals', say: 'Totals for the rows on this page of the list.' },
      { selector: '[data-tour="register-exp-add"]', title: 'Add an expense', say: 'Fill the basics and save. Tick Reimburse tech if someone paid out of pocket.' },
      { selector: '[data-tour="register-exp-filters"]', title: 'Filters', say: 'Narrow by date, category, status, vendor, person or reimbursement state.' },
      { selector: '[data-tour="register-exp-table"]', title: 'The list', say: 'Each row shows who, what and how much. Reimbursement buttons appear when there’s a decision to make, and any error shows above the list.' },
    ],
  },

  // ---------------------------------------------------------- Inventory cost
  {
    id: 'inventory-cost',
    title: 'Inventory & PO cost',
    description: 'What your stock is worth and what you spent on purchase orders.',
    route: /^\/accounting\/inventory-cost\/?$/,
    roadmap: [
      { title: 'Parts are bought and received', detail: 'On purchase orders, and every movement is tied to a person.' },
      { title: 'See the value', detail: 'Stock value and purchasing spend in one place.' },
      { title: 'Drill in', detail: 'Purchase orders, Inventory, Movements or the reports for detail.' },
    ],
    use: {
      say: 'Stock value comes from parts you receive on Purchase orders, and every move after that is listed in Movements. To check counts or where parts sit, use Inventory.',
      go: [
        { label: 'Open Purchase orders', to: '/purchase-orders' },
        { label: 'Go to Inventory', to: '/inventory' },
        { label: 'Open Movements', to: '/inventory/movements' },
      ],
    },
    steps: [
      { selector: '[data-tour="inv-cost-header"]', title: 'Pick the dates', say: 'The dates control PO spend. Stock value is always “right now”.' },
      { selector: '[data-tour="inv-cost-metrics"]', title: 'The totals', say: 'What your stock is worth, how much is free to use, and what you spent on POs.' },
      { selector: '[data-tour="inv-cost-spend"]', title: 'PO spend', say: 'Your top spend lines. Switch how they’re grouped.' },
      { selector: '[data-tour="inv-cost-locations"]', title: 'Value by location', say: 'Where the value sits: warehouse or truck.' },
      { selector: '[data-tour="inv-cost-pos"]', title: 'Recent purchase orders', say: 'The latest POs in the range.' },
      { selector: '[data-tour="inv-cost-status"]', title: 'PO status', say: 'Order totals grouped by where each PO is now.' },
      { selector: '[data-tour="inv-cost-shortcuts"]', title: 'Where to go next', say: 'Shortcuts to purchase orders, inventory, movements and the reports.' },
    ],
  },

  // ------------------------------------------------------ Bank match overview
  {
    id: 'bank-match-workspace',
    title: 'Bank match overview',
    description: 'Check one account and period, save a statement review, and see what still needs matching.',
    route: /^\/accounting\/bank-match\/?$/,
    roadmap: [
      { title: 'Statement rows come in', detail: 'Imported or typed in on the review page.' },
      { title: 'Check the totals', detail: 'For one account and period.' },
      { title: 'Save a statement review', detail: 'Enter the bank’s ending balance to see the difference.' },
      { title: 'Match and close', detail: 'Use the detailed review to match rows, then close the run there.' },
    ],
    use: {
      say: 'The matching itself happens in Review bank matches. Deposits you record on the Cash register arrive there as single lines, ready to match.',
      go: [
        { label: 'Review bank matches', to: '/accounting/bank-match/review' },
        { label: 'Go to Cash register', to: '/accounting/cash-drawer' },
        { label: 'Bank reconciliation report', to: '/accounting/reports/browse?layout=browser&report=bank-reconciliation' },
      ],
    },
    steps: [
      { selector: '[data-tour="bank-ws-header"]', title: 'Pick the statement dates', say: 'Choose your statement dates. Nothing here matches or approves anything by itself.' },
      { selector: '[data-tour="bank-ws-account"]', title: 'One account at a time', say: 'Narrow to one bank account before you close a statement.' },
      { selector: '[data-tour="bank-ws-metrics"]', title: 'The totals', say: 'Bank rows, matched and unmatched, deposits, withdrawals and the net for this account and period.' },
      { selector: '[data-tour="bank-ws-unmatched"]', title: 'Rows needing review', say: 'The first rows that still need a decision.' },
      { selector: '[data-tour="bank-ws-review"]', title: 'Start a statement review', say: 'Enter the ending balance from your bank statement and save. You’ll confirm first, and CrewBarn works out the difference.' },
      { selector: '[data-tour="bank-ws-runs"]', title: 'Match status and saved reviews', say: 'Totals by status, and your recent saved reviews with their differences.' },
      { selector: '[data-tour="bank-ws-flows"]', title: 'Deposits and withdrawals', say: 'The most recent money in and out for this range.' },
      { selector: '[data-tour="bank-ws-shortcuts"]', title: 'Where to go next', say: 'Shortcuts to the review page, the audit log, the Cash register and the bank reconciliation report.' },
    ],
  },

  // -------------------------------------------------------- Bank match review
  {
    id: 'bank-match-review',
    title: 'Bank match review',
    description: 'Bring in your statement and match each line to what CrewBarn already knows.',
    route: /^\/accounting\/bank-match\/review\/?$/,
    roadmap: [
      { title: 'Money hits the bank', detail: 'Deposits (often from the Cash register) and withdrawals.' },
      { title: 'Bring in the statement', detail: 'Paste the CSV or add rows by hand.' },
      { title: 'Match', detail: 'Pick a suggestion, or mark other, ignore, create an expense, or split.' },
      { title: 'Check what’s missing', detail: 'Payments CrewBarn has that the bank doesn’t yet.' },
      { title: 'Close the run', detail: 'Save a reconciliation run and close it once the difference is $0.' },
    ],
    use: {
      say: 'Matching an invoice suggestion records the payment on that invoice, and creating an expense from a row adds it to the Expense register. To have deposits come in by themselves, connect your checking in Tool Shed › Watch your bank for payments.',
      go: [
        { label: 'Go to Invoices', to: '/accounting/invoices' },
        { label: 'Open Expense register', to: '/accounting/expenses/register' },
        { label: 'Watch your bank', to: '/tool-shed/payments/watch-bank' },
      ],
    },
    steps: [
      { selector: '[data-tour="bank-review-header"]', title: 'Match your statement', say: 'Bring in your statement and match each line to what CrewBarn already knows.' },
      { selector: '[data-tour="bank-review-summary"]', title: 'This page at a glance', say: 'Rows on this page, how many have suggestions, and the net total.' },
      { selector: '[data-tour="bank-review-recon"]', title: 'Statement reconciliation', say: 'Save a run for this period with the bank’s ending balance. When the difference hits zero, close it.' },
      { selector: '[data-tour="bank-review-missing"]', title: 'Payments not found in the bank', say: 'Payments you recorded that don’t have a bank row yet. Import the deposit, then match it.' },
      { selector: '[data-tour="bank-review-add"]', title: 'Add one row', say: 'Type a single line from the statement. Positive for deposits, negative for withdrawals.' },
      { selector: '[data-tour="bank-review-csv"]', title: 'Paste a CSV', say: 'Paste rows straight from your bank’s CSV. Date, Description and Amount, or Debit and Credit, work.' },
      { selector: '[data-tour="bank-review-filters"]', title: 'Filters', say: 'Search and narrow by date, status and type.' },
      { selector: '[data-tour="bank-review-rows"]', title: 'Match each row', say: 'Suggestions sit beside each row. Click one and confirm to match; for an invoice suggestion that also records the payment. If anything is refused, the reason shows above the list.' },
    ],
  },

  // ----------------------------------------------------------------- Ledger
  {
    id: 'general-ledger',
    title: 'General ledger',
    description: 'Review the books, make adjustments, and close or lock finished periods.',
    route: /^\/accounting\/ledger\/?$/,
    roadmap: [
      { title: 'Entries post themselves', detail: 'Invoices, payments, expenses, bills, payroll and refunds post journal entries automatically.' },
      { title: 'Check the books', detail: 'Make sure nothing is missing and everything balances.' },
      { title: 'Adjust', detail: 'Manual journals, owner draws and tax payments.' },
      { title: 'Close', detail: 'Close or lock the month, and close the year to retained earnings.' },
      { title: 'Hand off', detail: 'Give the PDFs and spreadsheets to your CPA.' },
    ],
    use: {
      say: 'For files to hand your CPA, the Report workspace has registers, aging and the posting audit as downloads. If your accountant uses their own account codes, Sync mappings translates them and exports posted entries for Xero.',
      go: [
        { label: 'Open Sync mappings', to: '/accounting/sync-mappings' },
        { label: 'Open Report workspace', to: '/accounting/reports/browse' },
      ],
    },
    steps: [
      { selector: '[data-tour="ledger-header"]', title: 'Your general ledger', say: 'Most entries post themselves. This is where you review them and make adjustments.' },
      { selector: '[data-tour="ledger-filters"]', title: 'Dates', say: 'From and To drive the period reports. As of drives the trial balance and balance sheet.' },
      { selector: '[data-tour="ledger-metrics"]', title: 'The headline numbers', say: 'Trial balance debits and credits, whether they balance, net income, assets, the balance sheet check and the change in cash.' },
      { selector: '[data-tour="ledger-posting-audit"]', title: 'Posting audit', say: 'Anything that should have posted to the ledger but didn’t shows up here. Zero is the goal.' },
      { selector: '[data-tour="ledger-statements"]', title: 'Income statement and balance sheet', say: 'Profit and loss for the range, and what you own and owe as of the date. Click any account to see its lines.' },
      { selector: '[data-tour="ledger-trial"]', title: 'Trial balance', say: 'Your CPA’s hand-off view. Set As of to month, quarter or year end.' },
      { selector: '[data-tour="ledger-journals"]', title: 'Journal entries', say: 'Every entry in the range, with its real status on the badge.' },
      { selector: '[data-tour="ledger-manual-journal"]', title: 'Manual journal entry', say: 'For opening balances, corrections and adjustments. Debits must equal credits before you can post.' },
      { selector: '[data-tour="ledger-year-end"]', title: 'Year-end close', say: 'Moves the year’s revenue and expenses into retained earnings with one entry.' },
      { selector: '[data-tour="ledger-periods"]', title: 'Close or lock a month', say: 'Close a month you’ve reviewed, or lock it so nothing can change it. You’ll confirm first, and you can reopen it if you need to.' },
    ],
  },

  // -------------------------------------------------------------- Sync maps
  {
    id: 'sync-mappings',
    title: 'Sync mappings',
    description: 'Translate CrewBarn’s names into your accountant’s codes for exports.',
    route: /^\/accounting\/sync-mappings\/?$/,
    roadmap: [
      { title: 'Get the codes', detail: 'Your accountant gives you their account codes.' },
      { title: 'Map them', detail: 'Add a mapping for each CrewBarn key that needs translating.' },
      { title: 'Export', detail: 'Download the mappings CSV, or the Xero journal CSV for a date range.' },
    ],
    use: {
      say: 'The posted journal entries you export are the ones you review and close in the General ledger, so check the month there before you send it. The account numbers on the CrewBarn side are listed there too.',
      go: [
        { label: 'Go to General ledger', to: '/accounting/ledger' },
      ],
    },
    steps: [
      { selector: '[data-tour="sync-header"]', title: 'Translate for your accountant', say: 'Translate CrewBarn’s names into your accountant’s codes. This only shapes exports.' },
      { selector: '[data-tour="sync-form"]', title: 'Add a mapping', say: 'Pick the provider and type, then say which CrewBarn thing maps to which outside code. Check the spelling, because the CrewBarn side is free text.' },
      { selector: '[data-tour="sync-xero"]', title: 'Xero journal export', say: 'Download posted journal entries in a Xero-friendly CSV for any range.' },
      { selector: '[data-tour="sync-list"]', title: 'Your mappings', say: 'Search, edit or remove mappings. Removing one asks first.' },
    ],
  },
]
