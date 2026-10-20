import type { PageTour } from '../types'

/**
 * CBI AI → Rules (/tool-shed/ai/rules): the company's own rules for CBI,
 * under CrewBarn's locked safety rules. The tour never edits or restores.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'ai-rules',
  route: '^/tool-shed/ai/rules/?$',
  intro: {
    page: 'CBI rules',
    purpose: 'Write down how your company wants CBI to work. CrewBarn’s safety rules always come first.',
    covers: ['Safety rules', 'Your rules', 'Edit and history'],
  },
  steps: [
    {
      id: 'header', selector: t('ai-rules-header'),
      title: 'Your rules for CBI',
      say: 'CBI follows these on every answer, after CrewBarn’s safety rules and before anything it has learned.',
    },
    {
      id: 'platform', selector: t('ai-rules-platform'),
      title: 'Safety rules',
      say: 'These are CrewBarn’s. Nobody can switch them off, so a company rule that breaks one is ignored.',
    },
    {
      id: 'page', selector: t('ai-rules-page'),
      title: 'Your company rules',
      say: 'Plain lines, one rule each. The tinted part is what CBI added from approved lessons.',
    },
    {
      id: 'actions', selector: t('ai-rules-actions'),
      title: 'Edit and history',
      say: 'Edit rules changes the page. History keeps every version, and restoring one never loses the others.',
    },
    {
      id: 'read-only', selector: t('ai-rules-read-only'),
      title: 'Think one is wrong?',
      say: 'Tell CBI “that’s wrong, we …” and it goes to your admin.',
    },
  ],
}
