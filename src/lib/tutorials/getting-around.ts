import type { TutorialData } from './types'

/**
 * Getting around: the main menu and everything around it, in whichever
 * layout the person uses (Top bar, Side bar, Rail, Easy · Side bar,
 * Easy · Top bar, and the slide-out menu on narrow screens).
 *
 * Each part of the menu is pointed at with one selector per layout, joined
 * with commas, so the person sees their own menu lit up. Steps for parts
 * that only exist in other layouts are skipped by the player.
 *
 * Kept import-free (types aside) so the voice exporter can load it on its own.
 * Nothing here saves or changes a setting: the + menu, the account menu and
 * Tool Shed are opened and closed, the Rail panel is switched and switched
 * back, and Appearance is only pointed at. The layout is never changed.
 */

const t = (id: string) => `[data-tour=${JSON.stringify(id)}]`

const HOME = '^/$'
const JOBS = '^/jobs/?$'
const ACCOUNTING = '^/accounting/?$'
const TOOL_SHED = '^/tool-shed/?$'
const APPEARANCE = '^/tool-shed/appearance/?$'

/** The app shell, marked with the layout in use. */
const CLASSIC = t('layout-classic')
const PRO = t('layout-pro')
const RAIL = t('layout-rail')
/** Focus: the rail shell, with compact, task-first work pages. */
const FOCUS_SHELL = t('layout-focus')
/** A part of the rail, in the Rail or the Focus layout. */
const onRail = (marker: string) => `${RAIL} ${t(marker)}, ${FOCUS_SHELL} ${t(marker)}`
const EASY_SIDE = t('layout-easy-side')
const EASY_TOP = t('layout-easy-top')

/** One main-menu item, wherever the layout puts it. */
const item = (slug: string, rail = `rail-item-${slug}`) =>
  [t(`nav-${slug}`), t(`sidebar-${slug}`), t(`drawer-${slug}`), t(rail)].join(', ')

const MENU = `${t('nav-dashboard')}, ${t('sidebar-nav')}, ${t('rail-categories')}, ${t('mobile-menu')}`
const TOOL_SHED_BUTTON = `${t('nav-tool-shed')}, ${t('sidebar-tool-shed')}`
const TOOL_SHED_OPEN = `${t('toolshed-menu')}, ${t('sidebar-tool-shed-panel')}`
const JOBS_ITEM = `${t('nav-jobs')}, ${t('sidebar-jobs')}, ${t('drawer-jobs')}, ${t('rail-item-jobs')}`
const RAIL_WORK = t('rail-work')
/** Appearance's Layout tab (the section nav marks each tab with its description). */
const LAYOUT_TAB = `${t('appearance-tabs')} button[title^="Top bar"]`

export const TUTORIAL: TutorialData = {
  id: 'getting-around',
  kicker: 'Getting around · tutorial',
  title: 'Finding your way around',
  film: [
    {
      id: 'map',
      label: 'The lay of the land',
      title: 'Four ways to get around',
      narration:
        'CrewBarn has a main menu for your daily work, tabs inside the bigger sections, a Tool Shed for setting up the shop, and a bar of tools across the top. Let’s walk through each one.',
    },
    {
      id: 'menu',
      label: 'The main menu',
      title: 'The places you go every day',
      narration:
        'The main menu holds your everyday places: Dashboard, Jobs, Tasks, Estimates, Customers, Schedule, Dispatch and Accounting. You only see the ones your role can open.',
    },
    {
      id: 'layouts',
      label: 'Every layout',
      title: 'Same menu, different place',
      narration:
        'You can pick your layout: a menu across the top, a side bar, a rail of five headings, Focus, or one of the Easy looks. On a phone it folds into a slide-out menu. The menu works the same in each, just in a different place.',
    },
    {
      id: 'tabs',
      label: 'Section tabs',
      title: 'Pages inside a section',
      narration:
        'Bigger sections, like Accounting, have pages of their own. Depending on your layout, they show as tabs along the top, a More menu, or a panel beside the rail.',
    },
    {
      id: 'toolshed',
      label: 'Tool Shed',
      title: 'Tool Shed and Connect',
      narration:
        'Tool Shed holds how your shop runs: catalogs, job statuses, staff, connections and more. Company settings live on CrewBarn Connect, and Tool Shed links you straight there.',
    },
    {
      id: 'tools',
      label: 'The top bar',
      title: 'Tools that follow you',
      narration:
        'The top bar follows you to every page: messages, calls, intake, CBI, search, catalogs, the plus button for something new, notifications, Tutorial and Help. Your initials open your own menu.',
    },
    {
      id: 'yourturn',
      label: 'Your turn',
      title: 'Now let’s walk yours',
      narration:
        'That’s the idea. Now let’s walk your real menu, in the layout you use. I’ll step back into the corner and point at each part. When it’s your turn, you click. If you’d rather watch, press Do it for me.',
    },
  ],
  chapters: [
    { key: 'start', label: 'Your layout and home' },
    { key: 'menu', label: 'The main menu' },
    { key: 'sections', label: 'Tabs inside a section' },
    { key: 'toolshed', label: 'Tool Shed and Connect' },
    { key: 'topbar', label: 'The top bar tools' },
    { key: 'account', label: 'Your account menu' },
    { key: 'layouts', label: 'Switching layouts' },
  ],
  steps: [
    // ---------- Your layout and home ----------
    {
      id: 'start-welcome', chapter: 'start', route: HOME, open: 'goto:/',
      title: 'Finding your way around',
      say: 'Let’s find our way around. Whatever layout you use, I’ll light up your own menu as we go, and skip the parts that belong to other layouts.',
    },
    {
      id: 'start-brand', chapter: 'start', route: HOME,
      selector: [CLASSIC, PRO, EASY_SIDE, EASY_TOP].map((l) => `${l} ${t('shell-brand')}`).join(', '),
      title: 'Your workspace',
      say: 'In the corner is CrewBarn and your company’s name. That’s your workspace. Click it from any page to come home to the dashboard.',
    },
    {
      id: 'start-brand-rail', chapter: 'start', route: HOME, selector: onRail('shell-brand'),
      title: 'Home',
      say: 'At the top of the rail is your way home. Click it from any page to come back to the dashboard.',
    },
    {
      id: 'start-layout-classic', chapter: 'start', route: HOME, selector: `${CLASSIC} ${t('topbar')}`,
      title: 'You’re on Top bar',
      say: 'You’re using the Top bar layout. The main menu runs across the top with Tool Shed at the end, and some sections add a row of tabs underneath.',
    },
    {
      id: 'start-layout-easy-top', chapter: 'start', route: HOME, selector: `${EASY_TOP} ${t('topbar')}`,
      title: 'You’re on Easy · Top bar',
      say: 'You’re using Easy · Top bar. Your company name sits on its own line, the menu runs across the top on very wide screens, and every section shows its pages as big tabs.',
    },
    {
      id: 'start-layout-pro', chapter: 'start', route: HOME, selector: `${PRO} ${t('sidebar')}`,
      title: 'You’re on Side bar',
      say: 'You’re using the Side bar layout. The menu runs down the left, with Messages, Calls and Intake under it and Tool Shed at the bottom. The slim bar on top keeps your tools.',
    },
    {
      id: 'start-layout-easy-side', chapter: 'start', route: HOME, selector: `${EASY_SIDE} ${t('sidebar')}`,
      title: 'You’re on Easy · Side bar',
      say: 'You’re using Easy · Side bar. The menu runs down the left, Parts has its own place in it, and every section shows its pages as big tabs.',
    },
    {
      id: 'start-layout-rail', chapter: 'start', route: HOME, selector: `${RAIL} ${t('rail-categories')}`,
      title: 'You’re on Rail',
      say: 'You’re using the Rail. Five headings run down the edge: Work, Comms, Money, Files and Setup. Each one opens a panel of everything under it.',
    },
    {
      id: 'start-layout-focus', chapter: 'start', route: HOME, selector: `${FOCUS_SHELL} ${t('rail-categories')}`,
      title: 'You’re on Focus',
      say: 'You’re using Focus. Five headings run down a slim edge: Work, Comms, Money, Files and Setup, each with a panel of its pages. The work pages are compact: one list at a time, and details folded away until you need them.',
    },
    {
      id: 'start-narrow', chapter: 'start', route: HOME, selector: t('mobile-menu'),
      title: 'The three lines',
      say: 'Your window is narrow right now, so the menu has folded into this button with three lines. It opens a menu that slides in from the left. We’ll open it in a moment.',
    },
    {
      id: 'start-same', chapter: 'start', route: HOME, selector: t('topbar'),
      title: 'Same places, any layout',
      say: 'Every layout has the same places in it. Only where they sit changes. You can switch layouts whenever you like, and we’ll see how at the end.',
    },

    // ---------- The main menu ----------
    {
      id: 'menu-intro', chapter: 'menu', route: HOME, open: 'goto:/', selector: MENU,
      title: 'Your main menu',
      say: 'This is your main menu, the places you go every day. You only see the ones your role can open, so yours may be shorter than a coworker’s.',
    },
    {
      id: 'menu-drawer-open', chapter: 'menu', route: HOME, selector: t('mobile-menu'),
      wait: { appear: t('mobile-drawer') }, doIt: t('mobile-menu'),
      yourTurn: 'Tap the three lines.',
      title: 'Open the menu',
      say: 'On a narrow screen, your menu is behind the three lines. Tap them to open it.',
    },
    {
      id: 'menu-drawer', chapter: 'menu', route: HOME, selector: t('mobile-drawer'),
      title: 'The slide-out menu',
      say: 'Here’s the slide-out menu. The main places come first, then Messages, Calls and Intake, then your Tool Shed, and your account at the bottom.',
    },
    {
      id: 'menu-rail-work', chapter: 'menu', route: HOME, click: RAIL_WORK, selector: RAIL_WORK,
      title: 'Work',
      say: 'In the Rail, Work holds your day: Dashboard, Schedule and Dispatch, then Jobs, Estimates, Contracts and Tasks, then Customers, Assets, Warranties and Inventory.',
    },
    {
      id: 'menu-rail-panel', chapter: 'menu', route: HOME, click: RAIL_WORK, selector: t('rail-panel'),
      title: 'The panel',
      say: 'The panel beside the rail shows what’s under the heading you picked. It stays open while you click around, because the next place you want is usually next door.',
    },
    {
      id: 'menu-rail-try', chapter: 'menu', route: HOME, selector: t('rail-money'),
      wait: { click: true }, doIt: t('rail-money'),
      yourTurn: 'Click Money.',
      title: 'Look under Money',
      say: 'Click Money to see what’s under it. It only changes the panel. You stay right here.',
    },
    {
      id: 'menu-rail-money', chapter: 'menu', route: HOME, selector: t('rail-panel'),
      title: 'Under Money',
      say: 'Money has your everyday pages, Money desk, Cash register and Invoices, then what you pay out, then the pages for closing the books, like Sales tax, Reports and Bank match.',
    },
    {
      id: 'menu-rail-others', chapter: 'menu', route: HOME, selector: t('rail-categories'),
      title: 'The other headings',
      say: 'Comms is messages, calls and intake. Files is company files, custom documents and imports. Setup is what you sell, your people, and all your settings.',
    },
    {
      id: 'menu-rail-back', chapter: 'menu', route: HOME, click: RAIL_WORK, selector: t('rail-panel'),
      title: 'Back to Work',
      say: 'I’ve put the panel back on Work for you.',
    },
    {
      id: 'menu-dashboard', chapter: 'menu', route: HOME, click: RAIL_WORK, selector: item('dashboard'),
      title: 'Dashboard',
      say: 'Dashboard is your home page: today’s jobs, the money, dispatch, and a board you build yourself. It’s where CrewBarn opens after you sign in.',
    },
    {
      id: 'menu-jobs', chapter: 'menu', route: HOME, click: RAIL_WORK, selector: item('jobs'),
      title: 'Jobs',
      say: 'Jobs is the board of every job, from the first call to paid. A small colored number beside it means work from a partner company is waiting on you.',
    },
    {
      id: 'menu-tasks', chapter: 'menu', route: HOME, click: RAIL_WORK, selector: item('tasks'),
      title: 'Tasks',
      say: 'Tasks holds to-dos and follow-ups, on their own or tied to a job or a customer.',
    },
    {
      id: 'menu-estimates', chapter: 'menu', route: HOME, click: RAIL_WORK, selector: item('estimates'),
      title: 'Estimates',
      say: 'Estimates are your prices before the work starts. You send one, the customer says yes or no, and a yes turns into a job.',
    },
    {
      id: 'menu-customers', chapter: 'menu', route: HOME, click: RAIL_WORK, selector: item('customers'),
      title: 'Customers',
      say: 'Customers is everyone you work for, with their places, equipment, jobs, invoices and history.',
    },
    {
      id: 'menu-schedule', chapter: 'menu', route: HOME, click: RAIL_WORK, selector: item('schedule'),
      title: 'Schedule',
      say: 'Schedule is the calendar. Jobs still waiting for a date sit on the left, and you drag them onto a day.',
    },
    {
      id: 'menu-dispatch', chapter: 'menu', route: HOME, click: RAIL_WORK, selector: item('dispatch'),
      title: 'Dispatch',
      say: 'Dispatch is today, live: your techs on a map, today’s jobs, and the ones still waiting for someone. An amber number means requests for work are waiting.',
    },
    {
      id: 'menu-parts', chapter: 'menu', route: HOME, click: RAIL_WORK, selector: item('inventory'),
      title: 'Parts',
      say: 'Parts is your stock: what’s on the shelf and in the vans, purchase orders and vendors. The Easy layouts put it right in the menu. In the Rail it’s called Inventory, and elsewhere it’s in Tool Shed.',
    },
    {
      id: 'menu-accounting', chapter: 'menu', route: HOME, click: RAIL_WORK, selector: item('accounting', 'rail-money'),
      title: 'Accounting',
      say: 'Accounting is the money: the Money desk, invoices, payments, expenses, payroll and reports. In the Rail it’s the Money heading. An amber number means money your techs collected is waiting to be checked in.',
    },
    {
      id: 'menu-franchise', chapter: 'menu', route: HOME, click: RAIL_WORK, selector: item('franchises'),
      title: 'Franchise',
      say: 'If your company runs franchise locations, Franchise shows up here for the people allowed to see it.',
    },
    {
      id: 'menu-comms', chapter: 'menu', route: HOME,
      selector: `${t('sidebar-communications')}, ${t('drawer-communications')}, ${t('rail-comms')}`,
      title: 'Messages, Calls and Intake',
      say: 'Messages, Calls and Intake live here in your layout: your texts and emails, your phone log, and calls turned into draft jobs. We’ll look at them again with the top bar tools.',
    },
    {
      id: 'menu-try-jobs', chapter: 'menu', route: HOME, click: RAIL_WORK, selector: JOBS_ITEM,
      wait: { route: '^/jobs' }, doIt: JOBS_ITEM,
      yourTurn: 'Click Jobs.',
      title: 'Your turn: open Jobs',
      say: 'Your turn. Click Jobs. It only opens the page.',
    },
    {
      id: 'menu-on-jobs', chapter: 'menu', route: JOBS,
      selector: `${t('nav-jobs')}, ${t('sidebar-jobs')}, ${t('rail-item-jobs')}, ${t('jobs-header')}`,
      title: 'You are here',
      say: 'Here’s the Jobs board. Your menu marks the page you’re on, so you always know where you are.',
    },
    {
      id: 'menu-come-back', chapter: 'menu', route: JOBS, selector: t('shell-brand'),
      wait: { route: HOME }, doIt: t('shell-brand'),
      yourTurn: 'Go back to the dashboard.',
      title: 'Come back',
      say: 'Now head back. Click Dashboard in the menu, or the CrewBarn mark in the corner.',
    },
    {
      id: 'menu-rail-collapse', chapter: 'menu', route: HOME, selector: t('rail-collapse'),
      title: 'Collapse',
      say: 'Collapse tucks the panel away when you want more room. Click any heading on the rail to bring it back.',
    },
    {
      id: 'menu-drawer-close', chapter: 'menu', route: HOME, selector: t('drawer-close'),
      wait: { gone: t('mobile-drawer') }, doIt: t('drawer-close'),
      yourTurn: 'Close the menu.',
      title: 'Close the menu',
      say: 'Close the slide-out menu with the X, or tap outside it.',
    },

    // ---------- Tabs inside a section ----------
    {
      id: 'sec-intro', chapter: 'sections', route: ACCOUNTING, open: 'goto:/accounting',
      selector: `${t('subnav')}, ${t('easy-section-tabs')}, ${t('rail-panel')}, ${t('accounting-tools')}`,
      title: 'Pages inside a section',
      say: 'Some menu items open a whole section with pages of its own. Accounting is the biggest, so let’s see how your layout shows its pages.',
    },
    {
      id: 'sec-subnav', chapter: 'sections', route: ACCOUNTING, selector: t('subnav'),
      title: 'The row under the menu',
      say: 'In the Top bar layout, a second row under the menu holds the section’s main pages: Money desk, Cash register, Purchase orders, Payroll, Sales tax and Reports. The page you’re on stands out in dark text.',
    },
    {
      id: 'sec-more', chapter: 'sections', route: ACCOUNTING, selector: t('subnav-more'),
      wait: { appear: t('subnav-more-menu') }, doIt: t('subnav-more'),
      yourTurn: 'Click More.',
      title: 'More',
      say: 'The rest are under More. Click it.',
    },
    {
      id: 'sec-more-menu', chapter: 'sections', route: ACCOUNTING, selector: t('subnav-more-menu'),
      title: 'Nothing hidden',
      say: 'Overview and charts, Invoices, Credits, Expenses, Vendor bills, Inventory cost, Bank match, Ledger and Sync maps. Nothing’s hidden, just tucked away.',
    },
    {
      id: 'sec-more-close', chapter: 'sections', route: ACCOUNTING, selector: t('subnav-more'),
      wait: { gone: t('subnav-more-menu') }, doIt: t('subnav-more'),
      yourTurn: 'Close More.',
      title: 'Close it',
      say: 'Click anywhere outside it, or press Escape, to close it again.',
    },
    {
      id: 'sec-easy', chapter: 'sections', route: ACCOUNTING, selector: t('easy-section-tabs'),
      title: 'Big tabs',
      say: 'In the Easy layouts, every page of the section is a tab: Money desk, Invoices, Bank match, Expenses, Bills, Payroll, Cash drawer, Cards, Credits, Sales tax, Ledger, Reports and Sync mappings.',
    },
    {
      id: 'sec-easy-current', chapter: 'sections', route: ACCOUNTING, selector: t('easy-tab-accounting'),
      title: 'Where you are',
      say: 'The tab with the amber line is the page you’re on. Click any other tab to hop over.',
    },
    {
      id: 'sec-rail', chapter: 'sections', route: ACCOUNTING, selector: t('rail-panel'),
      title: 'The panel follows you',
      say: 'In the Rail, the panel shows Money by itself while you’re in Accounting, so every money page is one click away.',
    },
    {
      id: 'sec-tools', chapter: 'sections', route: ACCOUNTING, selector: t('accounting-tools'),
      title: 'Accounting tools',
      say: 'In every layout, Accounting tools at the top of the Money desk lists every money page in three groups. In the Side bar layout, this is how you get around Accounting.',
    },
    {
      id: 'sec-others', chapter: 'sections', route: ACCOUNTING,
      title: 'Other sections',
      say: 'Other sections have tabs too. In the Top bar layout, Jobs, Estimates and Customers do. In the Easy layouts, Jobs, Customers, Parts, Dispatch, Estimates, and Inbox for messages, calls and intake.',
    },

    // ---------- Tool Shed and Connect ----------
    {
      id: 'ts-intro', chapter: 'toolshed', route: HOME, open: 'goto:/',
      selector: `${t('nav-tool-shed')}, ${t('sidebar-tool-shed')}, ${t('rail-setup')}, ${t('mobile-menu')}`,
      title: 'Tool Shed',
      say: 'Tool Shed is for how the shop runs: catalogs, job statuses, staff, connections and more. Daily work stays in the main menu.',
    },
    {
      id: 'ts-rail', chapter: 'toolshed', route: HOME, selector: onRail('rail-setup'),
      title: 'Setup',
      say: 'On the rail, Tool Shed lives under Setup: what you sell, your people, and All settings, which opens the full Tool Shed page.',
    },
    {
      id: 'ts-narrow', chapter: 'toolshed', route: HOME, selector: t('mobile-menu'),
      title: 'On a narrow screen',
      say: 'On a narrow screen, Tool Shed is inside the slide-out menu, under the main places.',
    },
    {
      id: 'ts-open', chapter: 'toolshed', route: HOME, selector: TOOL_SHED_BUTTON,
      wait: { appear: TOOL_SHED_OPEN }, doIt: TOOL_SHED_BUTTON,
      yourTurn: 'Open Tool Shed.',
      title: 'Open Tool Shed',
      say: 'Open it now. In the Top bar it drops down when you point at it or click it. In the Side bar it opens right inside the menu.',
    },
    {
      id: 'ts-hover', chapter: 'toolshed', route: HOME, selector: t('toolshed-menu'),
      title: 'Rest your pointer here',
      say: 'Rest your pointer on the menu while we look. It closes when your pointer leaves it.',
    },
    {
      id: 'ts-connect', chapter: 'toolshed', route: HOME, selector: t('toolshed-connect'),
      title: 'Business settings',
      say: 'Business settings, at the top, has Open Connect. That opens CrewBarn Connect in a new tab, where your company, team and connections are set up.',
    },
    {
      id: 'ts-create', chapter: 'toolshed', route: HOME, selector: t('toolshed-section-create-send'),
      title: 'Create & Send',
      say: 'Create and Send: automations, templates and forms, service agreements, and bringing data in or out.',
    },
    {
      id: 'ts-inventory', chapter: 'toolshed', route: HOME, selector: t('toolshed-section-inventory-assets'),
      title: 'Inventory & Assets',
      say: 'Inventory and Assets: your stock, your service and product catalogs, customer equipment, company tools, vendors, purchase orders and warranties.',
    },
    {
      id: 'ts-workflow', chapter: 'toolshed', route: HOME, selector: t('toolshed-section-customers-workflow'),
      title: 'Customers & Workflow',
      say: 'Customers and Workflow: job types, job statuses, tags, customer types, service locations, territories and custom fields.',
    },
    {
      id: 'ts-team', chapter: 'toolshed', route: HOME, selector: t('toolshed-section-team-access'),
      title: 'Team & Access',
      say: 'Team and Access: staff and crews, hiring, subcontractors, roles and permissions, time off, and security.',
    },
    {
      id: 'ts-connections', chapter: 'toolshed', route: HOME, selector: t('toolshed-section-connections'),
      title: 'Connections',
      say: 'Connections: integrations, phone, texts and email, CBI, maps, GPS devices, your label printer and more.',
    },
    {
      id: 'ts-business', chapter: 'toolshed', route: HOME, selector: t('toolshed-section-business-controls'),
      title: 'Business Controls',
      say: 'Business Controls: company info, brand, pricing, taxes, payments, modules, your subscription and the audit log.',
    },
    {
      id: 'ts-short', chapter: 'toolshed', route: HOME, selector: TOOL_SHED_OPEN,
      title: 'Why some groups are short',
      say: 'If a group looks short or missing, that’s on purpose. You only see what your role allows, and company settings normally live on Connect instead of here.',
    },
    {
      id: 'ts-footer', chapter: 'toolshed', route: HOME, selector: t('toolshed-menu-footer'),
      title: 'The way to Connect',
      say: 'Along the bottom, a note says where company settings are kept, with a link to Connect.',
    },
    {
      id: 'ts-full', chapter: 'toolshed', route: HOME, selector: t('toolshed-open-full'),
      title: 'The full Tool Shed',
      say: 'Open full Tool Shed, called Open work tools in the Easy layouts, takes you to the whole Tool Shed page.',
    },
    {
      id: 'ts-close', chapter: 'toolshed', route: HOME, selector: TOOL_SHED_BUTTON,
      wait: { gone: TOOL_SHED_OPEN }, doIt: TOOL_SHED_BUTTON,
      yourTurn: 'Close Tool Shed.',
      title: 'Close it',
      say: 'Close it by clicking Tool Shed again. In the Top bar it also closes when your pointer moves away.',
    },
    {
      id: 'ts-page', chapter: 'toolshed', route: TOOL_SHED, open: 'goto:/tool-shed', selector: t('toolshed-header'),
      title: 'The Tool Shed page',
      say: 'This is the full Tool Shed page. Every tool you can open is a card here, in any layout.',
    },
    {
      id: 'ts-page-connect', chapter: 'toolshed', route: TOOL_SHED,
      selector: `${t('toolshed-connect-note')}, ${t('toolshed-connect-strip')}`,
      title: 'Connect, again',
      say: 'Here’s the way to Connect again. Company settings like your company info, money, team and connections are kept there, and Open Connect opens it in a new tab.',
    },
    {
      id: 'ts-page-search', chapter: 'toolshed', route: TOOL_SHED, selector: t('toolshed-search'),
      title: 'Search settings',
      say: 'Search finds a setting by its name or what it does. Try a word like tax or texts.',
    },
    {
      id: 'ts-page-cards', chapter: 'toolshed', route: TOOL_SHED, selector: t('toolshed-cards'),
      title: 'Your cards',
      say: 'Each card opens one setting. Customize, at the top, lets you drag the cards into your own order and hide the ones you don’t use. That’s kept on this computer.',
    },

    // ---------- The top bar tools ----------
    {
      id: 'tb-intro', chapter: 'topbar', route: HOME, open: 'goto:/', selector: t('topbar'),
      title: 'The top bar',
      say: 'The bar across the top is in every layout, and its tools work from any page.',
    },
    {
      id: 'tb-messages', chapter: 'topbar', route: HOME,
      selector: `${t('topbar-comms')}[href="/communications"], ${t('sidebar-communications')}`,
      title: 'Messages',
      say: 'Messages is your inbox for customer texts and emails. In the Top bar it’s up here. In the Side bar it’s under Communication, and in the Rail it’s under Comms.',
    },
    {
      id: 'tb-calls', chapter: 'topbar', route: HOME,
      selector: `${t('topbar-comms')}[href="/calls"], ${t('sidebar-calls')}`,
      title: 'Calls',
      say: 'Calls is your phone log. The amber number is calls still waiting on someone.',
    },
    {
      id: 'tb-intake', chapter: 'topbar', route: HOME,
      selector: `${t('topbar-comms')}[href="/intake"], ${t('sidebar-intake')}`,
      title: 'Intake',
      say: 'Intake is where calls and texts become draft jobs for you to check before they go on the board.',
    },
    {
      id: 'tb-cbi', chapter: 'topbar', route: HOME, selector: t('topbar-cbi'),
      title: 'CBI',
      say: 'CBI is your AI helper. Ask about jobs, customers, money or the schedule in plain words. If it wants to change something, you confirm first.',
    },
    {
      id: 'tb-search', chapter: 'topbar', route: HOME, selector: t('topbar-search'),
      title: 'Search',
      say: 'The magnifying glass finds a customer, job, estimate or catalog by name or number. Ctrl or Cmd plus K opens it from anywhere.',
    },
    {
      id: 'tb-catalogs', chapter: 'topbar', route: HOME, selector: '[data-header-actions] [aria-label="Catalogs"]',
      title: 'Catalogs',
      say: 'The book opens your shop’s catalogs, the parts and price books you keep. Alt plus C opens it from anywhere.',
    },
    {
      id: 'tb-create', chapter: 'topbar', route: HOME, selector: t('topbar-create'),
      wait: { appear: t('topbar-create-menu') }, doIt: `${t('topbar-create')} button`,
      yourTurn: 'Click the orange plus.',
      title: 'Start something new',
      say: 'The orange plus starts something new from any page. Click it.',
    },
    {
      id: 'tb-create-menu', chapter: 'topbar', route: HOME, selector: t('topbar-create-menu'),
      title: 'What you can start',
      say: 'New Job, New Task, New Estimate, New Service Agreement, New Customer and New Asset. Each opens a blank form, and nothing is made until you save it.',
    },
    {
      id: 'tb-create-close', chapter: 'topbar', route: HOME, selector: t('topbar-create'),
      wait: { gone: t('topbar-create-menu') }, doIt: 'menu:close',
      yourTurn: 'Click anywhere outside the menu.',
      title: 'Close it',
      say: 'We won’t start anything now. Click anywhere outside the menu to close it.',
    },
    {
      id: 'tb-bell', chapter: 'topbar', route: HOME, selector: t('topbar-bell'),
      title: 'Notifications',
      say: 'The bell is the office’s shared notifications, for money events like disputes and refunds. Click one to go straight to it.',
    },
    {
      id: 'tb-tutorial', chapter: 'topbar', route: HOME, selector: t('tutorial-launch'),
      title: 'Tutorial',
      say: 'The graduation cap with a gold dot is the Tutorial button. It shows on every page that has a tutorial, and teaches that page.',
    },
    {
      id: 'tb-help', chapter: 'topbar', route: HOME, selector: t('topbar-help'),
      title: 'Help',
      say: 'The question mark opens Help for the page you’re on, or press the question mark key. Help is also where you’ll find this tour again, under Finding your way around.',
    },

    // ---------- Your account menu ----------
    {
      id: 'acct-open', chapter: 'account', route: HOME, open: 'goto:/', selector: t('user-menu'),
      wait: { appear: t('user-menu-panel') }, doIt: t('user-menu'),
      yourTurn: 'Click your initials.',
      title: 'Your own menu',
      say: 'Your initials, at the right end of the top bar, open your own menu. Click them.',
    },
    {
      id: 'acct-panel', chapter: 'account', route: HOME, selector: t('user-menu-panel'),
      title: 'What’s in it',
      say: 'At the top is the email you’re signed in with and your role. Then Bugs and Ideas, to tell us something, My time off, My account, and Help. Sign out is at the bottom.',
    },
    {
      id: 'acct-layouts', chapter: 'account', route: HOME, selector: t('user-menu-layouts'),
      title: 'Layout preview',
      say: 'Layout preview switches you straight to Easy · Side bar or Easy · Top bar, and All layouts opens Appearance with every choice. Leave these for now; we’ll go to Appearance at the end.',
    },
    {
      id: 'acct-close', chapter: 'account', route: HOME, selector: t('user-menu'),
      wait: { gone: t('user-menu-panel') }, doIt: 'menu:close',
      yourTurn: 'Click anywhere outside the menu.',
      title: 'Close it',
      say: 'Click anywhere outside the menu to close it.',
    },
    {
      id: 'acct-sidebar', chapter: 'account', route: HOME, selector: t('sidebar-account'),
      title: 'At the foot of the side bar',
      say: 'In the Side bar layouts, the bottom of the side bar shows who’s signed in, with Help and Sign out right there.',
    },
    {
      id: 'acct-phone', chapter: 'account', route: HOME,
      title: 'On a phone',
      say: 'On a phone, the bottom of the slide-out menu has your email, My time off and Sign out.',
    },

    // ---------- Switching layouts ----------
    {
      id: 'lay-open', chapter: 'layouts', route: APPEARANCE, open: 'goto:/tool-shed/appearance', selector: t('appearance-header'),
      title: 'Appearance',
      say: 'This is Appearance, where you pick your layout, colors and type. Your layout follows your account, colors and type stay with this browser, and everything takes effect right away.',
    },
    {
      id: 'lay-tabs', chapter: 'layouts', route: APPEARANCE, selector: t('appearance-tabs'),
      title: 'Three parts',
      say: 'It has three parts: Layout, Color and Font. Color sets your accent and the color of the menu bar. Font sets the typeface and text size.',
    },
    {
      id: 'lay-who', chapter: 'layouts', route: APPEARANCE, click: LAYOUT_TAB, selector: t('appearance-layout-who'),
      title: 'Who uses this layout?',
      say: 'This box shows the company’s default layout, and whether you’ve picked your own. Use company default goes back to it. If you can change settings, Company default layout sets it for everyone who hasn’t picked their own.',
    },
    {
      id: 'lay-options', chapter: 'layouts', route: APPEARANCE, click: LAYOUT_TAB, selector: t('appearance-layout-options'),
      title: 'The layouts',
      say: 'Here are the layouts. The one marked Active is yours right now.',
    },
    {
      id: 'lay-top', chapter: 'layouts', route: APPEARANCE, click: LAYOUT_TAB, selector: t('appearance-layout-top'),
      title: 'Top bar',
      say: 'Top bar: the menu runs across the top, with tabs underneath in some sections. Roomy, and good on laptops and wide screens.',
    },
    {
      id: 'lay-side', chapter: 'layouts', route: APPEARANCE, click: LAYOUT_TAB, selector: t('appearance-layout-side'),
      title: 'Side bar',
      say: 'Side bar: the menu runs down the left, with a slim bar on top for your tools. Built for dispatch and juggling a few things at once.',
    },
    {
      id: 'lay-rail', chapter: 'layouts', route: APPEARANCE, click: LAYOUT_TAB, selector: t('appearance-layout-rail'),
      title: 'Rail',
      say: 'Rail: five headings on the edge, each opening a panel. It’s the one layout that reaches every part of the app without tucking anything away.',
    },
    {
      id: 'lay-focus', chapter: 'layouts', route: APPEARANCE, click: LAYOUT_TAB, selector: t('appearance-layout-focus'),
      title: 'Focus',
      say: 'Focus: the rail, with compact, task-first pages for jobs, customers, estimates and money. Lists show one at a time and details stay folded until you open them. The schedule and drag-and-drop calendar work just the same.',
    },
    {
      id: 'lay-easy', chapter: 'layouts', route: APPEARANCE, click: LAYOUT_TAB,
      selector: `${t('appearance-layout-easy-side')}, ${t('appearance-layout-easy-top')}`,
      title: 'The Easy layouts',
      say: 'Easy · Side bar and Easy · Top bar are previews of a simpler look, with every page of a section as a tab and Parts in the main menu. Your working pages stay the same.',
    },
    {
      id: 'lay-how', chapter: 'layouts', route: APPEARANCE, click: LAYOUT_TAB, selector: t('appearance-layout-options'),
      title: 'How to switch',
      say: 'To switch, click a layout. It changes at once, just for you, and you can switch back the same way. I’ll leave that choice to you.',
    },
    {
      id: 'lay-phone', chapter: 'layouts', route: APPEARANCE, selector: t('appearance-layout'),
      title: 'On phones',
      say: 'Every layout folds into the slide-out menu on phones and narrow windows, so the same places are always one tap away.',
    },
    {
      id: 'lay-done', chapter: 'layouts', route: APPEARANCE, selector: t('appearance-header'),
      title: 'That’s the way around',
      say: 'That’s the way around: the main menu, section tabs, Tool Shed, the top bar tools and your account menu. Take this tour again any time from Help.',
    },
  ],
}
