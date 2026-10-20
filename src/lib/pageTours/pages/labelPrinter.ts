import type { PageTour } from '../types'

/**
 * Catalog & inventory → Label printer (/tool-shed/label-printer).
 *
 * The page shows one of three states for this computer:
 *   lp-install    the Print Bridge isn't running here
 *   lp-pair       it's running, but this computer isn't connected yet
 *   lp-connected  connected: pick the printer, its language, test it
 *     lp-printer  data-printers = found | none
 * While it's still looking, only lp-looking shows.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'label-printer',
  route: '^/tool-shed/label-printer/?$',
  intro: {
    page: 'Label printer',
    purpose: 'Send labels straight to a roll printer on this computer, at the right size. It’s optional: without it, labels print through the normal print window.',
    covers: ['Where this computer is at', 'Installing the Print Bridge', 'Connecting', 'Picking the printer', 'A test label'],
  },
  steps: [
    {
      id: 'header', selector: t('lp-header'),
      title: 'Label printer',
      say: 'This sets up label printing on this computer only. Each computer that prints labels is set up once.',
    },
    {
      id: 'state', title: 'Where this computer is at', say: '',
      variants: [
        { when: t('lp-looking'), selector: t('lp-looking'), title: 'Looking', say: 'It’s checking whether the Print Bridge is running on this computer.' },
        { when: t('lp-install'), selector: t('lp-install'), title: 'Not installed here', say: 'The Print Bridge isn’t running on this computer. It’s a small program that passes labels to your printer.' },
        { when: t('lp-pair'), selector: t('lp-pair'), title: 'Almost there', say: 'The Print Bridge is running. Connect this computer with the six-digit code it shows.' },
        { when: t('lp-connected'), selector: t('lp-connected'), title: 'Connected', say: 'This computer is connected. Labels printed here go straight to the printer below.' },
      ],
    },
    {
      id: 'install', selector: t('lp-install'),
      title: 'Install it',
      say: 'Download the Print Bridge, keep it somewhere permanent, and run it. Then press I have started it, look again.',
    },
    {
      id: 'pair', selector: t('lp-pair'),
      title: 'Connect this computer',
      say: 'Type the six-digit code from the Print Bridge window and press Connect. Codes last ten minutes.',
    },
    {
      id: 'printer', selector: t('lp-printer'), title: 'Which printer',
      say: 'Pick your label printer from the list.',
      variants: [
        { when: `${t('lp-printer')}[data-printers="none"]`, say: 'No printers were found. Check it’s switched on and plugged in, then press Look for printers again.' },
      ],
    },
    {
      id: 'language', selector: t('lp-language'),
      title: 'What it speaks',
      say: 'Leave this on Work it out from the name, unless a test label doesn’t come out.',
    },
    {
      id: 'test', selector: t('lp-test'),
      title: 'Test it',
      say: 'Print a test label checks the printer and the size. Labels themselves print from bins, stock rows, received orders and products.',
    },
  ],
}
