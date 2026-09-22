import DOMPurify from 'dompurify'
import { useMemo } from 'react'

/**
 * SafeHtml — the ONE place untrusted HTML is allowed into the DOM.
 *
 * Inbound customer email (the comms thread, the platform admin inbox) is
 * attacker-controlled: anyone who knows the address can send it. Rendering it
 * through a bare `dangerouslySetInnerHTML` hands that sender script execution
 * inside a staff — or platform-admin — session. Every surface that renders
 * stored HTML must go through here.
 *
 *  - drops <script>, event handlers, `javascript:` URLs, and embedding tags
 *  - keeps the inline styles real-world email depends on (DOMPurify scrubs the
 *    CSS values, so `expression()` / `url(javascript:)` don't survive)
 *  - forces every surviving link to open in a new tab, unreferred + nofollow
 *  - `blockRemoteImages` drops <img> entirely (tracking pixels). OFF by default
 *    so legitimate screenshots, logos, and signatures still render.
 */

// Structural tags that have no place in rendered email/template HTML. <script>
// and on*= handlers are already stripped by DOMPurify; these are belt-and-braces.
const FORBID_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'link',
  'meta',
  'base',
]

// Registered once per page load; applies to every sanitize() call below.
let linkHookInstalled = false
function installLinkHook(): void {
  if (linkHookInstalled) return
  linkHookInstalled = true
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName === 'A') {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer nofollow')
    }
  })
}

export interface SanitizeOptions {
  blockRemoteImages?: boolean
  /**
   * Rendered documents (invoice/contract/agreement previews) are laid out by
   * their own <style> block. CSS cannot execute, so keep it; everything that
   * can run — scripts, handlers, javascript: URLs, embeds, forms — still goes.
   */
  document?: boolean
}

export function sanitizeHtml(html: string, opts: SanitizeOptions = {}): string {
  installLinkHook()

  let forbid = opts.document ? FORBID_TAGS.filter((t) => t !== 'style') : FORBID_TAGS
  if (opts.blockRemoteImages) forbid = [...forbid, 'img']

  return DOMPurify.sanitize(html, {
    // HTML only — no SVG/MathML, which carry their own script vectors.
    USE_PROFILES: { html: true },
    FORBID_TAGS: forbid,
    FORBID_ATTR: ['srcset', 'formaction', 'ping'],
    ALLOW_DATA_ATTR: false,
    // Permit the attributes the link hook adds back.
    ADD_ATTR: ['target', 'rel'],
  })
}

export function SafeHtml({
  html,
  className,
  blockRemoteImages = false,
  document = false,
}: {
  html: string | null | undefined
  className?: string
  blockRemoteImages?: boolean
  document?: boolean
}) {
  const clean = useMemo(
    () => sanitizeHtml(html ?? '', { blockRemoteImages, document }),
    [html, blockRemoteImages, document],
  )

  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />
}
