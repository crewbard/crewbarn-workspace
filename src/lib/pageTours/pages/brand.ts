import type { PageTour } from '../types'

/**
 * Your business → Brand & logo (/tool-shed/brand).
 *
 * The page marks its state for the tour:
 *   brand-logo   data-has-logo = yes | no
 *   brand-colour data-has-colour = yes | no, data-dirty = yes | no
 */
const t = (id: string) => `[data-tour="${id}"]`
const READ_ONLY = t('settings-read-only')
const HAS_LOGO = `${t('brand-logo')}[data-has-logo="yes"]`
const HAS_COLOUR = `${t('brand-colour')}[data-has-colour="yes"]`

export const PAGE_TOUR: PageTour = {
  id: 'brand',
  route: '^/tool-shed/brand/?$',
  intro: {
    page: 'Brand & logo',
    purpose: 'Your logo and colour, so the estimates, invoices and emails your customers get look like they came from you.',
    covers: ['Your logo', 'Your brand colour', 'Where they show up'],
  },
  steps: [
    {
      id: 'header', selector: t('brand-header'), title: 'Brand & logo',
      say: 'Your logo and brand colour go on everything customers get from you.',
      variants: [
        {
          when: READ_ONLY, selector: READ_ONLY, title: 'View only',
          say: 'You can see the logo and colour here but not change them. Ask an owner or admin if they need updating.',
        },
      ],
    },
    {
      id: 'logo', selector: t('brand-logo'), title: 'Your logo',
      say: 'No logo yet, so your paperwork goes out without one. Upload logo takes a PNG, JPG, WebP or SVG picture. A see-through background about six hundred pixels wide looks best.',
      variants: [
        {
          when: HAS_LOGO,
          say: 'This is your logo. It’s on every estimate, invoice and email you send.',
        },
      ],
    },
    {
      id: 'logo-buttons', selector: t('brand-logo-upload'), when: `!${READ_ONLY}`, title: 'Upload logo',
      say: 'Upload logo opens your files. It uploads the moment you pick one.',
      variants: [
        {
          when: HAS_LOGO, title: 'Replace or remove',
          say: 'Replace logo swaps in a new picture right away. Remove takes it off, after you confirm.',
        },
      ],
    },
    {
      id: 'colour', selector: t('brand-colour'), title: 'Brand colour',
      say: 'Your brand colour is the accent in customer emails and documents. You haven’t picked one yet.',
      variants: [
        {
          when: HAS_COLOUR,
          say: 'Your brand colour is the accent in customer emails and documents. The one ringed below is yours.',
        },
      ],
    },
    {
      id: 'presets', selector: t('brand-colour-presets'),
      title: 'Pick a colour',
      say: 'Click one of these to try it.',
    },
    {
      id: 'custom', selector: t('brand-colour-custom'),
      title: 'Your exact colour',
      say: 'Have an exact colour? Use the picker, or type its colour code, the one starting with a hash sign.',
    },
    {
      id: 'save', selector: t('brand-colour-save'), when: `!${READ_ONLY}`, title: 'Save colour',
      say: 'Save colour keeps the one you picked.',
      variants: [
        {
          when: `${t('brand-colour')}[data-dirty="yes"]`,
          say: 'You’ve picked a new colour that isn’t saved yet. Press Save colour to keep it.',
        },
        {
          when: HAS_COLOUR,
          say: 'Save colour keeps a new pick. Clear goes back to no colour, and it saves straight away.',
        },
      ],
    },
    {
      id: 'where',
      title: 'Where your brand shows up',
      say: 'Your logo goes into your document templates, your customer app starts from this colour, and your website shares it. Change it once and it changes everywhere.',
    },
  ],
}
