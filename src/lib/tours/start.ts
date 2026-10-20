import type { GuidedTour } from '@/lib/guidedTours'

/**
 * Page tours for the screens before you're in: sign-up, sign-in and the
 * flat /onboarding page. The onboarding intro, roadmap recap and setup guide
 * are separate (components/onboarding); the onboarding tour here only points
 * to them.
 */
export const START_TOURS: GuidedTour[] = [
  {
    id: 'start-sign-up',
    title: 'Start your free trial',
    description: 'Create your shop’s CrewBarn account. Your trade is picked here and locks once you sign up.',
    route: /^\/sign-up\/?$/,
    roadmap: [
      { title: 'Who you are', detail: 'Tell us you run a field-service business. Only businesses can continue.' },
      { title: 'Business and trade', detail: 'Name your business and pick your trade. The trade locks after sign-up.' },
      { title: 'Your login', detail: 'Enter your name, email and a password of at least 10 characters, then accept the terms.' },
      { title: 'Confirm your email', detail: 'Click the link we send you. It works for 48 hours.' },
      { title: 'Log in', detail: 'Sign in and the setup list opens to walk you through the rest.' },
    ],
    use: {
      say: 'Once you confirm your email and sign in, the setup list walks you through the rest. You can polish your business name later in Company info, and the job stages your trade starts you with can be edited on Job statuses.',
      go: [{ label: 'Open the setup list', to: '/onboarding' }, { label: 'Open Company info', to: '/tool-shed/company-info' }, { label: 'Open Job statuses', to: '/tool-shed/job-statuses' }],
    },
    steps: [
      {
        selector: '[data-tour="signup-header"]',
        title: 'Welcome',
        say: 'This is where your shop’s CrewBarn account starts. The trial doesn’t need a card.',
      },
      {
        selector: '[data-tour="signup-invite"]',
        title: 'You came in on an invite',
        say: 'You came in on an invite, so we’ve filled in what you already told us. Check it over.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="signup-applicant"]',
        title: 'Tell us who you are',
        say: 'Pick “I run a field-service business”. CrewBarn accounts are for shops that do the work, so the developer option can’t continue.',
      },
      {
        selector: '[data-tour="signup-business"]',
        title: 'Your business name',
        say: 'Use the name your customers know you by. You can polish it later in Company Info.',
      },
      {
        selector: '[data-tour="signup-trade"]',
        title: 'Pick your trade carefully',
        say: 'Your trade sets up your starting job stages and message templates, and it can’t be changed after sign-up. You can still edit the stages and messages themselves. The plan can stay on Starter; billing is set up later.',
      },
      {
        selector: '[data-tour="signup-owner"]',
        title: 'This is you, the owner',
        say: 'You’ll log in with this email and password. The password needs at least 10 characters. Last name and phone are optional.',
      },
      {
        selector: '[data-tour="signup-terms"]',
        title: 'The terms',
        say: 'Tick the box to confirm you’re using CrewBarn for your own business. The Terms of Service link opens in a new tab.',
      },
      {
        selector: '[data-tour="signup-submit"]',
        title: 'Create your account',
        say: 'Once everything is filled in, this button wakes up. We’ll email you a link to switch the account on.',
      },
      {
        selector: '[data-tour="signup-sent"]',
        title: 'Check your email',
        say: 'Nearly there. Open the email we just sent and click the link. It expires in 48 hours.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="signup-waitlist"]',
        title: 'Sign-ups open soon',
        say: 'We’re letting shops in a batch at a time. Leave your email and we’ll let you know when it’s your turn.',
        optional: 'Skip',
      },
    ],
  },
  {
    id: 'start-login',
    title: 'Sign in to CrewBarn',
    description: 'Sign in with your email and password, plus two-factor if you’ve turned it on.',
    route: /^\/login\/?$/,
    roadmap: [
      { title: 'Account switched on', detail: 'You confirmed your email, or accepted a staff invite.' },
      { title: 'Email and password', detail: 'Use the ones you signed up with.' },
      { title: 'Two-factor', detail: 'If it’s on, approve on your phone or type the code.' },
      { title: 'In you go', detail: 'You land where you were headed. New owners get the setup list.' },
    ],
    steps: [
      {
        selector: '[data-tour="login-env-banner"]',
        title: 'Test copy',
        say: 'This bar means you’re on a test copy of CrewBarn, not the live one.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="login-form"]',
        title: 'Sign in',
        say: 'Use the email and password you signed up with. If you’ve turned on two-factor, we’ll ask for that next.',
      },
      {
        selector: '[data-tour="login-push"]',
        title: 'Check your phone',
        say: 'Tap Approve in the CrewBarn app and you’ll be signed in here. If it doesn’t come through, enter a code instead.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="login-2fa"]',
        title: 'Your code',
        say: 'Type the 6-digit code from your authenticator app. A recovery code works here too. Tick the box to skip the code on this device for 30 days.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="login-forgot"]',
        title: 'Forgot your password?',
        say: 'Locked out? This sends a reset link to your email.',
      },
      {
        selector: '[data-tour="login-signup"]',
        title: 'New here?',
        say: 'No account yet? Start a free trial from here.',
      },
    ],
  },
  {
    id: 'start-onboarding',
    title: 'Set up your shop',
    description: 'Work down the setup list one step at a time. The intro, roadmap and setup guide are a click away.',
    route: /^\/onboarding\/?$/,
    roadmap: [
      { title: 'Signed up and in', detail: 'Your account is confirmed and you’ve logged in.' },
      { title: 'Watch or dive in', detail: 'Play the intro or the roadmap, or open the setup guide to be walked through.' },
      { title: 'Work down the list', detail: 'Each step saves on its own amber button. Skip anything for now.' },
      { title: 'Trade pack', detail: 'Step 4 loads the starter pack for the trade you picked at sign-up.' },
      { title: 'Go live', detail: 'The final step finishes setup. Anything skipped waits in the Tool Shed.' },
    ],
    use: {
      say: 'Each step saves into the real pages, so you can come back to any of them later in the Tool Shed. Your crew lives on Staff & crews, and what you sell and for how much is in the Service Catalog.',
      go: [{ label: 'Open the Tool Shed', to: '/tool-shed' }, { label: 'Open Staff & crews', to: '/tool-shed/staff' }, { label: 'Open Service Catalog', to: '/catalog/services' }],
    },
    steps: [
      {
        selector: '[data-tour="onboarding-intro"]',
        title: 'Your setup list',
        say: 'This is your setup list, in order. Stop whenever you like and pick it up later. Nothing goes out to a customer until the last step.',
      },
      {
        selector: '[data-tour="onboarding-tour-buttons"]',
        title: 'Want the big picture first?',
        say: 'Watch the short intro or the roadmap. Or open the guided setup and it’ll talk you through each step. Voice on or off is your call.',
      },
      {
        selector: '[data-tour="onboarding-progress"]',
        title: 'How far along you are',
        say: 'This counts the steps you’ve finished and how many are left.',
      },
      {
        selector: '[data-tour="onboarding-stages"]',
        title: 'One row per step',
        say: 'Click a row to open it. A green tick means it’s done. Grey ones open once the steps above them are finished.',
      },
      {
        selector: '[data-tour="onboarding-current-stage"]',
        title: 'The step you’re on',
        say: 'What the step is for, a few plain facts about it, and the controls to finish it. Some steps have a link that opens the real page in a new tab, so you can look before you confirm.',
      },
      {
        selector: '[data-tour="onboarding-stage-navigation"]',
        title: 'Back and Skip',
        say: 'Back and Skip only move you around. The step’s own amber button is what saves it.',
      },
      {
        selector: '[data-tour="onboarding-overlay-actions"]',
        title: 'Start over or close',
        say: 'Start over jumps back to the first step without undoing anything. Close shows the setup page underneath.',
      },
      {
        selector: '[data-tour="onboarding-page-header"]',
        title: 'The setup page',
        say: 'With the list closed, this is the same setup on one page. Open guided setup brings the list back, and Continue current step jumps to the first one still to do.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="onboarding-readiness"]',
        title: 'Launch readiness',
        say: 'How ready your shop is, with counts of the tools, staff, stock locations and catalog items you have so far.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="onboarding-page-current"]',
        title: 'The current step, on the page',
        say: 'The same step controls as the list, with Back and Next at the bottom. On the trade pack step, a preview shows what the pack will add.',
        optional: 'Skip',
      },
    ],
  },
]
