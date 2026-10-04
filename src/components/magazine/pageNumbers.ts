/**
 * The page numbers printed in the book, not the PDF's own count.
 *
 * A catalogue's cover is not page 1, and the PDF often drops a blank or
 * adds a cover, so "page 13" in the file is the book's 12 or 14 -- and the
 * counter on the phone and the book on the bench disagree. The book is
 * right: it is what the contents page, the index and the supplier on the
 * phone all quote.
 *
 * Two ways to know. A PDF can carry its own page labels (i, ii, 1, 2 ...),
 * which the publisher set and which win. Otherwise the folios -- the bare
 * number at the foot or head of each page -- say how far off the file is,
 * and every page moves by that much. With neither, the PDF's count is the
 * best there is.
 */
export class PageNumbers {
  readonly count: number
  /** File page minus printed page: 1 when a cover comes before page 1. */
  readonly shift: number
  private readonly labels: string[] | null

  constructor(count: number, shift = 0, labels: string[] | null = null) {
    this.count = count
    this.shift = shift
    // Labels that are just 1, 2, 3 say nothing the count does not.
    this.labels = labels && labels.length === count && labels.some((l, i) => l.trim() !== String(i + 1))
      ? labels.map((l) => l.trim())
      : null
  }

  /** True when the book's numbers are not the file's. */
  get differs(): boolean {
    return this.labels !== null || this.shift !== 0
  }

  /** "13", "iv", or "Cover" for what comes before page 1. */
  label(page: number): string {
    if (this.labels) return this.labels[page - 1] || String(page)
    const printed = page - this.shift
    if (printed >= 1) return String(printed)
    return page === 1 ? 'Cover' : 'Front'
  }

  /** The label of the last page, for "of 63". */
  get last(): string {
    return this.label(this.count)
  }

  /**
   * The file page a typed page number means. The book's number first --
   * "13" is the book's 13 -- then a label typed as printed ("iv", "A-3"),
   * then "cover". Null when it is not in this book.
   */
  find(typed: string): number | null {
    const text = typed.trim()
    if (!text) return null

    if (this.labels) {
      const exact = this.labels.findIndex((l) => l.toLowerCase() === text.toLowerCase())
      if (exact >= 0) return exact + 1
    }

    if (/^cover$/i.test(text)) return 1

    if (/^\d+$/.test(text)) {
      const n = Number(text)
      // No book has a page 0; the cover is "cover".
      if (n < 1) return null
      if (this.labels) {
        // A plain number on a labelled book: the page labelled with it, else the file's page.
        const labelled = this.labels.indexOf(String(n))
        if (labelled >= 0) return labelled + 1
        return n >= 1 && n <= this.count ? n : null
      }
      const page = n + this.shift
      return page >= 1 && page <= this.count ? page : null
    }

    return null
  }

  /** "12–13" for a spread, "Cover" for the cover alone. */
  range(left: number | null, right: number | null): string {
    if (left && right) return `${this.label(left)}–${this.label(right)}`
    const only = left ?? right
    return only ? this.label(only) : ''
  }
}
