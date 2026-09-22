import type { OnboardingStatus, OnboardingStep } from '@/types/onboarding'

export interface OnboardingStage {
  key: string
  eyebrow: string
  title: string
  summary: string
  detail: string
  primaryLabel: string
  primaryPath: string
  secondaryLabel?: string
  secondaryPath?: string
  complete: boolean
  locked: boolean
  optional?: boolean
  bullets: string[]
}

export function buildOnboardingStages(onboarding: OnboardingStatus): OnboardingStage[] {
  const betaLocked = onboarding.beta_agreement.required && !onboarding.beta_agreement.accepted
  const steps = onboarding.steps
  const counts = onboarding.counts

  const stages: OnboardingStage[] = []

  if (onboarding.beta_agreement.required) {
    stages.push({
      key: 'beta_agreement',
      eyebrow: 'Access',
      title: 'Accept the beta agreement',
      summary: 'Confirm the test terms before setup changes are made.',
      detail:
        'Beta accounts need the agreement accepted before CrewBarn starts writing setup data. This keeps test access clear and auditable.',
      primaryLabel: 'Review agreement',
      primaryPath: '/onboarding',
      complete: stepComplete(steps, 'beta_agreement'),
      locked: false,
      bullets: ['Confirm tester terms', 'Unlock setup actions', 'Keep audit trail clean'],
    })
  }

  stages.push(
    {
      key: 'ai_setup',
      eyebrow: 'Step 1',
      title: 'Connect AI or choose manual setup',
      summary: 'Let CrewBarn help seed the account, or continue manually.',
      detail:
        'AI should be first because it can walk you through each setup step, clean up rough tool lists, suggest trade defaults, write helper instructions, and turn call transcripts into job or estimate drafts. Manual setup stays available.',
      primaryLabel: stepComplete(steps, 'ai_setup') ? 'Review CBI AI settings' : 'Connect AI',
      primaryPath: '/settings/ai',
      secondaryLabel: 'I will set up manually',
      complete: stepComplete(steps, 'ai_setup'),
      locked: betaLocked,
      bullets: ['Bring your own AI key', 'Optional OpenAI transcription key', 'Manual setup path stays open'],
    },
    {
      key: 'data_ownership',
      eyebrow: 'Step 2',
      title: 'Choose data ownership',
      summary: 'Choose BYO provider accounts or CrewBarn-managed convenience billing.',
      detail:
        'BYO is the recommended path: you own your Cloudflare R2 bucket, Google Maps key, provider free-tier credits, and provider bill. This gate saves those credentials directly. CrewBarn-managed storage and maps stay available if you want CrewBarn to handle setup, with storage billed by size and maps billed by usage.',
      primaryLabel: stepComplete(steps, 'data_ownership') ? 'Review storage and maps' : 'Choose storage and maps',
      primaryPath: '/settings/integrations',
      complete: stepComplete(steps, 'data_ownership'),
      locked: betaLocked,
      bullets: onboarding.beta_agreement?.byo_only
        ? ['Cloudflare R2 setup', 'Google Maps API key', 'Bring-your-own keys (beta)']
        : ['Cloudflare R2 setup', 'Google Maps API key', 'CrewBarn-managed fallback'],
    },
    {
      key: 'company_profile',
      eyebrow: 'Step 3',
      title: 'Make the shop look real',
      summary: 'Name, phone, logo, brand, address, and document identity.',
      detail:
        'Customer-facing records need the company identity before invoices, estimates, contracts, emails, and portal screens go live.',
      primaryLabel: 'Company info',
      primaryPath: '/tool-shed/company-info',
      secondaryLabel: 'Brand and logo',
      secondaryPath: '/tool-shed/brand',
      complete: stepComplete(steps, 'company_profile'),
      locked: betaLocked,
      bullets: ['Company contact details', 'Logo and brand colors', 'Document-safe identity'],
    },
    {
      key: 'trade_seed',
      eyebrow: 'Step 4',
      title: 'Pick the trade starter pack',
      summary: 'Seed useful defaults instead of starting with an empty system.',
      detail:
        'The trade pack creates starter job types, statuses, catalog rows, inventory locations, custom fields, and workflow defaults that the member can review and edit.',
      primaryLabel: stepComplete(steps, 'trade_seed') ? 'Review seed' : 'Apply trade seed',
      primaryPath: '/onboarding',
      complete: stepComplete(steps, 'trade_seed'),
      locked: betaLocked,
      bullets: ['Trade-specific defaults', 'Preview before saving', 'Additive setup for new tenants'],
    },
    {
      key: 'company_assets',
      eyebrow: 'Step 5',
      title: 'Seed tools, software, and trucks',
      summary: 'Company-owned assets are separate from customer assets.',
      detail:
        'This is where locksmith programmers, laptops, mowers, plumbing machines, trucks, safety gear, and software subscriptions live. Dispatch AI can later use these capabilities.',
      primaryLabel: 'Company tools',
      primaryPath: '/company-assets',
      complete: stepComplete(steps, 'company_assets') || (counts.company_assets ?? 0) > 0,
      locked: betaLocked || !stepComplete(steps, 'trade_seed'),
      bullets: ['Capability tags', 'Assigned tech or truck', 'Needs confirmation status'],
    },
    {
      key: 'inventory_layout',
      eyebrow: 'Step 6',
      title: 'Choose starter stock',
      summary: 'Select trade stock and rough on-hand quantities.',
      detail:
        'CrewBarn recommends starter stock from the selected trade pack. Pick what the shop actually carries, adjust counts, or skip stock setup until later.',
      primaryLabel: 'Starter stock',
      primaryPath: '/inventory',
      complete: stepComplete(steps, 'inventory_layout'),
      locked: betaLocked || !(stepComplete(steps, 'company_assets') || (counts.company_assets ?? 0) > 0),
      bullets: ['Trade item suggestions', 'On-hand quantity', 'Reorder thresholds'],
    },
    {
      key: 'staff',
      eyebrow: 'Step 7',
      title: 'Invite the crew',
      summary: 'Add dispatchers, techs, office users, and managers.',
      detail:
        'Crew setup comes before skills and assignments. Employee onboarding can later collect private profile details, license uploads, photos, and role tours.',
      primaryLabel: 'Staff and crews',
      primaryPath: '/tool-shed/staff',
      complete: stepComplete(steps, 'staff'),
      locked: betaLocked,
      bullets: ['Invite users', 'Role selector', 'Role-specific onboarding'],
    },
    {
      key: 'communications',
      eyebrow: 'Step 8',
      title: 'Connect communication channels',
      summary: 'SMS, email, Net2Phone, call recordings, and webhooks.',
      detail:
        'Communication setup makes inbound calls, texts, call recordings, and customer replies flow into CrewBarn. This should be working before live dispatch.',
      primaryLabel: 'Communication settings',
      primaryPath: '/settings/communication',
      complete: stepComplete(steps, 'communications'),
      locked: betaLocked,
      bullets: ['Net2Phone SMS and calls', 'Email sender settings', 'Recording and transcript keys'],
    },
    {
      key: 'services_pricebook',
      eyebrow: 'Step 9',
      title: 'Review services and pricebook',
      summary: 'Seeded services should match what the company sells.',
      detail:
        'The service catalog should reflect the trade, tools, job types, and pricing style before dispatchers build estimates or invoices from it.',
      primaryLabel: 'Service catalog',
      primaryPath: '/catalog/services',
      secondaryLabel: 'Product catalog',
      secondaryPath: '/catalog/products',
      complete: stepComplete(steps, 'services_pricebook') || (counts.catalog_items ?? 0) > 0,
      locked: betaLocked,
      bullets: ['Common services', 'Default pricing', 'Required tools and skills later'],
    },
    {
      key: 'automations',
      eyebrow: 'Step 10',
      title: 'Turn on the safe defaults',
      summary: 'Reminders, triggers, alerts, and workflow gates.',
      detail:
        'Automation should start useful but controlled: appointment reminders, tech nudges, invoice follow-ups, status triggers, and dispatcher alerts.',
      primaryLabel: 'Automation hub',
      primaryPath: '/tool-shed/automations',
      complete: stepComplete(steps, 'automations') || (counts.automation_rules ?? 0) > 0,
      locked: betaLocked,
      optional: true,
      bullets: ['Customer reminders', 'Tech reminders', 'Workflow triggers'],
    },
    {
      key: 'launch_review',
      eyebrow: 'Final step',
      title: 'Review and launch',
      summary: 'Check the setup before real customers use it.',
      detail:
        'This is the final pass across company identity, seed data, tools, staff, communication, pricebook, and automations. Optional items can be reviewed later.',
      primaryLabel: 'Open dashboard',
      primaryPath: '/',
      complete: stepComplete(steps, 'launch_review') || onboarding.progress_percent >= 100,
      locked: betaLocked,
      bullets: ['Smoke test core workflows', 'Fix missing setup', 'Start live operations'],
    },
  )

  return stages
}

export function firstOpenStage(stages: OnboardingStage[]): OnboardingStage {
  return stages.find((stage) => !stage.complete && !stage.locked) ?? stages[stages.length - 1]
}

export function stepComplete(steps: OnboardingStep[], key: string): boolean {
  return !!steps.find((step) => step.key === key)?.complete
}
