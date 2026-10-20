import type { TutorialData } from './types'
import {
  TEMPLATES_TUTORIAL_CHAPTERS,
  TEMPLATES_TUTORIAL_FILM,
  TEMPLATES_TUTORIAL_STEPS,
} from '@/lib/templatesTutorialLines'

/** Templates & Forms: making a template, editing it, and where it's used. */
export const TUTORIAL: TutorialData = {
  id: 'templates',
  kicker: 'Templates & Forms · tutorial',
  title: 'Templates & Forms, start to finish',
  film: TEMPLATES_TUTORIAL_FILM,
  chapters: TEMPLATES_TUTORIAL_CHAPTERS,
  steps: TEMPLATES_TUTORIAL_STEPS,
}
