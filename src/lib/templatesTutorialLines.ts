/**
 * Words and steps for the Templates & Forms tutorial
 * (components/guides/ActiveTutorial.tsx).
 *
 * It starts as a short film, then the film steps back into a corner and the
 * tutorial walks the real page: it points at each part, waits while the person
 * does the step themselves, and has "Do it for me" for anyone who would rather
 * watch.
 *
 * Kept import-free so scripts/export-tour-lines.mjs can load it on its own and
 * export every line for voice recording as `templates.<n>`. The app finds a
 * recording by the line's own text, so editing a line here simply falls back
 * to live speech until it is re-recorded.
 */

export type TemplatesFilmSceneId = 'kinds' | 'moments' | 'chips' | 'tags' | 'default' | 'forms' | 'where' | 'yourturn'

import type { TutorialChapter, TutorialFilmScene, TutorialLiveStep } from '@/lib/tutorials/types'

export type { TutorialChapter, TutorialFilmScene, TutorialLiveStep }

const t = (id: string) => `[data-tour="${id}"]`

const BOARD = '^/custom-documents/?$'
const EDITOR = '^/custom-documents/(email|document)/[^/]+/?$'
const DOCUMENT = '^/custom-documents/document/[^/]+/?$'
const FORM = '^/custom-documents/new-form/?$'

export const TEMPLATES_TUTORIAL_FILM: TutorialFilmScene<TemplatesFilmSceneId>[] = [
  {
    id: 'kinds',
    label: 'Three kinds',
    title: 'Everything you send lives here',
    narration:
      'Welcome to Templates and Forms. Everything CrewBarn sends for you lives here, in three kinds: emails, text messages, and documents you print, attach, or get signed.',
  },
  {
    id: 'moments',
    label: 'Moments',
    title: 'Each one belongs to a moment in the job',
    narration:
      'Every template belongs to a moment in the job: before the job, on the job, getting paid, and after. When that moment comes, like the tech heading your way, CrewBarn sends the template that belongs to it.',
  },
  {
    id: 'chips',
    label: 'Status chips',
    title: 'One look tells you what sends',
    narration:
      'On the board, each moment has a chip for every channel. Green means it sends. Gray means it’s turned off. A dashed chip hasn’t been made yet. And amber with a number means there are copies, and only one of them is ever sent.',
  },
  {
    id: 'tags',
    label: 'Merge tags',
    title: 'Write it once, filled in every time',
    narration:
      'You write a template once, and CrewBarn fills it in every time. Merge tags, the words in curly braces, swap in the real details when it sends. So “Hi, customer first name” turns into “Hi, Jordan.”',
  },
  {
    id: 'default',
    label: 'Workflow default',
    title: 'The default is the one that sends',
    narration:
      'When you have more than one template of the same kind, the one marked as the workflow default is the one CrewBarn uses on its own. The others are still there to pick by hand.',
  },
  {
    id: 'forms',
    label: 'Forms',
    title: 'Documents and forms',
    narration:
      'Documents are your work orders, invoices, inspections and agreements. Add a signature slot and a document can be signed. And Make a form builds a new one just by picking fields, with no tags to type.',
  },
  {
    id: 'where',
    label: 'Where they’re used',
    title: 'Your templates show up all over',
    narration:
      'Your templates show up all over CrewBarn: in job stages, reminders and automations, on estimates and jobs, and in the message box. And when one customer needs something different, like their own invoice layout, you pick it right on their account.',
  },
  {
    id: 'yourturn',
    label: 'Your turn',
    title: 'Now let’s do it for real',
    narration:
      'That’s the idea. Now let’s do it for real. I’ll step back into the corner and point at each part of the page. When it’s your turn, you click. If you’d rather watch, press Do it for me.',
  },
]

export const TEMPLATES_TUTORIAL_CHAPTERS: TutorialChapter[] = [
  { key: 'board', label: 'The board' },
  { key: 'create', label: 'Create one' },
  { key: 'edit', label: 'Edit it' },
  { key: 'preview', label: 'Preview and save' },
  { key: 'document', label: 'Documents and signatures' },
  { key: 'text', label: 'Text messages' },
  { key: 'form', label: 'Make a form' },
  { key: 'used', label: 'Where they’re used' },
  { key: 'views', label: 'Other views' },
]

export const TEMPLATES_TUTORIAL_STEPS: TutorialLiveStep[] = [
  // ---------- The board ----------
  {
    id: 'board-header', chapter: 'board', route: BOARD, open: 'goto:/custom-documents',
    click: t('templates-view-journey'),
    selector: `${t('templates-header')}, ${t('templates-easy-header')}`,
    title: 'Templates & Forms',
    say: 'Here’s the page. Everything CrewBarn sends, prints or gets signed, laid out in the order your jobs happen.',
  },
  {
    id: 'board-views', chapter: 'board', route: BOARD, selector: t('templates-views'),
    title: 'Four ways to look',
    say: 'These four buttons change how you look at the same templates. Journey is the board you’re on. List puts each template on its own row. Job stages and By channel are for tidying up, and we’ll peek at them at the end.',
  },
  {
    id: 'board-starter', chapter: 'board', route: BOARD, selector: t('templates-starter'),
    title: 'CrewBarn’s starter templates',
    say: 'Add missing CrewBarn templates fills any gaps with CrewBarn’s tested versions. Restore CrewBarn defaults brings back the original wording on ones that changed. Both show you a list first, and nothing changes until you press Add selected or Restore selected.',
  },
  {
    id: 'board-new', chapter: 'board', route: BOARD, selector: t('templates-new'),
    title: 'Start a new one',
    say: 'Write one with CBI and New template both start a new template. We’ll make one together in a minute.',
  },
  {
    id: 'board-search', chapter: 'board', route: BOARD, selector: t('templates-journey-search'),
    title: 'Search',
    say: 'Search finds a moment or a template by name. Try words like reminder or invoice.',
  },
  {
    id: 'board-filter', chapter: 'board', route: BOARD, selector: t('templates-journey-filter'),
    title: 'One channel at a time',
    say: 'These narrow the board to one channel: everything, email, text, or documents.',
  },
  {
    id: 'board-form', chapter: 'board', route: BOARD, selector: t('templates-make-form'),
    title: 'Make a form',
    say: 'Make a form builds a printable document by picking fields. We’ll try it near the end.',
  },
  {
    id: 'board-listview', chapter: 'board', route: BOARD, selector: t('templates-list-view'),
    title: 'List view',
    say: 'List view jumps straight to the list, one template per row.',
  },
  {
    id: 'board-legend', chapter: 'board', route: BOARD, selector: t('templates-legend'),
    title: 'What the chips mean',
    say: 'This key explains the chips. Green sends. Gray is turned off. Dashed hasn’t been made yet. Amber with a number has copies.',
  },
  {
    id: 'board-stage', chapter: 'board', route: BOARD, selector: t('templates-stage-before'),
    title: 'In job order',
    say: 'The board reads top to bottom, in the order a job happens. First up is Before the job: requests, estimates, confirmations and reminders. Then On the job, Getting paid, and After the job.',
  },
  {
    id: 'board-moment', chapter: 'board', route: BOARD, selector: t('templates-moment-appointment-reminder'),
    wait: { click: true }, doIt: t('templates-moment-appointment-reminder'),
    yourTurn: 'Click the Appointment reminder card.',
    title: 'Open a moment',
    say: 'Each card is one moment. The lightning line says what sets it off, and the chips show what goes out. Click Appointment reminder to look inside.',
  },
  {
    id: 'board-preview', chapter: 'board', route: BOARD, selector: t('templates-moment-preview'),
    title: 'What the customer gets',
    say: 'This panel shows what the customer gets at that moment. The tabs switch between email and text, and when there’s more than one version, you pick which one to look at. This is your default. A customer can still be set up to get a different one, and we’ll come back to that.',
  },
  {
    id: 'board-facts', chapter: 'board', route: BOARD, selector: t('templates-preview-facts'),
    title: 'When, how many, how recent',
    say: 'Here’s when it sends, how many versions are live or switched off, and when it was last changed.',
  },
  {
    id: 'board-preview-job', chapter: 'board', route: BOARD, selector: t('templates-preview-job'),
    title: 'Preview with job data',
    say: 'Preview with job data fills it in with one of your real jobs, so you read exactly what the customer would. Nothing gets sent.',
  },
  {
    id: 'board-edit', chapter: 'board', route: BOARD, selector: t('templates-preview-edit'),
    title: 'Edit',
    say: 'Edit opens this template in the editor. We’ll get there, but first, let’s make a brand new one.',
  },

  // ---------- Create one ----------
  {
    id: 'create-open', chapter: 'create', route: BOARD, open: 'goto:/custom-documents', selector: t('templates-new-button'),
    wait: { appear: t('tpl-new') }, doIt: t('templates-new-button'),
    yourTurn: 'Click New template.',
    title: 'New template',
    say: 'A new template takes three quick picks. Click New template.',
  },
  {
    id: 'create-steps', chapter: 'create', selector: t('tpl-new-steps'),
    title: 'Three picks',
    say: 'Up top are the three picks: the moment, how it goes out, and what to start from.',
  },
  {
    id: 'create-moment', chapter: 'create', selector: t('tpl-new-moments'),
    wait: { appear: t('tpl-new-channels') }, doIt: t('tpl-new-moment-appointment-reminder'),
    yourTurn: 'Pick Appointment reminder.',
    title: 'Pick the moment',
    say: 'First, the moment. These are the same moments as the board, grouped by stage. Pick Appointment reminder.',
  },
  {
    id: 'create-chips', chapter: 'create', selector: t('tpl-new-chips'),
    title: 'Change a pick',
    say: 'Your picks show up here as green chips. Click one to go back and change it.',
  },
  {
    id: 'create-channel', chapter: 'create', selector: t('tpl-new-channels'),
    wait: { appear: t('tpl-new-start') }, doIt: t('tpl-new-channel-email'),
    yourTurn: 'Pick Email.',
    title: 'Pick how it goes out',
    say: 'Next, how it goes out: email, text, or document. Each one tells you if you already send one here, or if CrewBarn has a version ready. Pick Email.',
  },
  {
    id: 'create-existing', chapter: 'create', selector: t('tpl-new-existing'),
    title: 'You already have one',
    say: 'When you already have one for this moment, CrewBarn tells you. Only one is ever sent, so editing the one you have is usually better than adding another.',
  },
  {
    id: 'create-cbi', chapter: 'create', selector: t('tpl-new-start-cbi'),
    title: 'Write it with CBI',
    say: 'Now, what to start from. Write it with CBI: describe it in a sentence, and CBI writes it in your voice.',
  },
  {
    id: 'create-crewbarn', chapter: 'create', selector: t('tpl-new-start-crewbarn'),
    title: 'CrewBarn’s version',
    say: 'CrewBarn’s version is a tested starting point you can change however you like. It’s grayed out when CrewBarn doesn’t have one for that moment.',
  },
  {
    id: 'create-copy', chapter: 'create', selector: t('tpl-new-start-copy'),
    title: 'Copy one of yours',
    say: 'Copy one of yours starts from a template you already use.',
  },
  {
    id: 'create-blank', chapter: 'create', selector: t('tpl-new-start-blank'),
    title: 'Blank',
    say: 'And Blank starts from nothing at all.',
  },
  {
    id: 'create-create', chapter: 'create', selector: t('tpl-new-create'),
    wait: { route: EDITOR }, doIt: 'practice:email',
    yourTurn: 'Press Do it for me to open a practice copy.',
    title: 'Create',
    say: 'Create makes it and opens the editor. So we don’t add anything to your library, press Do it for me, and I’ll open a practice copy instead.',
  },

  // ---------- Edit it ----------
  {
    id: 'edit-practice', chapter: 'edit', route: EDITOR, open: 'practice:email', selector: t('tpl-practice-banner'),
    title: 'Your practice copy',
    say: 'This is your practice copy. Try anything you like. It isn’t saved when you leave. Only Create template saves it.',
  },
  {
    id: 'edit-crumb', chapter: 'edit', route: EDITOR, selector: t('tpl-editor-crumb'),
    title: 'Back to the list',
    say: 'This link takes you back to Templates and Forms. On a real template, your edits are saved on the way out.',
  },
  {
    id: 'edit-name', chapter: 'edit', route: EDITOR, selector: t('tpl-editor-name'),
    title: 'Name',
    say: 'The name is just for your team. Customers never see it. Underneath, it shows whether this is the default and which merge tags it uses.',
  },
  {
    id: 'edit-status', chapter: 'edit', route: EDITOR, selector: t('tpl-editor-status'),
    title: 'Saved or not',
    say: 'This tells you if there are unsaved changes, or when it was last saved.',
  },
  {
    id: 'edit-note', chapter: 'edit', route: EDITOR, selector: t('tpl-editor-note'),
    title: 'Edit note',
    say: 'Leave a short note about what you changed, if you like. It shows up in the history.',
  },
  {
    id: 'edit-subject', chapter: 'edit', route: EDITOR, selector: t('tpl-editor-subject'),
    title: 'Subject or title',
    say: 'On an email, this is the subject line. On a document, it’s the title at the top of the page. Merge tags work here too.',
  },
  {
    id: 'edit-starters', chapter: 'edit', route: EDITOR, selector: t('tpl-editor-starters'),
    title: 'Start from template',
    say: 'Start from template opens a gallery of CrewBarn designs. Pick one, choose the tags you want on it, and it drops into the editor.',
  },
  {
    id: 'edit-mode', chapter: 'edit', route: EDITOR, selector: t('tpl-editor-mode'),
    title: 'Visual or HTML',
    say: 'Visual shows the message the way the customer sees it. HTML is for pasting in a layout you already have.',
  },
  {
    id: 'edit-canvas', chapter: 'edit', route: EDITOR, selector: t('tpl-editor-canvas'), hold: true,
    yourTurn: 'Change the greeting, then press Next.',
    title: 'Write it',
    say: 'This is the message itself. Click in and type, just like a document. The toolbar does bold, headings, lists, alignment and links. Go ahead and change the greeting.',
  },
  {
    id: 'edit-workflow', chapter: 'edit', route: EDITOR, selector: t('tpl-editor-workflow'),
    title: 'Workflow default and tags',
    say: 'This strip says whether this is the workflow default, and which recommended tags are missing. Click a tag here to drop it in where your cursor is.',
  },
  {
    id: 'edit-blocks', chapter: 'edit', route: EDITOR, click: t('tpl-editor-tab-blocks'), selector: t('tpl-editor-sidebar'),
    title: 'Blocks',
    say: 'Your tools are on the right. Blocks are ready-made pieces, like a logo header, two columns, a price table, or a signature line. Click one, or drag it into place.',
  },
  {
    id: 'edit-tags', chapter: 'edit', route: EDITOR, click: t('tpl-editor-tab-tags'), selector: t('tpl-editor-sidebar'),
    title: 'Tags',
    say: 'Tags lists every merge tag, grouped and searchable, with an example of what each one fills in. Click to insert one, or drag it in.',
  },
  {
    id: 'edit-style', chapter: 'edit', route: EDITOR, click: t('tpl-editor-tab-style'), selector: t('tpl-editor-sidebar'),
    title: 'Style',
    say: 'Style changes whatever your cursor is sitting in, like a table, a cell or a heading: colors, spacing and borders. Right-clicking in the message jumps here too.',
  },
  {
    id: 'edit-cbi', chapter: 'edit', route: EDITOR, click: t('tpl-editor-tab-ask'), selector: t('tpl-editor-sidebar'),
    title: 'CBI',
    say: 'CBI is your writing helper. Ask it to make this friendlier, shorter, or to add a section. Each answer has Replace body and Append buttons, or turn on Auto-apply and rewrites land by themselves.',
  },
  {
    id: 'edit-history', chapter: 'edit', route: EDITOR, click: t('tpl-editor-tab-history'), selector: t('tpl-editor-sidebar'),
    title: 'History',
    say: 'History keeps every saved version, with who changed it and their note. Restore puts an older version back in the editor.',
  },
  {
    id: 'edit-use', chapter: 'edit', route: EDITOR, click: t('tpl-editor-tab-settings'), selector: t('tpl-design-use'),
    title: 'How it’s used',
    say: 'Design starts with how this template is used: its category, whether it’s active, and whether it’s the default CrewBarn sends on its own. There’s one default per category.',
  },
  {
    id: 'edit-brand', chapter: 'edit', route: EDITOR, click: t('tpl-editor-tab-settings'), selector: t('tpl-design-brand'),
    title: 'Your brand',
    say: 'Your logo comes from your brand settings, so it matches everywhere you send.',
  },
  {
    id: 'edit-theme', chapter: 'edit', route: EDITOR, click: t('tpl-editor-tab-settings'), selector: t('tpl-design-theme'),
    title: 'Theme and colors',
    say: 'Pick a theme, or set your own colors. Describe design turns a sentence into a look, and From existing doc copies the look of a document you upload.',
  },
  {
    id: 'edit-layout', chapter: 'edit', route: EDITOR, click: t('tpl-editor-tab-settings'), selector: t('tpl-design-layout'),
    title: 'Page layout',
    say: 'Page layout sets the spacing, the paper size and the font for printed copies.',
  },
  {
    id: 'edit-delete', chapter: 'edit', route: EDITOR, click: t('tpl-editor-tab-settings'), selector: t('tpl-design-delete'),
    title: 'Delete',
    say: 'On a saved template, Delete removes it for good, after you confirm.',
  },
  {
    id: 'edit-preview', chapter: 'edit', route: EDITOR, selector: t('tpl-editor-preview'),
    wait: { appear: t('tpl-preview') }, doIt: t('tpl-editor-preview'),
    yourTurn: 'Click Preview.',
    title: 'Preview',
    say: 'Now let’s see it filled in. Click Preview.',
  },

  // ---------- Preview and save ----------
  {
    id: 'preview-tools', chapter: 'preview', open: 'practice:email', selector: t('tpl-preview-tools'),
    title: 'Filled in with a real job',
    say: 'The preview fills your template in with a real job. Random job tries another one. Sample data fills any blanks with made-up values. Pick job lets you choose, and you can download a PDF or go full screen.',
  },
  {
    id: 'preview-check', chapter: 'preview', selector: t('tpl-preview-check'),
    title: 'Merge tag check',
    say: 'The merge tag check lists any tag that didn’t fill in, and suggests the right one. Fix those before you count on it.',
  },
  {
    id: 'preview-close', chapter: 'preview', selector: t('tpl-preview-close'),
    wait: { gone: t('tpl-preview') }, doIt: t('tpl-preview-close'),
    yourTurn: 'Close the preview.',
    title: 'Close the preview',
    say: 'Nothing in a preview is ever sent. Close it to get back to the editor.',
  },
  {
    id: 'preview-default', chapter: 'preview', route: EDITOR, selector: t('tpl-editor-default'),
    title: 'Make workflow default',
    say: 'Make workflow default makes this the one CrewBarn sends on its own at this moment.',
  },
  {
    id: 'preview-reset', chapter: 'preview', route: EDITOR, selector: t('tpl-editor-reset'),
    title: 'Reset starter',
    say: 'Reset starter puts back CrewBarn’s latest wording for this template. You can look it over before you save.',
  },
  {
    id: 'preview-pdf', chapter: 'preview', route: EDITOR, selector: t('tpl-editor-pdf'),
    title: 'PDF',
    say: 'PDF downloads the template as it stands right now.',
  },
  {
    id: 'preview-discard', chapter: 'preview', route: EDITOR, selector: t('tpl-editor-discard'),
    title: 'Discard changes',
    say: 'Discard changes throws away what you haven’t saved. On a brand new one, it leaves without making it.',
  },
  {
    id: 'preview-save', chapter: 'preview', route: EDITOR, selector: t('tpl-editor-save'),
    title: 'Save',
    say: 'Save template, or Create template on a new one, saves your work. In this practice copy it’s the one button that would add it to your library, so let’s leave it.',
  },

  // ---------- Documents and signatures ----------
  {
    id: 'document-open', chapter: 'document', route: DOCUMENT, open: 'practice:document', selector: t('tpl-editor-header'),
    title: 'Documents',
    say: 'Documents use the same editor, with a few extras. Here’s a practice work order.',
  },
  {
    id: 'document-signable', chapter: 'document', route: DOCUMENT, selector: t('tpl-editor-name'),
    title: 'Signable or not',
    say: 'On a document, the line under the name says whether it can be signed, and how many signature spots it has.',
  },
  {
    id: 'document-signatures', chapter: 'document', route: DOCUMENT, selector: t('tpl-editor-signatures'),
    title: 'Signature slots',
    say: 'Signature slots add a spot for the customer, the technician, or your company to sign. Add at least one, and the document can be signed.',
  },
  {
    id: 'document-paper', chapter: 'document', route: DOCUMENT, click: t('tpl-editor-tab-settings'), selector: t('tpl-design-layout'),
    title: 'Paper size',
    say: 'Paper size lives here in Design. Contracts often use legal, for the extra signing room.',
  },
  {
    id: 'document-pdf', chapter: 'document', route: DOCUMENT, selector: t('tpl-editor-pdf'),
    title: 'See it printed',
    say: 'And PDF shows you exactly what will print.',
  },

  // ---------- Text messages ----------
  {
    id: 'text-open', chapter: 'text', open: 'sms:new', selector: t('tpl-sms'),
    title: 'Text messages',
    say: 'Text messages have an editor of their own. Here’s a new one.',
  },
  {
    id: 'text-name', chapter: 'text', selector: t('tpl-sms-name'),
    title: 'Name',
    say: 'Name it for your team, the same as an email.',
  },
  {
    id: 'text-settings', chapter: 'text', selector: t('tpl-sms-settings'),
    title: 'Category, active, default',
    say: 'Pick its category, whether it’s active, and whether it’s the default for that category.',
  },
  {
    id: 'text-body', chapter: 'text', selector: t('tpl-sms-body'),
    title: 'The message',
    say: 'Write the message here. Keep it short and friendly. Merge tags work the same way.',
  },
  {
    id: 'text-count', chapter: 'text', selector: t('tpl-sms-count'),
    title: 'Length',
    say: 'This counts characters and message segments. A long text is split into segments, and most carriers bill each one. It’s a close guess, since tags fill in when it sends.',
  },
  {
    id: 'text-sidebar', chapter: 'text', selector: t('tpl-sms-sidebar'),
    title: 'Tags, CBI, History',
    say: 'Tags, CBI and History work just like they do for email.',
  },
  {
    id: 'text-footer', chapter: 'text', selector: t('tpl-sms-footer'),
    title: 'Save it',
    say: 'Down here, add a note about your change, then Create template saves it. On a saved text, Delete is on the left.',
  },
  {
    id: 'text-close', chapter: 'text', selector: t('tpl-sms-close'),
    wait: { gone: t('tpl-sms') }, doIt: t('tpl-sms-close'),
    yourTurn: 'Close the text editor.',
    title: 'Close it',
    say: 'Close it without saving. Nothing gets made.',
  },

  // ---------- Make a form ----------
  {
    id: 'form-open', chapter: 'form', route: FORM, open: 'goto:/custom-documents/new-form', selector: t('form-builder-header'),
    title: 'Make a form',
    say: 'Now, Make a form. Four steps down the left, and the page itself on the right, updating as you go.',
  },
  {
    id: 'form-starter', chapter: 'form', route: FORM, selector: t('form-builder-starter'),
    wait: { appear: t('form-builder-chips') }, doIt: t('form-builder-starter-work_order'),
    yourTurn: 'Pick Work order.',
    title: 'Start from a form you know',
    say: 'Start from a form you know: an invoice, a work order, an inspection, a service agreement, or a blank page. Pick Work order.',
  },
  {
    id: 'form-fields', chapter: 'form', route: FORM, selector: t('form-builder-fields'),
    title: 'Choose what goes on it',
    say: 'Now choose what goes on it. Fields are grouped by where they sit on the page. Tap to add or take one off, and watch the preview change.',
  },
  {
    id: 'form-next-style', chapter: 'form', route: FORM, selector: t('form-builder-next-style'),
    wait: { appear: t('form-builder-colors') }, doIt: t('form-builder-next-style'),
    yourTurn: 'Click Next: pick a colour.',
    title: 'Next step',
    say: 'When you’re happy with the fields, go on to the next step.',
  },
  {
    id: 'form-colors', chapter: 'form', route: FORM, selector: t('form-builder-colors'),
    title: 'Colour and look',
    say: 'Pick a colour, or any colour you like, and a look: a color band, a top line, or clean.',
  },
  {
    id: 'form-names', chapter: 'form', route: FORM, selector: t('form-builder-names'),
    title: 'Name and heading',
    say: 'The name is what your team picks when sending one. The heading is what the customer sees at the top.',
  },
  {
    id: 'form-next-build', chapter: 'form', route: FORM, selector: t('form-builder-next-build'),
    wait: { appear: t('form-builder-build-button') }, doIt: t('form-builder-next-build'),
    yourTurn: 'Click Next: build it.',
    title: 'Last step',
    say: 'Then on to the last step.',
  },
  {
    id: 'form-build', chapter: 'form', route: FORM, selector: t('form-builder-build'),
    title: 'Build it',
    say: 'Build it saves the form and opens it in the editor you just learned, so you can fine-tune anything. We’ll skip it this time.',
  },
  {
    id: 'form-preview', chapter: 'form', route: FORM, selector: t('form-builder-preview'),
    title: 'Live preview',
    say: 'The preview is letter-sized, so you can tell at a glance if it fits on one page. Switch between sample data and field names to see what goes where.',
  },
  {
    id: 'form-cancel', chapter: 'form', route: FORM, selector: t('form-builder-cancel'),
    wait: { route: BOARD }, doIt: t('form-builder-cancel'),
    yourTurn: 'Click Cancel.',
    title: 'Cancel',
    say: 'Cancel takes you back without making anything.',
  },

  // ---------- Where they're used ----------
  // No part of this page to point at: the card explains where to look.
  {
    id: 'used-intro', chapter: 'used', route: BOARD, open: 'goto:/custom-documents',
    title: 'Where your templates get used',
    say: 'Templates don’t only live on this page. Here’s where else they show up, so you know where to look.',
  },
  {
    id: 'used-customer', chapter: 'used', route: BOARD,
    title: 'One customer, their own templates',
    say: 'When one customer needs their own paperwork, open their account, go to Files, then Templates. For each kind of document, like invoices, estimates, work orders, receipts, statements and inspections, pick the template they get, and a text to go with it. Then press Save overrides. Everyone else keeps your default.',
  },
  {
    id: 'used-customer-edit', chapter: 'used', route: BOARD,
    title: 'A business customer’s statement and subject',
    say: 'On a business customer’s Edit Info tab, you can also set the day their monthly statement goes out, and give them their own invoice email subject, like one with their PO number in it.',
  },
  {
    id: 'used-stages', chapter: 'used', route: BOARD,
    title: 'Job stages',
    say: 'In Job statuses, each stage can email or text the customer when a job lands on it. Customer updates there shows which template each stage sends.',
  },
  {
    id: 'used-reminders', chapter: 'used', route: BOARD,
    title: 'Reminders and automations',
    say: 'Appointment reminders, and the automations you build, each pick an email or text template from here.',
  },
  {
    id: 'used-jobs', chapter: 'used', route: BOARD,
    title: 'Jobs, estimates and messages',
    say: 'On an estimate or a job, you can attach a signable agreement made from your document templates. And in Messages, the Template button drops a saved reply into the conversation.',
  },

  // ---------- Other views ----------
  {
    id: 'views-list', chapter: 'views', route: BOARD, open: 'goto:/custom-documents', click: t('templates-view-list'), selector: t('templates-list'),
    title: 'List',
    say: 'List puts every template on one row: its channel, what the customer sees first, whether it’s on, and how many copies there are.',
  },
  {
    id: 'views-library', chapter: 'views', route: BOARD, click: t('templates-view-library'), selector: t('templates-library'),
    title: 'Job stages',
    say: 'Job stages shows how ready your starter pack is, flags duplicates and agreements that still need a signer, and lists templates by stage.',
  },
  {
    id: 'views-channel', chapter: 'views', route: BOARD, click: t('templates-view-advanced'), selector: t('templates-channels'),
    title: 'By channel',
    say: 'By channel gives email, documents and texts a list each. It’s handy when you’re tidying one channel at a time.',
  },
  {
    id: 'views-copies', chapter: 'views', route: BOARD, selector: t('templates-extra-copies'),
    title: 'Extra copies',
    say: 'When you have extra copies, this banner names them. Clean them up lets you keep one of each and archives the rest. Archived copies aren’t deleted.',
  },
  {
    id: 'views-done', chapter: 'views', route: BOARD, click: t('templates-view-journey'), selector: t('templates-views'),
    title: 'That’s the lot',
    say: 'And Journey brings you back to the board. That’s everything, from making a template to editing it. You can take this tutorial again any time from the button at the top of the page.',
  },
]

/** Every line, in order, for voice recording. */
export const TEMPLATES_TUTORIAL_LINES: string[] = [
  ...TEMPLATES_TUTORIAL_FILM.map((scene) => scene.narration),
  ...TEMPLATES_TUTORIAL_STEPS.map((step) => step.say),
]
