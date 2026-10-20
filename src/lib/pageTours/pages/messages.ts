import type { PageTour } from '../types'

/**
 * Communications → Messages (/communications).
 *
 * The inbox: views on the left, threads in the middle, the open thread on
 * the right. Threads now include "Portal" ones, written by customers in the
 * customer portal.
 *
 *   comms-row          data-channel = sms | email | call | voicemail | portal | …
 *   comms-thread-title data-channel = the open thread's channel
 *   comms-reply        data-channel = portal | email | call | text
 *
 * To show a thread the tour opens the first one in the list (it only opens
 * it to look); it never sends, assigns, links or marks anything done.
 */
const t = (id: string) => `[data-tour="${id}"]`
const PORTAL_ROW = `${t('comms-row')}[data-channel="portal"]`
const OPEN = t('comms-thread-actions')
const reply = (c: string) => `${t('comms-reply')}[data-channel="${c}"]`

export const PAGE_TOUR: PageTour = {
  id: 'messages',
  route: '^/communications/?$',
  intro: {
    page: 'Messages',
    purpose: 'Every text, email, call, voicemail and customer portal message in one inbox, one thread for each person you’re talking with.',
    covers: ['Views and queues', 'This week’s threads', 'Portal messages', 'Finding a thread', 'Reading and replying', 'Linking it to a job'],
  },
  // The intro film, before the walk-through (see ../film.ts).
  film: [
    { id: 'name', say: 'This is Messages, one inbox for every conversation.', visual: { kind: 'title', title: 'Messages', subtitle: 'Texts, emails, calls and portal messages' } },
    {
      id: 'inbox', title: 'One inbox', say: 'Texts, emails, calls, voicemails and portal messages all land here, one thread for each person.',
      visual: { kind: 'list', heading: 'Inbox', rows: [
        { title: 'Maria Rivera', meta: 'Text · Thursday works. Thank you!', chip: 'New', tone: 'amber' },
        { title: 'Oakwood Dental', meta: 'Email · A question about an invoice', chip: 'Mine', tone: 'blue' },
        { title: '(555) 014-2290', meta: 'Voicemail · forty seconds', chip: 'Call back', tone: 'red' },
        { title: 'Chen residence', meta: 'Portal · Can we move my visit?', chip: 'Portal', tone: 'purple' },
      ] },
    },
    { id: 'thread', title: 'Reading and replying', say: 'Open a thread to read the whole conversation, and reply from the same place.', visual: { kind: 'thread', contact: 'Maria Rivera' } },
    {
      id: 'link', title: 'Linked to the work', say: 'Link a thread to the customer and the job, so everyone sees it where the work is.',
      visual: { kind: 'account', name: 'Maria Rivera', type: 'Residential', places: ['12 Oak Street'], people: ['Maria Rivera'], jobs: [{ title: 'Repair visit', chip: 'Thread linked', tone: 'green' }], balance: 'Three messages' },
    },
    { id: 'go', say: 'Let’s walk through the inbox.', visual: { kind: 'go' } },
  ],
  steps: [
    // ── The left rail ──
    {
      id: 'rail', selector: t('comms-rail'),
      title: 'Messages',
      say: 'Texts, emails, calls and portal messages from your customers all land here.',
    },
    {
      id: 'new', selector: `${t('comms-new')}, ${t('comms-new-mobile')}`,
      title: 'New message',
      say: 'Start a new text or email to anyone, customer or not.',
    },
    {
      id: 'alerts', selector: t('comms-alerts'),
      title: 'Pop-up alerts',
      say: 'Choose whether a pop-up tells you when a new message comes in.',
    },
    {
      id: 'views', selector: `${t('comms-views')}, ${t('comms-mobile-view')}`,
      title: 'Views',
      say: 'Different ways to look at the same inbox. The numbers show how many are in each.',
    },
    {
      id: 'inbox', selector: t('comms-view-inbox'),
      title: 'Inbox, this week',
      say: 'Home base: this week’s threads, today on top.',
    },
    {
      id: 'queue', selector: t('comms-queue'),
      title: 'My queue',
      say: 'What needs you: threads waiting for an answer, unread ones, callers nobody recognises, and threads given to you.',
    },
    {
      id: 'channels', selector: t('comms-channels'),
      title: 'Channels',
      say: 'Just texts, just calls, or just emails.',
    },
    {
      id: 'outbound', selector: t('comms-outbound'),
      title: 'Outbound',
      say: 'What your team sent and called, including calls made from the phone app.',
    },
    {
      id: 'archive', selector: t('comms-archive'),
      title: 'Archive',
      say: 'Every Sunday night the week moves to the archive. Nothing is lost, every message stays on its customer and job.',
    },

    // ── The list ──
    {
      id: 'today', selector: t('comms-today'), click: t('comms-view-inbox'),
      title: 'Today',
      say: 'Today’s threads, and how many are still open.',
    },
    {
      id: 'list', selector: t('comms-rows'), title: 'Threads', say: '',
      variants: [
        { when: t('comms-row'), say: 'One row per person. Bold means unread, and the badge shows how many new messages.' },
        { when: `!${t('comms-row')}`, title: 'Nothing here yet', say: 'No threads here right now. New texts, calls, emails and portal messages show up the moment they arrive.' },
      ],
    },
    {
      id: 'portal', selector: PORTAL_ROW,
      title: 'Portal messages',
      say: 'Portal means a customer wrote to you from your customer portal. There’s no phone number or email, the customer is the thread, and they read your reply in the portal.',
    },
    {
      id: 'badges', selector: t('comms-row-badges'),
      title: 'At a glance',
      say: 'Done, needs reply, unknown caller, who it’s given to, and the job it’s linked to. Tap the job number to open the job.',
    },
    {
      id: 'earlier', selector: t('comms-earlier'),
      title: 'Earlier this week',
      say: 'The rest of this week, folded away. Tap to open it.',
    },
    {
      id: 'archive-link', selector: t('comms-archive-link'),
      title: 'Search the archive',
      say: 'Looking for something older? Search the archive.',
    },

    // ── Finding ──
    {
      id: 'search', selector: t('comms-search'),
      title: 'Search',
      say: 'Search by name, number, email or words in the message.',
    },
    {
      id: 'sort', selector: t('comms-sort'),
      title: 'Newest or oldest',
      say: 'Flip between newest first and oldest first.',
    },
    {
      id: 'date', selector: t('comms-date'),
      title: 'Pick a day',
      say: 'Narrow it to one day, or a time range on that day.',
    },

    // ── One thread ──
    {
      id: 'thread', selector: t('comms-thread-title'), open: `first:${t('comms-row')}`, waitMs: 1200, title: 'One thread',
      say: 'Open a thread to see the whole conversation, oldest at the top.',
      variants: [
        { when: `${t('comms-thread-title')}[data-channel="portal"]`, title: 'A portal thread', say: 'This one came from your customer portal, so it’s already tied to the customer.' },
      ],
    },
    {
      id: 'callback', selector: t('comms-callback'), when: OPEN,
      title: 'Call back',
      say: 'Call the person straight back.',
    },
    {
      id: 'assign', selector: t('comms-assign'), when: OPEN,
      title: 'Assign it',
      say: 'Give this thread to someone. It lands in their Assigned to me view.',
    },
    {
      id: 'done', selector: t('comms-done'), when: OPEN,
      title: 'Mark done',
      say: 'Mark done when it’s handled. It stays in the list, faded, and Reopen brings it back.',
    },
    {
      id: 'customer', selector: `${t('comms-customer-link')}, ${t('comms-link-customer')}`, when: OPEN, title: 'The customer',
      say: 'Customer opens their record, with every message they’ve sent.',
      variants: [
        { when: t('comms-link-customer'), selector: t('comms-link-customer'), title: 'Link to customer', say: 'Don’t know who this is yet? Link to customer ties the thread to the right person.' },
      ],
    },
    {
      id: 'job', selector: `${t('comms-linked-job')}, ${t('comms-link-job')}`, when: OPEN, title: 'Link to job',
      say: 'Link to job puts the conversation on the job, so the whole team sees it there.',
      variants: [
        { when: t('comms-linked-job'), selector: t('comms-linked-job'), title: 'Linked to a job', say: 'This thread is on a job already, so it shows on that job too.' },
      ],
    },
    {
      id: 'messages', selector: t('comms-messages'), when: OPEN,
      title: 'The conversation',
      say: 'Every message back and forth, with photos, and calls with their recordings and transcripts.',
    },
    {
      id: 'flash-words', selector: t('flash-word'), when: OPEN, title: 'Part numbers', say: '',
      variants: [
        { when: t('comms-call-parts'), selector: t('comms-call-parts'), title: 'Parts mentioned', say: 'The parts named on this call, with how many you have, so you can answer straight away. Tap one for the details.' },
        { when: t('flash-word'), selector: t('flash-word'), say: 'Part numbers you know get a dotted underline, even when they’re said out loud. Tap one to see stock, what’s on order, the catalog page and who sells it.' },
      ],
    },
    {
      id: 'reply', selector: t('comms-reply'), when: OPEN, title: 'Reply',
      say: 'Reply right here. A text thread answers by text, and you can add photos.',
      variants: [
        { when: reply('portal'), title: 'Reply in the portal', say: 'Your reply goes back to their customer portal, where they read it. No text or email is sent.' },
        { when: reply('email'), title: 'Reply by email', say: 'An email thread answers by email, with a subject line. You’ll see when it’s opened.' },
        { when: reply('call'), say: 'You can answer a call thread with a text.' },
      ],
    },
    {
      id: 'send', selector: t('comms-send'), when: OPEN,
      title: 'Send',
      say: 'Send goes out the moment you press it.',
    },
  ],
}
