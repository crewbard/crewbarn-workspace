import type { TutorialData } from './types'

/**
 * Messages: the inbox and its views, finding a conversation, reading and
 * replying, keeping threads tidy and linked, calls with their recordings and
 * transcripts, the Intake queue, and where all of it shows up elsewhere.
 *
 * Import-free (types aside) so the voice exporter can load it on its own.
 * The walk never sends, saves, links, assigns, converts or dismisses: it opens
 * conversations and drafts to look at them, opens the New message window and
 * closes it with its own Cancel, and only points at the buttons that act.
 */

const t = (id: string) => '[data-tour=' + JSON.stringify(id) + ']'

/**
 * A section tab on Communication Settings. SettingsSectionNav gives each tab
 * `<tour>-<id>` at run time (here `comms-tabs-<id>`), which a source search
 * can't see, so these are built rather than written out.
 */
const settingsTab = (id: string) => '[data-tour=' + JSON.stringify('comms-tabs-' + id) + ']'

const COMMS = '^/communications/?$'
const CALLS = '^/calls/?$'
const INTAKE = '^/intake/?$'
const CUSTOMER = '^/customers/(?!new/?$|search/?$)[^/]+/?$'
const JOB = '^/jobs/(?!new/?$)[^/]+/?$'
const SETTINGS = '^/tool-shed/communication/?$'
const EMAIL = '^/tool-shed/communication/email/?$'

export const TUTORIAL: TutorialData = {
  id: 'messages',
  kicker: 'Messages · tutorial',
  title: 'Messages, calls and intake, start to finish',
  film: [
    {
      id: 'inbox',
      label: 'One inbox',
      title: 'Every conversation in one place',
      narration:
        'Welcome to Messages. Texts, emails, calls and voicemails from your customers all land here, one thread for each person you’re talking with. Next door are Calls, for the ones nobody has picked up yet, and the Intake queue, where new requests wait as drafts.',
    },
    {
      id: 'queues',
      label: 'Views',
      title: 'This week, and what needs you',
      narration:
        'The inbox shows this week, with today on top. Your queue pulls out what needs you: unread, unknown callers, and threads assigned to you. Every Sunday night the week rolls into the archive, and every message still stays on its customer and job.',
    },
    {
      id: 'thread',
      label: 'Reply',
      title: 'Open it, read it, reply',
      narration:
        'Open a thread to see the whole back-and-forth. Reply right underneath. A text thread answers by text, with photos if you like, and an email thread answers by email, and you can see when your email was opened.',
    },
    {
      id: 'link',
      label: 'Link it',
      title: 'Put it where it belongs',
      narration:
        'A number you don’t know yet can be linked to a customer, and CrewBarn saves the number so their next call is recognized. Link a thread to a job and it moves onto that job, out of the inbox and into the job’s own messages.',
    },
    {
      id: 'calls',
      label: 'Calls',
      title: 'Calls come with the details',
      narration:
        'Calls thread in too. Each one keeps its recording and a transcript, with who said what when CrewBarn can tell. A short summary says what they need, how urgent it is, and where, and one button starts the job from the call.',
    },
    {
      id: 'intake',
      label: 'Intake queue',
      title: 'Requests turn into drafts',
      narration:
        'Calls and texts to your intake line, and requests from your website, become drafts in the Intake queue. The customer, the address and the work are filled in for you to check. You correct what’s off, then create the job or set it aside. Nothing becomes a job without a person.',
    },
    {
      id: 'where',
      label: 'Where it shows',
      title: 'It follows the customer',
      narration:
        'Conversations follow the customer and the job, on their own Messages tabs. Pop-up alerts tell you when something new comes in, and your phone, texting and email are set up once in Tool Shed.',
    },
    {
      id: 'yourturn',
      label: 'Your turn',
      title: 'Now let’s do it for real',
      narration:
        'That’s the idea. Now let’s do it for real, on your own inbox. I’ll step back into the corner and point at each part. When it’s your turn, you click. If you’d rather watch, press Do it for me. We won’t send anything.',
    },
  ],
  chapters: [
    { key: 'inbox', label: 'The inbox' },
    { key: 'find', label: 'Search and filters' },
    { key: 'thread', label: 'Open a conversation' },
    { key: 'reply', label: 'Reply and new messages' },
    { key: 'organize', label: 'Assign, finish and link' },
    { key: 'calls', label: 'Calls and recordings' },
    { key: 'intake', label: 'The Intake queue' },
    { key: 'used', label: 'Where it shows up' },
    { key: 'settings', label: 'Phone, text and email settings' },
  ],
  steps: [
    // ---------- The inbox ----------
    {
      id: 'inbox-page', chapter: 'inbox', route: COMMS, open: 'goto:/communications',
      selector: `${t('comms-rail')}, ${t('comms-list')}`,
      title: 'Messages',
      say: 'This is Messages. Every text, email, call and voicemail with your customers lands here, one thread for each person you’re talking with.',
    },
    {
      id: 'inbox-tabs', chapter: 'inbox', route: COMMS, selector: `${t('easy-section-tabs')}, ${t('subnav')}`,
      title: 'Messages, Calls, Intake queue',
      say: 'Messages sits next to Calls and the Intake queue. We’ll visit all three.',
    },
    {
      id: 'inbox-new', chapter: 'inbox', route: COMMS, selector: `${t('comms-new')}, ${t('comms-new-mobile')}`,
      title: 'New message',
      say: '+ New message starts a text or an email to anyone, even someone who isn’t a customer yet. We’ll try it in a bit.',
    },
    {
      id: 'inbox-alerts', chapter: 'inbox', route: COMMS, selector: t('comms-alerts'),
      title: 'Pop-up alerts',
      say: 'This switch is for pop-up alerts. With Alerts on, a new message pops up while you work elsewhere in CrewBarn. Turn it off if you’d rather check in on your own time.',
    },
    {
      id: 'inbox-views', chapter: 'inbox', route: COMMS, selector: `${t('comms-views')}, ${t('comms-mobile-view')}`,
      title: 'Your views',
      say: 'These are your views. Each one is a different slice of the same conversations.',
    },
    {
      id: 'inbox-home', chapter: 'inbox', route: COMMS, selector: t('comms-view-inbox'),
      title: 'Inbox · this week',
      say: 'Inbox · this week is home. It shows every thread that’s moved since Monday, so it never piles up forever.',
    },
    {
      id: 'inbox-queue', chapter: 'inbox', route: COMMS, selector: t('comms-queue'),
      title: 'My queue',
      say: 'My queue is your to-do list, and it isn’t limited to this week: Needs action, Unread, Unknown callers for numbers not linked to anyone yet, and Assigned to me. The little numbers are how many are waiting.',
    },
    {
      id: 'inbox-channels', chapter: 'inbox', route: COMMS, selector: t('comms-channels'),
      title: 'Channels and outbound',
      say: 'Channels split this week by kind: only texts, only calls, or only emails. Below them, Outbound shows calls your team made, from the app or all of them.',
    },
    {
      id: 'inbox-archive', chapter: 'inbox', route: COMMS, selector: t('comms-archive'),
      title: 'Archive',
      say: 'Every Sunday night, the week’s threads move to Archive on their own. Nothing is lost. Every message also stays on its customer and job.',
    },
    {
      id: 'inbox-today', chapter: 'inbox', route: COMMS, click: t('comms-view-inbox'), selector: t('comms-today'),
      title: 'Today first',
      say: 'In the list, Today comes first, with a count of what’s still open. Earlier this week sits folded underneath it.',
    },
    {
      id: 'inbox-row', chapter: 'inbox', route: COMMS, selector: t('comms-row'),
      title: 'One row, one conversation',
      say: 'Each row is one conversation: who it’s with, whether it’s a text, call or email, when the last message came in, and a preview. An amber number means it has messages you haven’t read.',
    },
    {
      id: 'inbox-badges', chapter: 'inbox', route: COMMS, selector: t('comms-row-badges'),
      title: 'Where it stands',
      say: 'The tags tell you where it stands. Needs reply means they wrote last. Unknown means the number isn’t linked to a customer. Done means someone finished it. You’ll also see who it’s assigned to, and a green job number when it belongs to a job.',
    },

    // ---------- Search and filters ----------
    {
      id: 'find-search', chapter: 'find', route: COMMS, open: 'goto:/communications', selector: t('comms-search'), hold: true,
      yourTurn: 'Type a name, a number or a word, then press Next.',
      title: 'Search everything',
      say: 'Search looks through everything, the archive and job threads included, not just this week. Try a customer’s name, part of a phone number, or a word like leak.',
    },
    {
      id: 'find-sort', chapter: 'find', route: COMMS, selector: t('comms-sort'),
      title: 'Newest or oldest',
      say: 'Newest puts the latest at the top. Click it to flip to oldest first, and again to flip back.',
    },
    {
      id: 'find-date', chapter: 'find', route: COMMS, selector: t('comms-date'),
      wait: { appear: t('comms-date-panel') }, doIt: t('comms-date'),
      yourTurn: 'Click Date.',
      title: 'Narrow by date',
      say: 'Date narrows the list to one day, or a stretch of time on that day. Click it.',
    },
    {
      id: 'find-date-panel', chapter: 'find', route: COMMS, selector: t('comms-date-panel'),
      title: 'A day and a time',
      say: 'Pick a day, and if you like, a from and to time. The Date button shows ON while it’s narrowing the list, and Clear date filter puts everything back.',
    },
    {
      id: 'find-date-close', chapter: 'find', route: COMMS, selector: t('comms-date'),
      wait: { gone: t('comms-date-panel') }, doIt: t('comms-date'),
      yourTurn: 'Click Date again.',
      title: 'Fold it away',
      say: 'Click Date again to fold it away.',
    },
    {
      id: 'find-archive', chapter: 'find', route: COMMS, selector: t('comms-view-archive'),
      wait: { appear: t('comms-archive-filters') }, doIt: t('comms-view-archive'),
      yourTurn: 'Click Archive.',
      title: 'The archive',
      say: 'Now the archive, for anything before this week. Click Archive.',
    },
    {
      id: 'find-archive-filters', chapter: 'find', route: COMMS, selector: t('comms-archive-filters'),
      title: 'Year, month, week, day',
      say: 'Narrow the archive by year, then month, week and day. The line underneath says exactly what you’re looking at.',
    },
    {
      id: 'find-back', chapter: 'find', route: COMMS, selector: t('comms-view-inbox'),
      wait: { appear: t('comms-today') }, doIt: t('comms-view-inbox'),
      yourTurn: 'Click Inbox · this week.',
      title: 'Back home',
      say: 'Click Inbox · this week to come back home.',
    },

    // ---------- Open a conversation ----------
    {
      id: 'thread-open', chapter: 'thread', route: COMMS, open: 'goto:/communications',
      selector: `${t('comms-rows')}, ${t('comms-list')}`,
      wait: { appear: t('comms-thread') }, doIt: 'comms:first',
      yourTurn: 'Click a conversation.',
      title: 'Open one',
      say: 'Let’s open one. Click any conversation in the list. If today is quiet, open Earlier this week first.',
    },
    {
      id: 'thread-title', chapter: 'thread', route: COMMS, selector: t('comms-thread-title'),
      title: 'Who it’s with',
      say: 'Up top is who it’s with and what kind of thread it is. When it belongs to a job, the job’s number and title sit here too, and clicking it opens the job.',
    },
    {
      id: 'thread-messages', chapter: 'thread', route: COMMS, selector: t('comms-messages'),
      title: 'The whole back-and-forth',
      say: 'Here’s the whole conversation, newest at the bottom. Their messages are on the left, yours are on the right in amber, and a red one didn’t go through.',
    },
    {
      id: 'thread-photos', chapter: 'thread', route: COMMS, selector: t('comms-messages'),
      title: 'Photos and who’s read it',
      say: 'Photos they text show right in the thread. Click one to see it bigger. Next to a message, Read by shows who on your team has seen it.',
    },
    {
      id: 'thread-email', chapter: 'thread', route: COMMS,
      title: 'Email threads',
      say: 'In an email thread, each email is its own card with its subject. Yours show Opened once the customer opens it, or Not opened. Some email apps hide that, so Not opened isn’t proof they didn’t read it.',
    },
    {
      id: 'thread-actions', chapter: 'thread', route: COMMS, selector: t('comms-thread-actions'),
      title: 'What you can do with it',
      say: 'Along the top are the things you do with a thread: call back, assign it, mark it done, and link it to a customer or a job. We’ll go through those after replying.',
    },

    // ---------- Reply and new messages ----------
    {
      id: 'reply-box', chapter: 'reply', route: COMMS, open: 'comms:first', selector: t('comms-reply'),
      title: 'The reply box',
      say: 'This is the reply box. Text and call threads answer by text, and email threads answer by email.',
    },
    {
      id: 'reply-input', chapter: 'reply', route: COMMS, selector: t('comms-reply-input'),
      title: 'Enter sends',
      say: 'You type here. Careful: in a text thread, Enter sends straight away. Hold Shift and press Enter for a new line.',
    },
    {
      id: 'reply-attach', chapter: 'reply', route: COMMS, selector: t('comms-attach'),
      title: 'Photos',
      say: 'The paperclip adds photos to a text. They line up above the box, and the little x takes one off before it goes. Above the box is a row of quick emoji, too.',
    },
    {
      id: 'reply-email', chapter: 'reply', route: COMMS, selector: t('comms-email-subject'),
      title: 'Email replies',
      say: 'In an email thread there’s a subject line on top, and the button says Send email.',
    },
    {
      id: 'reply-send', chapter: 'reply', route: COMMS, selector: t('comms-send'),
      title: 'Send',
      say: 'Send sends it to the customer right away, so we won’t press it now.',
    },
    {
      id: 'reply-templates', chapter: 'reply', route: COMMS,
      title: 'Saved wording',
      say: 'On a customer’s or a job’s Messages tab, this same box also has Template. It drops in one of your saved texts or emails, already filled in for that customer. We’ll see it near the end.',
    },
    {
      id: 'new-open', chapter: 'reply', route: COMMS, selector: `${t('comms-new')}, ${t('comms-new-mobile')}`,
      wait: { appear: t('comms-compose') }, doIt: `${t('comms-new')}, ${t('comms-new-mobile')}`,
      yourTurn: 'Click + New message.',
      title: 'A new conversation',
      say: 'Now a brand new conversation. Click + New message.',
    },
    {
      id: 'new-email', chapter: 'reply', route: COMMS, selector: t('comms-compose-email'),
      wait: { appear: t('comms-compose-subject') }, doIt: t('comms-compose-email'),
      yourTurn: 'Click Email.',
      title: 'Try Email',
      say: 'You can send a text or an email. Text is picked to start. Click Email to see the difference.',
    },
    {
      id: 'new-subject', chapter: 'reply', route: COMMS, selector: t('comms-compose-subject'),
      title: 'A subject line',
      say: 'Email adds a subject line, and To asks for an email address instead of a phone number.',
    },
    {
      id: 'new-text', chapter: 'reply', route: COMMS, selector: t('comms-compose-text'),
      wait: { gone: t('comms-compose-subject') }, doIt: t('comms-compose-text'),
      yourTurn: 'Click Text.',
      title: 'Back to Text',
      say: 'Now back to Text. Click it.',
    },
    {
      id: 'new-to', chapter: 'reply', route: COMMS, selector: t('comms-compose-to'), hold: true,
      yourTurn: 'Type a made-up number, then press Next.',
      title: 'Who it’s to',
      say: 'To phone takes any number, customer or not. Someone new can be linked to a customer afterwards. Type a made-up number to try it.',
    },
    {
      id: 'new-body', chapter: 'reply', route: COMMS, selector: t('comms-compose-body'), hold: true,
      yourTurn: 'Type a short message, then press Next.',
      title: 'The message',
      say: 'Write the message here, like: Hi, this is Acme Services, Jordan is on the way. A text shows how many characters you’ve used, up to 1000.',
    },
    {
      id: 'new-send', chapter: 'reply', route: COMMS, selector: t('comms-compose-send'),
      title: 'Send text',
      say: 'Send text sends it and opens the new thread in your inbox. We won’t send this one.',
    },
    {
      id: 'new-cancel', chapter: 'reply', route: COMMS, selector: t('comms-compose-cancel'),
      wait: { gone: t('comms-compose') }, doIt: t('comms-compose-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Click Cancel. Nothing you typed is kept.',
    },

    // ---------- Assign, finish and link ----------
    {
      id: 'org-actions', chapter: 'organize', route: COMMS, open: 'comms:first', selector: t('comms-thread-actions'),
      title: 'Keep it tidy',
      say: 'Back to the top of the thread. These buttons keep the inbox tidy and put each conversation where it belongs.',
    },
    {
      id: 'org-callback', chapter: 'organize', route: COMMS, selector: t('comms-callback'),
      title: 'Call back',
      say: 'Call back dials their number from the device you’re on.',
    },
    {
      id: 'org-assign', chapter: 'organize', route: COMMS, selector: t('comms-assign'),
      title: 'Assign it',
      say: 'Assign hands the thread to someone on your team, and it shows up in their Assigned to me. Picking a name assigns it right away, so we’ll leave it.',
    },
    {
      id: 'org-done', chapter: 'organize', route: COMMS, selector: t('comms-done'),
      title: 'Mark done',
      say: 'Mark done says it’s handled. The row fades and shows done, and Reopen brings it back. It counts the moment you click, so we’ll leave this one too.',
    },
    {
      id: 'org-link-customer', chapter: 'organize', route: COMMS, selector: t('comms-link-customer'),
      wait: { appear: t('comms-link-customer-panel') }, doIt: t('comms-link-customer'),
      yourTurn: 'Click + Link to customer.',
      title: 'Link to customer',
      say: 'This number isn’t linked to anyone yet, so + Link to customer is here. Click it to have a look.',
    },
    {
      id: 'org-link-customer-panel', chapter: 'organize', route: COMMS, selector: t('comms-link-customer-panel'),
      title: 'Pick the customer',
      say: 'Search a name and pick them. That links the thread and saves this number on their account, so next time they call, CrewBarn knows who it is. Picking one saves it, so just look for now.',
    },
    {
      id: 'org-link-customer-close', chapter: 'organize', route: COMMS, selector: t('comms-link-customer'),
      wait: { gone: t('comms-link-customer-panel') }, doIt: t('comms-link-customer'),
      yourTurn: 'Click + Link to customer again.',
      title: 'Close it',
      say: 'Click + Link to customer again to close it.',
    },
    {
      id: 'org-customer', chapter: 'organize', route: COMMS, selector: t('comms-customer-link'),
      title: 'Their account',
      say: 'When the thread already has a customer, Customer opens their account, right on its Messages tab.',
    },
    {
      id: 'org-link-job', chapter: 'organize', route: COMMS, selector: t('comms-link-job'),
      wait: { appear: t('comms-link-job-panel') }, doIt: t('comms-link-job'),
      yourTurn: 'Click + Link to job.',
      title: 'Link to job',
      say: '+ Link to job ties the conversation to a job. Click it.',
    },
    {
      id: 'org-link-job-panel', chapter: 'organize', route: COMMS, selector: t('comms-link-job-panel'),
      title: 'Pick the job',
      say: 'It starts with this customer’s recent jobs, and you can search any job by number or title. Picking one moves the thread onto that job and out of the inbox, so leave it for now.',
    },
    {
      id: 'org-link-job-close', chapter: 'organize', route: COMMS, selector: t('comms-link-job'),
      wait: { gone: t('comms-link-job-panel') }, doIt: t('comms-link-job'),
      yourTurn: 'Click + Link to job again.',
      title: 'Close it',
      say: 'Click + Link to job again to close it.',
    },
    {
      id: 'org-linked', chapter: 'organize', route: COMMS, selector: t('comms-linked-job'),
      title: 'Already on a job',
      say: 'When a thread is already on a job, the job number shows here instead. Unlink sends the thread back to the inbox.',
    },

    // ---------- Calls and recordings ----------
    {
      id: 'calls-view', chapter: 'calls', route: COMMS, open: 'goto:/communications', selector: t('comms-view-calls'),
      wait: { click: true }, doIt: t('comms-view-calls'),
      yourTurn: 'Click Calls.',
      title: 'Calls in Messages',
      say: 'Calls and voicemails thread right here in Messages too. Click Calls, under Channels.',
    },
    {
      id: 'calls-open', chapter: 'calls', route: COMMS, selector: `${t('comms-rows')}, ${t('comms-list')}`,
      wait: { appear: t('comms-call') }, doIt: 'comms:first-call',
      yourTurn: 'Click a call.',
      title: 'Open a call',
      say: 'Open a call to see what CrewBarn kept from it.',
    },
    {
      id: 'call-card', chapter: 'calls', route: COMMS, selector: t('comms-call'),
      title: 'Every call is a card',
      say: 'Every call is a card: inbound, outbound or voicemail, when it was, how long it ran, and the numbers on both ends. Outbound calls also show who on your team made them.',
    },
    {
      id: 'call-need', chapter: 'calls', route: COMMS, selector: t('comms-call-need'),
      title: 'What they need',
      say: 'Once CrewBarn has read the call, What they need comes first: a short summary, plus the service, how urgent it is, and the area.',
    },
    {
      id: 'call-recording', chapter: 'calls', route: COMMS, selector: t('comms-call-recording'),
      title: 'The recording',
      say: 'Play recording plays the call right here, whenever you want a listen.',
    },
    {
      id: 'call-transcript', chapter: 'calls', route: COMMS, selector: t('comms-call-transcript'),
      wait: { appear: t('comms-call-transcript-body') }, doIt: t('comms-call-transcript'),
      yourTurn: 'Click Read transcript.',
      title: 'Read the transcript',
      say: 'Longer calls keep the transcript tucked away. Click Read transcript.',
    },
    {
      id: 'call-transcript-view', chapter: 'calls', route: COMMS, selector: t('comms-transcript-view'),
      title: 'Who said what',
      say: 'When CrewBarn can tell the two sides apart, Conversation shows who said what, your side and the customer’s. Original is the plain transcript. If a line says inferred, check the recording when it matters.',
    },
    {
      id: 'call-create', chapter: 'calls', route: COMMS, selector: t('comms-call-create'),
      title: 'Start the job from the call',
      say: 'Create job from this call, or Create estimate, reads the call and opens a short form with what it found, so you can check it before any job is made. We won’t start one now.',
    },
    {
      id: 'call-link', chapter: 'calls', route: COMMS, selector: t('comms-call-actions'),
      title: 'Already have the job?',
      say: 'When the call is about work you already have, Link to an existing job puts it there instead, so you don’t make the same job twice.',
    },
    {
      id: 'calls-page', chapter: 'calls', route: CALLS, open: 'goto:/calls', selector: t('calls-header'),
      title: 'Calls to review',
      say: 'Now the Calls tab. It’s a short list of calls nobody has dealt with yet: incoming calls and voicemails from the last 12 hours that weren’t opened, called back or marked reviewed.',
    },
    {
      id: 'calls-count', chapter: 'calls', route: CALLS, selector: t('calls-count'),
      title: 'How many are waiting',
      say: 'This is how many are waiting. The Alerts switch beside it turns the incoming call pop-up on or off.',
    },
    {
      id: 'calls-list', chapter: 'calls', route: CALLS, selector: t('calls-list'),
      title: 'The list',
      say: 'Each call shows the caller, the time, the customer it matched if there is one, and the start of the transcript. VIP customers are marked.',
    },
    {
      id: 'calls-actions', chapter: 'calls', route: CALLS, selector: t('calls-row-actions'),
      title: 'Deal with it',
      say: 'Call back dials them. Go to customer opens their account, and Open thread opens the call in Messages. Any of those clears it from this list, and Mark reviewed clears one you dealt with some other way. We’ll leave them.',
    },

    // ---------- The Intake queue ----------
    {
      id: 'intake-page', chapter: 'intake', route: INTAKE, open: 'goto:/intake', selector: t('intake-header'),
      title: 'The Intake queue',
      say: 'This is the Intake queue. When someone calls or texts your intake line, or sends a request from your website, CrewBarn reads it and drafts the job for you. Nothing becomes a job until a person says so. The Alerts switch pops up each new draft as it arrives.',
    },
    {
      id: 'intake-status', chapter: 'intake', route: INTAKE, selector: t('intake-status'),
      title: 'Where each draft stands',
      say: 'Pending is waiting for you. Reviewed has been looked at. Approved became a job. Failed couldn’t be read. Dismissed was set aside. And All is everything.',
    },
    {
      id: 'intake-pending', chapter: 'intake', route: INTAKE, selector: t('intake-status-pending'),
      wait: { click: true }, doIt: t('intake-status-pending'),
      yourTurn: 'Click Pending.',
      title: 'Pending',
      say: 'Click Pending, the ones waiting on you.',
    },
    {
      id: 'intake-list', chapter: 'intake', route: INTAKE, selector: t('intake-list'),
      title: 'The drafts',
      say: 'Each draft shows who it’s from, its status, what it’s about, how long ago it came in, a camera when photos came with it, and the start of the message.',
    },
    {
      id: 'intake-open', chapter: 'intake', route: INTAKE, selector: t('intake-row'),
      wait: { appear: t('intake-detail-head') }, doIt: t('intake-row'),
      yourTurn: 'Click a draft.',
      title: 'Open a draft',
      say: 'Click one to open it. Looking doesn’t change it.',
    },
    {
      id: 'intake-head', chapter: 'intake', route: INTAKE, selector: t('intake-detail-head'),
      title: 'At a glance',
      say: 'Up top is the name, its status, whether it looks like a job or an estimate, and how sure the AI was about what it pulled out. That’s how clear the reading was, not a go-ahead.',
    },
    {
      id: 'intake-review', chapter: 'intake', route: INTAKE, selector: t('intake-review'),
      title: 'Your review comes first',
      say: 'This panel is the plan: check the source, correct the details, then decide whether to create the job. Each review is noted here, with what was changed.',
    },
    {
      id: 'intake-customer', chapter: 'intake', route: INTAKE, selector: t('intake-customer'),
      title: 'Customer',
      say: 'The draft is laid out in parts. Customer has the name, business, phone and email it found. Anything it missed says Not captured.',
    },
    {
      id: 'intake-equipment', chapter: 'intake', route: INTAKE, selector: t('intake-equipment'),
      title: 'Asset and equipment',
      say: 'Asset and equipment holds what they described, like a unit’s brand, model and serial number.',
    },
    {
      id: 'intake-part', chapter: 'intake', route: INTAKE, selector: t('intake-part'),
      title: 'Part guess',
      say: 'Part guess is what the AI thinks the work needs, with how much you have and whose truck it’s on. If it guessed wrong, the Wrong part? button lets you correct it.',
    },
    {
      id: 'intake-job', chapter: 'intake', route: INTAKE, selector: t('intake-job'),
      title: 'The work',
      say: 'Job draft is the work itself: a title, the service, the priority, when they asked for it, and the scope.',
    },
    {
      id: 'intake-address', chapter: 'intake', route: INTAKE, selector: t('intake-address'),
      title: 'Service address',
      say: 'Service address is where the work is, with any entry notes, like a gate code.',
    },
    {
      id: 'intake-photos', chapter: 'intake', route: INTAKE, selector: t('intake-photos'),
      title: 'Photos',
      say: 'Photos are the pictures that came with this request. Show the whole conversation reaches further back if the right one came earlier.',
    },
    {
      id: 'intake-transcript', chapter: 'intake', route: INTAKE, selector: t('intake-transcript'),
      title: 'What they actually said',
      say: 'And the transcript of the call or text, so you can check the draft against their own words.',
    },
    {
      id: 'intake-follow-up', chapter: 'intake', route: INTAKE, selector: t('intake-follow-up-open'),
      wait: { click: true }, doIt: t('intake-follow-up-open'),
      yourTurn: 'Click Ask for missing details.',
      title: 'Missing something?',
      say: 'Missing an address or a better photo? Click Ask for missing details.',
    },
    {
      id: 'intake-follow-up-body', chapter: 'intake', route: INTAKE, selector: t('intake-follow-up'),
      title: 'Ask for it',
      say: 'Tick what’s missing, and Prepare wording writes a polite message you can edit. Save draft keeps it with the intake. Nothing is sent from here. You send it from the conversation.',
    },
    {
      id: 'intake-replies', chapter: 'intake', route: INTAKE, selector: t('intake-replies'),
      title: 'Newer messages',
      say: 'Review newer customer messages shows anything they sent after the first one, in case they added details.',
    },
    {
      id: 'intake-actions', chapter: 'intake', route: INTAKE, selector: t('intake-actions'),
      title: 'The decision',
      say: 'Back up top are the decisions. Open thread jumps to the conversation in Messages.',
    },
    {
      id: 'intake-create', chapter: 'intake', route: INTAKE, selector: t('intake-create'),
      title: 'Create job',
      say: 'Create job, or Create estimate, opens a new form filled in from the draft. You check it and save it there. We won’t open it now.',
    },
    {
      id: 'intake-dismiss', chapter: 'intake', route: INTAKE, selector: t('intake-dismiss'),
      title: 'Dismiss',
      say: 'Dismiss sets a draft aside, like a wrong number or a sales call. It moves to Dismissed, and Reopen there brings it back. A failed draft has Retry AI extraction instead. We’ll leave this one.',
    },

    // ---------- Where it shows up ----------
    {
      id: 'used-customer', chapter: 'used', route: CUSTOMER, open: 'customer:messages', selector: t('customer-messages-tab'),
      title: 'On the customer',
      say: 'Messages follow the customer. On any account, the Messages tab has every text, email, call and voicemail with them, grouped by job, with General for the rest. I’ve opened one of your customers, just for looking.',
    },
    {
      id: 'used-template', chapter: 'used', route: CUSTOMER, selector: t('comms-template'),
      title: 'Template',
      say: 'Here’s Template in the reply box. It drops in one of the texts or emails you keep in Templates & Forms, filled in for this customer.',
    },
    {
      id: 'used-template-fill', chapter: 'used', route: CUSTOMER,
      title: 'Filled in from the right job',
      say: 'New email and New text fill a template in from the page you’re on. On a customer, it uses their next booked job, or their latest open one, and says so: Filled in from job, with the date. Click change to pick another job. Anything it can’t fill shows up in yellow as Still blank, with a box to type it in, and it won’t send until those are done.',
    },
    {
      id: 'used-job', chapter: 'used', route: JOB, open: 'job:messages', click: t('job-tab-messages'), selector: t('job-messages-panel'),
      title: 'On the job',
      say: 'Every job has its own Messages tab too, with just the conversations tied to that job. This is where a thread goes when you link it.',
    },
    {
      id: 'used-menu', chapter: 'used', selector: `${t('topbar-comms')}[href="/communications"], ${t('sidebar-communications')}`,
      title: 'Always one click away',
      say: 'Messages is always one click away in the menu.',
    },
    {
      id: 'used-alerts', chapter: 'used',
      title: 'Pop-ups',
      say: 'When something new comes in, a pop-up lets you know: a new message, an incoming call with Open thread, or a new intake draft. Each has its own Alerts switch, on the page it’s about.',
    },
    {
      id: 'used-dashboard', chapter: 'used',
      title: 'On the dashboard',
      say: 'On the dashboard, the Unanswered messages card lists who’s waiting on a reply, with a link straight to the inbox.',
    },

    // ---------- Phone, text and email settings ----------
    {
      id: 'set-page', chapter: 'settings', route: SETTINGS, open: 'goto:/tool-shed/communication', selector: t('comms-header'),
      title: 'Communication Settings',
      say: 'Behind all of this is Communication Settings, in Tool Shed. This is where your phone, texting and email get set up. We’ll only look.',
    },
    {
      id: 'set-tabs', chapter: 'settings', route: SETTINGS, selector: t('comms-tabs'),
      title: 'Its sections',
      say: 'It’s split into sections: phone setup and texting, call transcription, intake, and customer email, each with a test to make sure it works.',
    },
    {
      id: 'set-inbox', chapter: 'settings', route: SETTINGS, click: settingsTab('phone'), selector: t('comms-inbox'),
      title: 'Keep job threads in the inbox',
      say: 'Under Phone setup, Messages inbox has one choice that changes what you see. Keep job-linked threads in the inbox is off to start, so a thread that moves to a job leaves the inbox. Turn it on if you want every message to stay in Messages.',
    },
    {
      id: 'set-transcription', chapter: 'settings', route: SETTINGS, click: settingsTab('transcription'), selector: t('comms-transcription'),
      title: 'Call transcription',
      say: 'Call transcription picks who turns recordings into text. That’s what fills in the transcripts and summaries on your calls.',
    },
    {
      id: 'set-intake', chapter: 'settings', route: SETTINGS, click: settingsTab('intake'), selector: t('comms-intake'),
      title: 'Intake automation',
      say: 'Intake automation sets one number aside just for intake. Any call or text to it lands in the Intake queue as a draft, and every other number works as normal.',
    },
    {
      id: 'set-test', chapter: 'settings', route: SETTINGS, click: settingsTab('test-sms'), selector: t('comms-test-sms'),
      title: 'Test messaging',
      say: 'Test messaging sends one text through your setup, to check it works.',
    },
    {
      id: 'set-email', chapter: 'settings', route: EMAIL, open: 'goto:/tool-shed/communication/email', selector: t('email-sender-header'),
      title: 'Where your email comes from',
      say: 'Where your email comes from is about sending from your own address. A few settings, once, keep your emails out of junk folders.',
    },
    {
      id: 'set-email-fallback', chapter: 'settings', route: EMAIL, selector: t('email-sender-fallback'),
      title: 'Until then',
      say: 'Until you do, email still goes out, from a CrewBarn address with your name on it.',
    },
    {
      id: 'set-done', chapter: 'settings',
      title: 'That’s Messages',
      say: 'That’s Messages, Calls and the Intake queue. Reply from the inbox, link each thread to its customer and job, and check every intake draft before it becomes work. Nothing was sent or changed along the way.',
    },
  ],
}
