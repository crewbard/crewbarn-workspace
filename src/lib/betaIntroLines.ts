/**
 * What the beta page's intro film says, one line per scene. Kept free of
 * imports so scripts/export-tour-lines.mjs can read it and the lines get
 * recorded in the tour voice (as `beta-intro.<n>`). Change a line and it is
 * read live until it is recorded again.
 */
export const BETA_INTRO_LINES: string[] = [
  'This is the CrewBarn beta.',
  'CrewBarn runs the business side of any trade, from the first call to the paid invoice: one inbox, quotes, scheduling, a call to any tech running late, the field app, invoices and the books.',
  'We are opening it to a small group of trades who will use it on real work. Those testers keep CrewBarn free for life.',
  'Seats are limited. When they are gone, new trades wait for the next opening.',
  'You bring your own provider keys for AI, phone, maps and storage. Most AI tasks cost less than half a penny.',
  'There is one rule. Use CrewBarn on your real jobs, and report bugs and ideas on the bug and idea board. Accounts that are not used, or never report anything, are removed, and the seat goes to the next trade.',
  'Your crew gets the field app. The Android app is ready to install today; scan the code with your phone. The App Store and Google Play versions are coming soon.',
  'Have an invite code? Enter it below. No code? Ask for one.',
]
