import type { PageTour } from '../types'

/**
 * Jobs & workflow → Templates & forms → Make a form (/custom-documents/new-form).
 * Four steps, one open at a time.
 *
 *   form-builder-header  data-step = 1 | 2 | 3 | 4, data-started = yes | no
 */
const t = (id: string) => `[data-tour="${id}"]`
const step = (n: number) => `${t('form-builder-header')}[data-step="${n}"]`
const NOT_STARTED = `${t('form-builder-header')}[data-started="no"]`

export const PAGE_TOUR: PageTour = {
  id: 'form-builder',
  route: '^/custom-documents/new-form/?$',
  intro: {
    page: 'Make a form',
    purpose: 'Build a printable form, like an inspection or checklist, in four quick steps. The preview shows the page as you go.',
    covers: ['Start from a form you know', 'Choose the fields', 'Colour and name', 'Build it', 'Live preview'],
  },
  steps: [
    {
      id: 'header', selector: t('form-builder-header'),
      title: 'Make a form',
      say: 'Four quick steps, and you have a form you can print, fill in on a job, or get signed.',
    },
    {
      id: 'starter', selector: t('form-builder-starter'), title: '1. Start from a form you know',
      say: 'Pick the kind of form closest to what you need. It fills in the usual fields for you.',
      variants: [
        { when: NOT_STARTED, say: 'Start here: pick the kind of form closest to what you need. The other steps open once you’ve picked one.' },
      ],
    },
    {
      id: 'fields', selector: t('form-builder-fields'), title: '2. Choose what goes on it',
      say: 'Tick the fields you want on the page, and untick the rest.',
    },
    {
      id: 'chips', selector: t('form-builder-chips'), when: step(2),
      title: 'Fields',
      say: 'Each chip is one field. Press it to add or remove it, and the preview updates.',
    },
    {
      id: 'style', selector: t('form-builder-style'),
      title: '3. Colour and name',
      say: 'Pick a colour and a look, then name it.',
    },
    {
      id: 'colors', selector: t('form-builder-colors'), when: step(3),
      title: 'Colour and look',
      say: 'Choose a colour, or your brand colour, and a look for the page.',
    },
    {
      id: 'names', selector: t('form-builder-names'), when: step(3),
      title: 'Name and heading',
      say: 'The name is how you find it later. The heading prints at the top of the page.',
    },
    {
      id: 'build', selector: t('form-builder-build'),
      title: '4. Build it',
      say: 'Build it saves the form as a document you can edit, preview and send like any other.',
    },
    {
      id: 'preview', selector: t('form-builder-preview'),
      title: 'Live preview',
      say: 'The preview shows a letter-size page, changing as you go.',
    },
    {
      id: 'preview-mode', selector: t('form-builder-preview-mode'),
      title: 'Blank or filled',
      say: 'Switch between how the form looks blank, and how it looks filled in.',
    },
    {
      id: 'cancel', selector: t('form-builder-cancel'),
      title: 'Cancel',
      say: 'Cancel goes back without making anything.',
    },
  ],
}
