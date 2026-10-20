import {
  IconActivity,
  IconAdjustments,
  IconAlarm,
  IconApps,
  IconBeach,
  IconBell,
  IconBolt,
  IconBook,
  IconBook2,
  IconBox,
  IconBrain,
  IconBriefcase,
  IconBuilding,
  IconBuildingBank,
  IconBuildingCommunity,
  IconBuildingStore,
  IconCalculator,
  IconCalendar,
  IconCash,
  IconCategory,
  IconCircleCheck,
  IconClock,
  IconCloud,
  IconComponents,
  IconCoin,
  IconCpu,
  IconCreditCard,
  IconDatabase,
  IconDeviceMobile,
  IconDeviceTv,
  IconDownload,
  IconEye,
  IconFile,
  IconFileCertificate,
  IconFileInvoice,
  IconFolder,
  IconForms,
  IconGauge,
  IconGps,
  IconHash,
  IconHeartHandshake,
  IconHistory,
  IconHourglass,
  IconKey,
  IconListCheck,
  IconListDetails,
  IconLock,
  IconLockOpen,
  IconMail,
  IconMap,
  IconMapPin,
  IconMessage2,
  IconMicrophone,
  IconPalette,
  IconPercentage,
  IconPhone,
  IconPhonePlus,
  IconPlug,
  IconPrinter,
  IconPuzzle,
  IconReceipt,
  IconRocket,
  IconSatellite,
  IconSchool,
  IconSend,
  IconServer,
  IconShield,
  IconShieldLock,
  IconStack,
  IconStar,
  IconSun,
  IconTag,
  IconTool,
  IconTrash,
  IconTruck,
  IconUpload,
  IconUserPlus,
  IconUsers,
  IconUsersGroup,
  IconVideo,
  IconWebhook,
  IconWorld,
} from '@tabler/icons-react'
import type { SectionKey } from '@/settings/types'

/**
 * The settings menu: every area, the groups inside it, and what is in each.
 *
 * Transcribed from docs/design/connect-settings-menu.html, which is the
 * design this implements — the labels, the one-line descriptions and the
 * icons are all its, not invented here.
 *
 * **Routes never change.** Only where a setting is listed does. Each
 * person's Tool Shed grid is saved in their own browser keyed on the route
 * (`id: item.to` in ToolShedPage), so renaming one drops their card and
 * adds a stranger in its place, with nothing on the server to migrate.
 *
 * **Everything here must exist in the Connect build.** Connect is cut from
 * this app by an allowlist (ALSO_CONNECT in scripts/lib/app-slice.mjs), and
 * a route that is listed but not shipped does not announce itself — the
 * catch-all renders nothing and it reads as a page that failed to load.
 * `connect-settings-menu.test.mjs` fails when the two disagree.
 *
 * **Listed here is not the same as being a company setting.** The catalogs,
 * vendors, company tools and reference cards are work surfaces that also
 * belong in the settings menu. Whether a route is a company setting — and
 * so hidden from the workspace's own Tool Shed — is still decided by
 * `sectionForRoute` in sections.ts, not by this list.
 */

export interface MenuItem {
  label: string
  to: string
  blurb: string
  icon: typeof IconActivity
  /** Where it used to be listed, while people are still learning the new menu. */
  movedFrom?: string
  /**
   * The permission a person needs to see this. Only for pages the Tool
   * Shed menu does not list; everything it lists brings its own.
   */
  requires?: string
}

export interface MenuGroup {
  label: string
  blurb: string
  icon: typeof IconActivity
  items: MenuItem[]
}

export const SETTINGS_MENU: Record<SectionKey, { groups: MenuGroup[] }> = {
  business: {
    groups: [
    {
      label: 'Company profile',
      blurb: 'Name, address, logo and colours on everything you send.',
      icon: IconBuilding,
      items: [
        { label: 'Company info', to: '/tool-shed/company-info', blurb: 'Name, phone, email, address, website, license number and timezone.', icon: IconBuilding },
        { label: 'Brand & logo', to: '/tool-shed/brand', blurb: 'Your logo and accent colour on estimates, invoices, emails and the portal.', icon: IconPalette },
        { label: 'Where your settings live', to: '/tool-shed/settings-location', blurb: 'Keep company settings only in Connect, or list them in the work app too.', icon: IconAdjustments },
      ],
    },
    {
      label: 'Online presence',
      blurb: 'Your website, customer app and reviews.',
      icon: IconWorld,
      items: [
        { label: 'Your website', to: '/website-builder', blurb: 'Build and publish your site.', icon: IconWorld },
        { label: 'Customer app', to: '/tool-shed/customer-app', blurb: 'Build your own branded phone app that opens your customer portal.', icon: IconDeviceMobile },
        { label: 'Google Reviews', to: '/tool-shed/google-reviews', blurb: 'Pick your Google listing, ask for reviews after a job, and reply to them.', icon: IconStar },
        { label: 'Marketplace listing', to: '/tool-shed/marketplace', blurb: 'How you show up in the CrewBarn marketplace.', icon: IconBuildingStore, movedFrom: 'Connections' },
      ],
    },
    {
      label: 'Features',
      blurb: 'Turn parts of CrewBarn on or off for your company.',
      icon: IconPuzzle,
      items: [
        { label: 'Modules', to: '/tool-shed/modules', blurb: 'Switch whole areas of CrewBarn on or off for everyone.', icon: IconPuzzle },
      ],
    },
    ],
  },
  customers: {
    groups: [
    {
      label: 'Customers',
      blurb: 'Sorting and labelling the people you work for.',
      icon: IconUsers,
      items: [
        { label: 'Customer types', to: '/tool-shed/customer-types', blurb: 'Residential, commercial, property manager — each with its own defaults.', icon: IconUsers, movedFrom: 'Jobs & workflow' },
        { label: 'Tags', to: '/tool-shed/tags', blurb: 'Customer tags: the ones the customer form offers, with their colors.', icon: IconTag, movedFrom: 'Jobs & workflow' },
      ],
    },
    {
      label: 'Where you work',
      blurb: 'Sites and the areas your crew covers.',
      icon: IconMap,
      items: [
        { label: 'Service locations', to: '/tool-shed/service-locations', blurb: 'Rules for sites, gate codes, access notes.', icon: IconMapPin, movedFrom: 'Jobs & workflow' },
        { label: 'Territories', to: '/tool-shed/territories', blurb: 'Areas you cover and who covers them.', icon: IconMap, movedFrom: 'Jobs & workflow' },
      ],
    },
    {
      label: 'Their equipment',
      blurb: 'The equipment you install and look after for customers.',
      icon: IconComponents,
      items: [
        { label: 'Asset types', to: '/asset-types', blurb: 'What kinds of equipment you track and the fields each one has.', icon: IconComponents, movedFrom: 'Tool Shed' },
        { label: 'Asset access requests', to: '/asset-access-requests', blurb: 'When a customer or partner asks to see an asset record.', icon: IconLockOpen, movedFrom: 'Tool Shed' },
      ],
    },
    {
      label: 'Agreements',
      blurb: 'Recurring service and how it is billed.',
      icon: IconFileCertificate,
      items: [
        { label: 'Service agreements', to: '/tool-shed/service-agreements', blurb: 'Your agreement template and who reviews your contracts.', icon: IconFileCertificate, movedFrom: 'Tool Shed' },
        { label: 'Contract invoices', to: '/tool-shed/preferences/contract-invoices', blurb: 'Whether invoices an agreement raises wait as drafts for you.', icon: IconFileInvoice, movedFrom: 'Shop rules' },
      ],
    },
    ],
  },
  workflow: {
    groups: [
    {
      label: 'Jobs',
      blurb: 'What a job is and the steps it goes through.',
      icon: IconBriefcase,
      items: [
        { label: 'Job types', to: '/tool-shed/job-types', blurb: 'Each kind of job you do, with its own defaults.', icon: IconBriefcase },
        { label: 'Task groups', to: '/tool-shed/task-groups', blurb: 'Sets of job tasks to pull onto a job, ticked off on the phone.', icon: IconListCheck },
        { label: 'Job statuses', to: '/tool-shed/job-statuses', blurb: 'The steps a job moves through and what each one means.', icon: IconListCheck },
        { label: 'New job & estimate intake', to: '/tool-shed/preferences#intake', blurb: 'What the intake form asks before a job is created.', icon: IconForms, movedFrom: 'Shop rules' },
        { label: 'Auto-numbering', to: '/tool-shed/preferences#numbering', blurb: 'How job, estimate and invoice numbers are made.', icon: IconHash, movedFrom: 'Shop rules' },
        { label: 'Custom fields', to: '/tool-shed/custom-fields', blurb: 'Extra fields on jobs, customers and assets.', icon: IconListDetails },
      ],
    },
    {
      label: 'In the field',
      blurb: 'Rules for techs while they are on a job.',
      icon: IconGps,
      items: [
        { label: 'Checking a tech in when they arrive', to: '/tool-shed/preferences/auto-check-in', blurb: 'GPS check-in when the tech reaches the site.', icon: IconGps, movedFrom: 'Shop rules' },
        { label: 'Flashing Schedule when a tech may be late', to: '/tool-shed/preferences/late-techs', blurb: 'Schedule flashes red and blue until somebody answers; then a toast.', icon: IconAlarm },
        { label: 'When a job counts as stalled', to: '/tool-shed/preferences/stalled-jobs', blurb: 'How many days without activity before a job is flagged as stalled.', icon: IconHourglass, movedFrom: 'Shop rules' },
        { label: 'Closing a job properly', to: '/tool-shed/preferences#field-rules', blurb: 'Stop a job being closed before photos, signature and payment.', icon: IconCircleCheck, movedFrom: 'Shop rules' },
        { label: 'How long a field video can be', to: '/tool-shed/preferences/video-length', blurb: 'Longest clip a tech can upload.', icon: IconVideo, movedFrom: 'Shop rules' },
      ],
    },
    {
      label: 'Automations & reminders',
      blurb: 'Things CrewBarn does for you on a trigger.',
      icon: IconBolt,
      items: [
        { label: 'Automations', to: '/tool-shed/automations', blurb: 'Things CrewBarn does for you when something happens, each with its own switch.', icon: IconBolt },
        { label: 'Reminders before an appointment', to: '/tool-shed/preferences/reminders', blurb: 'Turn appointment reminders on or off for the whole company.', icon: IconBell, movedFrom: 'Shop rules' },
      ],
    },
    {
      label: 'Documents',
      blurb: 'What you send and what techs fill in.',
      icon: IconFile,
      items: [
        { label: 'Templates & forms', to: '/custom-documents', blurb: 'Estimate, invoice and work-order layouts; inspection forms.', icon: IconFile },
      ],
    },
    {
      label: 'Warranties',
      blurb: 'What you guarantee and when you hear about it.',
      icon: IconShield,
      items: [
        { label: 'Warranty settings', to: '/tool-shed/warranty-settings', blurb: 'What a claim does, and when coverage counts as expiring. Lengths are set on catalog items.', icon: IconShield },
        { label: 'When to warn you a warranty is running out', to: '/tool-shed/warranty-settings/expiring', blurb: 'How many days of notice before a warranty ends.', icon: IconAlarm },
      ],
    },
    ],
  },
  catalog: {
    groups: [
    {
      label: 'What you sell',
      blurb: 'Services and parts that go on estimates and invoices.',
      icon: IconBox,
      items: [
        { label: 'Service catalog', to: '/catalog/services', blurb: 'Labor items with prices and times.', icon: IconTool, movedFrom: 'Tool Shed' },
        { label: 'Product catalog', to: '/catalog/products', blurb: 'Parts and hardware with costs and prices.', icon: IconBox, movedFrom: 'Tool Shed' },
        { label: 'Service categories', to: '/catalog/categories', blurb: 'Groups for the service catalog.', icon: IconCategory, movedFrom: 'Tool Shed' },
        { label: 'Product categories', to: '/catalog/product-categories', blurb: 'Groups for the product catalog.', icon: IconCategory, movedFrom: 'Tool Shed' },
      ],
    },
    {
      label: 'Reference',
      blurb: 'Catalogs, manuals and what your shop knows.',
      icon: IconBook2,
      items: [
        {
          label: 'Catalogs',
          to: '/catalogs',
          blurb: 'Your price books and manuals as PDFs that open like the printed book, with tabs, find and ordering.',
          icon: IconBook2,
          requires: 'catalog.view',
        },
        {
          label: 'Reference cards',
          to: '/reference-cards',
          blurb: 'Write down what your shop knows. A word or part number in a job opens the card, with the catalog page it is on.',
          icon: IconBook2,
          requires: 'catalog.view',
        },
      ],
    },
    {
      label: 'Stock',
      blurb: 'How stock is counted and reordered.',
      icon: IconStack,
      items: [
        { label: 'Inventory settings', to: '/tool-shed/inventory-settings', blurb: 'Low-stock levels, van restock, counting rules.', icon: IconStack, movedFrom: 'Jobs & workflow' },
        { label: 'Vendors', to: '/vendors', blurb: 'Who you buy from and their account numbers.', icon: IconTruck, movedFrom: 'Tool Shed' },
      ],
    },
    {
      label: 'Labels',
      blurb: 'Printing part and key labels.',
      icon: IconPrinter,
      items: [
        { label: 'Label printer', to: '/tool-shed/label-printer', blurb: 'Which printer, label size and what is printed.', icon: IconPrinter, movedFrom: 'Connections' },
      ],
    },
    ],
  },
  money: {
    groups: [
    {
      label: 'Getting paid',
      blurb: 'Cards, bank transfers and the ways customers can pay.',
      icon: IconCreditCard,
      items: [
        { label: 'Payments', to: '/tool-shed/payments', blurb: 'Connect Stripe or GoDaddy for cards, and your own bank for transfers.', icon: IconCreditCard },
        { label: 'Where card payments go', to: '/tool-shed/payments/card-processor', blurb: 'Pick which connected processor charges your customers.', icon: IconCreditCard },
        { label: 'Let customers pay by bank transfer', to: '/tool-shed/payments/bank-transfer', blurb: 'ACH details shown on invoices.', icon: IconBuildingBank },
        { label: 'Watch your bank for payments', to: '/tool-shed/payments/watch-bank', blurb: 'Match bank deposits to open invoices.', icon: IconEye },
        { label: 'Payment types', to: '/tool-shed/payment-types', blurb: 'Cash, check, card, Zelle — what a tech can record.', icon: IconCash },
      ],
    },
    {
      label: 'Invoices & tax',
      blurb: 'Terms and tax on what you bill.',
      icon: IconReceipt,
      items: [
        { label: 'Payment terms', to: '/tool-shed/payment-terms', blurb: 'Due on receipt, net 15, net 30, and which one new customers get.', icon: IconCalendar },
        { label: 'Tax classes', to: '/catalog/tax-classes', blurb: 'Tax rates for labor and parts by area.', icon: IconReceipt },
      ],
    },
    {
      label: 'Pricing',
      blurb: 'What you charge and what it costs you.',
      icon: IconPercentage,
      items: [
        { label: 'Pricing & discounts', to: '/tool-shed/pricing', blurb: 'Price levels, trip charges, after-hours, discounts.', icon: IconPercentage },
        { label: 'Cost model', to: '/tool-shed/cost-model', blurb: 'Your hourly cost, overhead and target margin.', icon: IconCalculator },
      ],
    },
    {
      label: 'Cash rules',
      blurb: 'Keeping cash from the field accounted for.',
      icon: IconCoin,
      items: [
        { label: 'Stopping new work when cash has not been handed in', to: '/tool-shed/preferences/cash-collection', blurb: 'COD must be collected and turned in before the next job.', icon: IconCoin, movedFrom: 'Shop rules' },
      ],
    },
    ],
  },
  team: {
    groups: [
    {
      label: 'People',
      blurb: 'Your crew and the people who help.',
      icon: IconUsers,
      items: [
        { label: 'Staff & crews', to: '/tool-shed/staff', blurb: 'Add people, set crews and lead techs.', icon: IconUsers },
        { label: 'Subcontractors', to: '/tool-shed/subcontractors', blurb: 'Outside techs you send work to.', icon: IconUsersGroup },
        { label: 'Hiring', to: '/tool-shed/hiring', blurb: 'Job posts and applicants.', icon: IconUserPlus },
        { label: 'Responsibilities', to: '/tool-shed/responsibilities', blurb: 'Who owns jobs, billing, the books and the rest, and the daily to-dos that keep them on top of it.', icon: IconListCheck },
        { label: 'Employee settings', to: '/tool-shed/employee-settings', blurb: 'Quiet hours, task reminder emails, and how far back daily duties look. Each person can keep their own.', icon: IconUsers },
      ],
    },
    {
      label: 'Access & security',
      blurb: 'What each person can see and change.',
      icon: IconShieldLock,
      items: [
        { label: 'Roles & permissions', to: '/tool-shed/roles', blurb: 'What each role can view, edit and delete.', icon: IconShieldLock },
        { label: 'Delete permissions', to: '/tool-shed/preferences#delete-permissions', blurb: 'Who can delete jobs, invoices and customers.', icon: IconTrash, movedFrom: 'Shop rules' },
        { label: 'Security & two-factor', to: '/tool-shed/security', blurb: 'Your 2FA and the team 2FA rule.', icon: IconLock, movedFrom: 'merged with Team two-factor' },
      ],
    },
    {
      label: 'Time & pay',
      blurb: 'Hours, time off and when pay is earned.',
      icon: IconClock,
      items: [
        { label: 'Time off', to: '/tool-shed/time-off', blurb: 'Requests, approvals and balances.', icon: IconBeach },
        { label: 'When pay is earned', to: '/tool-shed/preferences#pay', blurb: 'Commission when a job is invoiced or when it is paid; who carries the card fee on tips.', icon: IconCoin, movedFrom: 'Shop rules' },
        { label: 'Vacation earned', to: '/tool-shed/preferences#vacation', blurb: 'Accrual for hourly and salaried staff.', icon: IconSun, movedFrom: 'Shop rules' },
        { label: 'Clock in and out by GPS', to: '/tool-shed/preferences#clock', blurb: 'Auto clock-in/out at the shop geofence.', icon: IconClock, movedFrom: 'Shop rules' },
      ],
    },
    {
      label: 'Vans & tools',
      blurb: 'What each tech carries. Dispatch uses this to pick who goes.',
      icon: IconTool,
      items: [
        { label: 'Company tools', to: '/company-assets', blurb: 'Programmers, meters and specialty tools — who has which.', icon: IconTool, movedFrom: 'Tool Shed' },
        { label: 'GPS devices', to: '/tool-shed/gps', blurb: 'Trackers in vans and who they belong to.', icon: IconSatellite, movedFrom: 'Connections' },
      ],
    },
    ],
  },
  ai: {
    groups: [
    {
      label: 'Setup',
      blurb: 'Which AI does the work and how it sounds.',
      icon: IconCpu,
      items: [
        { label: 'Which AI does the thinking', to: '/tool-shed/ai/provider', blurb: 'Pick the AI company you bring your own account with.', icon: IconCpu, movedFrom: 'Connections' },
        { label: 'Your AI key', to: '/tool-shed/ai/key', blurb: 'Paste your AI key and check it works.', icon: IconKey, movedFrom: 'Connections' },
        { label: 'Talking to CBI', to: '/tool-shed/ai/voice', blurb: 'Turn the “Hey CrewBarn” wake word on or off in the crew app.', icon: IconMicrophone, movedFrom: 'Connections' },
      ],
    },
    {
      label: 'What it may do',
      blurb: 'The jobs you let CBI handle on its own.',
      icon: IconListCheck,
      items: [
        { label: 'Allowed actions', to: '/tool-shed/ai/allowed', blurb: 'Wake AI up and pick the tasks it may help with. It drafts; it does not send.', icon: IconListCheck, movedFrom: 'Connections' },
      ],
    },
    {
      label: 'Calls',
      blurb: 'CBI phoning a late tech or their customer.',
      icon: IconPhone,
      items: [
        { label: 'CBI calls', to: '/tool-shed/call-scripts', blurb: 'What CBI says when it calls a late tech or their customer, the voice, and what pressing 1 or 2 does.', icon: IconPhone, movedFrom: 'Phone, text & email' },
      ],
    },
    {
      label: 'Teach it',
      blurb: 'What CBI knows about your business.',
      icon: IconSchool,
      items: [
        { label: 'Learning policy', to: '/tool-shed/ai/learning', blurb: 'Controls for allowed learning sources and retention.', icon: IconSchool, movedFrom: 'Connections' },
        { label: 'Knowledge & review', to: '/tool-shed/ai/memory', blurb: 'Review queued lessons and authorized saved knowledge.', icon: IconBrain, movedFrom: 'Connections' },
      ],
    },
    {
      label: 'Watch it',
      blurb: 'Everything CBI did, in one list.',
      icon: IconActivity,
      items: [
        { label: 'Activity', to: '/tool-shed/ai/activity', blurb: 'The latest things AI did, with cost and any failures.', icon: IconActivity, movedFrom: 'Connections' },
      ],
    },
    ],
  },
  connections: {
    groups: [
    {
      label: 'Phone, text & email',
      blurb: 'How you reach customers and how they reach you.',
      icon: IconPhone,
      items: [
        { label: 'Phone, SMS & email', to: '/tool-shed/communication', blurb: 'Your numbers, texting and email in one place.', icon: IconPhone },
        { label: 'Texting from your own Twilio number', to: '/tool-shed/communication/twilio', blurb: 'Send customer texts from a Twilio number you already own.', icon: IconPhonePlus },
        { label: 'Call transcription', to: '/tool-shed/communication/transcription', blurb: 'Who turns your call recordings into text. Opens on the Phone, SMS & email page.', icon: IconMessage2 },
        { label: 'Where your email comes from', to: '/tool-shed/communication/email', blurb: 'Send from your own domain so quotes and invoices stay out of spam.', icon: IconMail },
        { label: 'Outbound sender', to: '/tool-shed/preferences#sender', blurb: 'Which name and number customers see.', icon: IconSend, movedFrom: 'Shop rules' },
      ],
    },
    {
      label: 'Apps & partners',
      blurb: 'Other software and companies you share work with.',
      icon: IconPlug,
      items: [
        { label: 'Integrations', to: '/tool-shed/integrations', blurb: 'Which outside services are connected, and where each one is set up.', icon: IconPlug },
        { label: 'Connected apps', to: '/tool-shed/connected-apps', blurb: 'Apps you have allowed into your account.', icon: IconApps },
        { label: 'Partner connections', to: '/tool-shed/partner-connections', blurb: 'Approve partners who read your work records, and see what they looked at.', icon: IconHeartHandshake },
      ],
    },
    {
      label: 'Storage, maps & domain',
      blurb: 'Where files live and how maps load.',
      icon: IconCloud,
      items: [
        { label: 'Storage & maps', to: '/tool-shed/storage-maps', blurb: 'File storage, large uploads and your maps key.', icon: IconDatabase },
        { label: 'Connect Cloudflare', to: '/tool-shed/cloudflare', blurb: 'Your domain and files on your Cloudflare.', icon: IconCloud, movedFrom: 'Your business' },
      ],
    },
    {
      label: 'Shop devices',
      blurb: 'Screens in the shop.',
      icon: IconDeviceTv,
      items: [
        { label: 'Shop TV', to: '/tool-shed/shop-tv', blurb: 'Pair shop TVs and design the live boards they show.', icon: IconDeviceTv },
      ],
    },
    ],
  },
  developers: {
    groups: [
    {
      label: 'API',
      blurb: 'Keys and the reference.',
      icon: IconKey,
      items: [
        { label: 'API tokens', to: '/tool-shed/api-tokens', blurb: 'Create and revoke keys.', icon: IconKey },
        { label: 'API endpoint guide', to: '/tool-shed/api-endpoints', blurb: 'Every endpoint with examples.', icon: IconBook },
      ],
    },
    {
      label: 'Events',
      blurb: 'Get told when something happens.',
      icon: IconWebhook,
      items: [
        { label: 'Webhooks', to: '/tool-shed/webhooks', blurb: 'Send events to your own URL.', icon: IconWebhook },
      ],
    },
    {
      label: 'Self-hosted',
      blurb: 'Running the shop server.',
      icon: IconServer,
      items: [
        { label: 'Self-hosted console', to: '/tool-shed/self-hosted', blurb: 'Run the CrewBarn console on your own domain.', icon: IconServer },
      ],
    },
    ],
  },
  account: {
    groups: [
    {
      label: 'Plan',
      blurb: 'What you pay CrewBarn and what you use.',
      icon: IconReceipt,
      items: [
        { label: 'Subscription', to: '/tool-shed/subscription', blurb: 'Plan, seats and payment method.', icon: IconReceipt },
        { label: 'Usage & limits', to: '/tool-shed/usage', blurb: 'How many records your business keeps, and your plan.', icon: IconGauge },
      ],
    },
    {
      label: 'Your data',
      blurb: 'Bring it in, take it out, keep it locked.',
      icon: IconDatabase,
      items: [
        { label: 'Import data', to: '/tool-shed/import', blurb: 'Customers, jobs and parts from another system.', icon: IconUpload, movedFrom: 'Jobs & workflow' },
        { label: 'Data export', to: '/tool-shed/data-export', blurb: 'Download a CSV file for each kind of record.', icon: IconDownload, movedFrom: 'Jobs & workflow' },
        { label: 'Data encryption (BYOK)', to: '/tool-shed/encryption', blurb: 'Your own key for sensitive records and private files.', icon: IconLock, movedFrom: 'Team' },
        { label: 'Company files', to: '/tool-shed/company-files', blurb: 'Your encrypted vault for company documents that are not tied to a customer.', icon: IconFolder, requires: 'company.secure_files.list' },
      ],
    },
    {
      label: 'Records',
      blurb: 'Who changed what.',
      icon: IconHistory,
      items: [
        { label: 'Audit log', to: '/tool-shed/audit-log', blurb: 'Who changed what, and every deletion with its reason.', icon: IconHistory },
      ],
    },
    {
      label: 'Getting started',
      blurb: 'Setup and outside access.',
      icon: IconRocket,
      items: [
        { label: 'Guided setup', to: '/onboarding', blurb: 'The step-by-step setup checklist.', icon: IconRocket },
        { label: 'Franchise access', to: '/franchise-support', blurb: 'Let your franchisor help. Shown to franchises only.', icon: IconBuildingCommunity },
      ],
    },
    ],
  },
}

/** Every setting in the menu, flattened. */
export const MENU_ITEMS: Array<MenuItem & { section: SectionKey; group: string }> =
  (Object.entries(SETTINGS_MENU) as Array<[SectionKey, { groups: MenuGroup[] }]>)
    .flatMap(([section, area]) =>
      area.groups.flatMap((group) =>
        group.items.map((item) => ({ ...item, section, group: group.label })),
      ),
    )

/** The anchor a group's card carries on its area page. */
export const menuSlug = (label: string): string =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
