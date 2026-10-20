import { TUTORIAL } from '@/lib/tutorials/templates'
import {
  TEMPLATES_FILM_CSS,
  TEMPLATES_REVEAL_STEPS,
  TemplatesFilmVisual,
} from '@/components/customDocuments/TemplatesTutorialFilm'
import { THEMES } from '@/components/customDocuments/templateStarters'
import type { TemplatesFilmSceneId } from '@/lib/templatesTutorialLines'
import { findVisible, type TutorialNavigate, type TutorialScript } from '../tutorialScript'

/**
 * Practice copies keep the walk-through from changing anything: the editor
 * steps open a practice template that is never saved unless the person
 * presses Create template themselves.
 */
function openPractice(navigate: TutorialNavigate, kind: 'email' | 'document') {
  // Close the New template window first if it's open.
  findVisible('[data-tour="tpl-new-close"]')?.click()
  // Already in a new one of this kind: nothing to open, and a draft left
  // behind would turn up in the next real new template.
  if (window.location.pathname.replace(/\/$/, '').endsWith(`/custom-documents/${kind}/new`)) return
  const design_tokens = { ...THEMES.classic, body_format: 'html' as const }
  const draft = kind === 'email'
    ? {
        name: 'Practice: appointment reminder',
        category: 'appointment',
        titleOrSubject: 'See you {{appointment.date}}, {{customer.first_name}}',
        body:
          '<p>Hi {{customer.first_name}},</p>' +
          '<p>This is {{company.name}}. Just a reminder that we’ll see you on {{appointment.date}} at {{appointment.time}}.</p>' +
          '<p>Need to change it? Call us at {{company.phone}}.</p>' +
          '<p>Thanks,<br/>{{company.name}}</p>',
        design_tokens,
      }
    : {
        name: 'Practice: work order',
        category: 'work_order',
        titleOrSubject: 'Work order {{job.number}}',
        body:
          '<h2>Work order</h2>' +
          '<p><strong>Customer:</strong> {{customer.name}}<br/><strong>Address:</strong> {{job.address}}</p>' +
          '<p><strong>Work:</strong> {{job.description}}</p>' +
          '<p>Customer signature:</p><p>[[signature:customer]]</p>',
        design_tokens,
      }
  try {
    sessionStorage.setItem('tpl-draft', JSON.stringify({ kind, practice: true, draft }))
  } catch {
    /* private mode: the editor opens empty */
  }
  navigate(`/custom-documents/${kind}/new`)
}

export const templatesScript: TutorialScript = {
  data: TUTORIAL,
  reveal: TEMPLATES_REVEAL_STEPS,
  Visual: ({ id, shown }) => <TemplatesFilmVisual id={id as TemplatesFilmSceneId} shown={shown} />,
  css: TEMPLATES_FILM_CSS,
  actions: {
    'practice:email': (navigate) => openPractice(navigate, 'email'),
    'practice:document': (navigate) => openPractice(navigate, 'document'),
    'sms:new': (navigate) => navigate('/custom-documents?tab=sms&new=1'),
  },
}
