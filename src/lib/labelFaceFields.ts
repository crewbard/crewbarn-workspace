import type { PdfLabel } from '@/lib/pdfLabels'

/**
 * The face fields of a label (name, code, type badge, place), whichever
 * shape the caller sent. The studio sends code/tag/path; older pages send
 * title/subtitle/details, read here as name/tag/path so nothing prints blank.
 *
 * Shared by the PDF and the printer picture (pngLabels), so a label from
 * the Print Bridge, Bluetooth, ZPL, TSPL or EPL carries the same words as
 * the on-screen preview.
 */
export interface LabelFaceFields {
  name: string
  code?: string
  tag?: string
  path?: string
  company?: string
  phone?: string
  note?: string
}

export function faceOf(label: PdfLabel): LabelFaceFields {
  const details = label.details ?? []
  return {
    name: label.title,
    code: label.code ?? details.find((d) => /^(SKU|SN)[: ]/i.test(d)),
    tag: label.tag ?? label.subtitle,
    // A path is the detail line with separators in it; failing that, the
    // last one, which is where these pages have always put it.
    path: label.path ?? details.find((d) => d.includes('\u203a') || d.includes('>')) ?? details[details.length - 1],
    company: label.company,
    phone: label.phone,
    note: label.note,
  }
}
