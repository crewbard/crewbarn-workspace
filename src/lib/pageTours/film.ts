/**
 * Intro films: the short animated film a page tour opens with, before the
 * walk-through. Each scene is one spoken line (captions always on) over one
 * animated drawing. The drawings are a small library of generic pictures
 * (components/guides/filmVisuals.tsx) driven by the data here, so a film is
 * just data: write `film` on a page tour (pages/*.ts). A page with no film
 * written gets one made from its intro (autoFilm() in build.ts).
 *
 * Import-free, so scripts/export-tour-lines.mjs can load every film and
 * export its lines for voice recording.
 *
 * Words: plain, friendly, for every trade. Every field on a visual is
 * optional except where marked: leave it out and the drawing uses its own
 * generic sample (a few jobs, a few people, a few parts).
 */

/** Colour of a chip, pin or block. */
export type FilmTone = 'gray' | 'blue' | 'amber' | 'green' | 'red' | 'purple'

/** A row in a list, a job on an account, a card in a column. */
export interface FilmRow {
  title: string
  /** Small grey line under the title: a customer, a place, a time. */
  meta?: string
  /** The status chip on the right. */
  chip?: string
  tone?: FilmTone
}

/** The page's name, big, with its area above it. */
export interface FilmTitleVisual { kind: 'title'; title: string; subtitle?: string; area?: string }
/** A big plain statement. */
export interface FilmTextVisual { kind: 'text'; headline: string; body?: string }
/** Labels popping in as chips ("what we'll look at"). */
export interface FilmChipsVisual { kind: 'chips'; heading?: string; chips: string[] }
/** The closing scene: a pointer lands on the page, "let's walk through it". */
export interface FilmGoVisual { kind: 'go'; label?: string }
/** List rows sliding in, each with a status chip; optional search typed in first. */
export interface FilmListVisual { kind: 'list'; heading?: string; search?: string; rows?: FilmRow[] }
/** A week calendar filling with visits. `day` 0–4 (Mon–Fri), `slot` 0–3 (morning to late). */
export interface FilmCalendarVisual { kind: 'calendar'; days?: string[]; visits?: Array<{ day: number; slot: number; span?: number; label: string; tone?: FilmTone }> }
/** A map with pins; a pin with `to` drives there. x / y are 0–100. */
export interface FilmMapVisual { kind: 'map'; pins?: Array<{ label: string; x: number; y: number; to?: { x: number; y: number }; tone?: FilmTone; person?: boolean }>; route?: boolean }
/** A message thread: bubbles arrive, the last one is typed first. */
export interface FilmThreadVisual { kind: 'thread'; contact?: string; messages?: Array<{ from: 'them' | 'us'; text: string; channel?: 'text' | 'email' | 'call' | 'portal' }> }
/** Parts dropping into a cart, then a purchase order made from them. */
export interface FilmCartVisual { kind: 'cart'; items?: Array<{ name: string; qty: number; job?: string }>; supplier?: string; order?: string }
/** Lines of a bill adding up to a total, then a stamp (e.g. "Paid"). Amounts in dollars. */
export interface FilmMoneyVisual { kind: 'money'; title?: string; lines?: Array<{ label: string; amount: number }>; stamp?: string }
/** A phone with a document, signed with a finger. */
export interface FilmSignatureVisual { kind: 'signature'; doc?: string; lines?: string[]; total?: string; signer?: string; stamp?: string }
/** One customer's account card: places, people and jobs filling in. */
export interface FilmAccountVisual { kind: 'account'; name?: string; type?: string; places?: string[]; people?: string[]; jobs?: FilmRow[]; balance?: string }
/** Stages in a row; a card travels from the first to the last. */
export interface FilmPipelineVisual { kind: 'pipeline'; stages?: string[]; card?: string; stopAt?: number }
/** A form filling itself in, field by field, then its button. */
export interface FilmFormVisual { kind: 'form'; fields?: Array<{ label: string; value: string }>; button?: string }
/** Number tiles counting up. */
export interface FilmTilesVisual { kind: 'tiles'; tiles?: Array<{ label: string; value: number; prefix?: string; suffix?: string; tone?: FilmTone }> }
/** A settings panel with switches flipping on. */
export interface FilmTogglesVisual { kind: 'toggles'; heading?: string; rows?: Array<{ label: string; on?: boolean }> }

export type FilmVisual =
  | FilmTitleVisual
  | FilmTextVisual
  | FilmChipsVisual
  | FilmGoVisual
  | FilmListVisual
  | FilmCalendarVisual
  | FilmMapVisual
  | FilmThreadVisual
  | FilmCartVisual
  | FilmMoneyVisual
  | FilmSignatureVisual
  | FilmAccountVisual
  | FilmPipelineVisual
  | FilmFormVisual
  | FilmTilesVisual
  | FilmTogglesVisual

export type FilmVisualKind = FilmVisual['kind']

/** One scene of an intro film: one spoken line over one drawing. */
export interface FilmScene {
  /** Unique in the film. */
  id: string
  /** What is spoken and shown as the caption. One or two short sentences. */
  say: string
  /** Small headline over the drawing. */
  title?: string
  visual: FilmVisual
}
