import type { PageTour } from '../types'

/**
 * Account & billing → Company files (/tool-shed/company-files).
 *
 * States: not set up (company-files-setup shows), locked or unlocked
 * (company-files-header data-unlocked = yes | no), and an empty or filled
 * list (company-files-list data-empty = yes | no). Recovery controls show
 * only to owners and admins.
 */
const t = (id: string) => `[data-tour="${id}"]`
const UNLOCKED = `${t('company-files-header')}[data-unlocked="yes"]`

export const PAGE_TOUR: PageTour = {
  id: 'company-files',
  route: '^/tool-shed/company-files/?$',
  intro: {
    page: 'Company files',
    purpose: 'A locked vault for your own business paperwork, like insurance, licences, bank statements and contracts. Each file is locked on its own, opens with a code, and every look is recorded.',
    covers: ['Setting it up', 'Unlocking with a code', 'Adding files and notes', 'Your files'],
  },
  steps: [
    {
      id: 'header', selector: t('company-files-header'), title: 'Company files',
      say: 'Your company’s own locked vault, for papers that aren’t tied to a customer. The badge shows it’s locked.',
      variants: [
        { when: UNLOCKED, say: 'Your company’s own locked vault, for papers that aren’t tied to a customer. It’s unlocked right now, so you can open and add files.' },
      ],
    },
    {
      id: 'setup', selector: t('company-files-setup'),
      title: 'Set it up first',
      say: 'The vault needs setting up once. Set up secure files makes your company’s own keys, and shows a recovery key one time only. Keep that somewhere safe.',
    },
    {
      id: 'recovery-key', selector: t('company-files-recovery-key'),
      title: 'Your recovery key',
      say: 'This is your recovery key, and it won’t be shown again. Store it somewhere safe, then press I stored this safely.',
    },
    {
      id: 'recovery', selector: t('company-files-recovery'),
      title: 'Recovery key',
      say: 'Owners and admins can make a new recovery key here, or use the old one to get back in if something goes wrong.',
    },
    {
      id: 'unlock', selector: t('company-files-unlock'),
      title: 'Unlock with a code',
      say: 'To open the vault, choose a text or an email, press Send code, then type the code and press Verify.',
    },
    {
      id: 'add', selector: t('company-files-add'),
      title: 'Add a file or note',
      say: 'Upload a file, or write a secure note for things like account numbers. Both are locked the moment they’re saved.',
    },
    {
      id: 'list', selector: t('company-files-list'), title: 'Your files',
      say: 'Your files. View opens one, and Audit shows everyone who has looked at it.',
      variants: [
        {
          when: `${t('company-files-list')}[data-empty="yes"]`,
          say: 'No company files yet. Once you add some, they’re listed here with who added them and when.',
        },
        {
          when: (page) => !page.find(UNLOCKED),
          say: 'Your files. View opens one once the vault is unlocked, and Audit shows everyone who has looked at it.',
        },
      ],
    },
  ],
}
