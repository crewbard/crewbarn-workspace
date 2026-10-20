import type { PageTour } from '../types'

/**
 * Team → Hiring (/tool-shed/hiring).
 *
 *   hiring-switch    data-hiring = on | off
 *   hiring-postings  data-state = empty | list
 *   Applicants tab   hiring-applicants-empty / hiring-applicants-table
 *   hiring-new, hiring-posting-actions  only for people who can edit staff
 */
const t = (id: string) => `[data-tour="${id}"]`
const ON = `${t('hiring-switch')}[data-hiring="on"]`
const OFF = `${t('hiring-switch')}[data-hiring="off"]`

export const PAGE_TOUR: PageTour = {
  id: 'hiring',
  route: '^/tool-shed/hiring/?$',
  intro: {
    page: 'Hiring',
    purpose: 'Post an opening, collect applications, and move people from applied to hired, all in one place.',
    covers: ['The hiring switch', 'Your careers page', 'Postings', 'Applicants'],
  },
  steps: [
    {
      id: 'header', selector: t('hiring-header'),
      title: 'Hiring',
      say: 'Job seekers find you on the CrewBarn job board by city, and on your own website’s careers page.',
    },
    {
      id: 'new', selector: t('hiring-new'),
      title: 'New posting',
      say: 'New posting writes an opening: the job, the pay, and the questions you want answered.',
    },
    {
      id: 'switch', selector: t('hiring-switch'), title: 'Are you hiring?',
      say: 'This one switch decides whether anyone can see your openings.',
      variants: [
        { when: ON, title: 'You’re hiring', say: 'Hiring is on, so your open postings can be seen and applied to.' },
        { when: OFF, title: 'Not hiring right now', say: 'Hiring is off. Your postings stay saved, but nobody can see or apply to them until you switch it on.' },
      ],
    },
    {
      id: 'careers', selector: t('hiring-careers'),
      title: 'Your careers page',
      say: 'This is your own careers page. Copy the link and put it on your website or social pages.',
    },
    {
      id: 'outside', selector: t('hiring-outside-link'),
      title: 'Already use another site?',
      say: 'If you already take resumes somewhere else, paste that link. Job seekers see it under your name while hiring is on, even with no postings.',
    },
    {
      id: 'tabs', selector: t('hiring-tabs'),
      title: 'Postings and applicants',
      say: 'Postings are your openings. Applicants are the people who applied, with a count of new ones.',
    },
    {
      id: 'postings', selector: t('hiring-postings'), click: t('hiring-postings-tab'), title: 'Your postings', say: '',
      variants: [
        { when: `${t('hiring-postings')}[data-state="empty"]`, title: 'No postings yet', say: 'No postings yet. Press New posting to write your first one.' },
        { when: `${t('hiring-postings')}[data-state="list"]`, say: 'Each posting shows its type, place and pay, how many have applied, and whether it’s live.' },
      ],
    },
    {
      id: 'posting-actions', selector: t('hiring-posting-actions'),
      title: 'Open, pause or close',
      say: 'Open puts a posting on the job board. Pause hides it for a while, Close ends it, and Duplicate copies it for a similar job.',
    },
    {
      id: 'applicants', selector: t('hiring-applicants'), click: t('hiring-applicants-tab'), waitMs: 1200,
      title: 'Applicants',
      say: 'Everyone who applied, newest first.',
    },
    {
      id: 'pipeline', selector: t('hiring-pipeline'),
      title: 'Where everyone is',
      say: 'These counts are also filters. Tap one to see just new applicants, interviews, offers or hires.',
    },
    {
      id: 'applicant-filters', selector: t('hiring-applicant-filters'),
      title: 'Narrow it down',
      say: 'Show one posting at a time, and hide people who were already hired or not picked.',
    },
    {
      id: 'applicant-list', selector: t('hiring-applicants'), title: 'Who applied', say: '',
      variants: [
        { when: t('hiring-applicants-table'), selector: t('hiring-applicants-table'), say: 'Click anyone to read their answers, schedule an interview, or move them along.' },
        { when: t('hiring-applicants-empty'), selector: t('hiring-applicants-empty'), say: 'Nobody here yet. Applications land the moment they come in.' },
      ],
    },
  ],
}
