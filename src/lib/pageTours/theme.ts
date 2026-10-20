/**
 * The app's look, for a step's `when` or a variant's `when`.
 *
 * The chosen look is written on the page itself (<html data-theme="…">), so
 * a step can say other words, or light up another part, when the person is
 * in the Focus look: `variants: [{ when: FOCUS, say: '…' }]`, or
 * `when: NOT_FOCUS` for a step that only fits the other looks.
 *
 * Kept import-free so scripts/export-tour-lines.mjs can load it.
 */
export const FOCUS = 'html[data-theme="focus"]'
export const NOT_FOCUS = `!${FOCUS}`
