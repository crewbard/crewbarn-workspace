import type { CoveragePayload } from './coverageTable'

/**
 * What must be true before an agreement goes to a customer to sign.
 * The same rules as app/Services/Contracts/AgreementSendCheck.php, which the
 * send endpoints enforce (422 with this list). No AI involved.
 *
 * Each item's key says where the fix is: item:<n>, price, term,
 * section:<key> or email.
 */
export interface SendCheck { key: string; message: string }
export interface CheckSection { key: string; label: string; text: string; included?: boolean }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function sendChecks(sections: CheckSection[], coverage: CoveragePayload | null, email: string | null | undefined): SendCheck[] {
  const out: SendCheck[] = []
  if (coverage && coverage.items.length) {
    coverage.items.forEach((item, i) => {
      const name = item.name.trim() || 'an item'
      const r = item.rhythm
      const often = r.mode === 'months' ? r.months.length > 0 : Boolean(r.count && r.unit)
      if (!item.tasks.trim()) out.push({ key: `item:${i}`, message: `Say what is done each visit for ${name}.` })
      else if (!often) out.push({ key: `item:${i}`, message: `Say how often ${name} is visited.` })
    })
    if (coverage.pricing.mode === 'flat') {
      if (coverage.pricing.flat_cents === null) out.push({ key: 'price', message: 'Set the price for everything.' })
    } else {
      const unpriced = coverage.items.filter((item) => item.price_cents === null)
      if (unpriced.length) {
        const names = unpriced.slice(0, 3).map((item) => item.name.trim() || 'an item')
        const more = unpriced.length > 3 ? ` and ${unpriced.length - 3} more` : ''
        out.push({ key: 'price', message: `Set a price for ${names.join(', ')}${more}.` })
      }
    }
    if (coverage.term.until_cancelled) {
      if (coverage.term.notice_days === null) out.push({ key: 'term', message: "Say how many days' notice it takes to cancel." })
    } else if (!coverage.term.ends_on) {
      out.push({ key: 'term', message: 'Add an end date, or choose "until cancelled" with notice.' })
    }
  }

  const included = sections.filter((s) => s.included ?? true)
  const excluded = included.find((s) => s.key === 'excluded')
  if (!excluded || !excluded.text.trim()) out.push({ key: 'section:excluded', message: 'Say what is not covered.' })

  if (!email || !EMAIL.test(email.trim())) out.push({ key: 'email', message: "Add the customer's email address." })

  for (const s of included) {
    if (s.key === 'excluded' && !s.text.trim()) continue
    if (!s.text.trim()) out.push({ key: `section:${s.key}`, message: `${s.label} is empty. Write it, or untick it.` })
    else if (s.text.includes('{{') || /\[enter/i.test(s.text)) out.push({ key: `section:${s.key}`, message: `${s.label} still has a blank to fill in.` })
  }
  return out
}
