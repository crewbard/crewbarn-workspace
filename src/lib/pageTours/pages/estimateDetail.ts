import type { PageTour } from '../types'
import { FOCUS } from '../theme'

/**
 * Daily work → Estimates → one estimate (/estimates/:id).
 *
 * States: estimate-header data-status = draft | sent | approved | rejected |
 * expired | superseded, data-scope = all | partial (only part approved),
 * data-tiers = yes | no (Good / Better / Best options), data-job = yes | no
 * (already a job). The customer decision card (estimate-decision) has
 * data-state = signed | unsigned. Tabs carry aria-pressed. The action
 * buttons only show when they fit the status and the person may use them.
 * Mark rejected, Re-quote, Edit details and Delete estimate (once it's been
 * sent) sit in the More actions menu (estimate-more-actions).
 *
 * Focus look: the header is light instead of dark, and on Overview the
 * customer, site and latest activity fold into "Connected records &
 * activity" (estimate-connected), closed until it's opened.
 */
const t = (id: string) => `[data-tour="${id}"]`
const H = t('estimate-header')
const is = (s: string) => `${H}[data-status="${s}"]`
const OVERVIEW = t('estimate-tab-overview')
const LINES = t('estimate-tab-line-items')

export const PAGE_TOUR: PageTour = {
  id: 'estimate',
  route: '^/estimates/(?!new/?$)[^/]+/?$',
  intro: {
    page: 'Estimate',
    purpose: 'One estimate in full: the work and price, sending it, the customer’s answer, and what happens next.',
    covers: ['Where it’s at', 'Work and price', 'Options and parts', 'Sending it', 'The customer’s answer', 'Service agreements'],
  },
  steps: [
    {
      id: 'header', selector: H, title: 'This estimate', say: 'The estimate number, who it’s for, where it’s at, and the total.',
      variants: [
        { when: `${H}[data-job="yes"]`, title: 'It became a job', say: 'The customer said yes and this estimate is now a job. It stays here as the record of what was quoted.' },
        { when: `${is('approved')}[data-scope="partial"]`, title: 'Partly approved', say: 'The customer approved part of this estimate. Only the lines they said yes to carry over to the job.' },
        { when: is('approved'), title: 'Approved', say: 'The customer said yes. Next, turn it into a job and book the work.' },
        { when: is('draft'), title: 'A draft', say: 'This is a draft. The customer hasn’t seen it yet. Check the work and price, then send it.' },
        { when: is('sent'), title: 'Sent', say: 'This estimate is with the customer, waiting for their answer.' },
        { when: is('rejected'), title: 'Declined', say: 'The customer turned this one down. It stays for your records, and you can re-quote if they want something different.' },
        { when: is('expired'), title: 'Expired', say: 'This estimate passed its expiry date without an answer. A re-quote starts a fresh one.' },
        { when: is('superseded'), title: 'Replaced', say: 'This version was replaced by a newer quote. Follow the newer one.' },
      ],
    },
    { id: 'actions', selector: t('estimate-actions'), title: 'What you can do', say: 'The buttons here change with the estimate, so you only see what fits right now.' },
    { id: 'convert', selector: t('estimate-convert'), title: 'Convert to job', say: 'Turns the approved work into a job, ready to book with a time and a tech.' },
    {
      id: 'email', selector: t('estimate-email'), title: 'Email estimate', say: 'Opens an email to the customer with a link to review and approve. Pick one of your templates and it fills itself in from this estimate. Anything it can’t fill is listed for you to type. Nothing sends until you press Send.',
    },
    { id: 'text', selector: t('estimate-text'), title: 'Text estimate', say: 'The same, as a text message with the same link.' },
    { id: 'filled', selector: t('composer-filled-from'), title: 'Filled in for you', say: 'The template filled itself in from this estimate and its job. This line says which job it used.' },
    { id: 'blanks', selector: t('composer-blanks'), title: 'A few blanks', say: 'These couldn’t be filled in automatically. Type them here and they drop into the message.' },
    { id: 'approve', selector: t('estimate-approve'), title: 'Mark approved', say: 'Did they say yes on the phone or in person? Record it here. With options, it asks which one they picked.' },
    { id: 'messages', selector: t('estimate-messages'), title: 'Messages', say: 'Your whole conversation with this customer, for following up.' },
    { id: 'agreement', selector: t('estimate-agreement-builder'), title: 'Build a service agreement', say: 'For ongoing work, build a service agreement straight from this estimate: what’s covered, how often, and the price.' },
    { id: 'delete', selector: t('estimate-delete'), title: 'Delete', say: 'Deletes a draft after you confirm.' },
    { id: 'more', selector: t('estimate-more-actions-toggle'), title: 'More actions', say: 'More actions, at the right, holds the rest: Mark rejected, Re-quote, Edit details and Delete estimate. Each one asks before it changes anything.' },

    { id: 'progress', selector: t('estimate-progress'), title: 'How far it’s got', say: 'Drafted, sent, the customer’s answer, and the job. A tick shows each part that’s done, with its date.' },
    { id: 'strip', selector: t('estimate-customer-strip'), title: 'Customer and site', say: 'The customer and service address, always in view. Click the name to open their account.' },
    { id: 'tabs', selector: t('estimate-tabs'), title: 'Tabs', say: 'Overview, the work and pricing, details you can edit, photos, documents and history.' },

    // ── Overview ──
    {
      id: 'work', click: OVERVIEW, selector: t('estimate-overview-work'), title: 'Work and price', say: 'The work and the price together, with the total and tax.',
      variants: [
        { when: `${H}[data-tiers="yes"]`, say: 'The work and the price together. This estimate offers options, so you’re seeing the chosen one, or the one you recommended.' },
      ],
    },
    {
      id: 'decision', selector: t('estimate-decision'), title: 'The customer’s answer', say: 'Notes and terms for the customer.',
      variants: [
        { when: `${t('estimate-decision')}[data-state="signed"]`, title: 'Approved and signed', say: 'The customer’s decision, when they made it, and the name they signed with.' },
        { when: `${is('approved')}[data-scope="partial"]`, title: 'Part approved', say: 'The customer approved only some of the lines. The rest stay on record as declined.' },
        { when: is('approved'), title: 'Approval and terms', say: 'The customer’s decision, when they made it, and the terms they agreed to.' },
      ],
    },
    { id: 'next-step', selector: t('estimate-next-step'), title: 'Next step', say: 'What to do next with this estimate, one button away.' },
    {
      id: 'connected', click: OVERVIEW, selector: t('estimate-connected'), title: 'Customer, site and activity', say: 'The customer and site, any job it became, and the latest activity, with All history a click away.',
      variants: [
        { when: FOCUS, title: 'Connected records & activity', say: 'The customer and site, any job it became, and the latest activity are folded in here to keep the page short. Click it to open it.' },
      ],
    },

    // ── Work & pricing ──
    { id: 'lines', click: LINES, selector: t('estimate-line-items'), title: 'Work and pricing', say: 'Every line, with quantity and price. Changes here save as you go.' },
    { id: 'tiers', selector: t('estimate-tiers'), title: 'Good, better, best', say: 'This estimate offers options. The customer picks one, and you can mark the one you recommend.' },
    { id: 'new-tier', selector: t('estimate-new-tier'), when: `!${t('estimate-tiers')}`, title: 'Offer a choice', say: 'New tier turns this into options, like good, better and best, so the customer can choose.' },
    { id: 'parts', selector: t('estimate-parts'), title: 'Parts', say: 'Parts on this estimate are held from your stock once the customer approves. Order from a catalog adds parts from a supplier at your sell price.' },
    { id: 'parts-waiting', selector: t('parts-waiting'), title: 'Parts on order', say: 'Parts ordered for this estimate that haven’t arrived yet.' },
  ],
}
