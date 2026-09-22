import { sanitizeHtml } from '@/components/SafeHtml'
import { useEffect, useMemo, useState } from 'react'
import type { Starter } from './templateStarters'
import { markdownToHtml, fontToCss } from '@/lib/extractedDocumentPdf'

/**
 * StarterDetailModal — second step of the starter pick flow.
 *
 *   Starters gallery → user clicks a card → this modal → user picks
 *   which merge tags they want available for this document → confirm.
 *
 * The starter's body lands as-is in the editor (HTML or markdown) and
 * the chosen tags become `design_tokens.pinned_tags`, surfaced as a
 * one-click chip strip above the body editor for quick insertion.
 *
 * Pre-checks `starter.suggested_tags` so the user gets a sensible
 * default without having to think about every field. Power users can
 * add / remove anything before confirming.
 */

interface TagSpec {
  tag: string
  description: string
}
interface TagGroup {
  category: string
  items: TagSpec[]
}

const ALL_TAGS: TagGroup[] = [
  {
    category: 'Customer',
    items: [
      { tag: '{{customer.name}}',          description: 'Full display name' },
      { tag: '{{customer.first_name}}',    description: 'First name only' },
      { tag: '{{customer.last_name}}',     description: 'Last name only' },
      { tag: '{{customer.business_name}}', description: 'Business name (commercial)' },
      { tag: '{{customer.address}}',       description: 'Service location' },
      { tag: '{{customer.phone}}',         description: 'Primary phone' },
      { tag: '{{customer.email}}',         description: 'Primary email' },
    ],
  },
  {
    category: 'Job',
    items: [
      { tag: '{{job.id}}',           description: 'Internal job ID' },
      { tag: '{{job.number}}',       description: 'Job number' },
      { tag: '{{job.title}}',        description: 'Job title' },
      { tag: '{{job.description}}',  description: 'Scope description' },
      { tag: '{{job.address}}',      description: 'Service address' },
      { tag: '{{job.scheduled_at}}', description: 'Scheduled date' },
      { tag: '{{job.priority}}',     description: 'Priority' },
      { tag: '{{job.status}}',       description: 'Current status' },
      { tag: '{{job.type}}',         description: 'Job type' },
    ],
  },
  {
    category: 'Appointment',
    items: [
      { tag: '{{appointment.at}}',   description: 'Date + time' },
      { tag: '{{appointment.date}}', description: 'Date only' },
      { tag: '{{appointment.time}}', description: 'Time only' },
    ],
  },
  {
    category: 'Invoice',
    items: [
      { tag: '{{invoice.number}}',          description: 'Invoice number' },
      { tag: '{{invoice.total}}',           description: 'Total' },
      { tag: '{{invoice.subtotal}}',        description: 'Subtotal' },
      { tag: '{{invoice.tax}}',             description: 'Tax' },
      { tag: '{{invoice.balance}}',         description: 'Outstanding' },
      { tag: '{{invoice.balance_dollars}}', description: 'Outstanding (alias)' },
      { tag: '{{invoice.days_overdue}}',    description: 'Days past due' },
      { tag: '{{invoice.due_at}}',          description: 'Due date' },
      { tag: '{{invoice.issued_at}}',       description: 'Issued date' },
      { tag: '{{invoice.status}}',          description: 'Status' },
      { tag: '{{invoice.pay_link}}',        description: 'Pay-online URL' },
    ],
  },
  {
    category: 'Technician',
    items: [
      { tag: '{{technician.name}}', description: 'Lead tech name' },
    ],
  },
  {
    category: 'Company',
    items: [
      { tag: '{{company.name}}',        description: 'Your company name' },
      { tag: '{{company.phone}}',       description: 'Phone' },
      { tag: '{{company.email}}',       description: 'Email' },
      { tag: '{{company.address}}',     description: 'Address' },
      { tag: '{{company.logo}}',        description: 'Logo URL' },
      { tag: '{{company.review_link}}', description: 'Review link' },
    ],
  },
  {
    category: 'Other',
    items: [
      { tag: '{{today}}',                  description: "Today's date" },
    ],
  },
  {
    category: 'Signature placeholders',
    items: [
      { tag: '[[signature:customer]]',   description: 'Customer signature slot' },
      { tag: '[[signature:company]]',    description: 'Company signature slot' },
      { tag: '[[signature:technician]]', description: 'Technician sign-off slot' },
      { tag: '[[signature:witness]]',    description: 'Witness signature slot' },
    ],
  },
]

/**
 * Walk the preview HTML and wrap every `{{tag.path}}` / every
 * `[[signature:role]]` token in a styled span so the user sees a live
 * green / grey indicator of whether that tag is currently picked.
 *
 * Done via real DOM parsing + tree walking instead of string regex,
 * because string regex would happily replace tokens that live inside
 * attribute values too — and injecting `<span>` into an attribute
 * (`<img src="{{logo}}">` → `<img src="<span ...>...</span>">`) breaks
 * the HTML and the preview goes blank.
 *
 * Text nodes only: token-in-attribute occurrences are left as-is
 * (they still get filled by the real merge renderer downstream).
 */
function annotateTagsForPreview(html: string, chosen: Set<string>): string {
  if (typeof document === 'undefined') return html  // SSR safety

  const TOKEN_RE = /(\{\{\s*[a-zA-Z_][a-zA-Z0-9_.]*\s*\}\}|\[\[signature:[a-zA-Z0-9_-]+\]\])/g
  const BASE_STYLE =
    'display:inline-block;padding:0 6px;border-radius:4px;font-family:ui-monospace,monospace;font-size:0.85em;'
  const ON_STYLE = BASE_STYLE + 'background:#dcfce7;color:#166534;border:1px solid #86efac;'
  const OFF_STYLE =
    BASE_STYLE + 'background:#f1f5f9;color:#94a3b8;border:1px solid #e2e8f0;text-decoration:line-through;'

  function normalize(token: string): string {
    // {{   customer.name }} → {{customer.name}}  so chosen-set lookup
    // matches the canonical form we store from the checklist.
    const m = /^\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}$/.exec(token)
    return m ? `{{${m[1]}}}` : token
  }

  const wrap = document.createElement('div')
  wrap.innerHTML = html

  // Walk text nodes only. Attribute values are owned by the element,
  // not text nodes, so they're naturally skipped.
  const walker = document.createTreeWalker(wrap, NodeFilter.SHOW_TEXT, null)
  const textNodes: Text[] = []
  let cur = walker.nextNode()
  while (cur) {
    textNodes.push(cur as Text)
    cur = walker.nextNode()
  }

  for (const node of textNodes) {
    // Skip text inside <script> / <style> just in case some starter
    // dropped a `{{` literal in there.
    const parentTag = (node.parentNode as Element | null)?.nodeName
    if (parentTag === 'SCRIPT' || parentTag === 'STYLE') continue

    const text = node.nodeValue ?? ''
    const matches = [...text.matchAll(TOKEN_RE)]
    if (matches.length === 0) continue

    const frag = document.createDocumentFragment()
    let lastIndex = 0
    for (const m of matches) {
      const token = m[0]
      const start = m.index ?? 0
      if (start > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, start)))
      }
      const span = document.createElement('span')
      const included = chosen.has(normalize(token))
      span.setAttribute('style', included ? ON_STYLE : OFF_STYLE)
      span.setAttribute(
        'title',
        included
          ? 'Checked — this tag will be filled with real data when rendered.'
          : 'Not checked — this tag stays as raw text. Check it on the left to use it.',
      )
      span.textContent = token
      frag.appendChild(span)
      lastIndex = start + token.length
    }
    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)))
    }
    node.parentNode?.replaceChild(frag, node)
  }

  return wrap.innerHTML
}

export function StarterDetailModal({
  starter,
  onClose,
  onUse,
}: {
  starter: Starter
  onClose: () => void
  onUse: (chosenTags: string[]) => void
}) {
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(starter.suggested_tags ?? []),
  )
  const [q, setQ] = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const filtered = useMemo(() => {
    if (!q.trim()) return ALL_TAGS
    const needle = q.trim().toLowerCase()
    return ALL_TAGS.map((g) => ({
      ...g,
      items: g.items.filter(
        (i) =>
          i.tag.toLowerCase().includes(needle) ||
          i.description.toLowerCase().includes(needle) ||
          g.category.toLowerCase().includes(needle),
      ),
    })).filter((g) => g.items.length > 0)
  }, [q])

  function toggle(tag: string) {
    setChosen((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  function resetToSuggested() {
    setChosen(new Set(starter.suggested_tags ?? []))
  }

  function selectAllVisible() {
    setChosen((prev) => {
      const next = new Set(prev)
      for (const g of filtered) for (const i of g.items) next.add(i.tag)
      return next
    })
  }

  function clearAll() {
    setChosen(new Set())
  }

  // Preview HTML for the right side. Merge tags + signature tokens
  // are wrapped with status pills that reflect the chosen-set live —
  // green when the user has the tag checked, grey + strikethrough
  // when they haven't (so they can SEE the consequence of each
  // checkbox without saving).
  const isHtml = (starter.design_tokens.body_format ?? 'markdown') === 'html'
  const rawPreview = isHtml ? starter.body : markdownToHtml(starter.body)
  const previewHtml = useMemo(
    () => annotateTagsForPreview(rawPreview, chosen),
    [rawPreview, chosen],
  )
  const primary = starter.design_tokens.primary_color ?? '#f59e0b'
  const accent = starter.design_tokens.accent_color ?? '#0f172a'

  // Map paper_size to an approximate on-screen pixel width so the
  // preview "page" looks like the actual document, not a squashed
  // version of it.
  const paperPx =
    starter.design_tokens.paper_size === 'legal' ? 720 :
    starter.design_tokens.paper_size === 'a4'    ? 680 :
                                                   720  // letter default

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/70 flex flex-col"
      onClick={onClose}
    >
      <div
        className="flex-1 flex flex-col bg-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center gap-4 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <h2 className="text-base font-semibold text-navy-900 truncate">{starter.name}</h2>
              <span className="text-[10px] uppercase tracking-wide text-slate-500">starter</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{starter.blurb}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 shrink-0"
          >
            ← Back to starters
          </button>
          <button
            type="button"
            onClick={() => onUse(Array.from(chosen))}
            className="text-sm px-4 py-2 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold shrink-0"
          >
            Use this template · {chosen.size} tag{chosen.size === 1 ? '' : 's'} pinned →
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left — tag picker (fixed width sidebar) */}
          <div className="w-[360px] shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-amber-50/50 shrink-0">
              <div className="text-[11px] uppercase tracking-wide text-amber-900 font-semibold mb-1">
                Step 2 · Which merge fields will this document use?
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                Suggested fields are pre-checked. Pick the ones you want as one-click
                chips above the editor.
              </p>
            </div>

            <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search tags…"
                className="flex-1 text-xs px-2 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-slate-500">{chosen.size} picked</span>
            </div>

            <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={resetToSuggested}
                className="text-[10px] px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
              >
                Reset to suggested
              </button>
              <button
                type="button"
                onClick={selectAllVisible}
                className="text-[10px] px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
              >
                Select all visible
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="text-[10px] px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 text-red-700"
              >
                Clear
              </button>
            </div>

            <div className="overflow-y-auto p-3">
              {filtered.map((group) => (
                <div key={group.category} className="mb-3">
                  <div className="px-1 py-1 text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
                    {group.category}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isOn = chosen.has(item.tag)
                      const isSuggested = (starter.suggested_tags ?? []).includes(item.tag)
                      return (
                        <label
                          key={item.tag}
                          className={[
                            'flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer border',
                            isOn
                              ? 'bg-amber-50 border-amber-200'
                              : 'border-transparent hover:bg-slate-50',
                          ].join(' ')}
                        >
                          <input
                            type="checkbox"
                            checked={isOn}
                            onChange={() => toggle(item.tag)}
                            className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-[11px] text-amber-900 flex items-baseline gap-1">
                              <span className="truncate">{item.tag}</span>
                              {isSuggested && (
                                <span className="text-[9px] uppercase tracking-wide text-emerald-700 shrink-0">
                                  · suggested
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 leading-tight">
                              {item.description}
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — starter preview at proper paper width */}
          <div
            className="flex-1 overflow-y-auto bg-slate-100"
            style={
              {
                fontFamily: fontToCss(starter.design_tokens.font_family),
                ['--primary' as string]: primary,
                ['--accent' as string]: accent,
              } as React.CSSProperties
            }
          >
            <div className="py-8 px-6 flex flex-col items-center gap-4">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold flex items-center gap-2 flex-wrap justify-center">
                <span>Preview</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-700">{starter.titleOrSubject}</span>
                <span className="text-slate-400">·</span>
                <span className="uppercase">{starter.design_tokens.paper_size ?? 'letter'}</span>
                <span className="text-slate-400">·</span>
                <span className="inline-flex items-center gap-1 normal-case tracking-normal text-slate-500">
                  <span className="inline-block w-2 h-2 rounded-sm bg-emerald-200 border border-emerald-400" />
                  picked
                  <span className="inline-block w-2 h-2 rounded-sm bg-slate-200 border border-slate-300 ml-1" />
                  not picked
                </span>
              </div>
              {/* The actual rendered "page" — shadowed white card sized to
                  match the chosen paper width so designs don't get
                  squashed. */}
              <div
                className="bg-white shadow-xl rounded-sm"
                style={{
                  width: `${paperPx}px`,
                  minHeight: starter.design_tokens.paper_size === 'legal'
                    ? `${paperPx * 1.65}px`  // ~14/8.5
                    : starter.design_tokens.paper_size === 'a4'
                    ? `${paperPx * 1.41}px`  // ~297/210
                    : `${paperPx * 1.29}px`, // ~11/8.5 letter
                  padding: '48px 56px',
                }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml, { document: true }) }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
