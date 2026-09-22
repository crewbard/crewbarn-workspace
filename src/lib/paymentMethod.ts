/**
 * Payment-method emoji + labels — shared so the cash drawer, accounting
 * charts, and invoice detail all read the same.
 */
export const PAYMENT_METHOD_EMOJI: Record<string, string> = {
  cash: '💵',
  check: '🧾',
  card_manual: '💳',
  card_terminal: '💳',
  card: '💳',
  ach: '🏦',
  paypal: '🅿️',
  godaddy: '🌐',
  other: '🔖',
}

export const PAYMENT_METHOD_NAME: Record<string, string> = {
  cash: 'Cash',
  check: 'Check',
  card_manual: 'Card (manual)',
  card_terminal: 'Card (terminal)',
  card: 'Card',
  ach: 'ACH',
  paypal: 'PayPal',
  godaddy: 'GoDaddy',
  other: 'Other',
}

export function paymentMethodEmoji(method: string | null | undefined): string {
  if (!method) return '🔖'
  return PAYMENT_METHOD_EMOJI[method] ?? '🔖'
}

/** "💵 Cash" — emoji + readable name (falls back to the raw key). */
export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return 'Other'
  const name = PAYMENT_METHOD_NAME[method] ?? method
  return `${paymentMethodEmoji(method)} ${name}`
}
