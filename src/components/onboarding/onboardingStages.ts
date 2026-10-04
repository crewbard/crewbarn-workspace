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
      summary: 'Say yes to the test terms before anything is set up.',
      detail:
        'You are on a free test account, so we need the agreement accepted before CrewBarn starts putting anything in your shop. It takes a minute to read.',
      primaryLabel: 'Review agreement',
      primaryPath: '/onboarding',
      complete: stepComplete(steps, 'beta_agreement'),
      locked: false,
      bullets: ['You are testing CrewBarn for free', 'Nothing is set up until you accept', 'The terms are short and in full'],
    })
  }

  stages.push(
    {
      key: 'ai_setup',
      eyebrow: 'Step 1',
      title: 'Let AI help, or do it yourself',
      summary: 'AI can fill in a lot of what follows. It is optional.',
      detail:
        'This is first because AI can do much of the work below for you — tidy a rough list of tools, suggest what a shop in your trade usually needs, turn a phone call into a job. What it costs goes to your own AI account, never to us. Skipping it is fine; everything can be filled in by hand.',
      primaryLabel: stepComplete(steps, 'ai_setup') ? 'Check my AI settings' : 'Set up AI',
      // The rebuilt screens: which company, then the key, each on its own page.
      primaryPath: '/tool-shed/ai/provider',
      secondaryLabel: 'I will do it by hand',
      complete: stepComplete(steps, 'ai_setup'),
      locked: betaLocked,
      bullets: ['You bring your own AI account', 'Nothing runs until you turn it on', 'Doing it by hand stays an option'],
    },
    {
      key: 'data_ownership',
      eyebrow: 'Step 2',
      title: 'Where your photos and maps come from',
      summary: 'Use your own accounts, or let CrewBarn handle it.',
      detail:
        'Job photos and documents have to be kept somewhere, and the map needs an account of its own. Use your own and you own the storage and the bill, which is what we recommend — or let CrewBarn set both up and bill you for what you use.',
      primaryLabel: stepComplete(steps, 'data_ownership') ? 'Review storage and maps' : 'Choose storage and maps',
      primaryPath: '/settings/integrations',
      complete: stepComplete(steps, 'data_ownership'),
      locked: betaLocked,
      bullets: onboarding.beta_agreement?.byo_only
        ? ['Your own storage, your own bill', 'Your own map account', 'Your keys only, while in beta']
        : ['Your own storage, your own bill', 'Your own map account', 'Or let CrewBarn handle both'],
    },
    {
      key: 'company_profile',
      eyebrow: 'Step 3',
      title: 'Make it look like your shop',
      summary: 'Your name, number, address and logo.',
      detail:
        'These go on every invoice, quote, email and anything else a customer sees. Worth getting right before you send the first one.',
      primaryLabel: 'Company info',
      primaryPath: '/tool-shed/company-info',
      secondaryLabel: 'Brand and logo',
      secondaryPath: '/tool-shed/brand',
      complete: stepComplete(steps, 'company_profile'),
      locked: betaLocked,
      bullets: ['Name, phone, email and address', 'Your logo and your colour', 'Used on everything a customer gets'],
    },
    {
      key: 'trade_seed',
      eyebrow: 'Step 4',
      title: 'Start with a pack for your trade',
      summary: 'Begin with sensible defaults instead of a blank screen.',
      detail:
        'Rather than an empty system, CrewBarn fills in the job types, statuses, services and stock locations a shop like yours usually needs. You see all of it before anything is saved, and you can change any of it afterwards.',
      primaryLabel: stepComplete(steps, 'trade_seed') ? 'Look at the pack' : 'Use a starter pack',
      primaryPath: '/onboarding',
      complete: stepComplete(steps, 'trade_seed'),
      locked: betaLocked,
      bullets: ['Built for your trade', 'You see it before it saves', 'Change anything later'],
    },
    {
      key: 'company_assets',
      eyebrow: 'Step 5',
      title: 'Your tools, trucks and software',
      summary: 'The kit your shop owns — not the customer\'s.',
      detail:
        'Programmers, laptops, mowers, machines, trucks, safety gear, the software you pay for every month. Later this is how CrewBarn knows which van can take which job.',
      primaryLabel: 'Company tools',
      primaryPath: '/company-assets',
      complete: stepComplete(steps, 'company_assets') || (counts.company_assets ?? 0) > 0,
      locked: betaLocked || !stepComplete(steps, 'trade_seed'),
      bullets: ['What each one can do', 'Who or which truck has it', 'Flagged if it needs checking'],
    },
    {
      key: 'inventory_layout',
      eyebrow: 'Step 6',
      title: 'What you keep on the shelf',
      summary: 'Pick the stock you actually carry.',
      detail:
        'CrewBarn suggests what a shop in your trade usually keeps. Tick what you carry and put in rough counts — or skip it and sort stock out another day.',
      primaryLabel: 'Starter stock',
      primaryPath: '/inventory',
      complete: stepComplete(steps, 'inventory_layout'),
      locked: betaLocked || !(stepComplete(steps, 'company_assets') || (counts.company_assets ?? 0) > 0),
      bullets: ['Suggested for your trade', 'Roughly how many you have', 'When to order more'],
    },
    {
      key: 'staff',
      eyebrow: 'Step 7',
      title: 'Get your crew in',
      summary: 'Office, dispatchers, techs and managers.',
      detail:
        'Everyone who needs a login. They get an email and set their own password; techs use the phone app. Skills, time off and the rest can wait until they are in.',
      primaryLabel: 'Staff and crews',
      primaryPath: '/tool-shed/staff',
      complete: stepComplete(steps, 'staff'),
      locked: betaLocked,
      bullets: ['They set their own password', 'You choose what each can see', 'Techs get the phone app'],
    },
    {
      key: 'communications',
      eyebrow: 'Step 8',
      title: 'Your phone, texts and email',
      summary: 'So calls and messages land in CrewBarn.',
      detail:
        'Connect the number customers ring and the address your email goes out from, so calls, texts and replies come into CrewBarn instead of somebody\'s personal phone. Worth having working before the first real job.',
      primaryLabel: 'Communication settings',
      primaryPath: '/tool-shed/communication',
      complete: stepComplete(steps, 'communications'),
      locked: betaLocked,
      bullets: ['Calls and texts in one inbox', 'Email that comes from you', 'Recorded calls become text'],
    },
    {
      key: 'services_pricebook',
      eyebrow: 'Step 9',
      title: 'Check what you sell, and for how much',
      summary: 'The starter list should match your real work.',
      detail:
        'The pack gave you a starting list of services and prices. Go through it once, so the quotes and invoices your crew builds come out right the first time.',
      primaryLabel: 'Service catalog',
      primaryPath: '/catalog/services',
      secondaryLabel: 'Product catalog',
      secondaryPath: '/catalog/products',
      complete: stepComplete(steps, 'services_pricebook') || (counts.catalog_items ?? 0) > 0,
      locked: betaLocked,
      bullets: ['The work you actually do', 'What you charge for it', 'Change any of it, any time'],
    },
    {
      key: 'automations',
      eyebrow: 'Step 10',
      title: 'Let CrewBarn do the chasing',
      summary: 'Reminders and nudges, set to start gently.',
      detail:
        'Reminding a customer the day before, nudging a tech on a job that has gone quiet, chasing an invoice nobody has paid. They start gentle, and you can switch any of them off.',
      primaryLabel: 'Automation hub',
      primaryPath: '/tool-shed/automations',
      complete: stepComplete(steps, 'automations') || (counts.automation_rules ?? 0) > 0,
      locked: betaLocked,
      optional: true,
      bullets: ['Reminders to customers', 'Nudges to your techs', 'Switch any of them off'],
    },
    {
      key: 'launch_review',
      eyebrow: 'Final step',
      title: 'Have a look, then go',
      summary: 'One last check before real customers turn up.',
      detail:
        'A quick pass over everything you have set up. Anything you skipped is waiting in the Tool Shed whenever you want it — none of it stops you starting.',
      primaryLabel: 'Open dashboard',
      primaryPath: '/',
      complete: stepComplete(steps, 'launch_review') || onboarding.progress_percent >= 100,
      locked: betaLocked,
      bullets: ['See what is done', 'Fix anything you missed', 'Start taking real work'],
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
