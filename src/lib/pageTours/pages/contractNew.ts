import type { PageTour } from '../types'

/** Daily work → Contracts → New service agreement (/maintenance-contracts/new). */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'contract-new',
  route: '^/maintenance-contracts/new/?$',
  intro: {
    page: 'New service agreement',
    purpose: 'Write up work you’ve agreed to do on a schedule, for a fee. CrewBarn places the visits, puts them on the board, and bills the fee.',
    covers: ['Who it’s for', 'What’s covered and how often', 'The money and the term', 'Saving or starting it'],
  },
  steps: [
    { id: 'header', selector: t('contract-new-header'), title: 'New service agreement', say: 'Work you’ve agreed to do on a schedule, for a fee.' },
    { id: 'steps', selector: t('contract-new-steps'), title: 'A few steps', say: 'Jump between the steps any time. Nothing saves until the end.' },
    { id: 'read', selector: t('contract-new-read'), title: 'Already on paper?', say: 'Upload the agreement you already have, and it’s read in for you to check.' },
    { id: 'customer', selector: t('contract-new-customer-picker'), title: 'Customer', say: 'Pick the customer, or add a new one.' },
    { id: 'title', selector: t('contract-new-title'), title: 'Name it', say: 'A name you and the customer will recognise.' },
    { id: 'properties', selector: t('contract-new-properties'), title: 'Properties', say: 'Tick the properties it covers.' },
    { id: 'services', selector: t('contract-new-services'), title: 'What’s covered', say: 'One card per service, each with its own type of work.' },
    { id: 'assets', selector: t('contract-new-service-assets'), title: 'Equipment', say: 'Tick the equipment this service looks after.' },
    { id: 'rhythm', selector: t('contract-new-rhythm'), title: 'How often', say: 'How often the visits happen. You can make part of the year different, like more visits in summer.' },
    { id: 'sentence', selector: t('contract-new-rhythm-sentence'), title: 'In plain words', say: 'The rhythm read back in a sentence, so you can check it.' },
    { id: 'add-service', selector: t('contract-new-add-service'), title: 'Add a service', say: 'Add another service to the same agreement.' },
    { id: 'money', selector: t('contract-new-money'), title: 'The money and the term', say: 'The fee, how often it’s billed, and how long it runs. The fee covers the visits; they’re never billed one by one.' },
    { id: 'still-needed', selector: t('contract-new-still-needed'), title: 'Still needed', say: 'What’s left to fill in before you can save.' },
    { id: 'save', selector: `${t('contract-new-save-draft')}, ${t('contract-new-save')}`, title: 'Save it', say: 'Save it as a draft to come back to. It books nothing until it’s started or signed.' },
    { id: 'start', selector: t('contract-new-start'), title: 'Start it', say: 'Saves it and starts it straight away, so it begins booking visits.' },
  ],
}
