import type { ReactNode } from 'react'

/**
 * One setting, declared rather than hand-built.
 *
 * docs/design/connect/README.md asks for 52 focused pages, each written for
 * someone who has never set up software. Fifty-two bespoke pages drift: page
 * forty stops looking like page three, plain English slides back into jargon,
 * and the save bar behaves differently depending on who wrote it.
 *
 * So a setting is DATA, and one component renders it. The rules then hold
 * because there is nowhere else to put them:
 *
 *   - one main button per page — the renderer only offers one
 *   - cards, not dropdowns — the only choice control there is
 *   - nothing saved by surprise — the save bar is written once
 *   - read-only when the permission is missing — applied from `permission`
 *
 * Three other screens fall out of the same declarations instead of being
 * built separately: the section list (`summary`), Find a setting (`title`,
 * `blurb`, `section`) and Home's needs-attention list (`attention`).
 */

export type SectionKey =
  | 'business'
  | 'customers'
  | 'workflow'
  | 'catalog'
  | 'money'
  | 'team'
  | 'ai'
  | 'connections'
  | 'developers'
  | 'account'

export const SECTIONS: Record<SectionKey, { label: string; blurb: string }> = {
  business: { label: 'Your business', blurb: 'Who you are and how customers find you.' },
  customers: { label: 'Customers & sites', blurb: 'How you sort customers, where you work, what you look after.' },
  workflow: { label: 'Jobs & workflow', blurb: 'How a job moves from the first call to closed.' },
  catalog: { label: 'Catalog & inventory', blurb: 'What you sell, what it costs you, where it is kept.' },
  money: { label: 'Money', blurb: 'How you price work and get paid.' },
  team: { label: 'Team', blurb: 'Who works with you, what they can do, how they are paid.' },
  ai: { label: 'CBI AI', blurb: 'What it uses, what it may do, and what it has learned.' },
  connections: { label: 'Connections', blurb: 'Outside services CrewBarn talks to.' },
  developers: { label: 'Developers', blurb: 'For people building on CrewBarn.' },
  account: { label: 'Account & billing', blurb: 'Your plan, your data and the record of changes.' },
}

/**
 * A choice between a few named options.
 *
 * Cards, never a dropdown: a dropdown hides the options and says nothing
 * about what picking one does. Every option carries the one sentence that
 * explains its consequence.
 */
export interface ChoiceControl<V extends string = string> {
  kind: 'choice'
  options: Array<{
    value: V
    label: string
    /** One sentence: what happens if they pick this. */
    detail: string
    /** Why this option cannot be picked yet, if it cannot. */
    unavailable?: (context: unknown) => string | null
  }>
}

/** A number with a floor, a ceiling and a unit people recognise. */
export interface NumberControl {
  kind: 'number'
  min: number
  max: number
  step?: number
  /** "days", "seats" — shown beside the stepper, never as a bare number. */
  unit: string
}

/** A switch. `on`/`off` carry the consequence, same as choice options. */
export interface ToggleControl {
  kind: 'toggle'
  on: string
  off: string
}

/**
 * Credentials from another service, which is never one field and never
 * something to switch on before it has been tested. Rendered as the three
 * steps in TOOL-SHED-CLEANUP §4: what it does, your details, test it.
 */
export interface WizardControl {
  kind: 'wizard'
  /** Opens the wizard from the setting page. */
  cta: string
}

export type SettingControl = ChoiceControl | NumberControl | ToggleControl | WizardControl

export interface SettingDefinition<V = unknown, D = unknown> {
  /** Stable id, used by search and the needs-attention list. */
  key: string
  /** Where it lives on Connect, and in the hosted app's Tool Shed. */
  route: string
  section: SectionKey

  /**
   * The submenu inside that area.
   *
   * Optional, and only consulted when the filing map in connect/sections.ts
   * says nothing about this route. The map is where filing is decided, so
   * that there is one list to change rather than two that can disagree.
   */
  subgroup?: string

  /**
   * The outcome in plain words — "Where card payments go", not "Payment
   * processor configuration". If the title needs a noun from the software,
   * it is the wrong title.
   */
  title: string
  /** One or two sentences on what it does. No jargon without a plain line. */
  blurb: string
  /** Words someone might search for that are not already in the title. */
  keywords?: string[]

  /** The permission the API demands — the page goes read-only without it. */
  permission: string

  control: SettingControl

  /** Load the current value. */
  load: () => Promise<{ value: V; data: D }>
  /** Save it. Only ever called from the one Save button. */
  save: (value: V) => Promise<unknown>

  /**
   * What will actually happen, in two or three numbered steps, updated live
   * as the choice changes. This is the part that makes a setting legible to
   * someone who has never done it before.
   */
  consequences: (value: V, data: D) => string[]

  /** What this does NOT touch: "Payments already taken keep their records." */
  scopeNote?: string

  /** The current value for the section list: "Stripe · in use". */
  summary?: (value: V, data: D) => string

  /** A short reason this needs attention, for Home. Null when it is fine. */
  attention?: (value: V, data: D) => string | null

  /**
   * Save the moment somebody picks, instead of behind a save bar.
   *
   * The save bar is right for a setting with a cost or a consequence. It is
   * wrong for a choice that is the FIRST of several steps: pick Claude, press
   * the link to set up its key, and the key screen sends you back to pick an
   * AI — because the pick was still sitting unsaved behind a button. A dead
   * end that looks like a bug. Those settings autosave, show that they saved,
   * and can be undone.
   */
  autosave?: boolean

  /**
   * The step after this one. With `autosave`, the page goes there by itself
   * once the save lands, so a sequence feels like a sequence.
   */
  next?: (value: V, data: D) => { to: string; label: string } | null

  /** Anything the page should show beside the control — a preview, a status. */
  aside?: (value: V, data: D) => ReactNode
}
