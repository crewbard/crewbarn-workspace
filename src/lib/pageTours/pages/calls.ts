import type { PageTour } from '../types'

/**
 * Communications → Calls (/calls): calls and voicemails nobody has looked
 * at yet. The tour never calls back or marks anything reviewed.
 *
 *   calls-row  data-channel = call | voicemail; data-matched = yes | no
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'calls',
  route: '^/calls/?$',
  intro: {
    page: 'Calls',
    purpose: 'Incoming calls and voicemails that nobody has opened, called back or marked reviewed yet, so none slip through.',
    covers: ['How many are waiting', 'Each call', 'Calling back', 'Marking reviewed'],
  },
  steps: [
    {
      id: 'header', selector: t('calls-header'),
      title: 'Calls to review',
      say: 'A call stays here until someone opens it, calls back, or marks it reviewed.',
    },
    {
      id: 'alerts', selector: t('calls-alerts'),
      title: 'Pop-up alerts',
      say: 'Choose whether a pop-up tells you about each incoming call.',
    },
    {
      id: 'count', selector: t('calls-count'),
      title: 'Waiting',
      say: 'How many calls still need a look.',
    },
    {
      id: 'list', selector: t('calls-list'), title: 'The calls', say: '',
      variants: [
        { when: t('calls-empty'), title: 'All caught up', say: 'Nothing waiting. New calls show up here if nobody opens the pop-up.' },
        { when: t('calls-row'), say: 'Newest first. Each one says if it was a call or a voicemail, and when.' },
      ],
    },
    {
      id: 'row', selector: t('calls-row'), title: 'One call', say: '',
      variants: [
        { when: `${t('calls-row')}[data-matched="yes"]`, selector: `${t('calls-row')}[data-matched="yes"]`, say: 'This caller matched one of your customers, so you can see who it is straight away.' },
        { when: `${t('calls-row')}[data-matched="no"]`, selector: `${t('calls-row')}[data-matched="no"]`, say: 'No customer matched this number yet. Open the thread to find out who it is.' },
      ],
    },
    {
      id: 'parts', selector: t('calls-parts'), title: 'Parts mentioned', say: '',
      variants: [
        { when: t('calls-parts'), selector: t('calls-parts'), say: 'Parts the caller asked for, with how many you have. Tap one to see where it is, what’s on order and who sells it.' },
        { when: t('flash-word'), selector: t('flash-word'), title: 'Part numbers', say: 'A part number with a dotted underline is one you know. Tap it to see stock, orders and who sells it.' },
      ],
    },
    {
      id: 'actions', selector: t('calls-row-actions'),
      title: 'What to do next',
      say: 'Call back, go to the customer, or open the thread. Any of them takes it off this list.',
    },
    {
      id: 'reviewed', selector: t('calls-reviewed'),
      title: 'Mark reviewed',
      say: 'Nothing to do? Mark reviewed clears it.',
    },
  ],
}
