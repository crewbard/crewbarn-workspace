/**
 * One quoted CSV cell that a spreadsheet opens as text, never as a formula
 * (security assessment SA-29; the API's App\Support\CsvCell does the same
 * for its exports).
 *
 * A customer name or a note that starts with "=", "+", "-", "@", a tab or a
 * return would otherwise run as a formula when the office opens the file in
 * Excel or Sheets. Such a cell gets an apostrophe in front, which the
 * spreadsheet hides. Plain numbers and amounts ("-12.50", "-$1,234.00",
 * "-5%") are left alone so the columns still add up.
 */

const RISKY_FIRST = ['=', '+', '-', '@', '\t', '\r']
const PLAIN_NUMBER = /^[+-]?[$€£]?\d[\d,]*(\.\d+)?%?$|^[+-]?[$€£]?\.\d+%?$/

/** The text a cell holds, with the apostrophe in front when it could run as a formula. */
export function csvSafeText(raw: string): string {
  if (raw === '' || !RISKY_FIRST.includes(raw[0]) || PLAIN_NUMBER.test(raw)) return raw
  return `'${raw}`
}

export function csvCell(value: unknown): string {
  const raw = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
  return `"${csvSafeText(raw).replace(/"/g, '""')}"`
}
