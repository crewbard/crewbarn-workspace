/**
 * The shape of a reference card, and the rules for writing one.
 *
 * Separate from the components so that the reader, the builder and
 * the linkifier all agree on it without importing each other.
 */

export type ReferenceCardSection = {
  heading: string
  body: string | null
  tab?: string | null
}

/** The colours an index tab can take. Matches the API's list. */
export const TAB_COLORS = [
  'slate', 'blue', 'green', 'yellow', 'orange', 'red', 'navy', 'teal', 'purple', 'pink',
] as const

export type TabColor = (typeof TAB_COLORS)[number]

/** A tab down the edge of the viewer: a name and the page it opens at. */
export type DocumentTab = {
  label: string
  page: number
  color: TabColor | null
}

/** A file on a card. Never carries a URL: the bytes come through the API. */
export type ReferenceCardDocument = {
  id: string
  title: string
  original_filename: string
  size_bytes: number
  shareable: boolean
  tabs: DocumentTab[]
  /** Copied into CrewBarn's storage because the card was approved. */
  on_platform: boolean
  /** The shop's customers can read it in the portal and order from it. */
  customer_visible?: boolean
  /** This shop's own upload, rather than one another shop shared. */
  mine?: boolean
}

/** Where a card's part is found: a catalog, and a page of it. */
export type CatalogLink = {
  id: string
  document_id: string
  title: string
  vendor?: string | null
  size_bytes?: number
  /** The page of the file. Null: the whole book. */
  page: number | null
  /** The number printed on that page, when it differs. */
  page_label: string | null
}

export type ReferenceCard = {
  id: string
  title: string
  triggers: string[]
  sections: ReferenceCardSection[]
  status: string
  scope: 'shop' | 'platform'
  mine: boolean
  /** The numbers the part goes by. What a lookup, and later a call transcript, finds it by. */
  part_numbers?: string[]
  /** Other names for it: what customers and suppliers call it. */
  aliases?: string[]
  has_picture?: boolean
  found_in?: CatalogLink[]
  /** Files uploaded to the card before catalogs had their own library. */
  documents?: ReferenceCardDocument[]
  /** What worked, from this shop's finished jobs ("What worked?" at close-out). */
  from_jobs?: FromJobs
}

/** What a card learned from this shop's jobs (App\Services\Reference\WhatWorked::summaryFor). */
export type FromJobs = {
  jobs: number
  /** The parts those jobs took, most-used first. */
  parts: { description: string; catalog_item_id: string | null; jobs: number }[]
  typical_minutes: number | null
  recent: {
    note: string | null
    minutes: number | null
    vehicle: string | null
    by: string | null
    at: string
    work_order_id: string | null
    work_order_number: number | null
  }[]
}

/** Matches the API: triggers, sections and the lengths it accepts. */
export const LIMITS = {
  title: 160,
  trigger: 80,
  minTrigger: 3,
  triggers: 20,
  heading: 120,
  body: 4000,
  tab: 40,
  sections: 30,
  /** Files: matches ReferenceCardDocumentController, which matches the server's upload limit. */
  documentMb: 150,
  documents: 20,
  documentTabs: 24,
  documentTabLabel: 40,
  names: 30,
  name: 80,
}

/**
 * The tab names a card uses, in the order its sections introduce them.
 *
 * A tab is a name carried by each section rather than a container
 * holding them, so reordering sections cannot silently move one
 * between tabs and renaming a tab happens in one place. The cost is
 * that the set of tabs has to be derived, which is this.
 */
export function tabsOf(sections: ReferenceCardSection[]): string[] {
  const seen: string[] = []

  sections.forEach((section) => {
    const tab = (section.tab ?? '').trim()
    if (tab !== '' && !seen.includes(tab)) {
      seen.push(tab)
    }
  })

  return seen
}

export type DraftSection = {
  /** Stable across reorders, so React keeps the focused field focused. */
  key: string
  heading: string
  body: string
  tab: string
}

/** A catalog page a card will be linked to once it is saved. */
export type PendingLink = { document_id: string; title: string; page: number | null; page_label: string | null }

export type Draft = {
  id: string | null
  title: string
  triggers: string[]
  sections: DraftSection[]
  propose: boolean
  partNumbers: string[]
  aliases: string[]
  /** New cards only: catalog pages to link on save. A saved card links straight away. */
  links: PendingLink[]
  /** A picture waiting to go on with the save: usually cut from a catalog page. */
  picture: Blob | null
}

let counter = 0
export const nextKey = () => `s${++counter}`

export function emptyDraft(): Draft {
  return {
    id: null,
    title: '',
    triggers: [],
    sections: [{ key: nextKey(), heading: '', body: '', tab: '' }],
    propose: false,
    partNumbers: [],
    aliases: [],
    links: [],
    picture: null,
  }
}

export function draftOf(card: ReferenceCard): Draft {
  return {
    id: card.id,
    title: card.title,
    triggers: [...card.triggers],
    sections: card.sections.map((s) => ({
      key: nextKey(),
      heading: s.heading,
      body: s.body ?? '',
      tab: (s.tab ?? '').trim(),
    })),
    propose: card.status === 'proposed',
    partNumbers: [...(card.part_numbers ?? [])],
    aliases: [...(card.aliases ?? [])],
    links: [],
    picture: null,
  }
}

/** "RV-200", "rv 200" and "RV200" are one number. Matches the API's fold. */
export function foldName(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/** Every folded part number, other name and opening word a card answers to. */
export function namesOf(card: ReferenceCard): string[] {
  return [...(card.part_numbers ?? []), ...(card.aliases ?? []), ...card.triggers].map(foldName).filter(Boolean)
}

/** "Ilco catalog, p. 52" */
export function linkLabel(link: { title: string; page: number | null; page_label: string | null }): string {
  const page = link.page_label ?? (link.page !== null ? String(link.page) : null)
  return page ? `${link.title}, p. ${page}` : link.title
}
