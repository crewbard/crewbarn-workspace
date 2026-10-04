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

export type ReferenceCard = {
  id: string
  title: string
  triggers: string[]
  sections: ReferenceCardSection[]
  status: string
  scope: 'shop' | 'platform'
  mine: boolean
  documents?: ReferenceCardDocument[]
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

export type Draft = {
  id: string | null
  title: string
  triggers: string[]
  sections: DraftSection[]
  propose: boolean
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
  }
}
