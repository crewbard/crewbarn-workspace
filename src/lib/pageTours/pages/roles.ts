import type { PageTour } from '../types'

/**
 * Team → Roles & permissions (/tool-shed/roles).
 *
 * The first role on the list (the Owner) is picked when the page opens. To
 * show the editor the tour picks the first other role; picking a role only
 * changes what is shown. People who can't edit staff see roles-readonly.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'roles',
  route: '^/tool-shed/roles/?$',
  intro: {
    page: 'Roles & permissions',
    purpose: 'Decide what each kind of person can see and change. Give each person a role in Staff and crews, and they get exactly that access.',
    covers: ['Your roles', 'The owner', 'Access by area', 'Dashboards', 'Comparing and history', 'New roles'],
  },
  steps: [
    {
      id: 'header', selector: t('roles-header'),
      title: 'Roles & permissions',
      say: 'A role is a set of permissions. Change a role here and everyone in it changes at once.',
    },
    {
      id: 'read-only', selector: t('roles-readonly'),
      title: 'View only',
      say: 'Your role can look at these, but not change them. Ask the owner if you should be able to.',
    },
    {
      id: 'list', selector: t('roles-list'),
      title: 'Your roles',
      say: 'Every role, with how many people are in it and how much they can do. CrewBarn presets are a starting point. The ones marked yours you made.',
    },
    {
      id: 'owner', selector: t('roles-owner'),
      title: 'The owner',
      say: 'The owner can do everything, and that can’t be narrowed. To change who is an owner, go to Staff and crews.',
    },
    {
      id: 'pick', selector: t('roles-name'), click: t('roles-role-pick'), waitMs: 1200,
      title: 'One role',
      say: 'Pick a role on the left to see it here. You can rename it and add a short description.',
    },
    {
      id: 'copy', selector: t('roles-copy'),
      title: 'Copy it',
      say: 'Want something close to this role? Copy it, then change just what’s different.',
    },
    {
      id: 'widgets', selector: t('roles-widgets'),
      title: 'Dashboard boxes',
      say: 'Choose which dashboard boxes people in this role can use. Someone’s own settings in Staff can still change it.',
    },
    {
      id: 'plain', selector: t('roles-plain-words'),
      title: 'In plain words',
      say: 'This sums up the role: what it can change, what it can only look at, and what it can’t open at all.',
    },
    {
      id: 'find', selector: t('roles-find'),
      title: 'Find a permission',
      say: 'Looking for one thing, like refunds or gate codes? Type it here.',
    },
    {
      id: 'areas', selector: t('roles-areas'),
      title: 'Access by area',
      say: 'Each card is one part of CrewBarn. Pick a level, from no access to full, or open Fine-tune to choose one permission at a time.',
    },
    {
      id: 'extra', selector: t('roles-extra'),
      title: 'Everything else',
      say: 'Page-by-page settings and any extra permissions live down here, so nothing is hidden.',
    },
    {
      id: 'save', selector: t('roles-save'),
      title: 'Save the role',
      say: 'This bar lists what you turned on and off, and how many people it affects. Nothing changes until you save.',
    },
    {
      id: 'people', selector: t('roles-people-button'),
      title: 'People',
      say: 'People shows who is in the selected role.',
    },
    {
      id: 'compare', selector: t('roles-compare-button'),
      title: 'Compare roles',
      say: 'Compare roles lays every role side by side, area by area, so you can spot the differences.',
    },
    {
      id: 'audit', selector: t('roles-audit-button'),
      title: 'Audit log',
      say: 'The audit log lists every change made to a role, and who made it.',
    },
    {
      id: 'new', selector: t('roles-new-button'),
      title: 'New role',
      say: 'New role starts from the closest existing role or a preset, so you’re never starting from a blank page.',
    },
  ],
}
