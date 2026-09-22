import { useState } from 'react'

/**
 * Pre-designed HTML blocks the user can drop into a template. Each
 * block is a self-contained HTML chunk that styles itself via inline
 * styles or via the starter's already-loaded class system + the
 * `--primary` / `--accent` CSS vars injected by VisualEditor.
 *
 * Two ways to use:
 *   1. Click → insertHtml() at cursor in the contenteditable.
 *   2. Drag → the editor's onDrop handler captures the HTML and
 *      inserts at the drop point.
 */

export interface Block {
  id: string
  name: string
  category: 'Header' | 'Layout' | 'Table' | 'Signature' | 'Misc'
  icon: string
  /** One-line description shown in the card. */
  hint: string
  html: string
}

const BLOCKS: Block[] = [
  // ---------- Headers ----------
  {
    id: 'logo-company-header',
    name: 'Logo + company info',
    category: 'Header',
    icon: '🏢',
    hint: 'Logo on the left, company contact info on the right.',
    html: `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
  <div>
    <img src="{{company.logo}}" alt="{{company.name}}" style="max-height:56px;max-width:200px;display:block;" onerror="this.style.display='none'" />
    <div style="font-size:11px;color:#64748b;margin-top:6px;line-height:1.5;">{{company.name}}<br/>{{company.address}}<br/>{{company.phone}} · {{company.email}}</div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:30px;font-weight:800;color:var(--accent,#1e293b);letter-spacing:-0.02em;">DOCUMENT</div>
    <div style="color:var(--primary,#3b82f6);font-weight:700;">#0001</div>
  </div>
</div>`,
  },
  {
    id: 'banner-title',
    name: 'Colored banner title',
    category: 'Header',
    icon: '🎀',
    hint: 'Full-width brand-colored band with title in white.',
    html: `<div style="background:var(--primary,#f59e0b);color:white;padding:20px 28px;border-radius:4px;margin-bottom:24px;">
  <h1 style="margin:0;font-size:24px;">Title goes here</h1>
  <div style="opacity:0.9;font-size:13px;margin-top:4px;">Subtitle or date</div>
</div>`,
  },
  {
    id: 'page-title',
    name: 'Page title with accent underline',
    category: 'Header',
    icon: '📄',
    hint: 'Large heading + brand-color rule beneath.',
    html: `<h1 style="margin:0 0 4px;font-size:26px;font-weight:800;color:var(--accent,#0f172a);">Page title</h1>
<div style="height:3px;background:var(--primary,#f59e0b);margin-bottom:20px;border-radius:2px;"></div>`,
  },

  // ---------- Layout ----------
  {
    id: 'two-column',
    name: 'Two-column row',
    category: 'Layout',
    icon: '⫼',
    hint: 'Side-by-side blocks — perfect for Bill-to / From.',
    html: `<div style="display:flex;gap:24px;margin:16px 0;">
  <div style="flex:1;">
    <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:4px;">Left block</div>
    <div>Type here…</div>
  </div>
  <div style="flex:1;">
    <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:4px;">Right block</div>
    <div>Type here…</div>
  </div>
</div>`,
  },
  {
    id: 'three-column',
    name: 'Three-column row',
    category: 'Layout',
    icon: '☰',
    hint: 'Three even columns for invoice metadata (date / due / job).',
    html: `<div style="display:flex;gap:20px;margin:16px 0;">
  <div style="flex:1;">
    <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:4px;">Column 1</div>
    <div>Content</div>
  </div>
  <div style="flex:1;">
    <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:4px;">Column 2</div>
    <div>Content</div>
  </div>
  <div style="flex:1;">
    <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:4px;">Column 3</div>
    <div>Content</div>
  </div>
</div>`,
  },
  {
    id: 'info-card',
    name: 'Info card',
    category: 'Layout',
    icon: '🪪',
    hint: 'Boxed block with label + content. Good for customer / tech info.',
    html: `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 14px;margin:12px 0;">
  <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:4px;">Label</div>
  <div style="font-weight:700;">Heading line</div>
  <div style="font-size:12px;">Detail line</div>
</div>`,
  },

  // ---------- Tables ----------
  {
    id: 'line-items-table',
    name: 'Line items table',
    category: 'Table',
    icon: '🧾',
    hint: 'Dynamic invoice/job table rendered from real line items.',
    html: `<div style="margin:16px 0;">
  {{products.table}}
  <div style="margin-top:12px;max-width:260px;margin-left:auto;font-size:13px;">
    <div style="display:flex;justify-content:space-between;color:#64748b;"><span>Subtotal</span><span>\${{products.subtotal}}</span></div>
    {{products.discount_row}}
    <div style="display:flex;justify-content:space-between;color:#64748b;"><span>Tax</span><span>\${{products.tax}}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;color:var(--accent,#0f172a);border-top:1px solid #e2e8f0;margin-top:8px;padding-top:8px;"><span>Total</span><span>\${{products.total}}</span></div>
  </div>
</div>`,
  },
  {
    id: 'line-items-compact-table',
    name: 'Compact line items',
    category: 'Table',
    icon: '▦',
    hint: 'Dense dynamic line-item table for one-page estimates, jobs, and invoices.',
    html: `<div style="margin:10px 0;">
  {{products.compact_table}}
  <div style="margin-top:8px;max-width:230px;margin-left:auto;font-size:11px;line-height:1.55;">
    <div style="display:flex;justify-content:space-between;color:#64748b;"><span>Subtotal</span><span>\${{products.subtotal}}</span></div>
    {{products.discount_row}}
    <div style="display:flex;justify-content:space-between;color:#64748b;"><span>Tax</span><span>\${{products.tax}}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;color:var(--accent,#0f172a);border-top:1px solid #e2e8f0;margin-top:5px;padding-top:5px;"><span>Total</span><span>\${{products.total}}</span></div>
  </div>
</div>`,
  },
  {
    id: 'line-items-table-images',
    name: 'Line items with images',
    category: 'Table',
    icon: '🖼',
    hint: 'Dynamic line-item table with catalog thumbnails when available.',
    html: `<div style="margin:16px 0;">
  {{products.table_with_images}}
  <div style="margin-top:12px;max-width:260px;margin-left:auto;font-size:13px;">
    <div style="display:flex;justify-content:space-between;color:#64748b;"><span>Subtotal</span><span>\${{products.subtotal}}</span></div>
    {{products.discount_row}}
    <div style="display:flex;justify-content:space-between;color:#64748b;"><span>Tax</span><span>\${{products.tax}}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;color:var(--accent,#0f172a);border-top:1px solid #e2e8f0;margin-top:8px;padding-top:8px;"><span>Total</span><span>\${{products.total}}</span></div>
  </div>
</div>`,
  },
  {
    id: 'key-value-table',
    name: 'Key / value table',
    category: 'Table',
    icon: '📋',
    hint: 'Two-column table — good for contract terms or specs.',
    html: `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
  <tr><td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;width:30%;font-weight:600;">Term</td><td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">12 months</td></tr>
  <tr><td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:600;">Fee</td><td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">Type fee or terms here</td></tr>
  <tr><td style="padding:8px 10px;font-weight:600;">Renewal</td><td style="padding:8px 10px;">Auto-renews unless cancelled in writing</td></tr>
</table>`,
  },
  {
    id: 'checklist',
    name: 'Checklist',
    category: 'Table',
    icon: '✅',
    hint: 'Checkbox-style table for inspections.',
    html: `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
  <tr><td style="width:30px;text-align:center;padding:8px;border-bottom:1px solid #e5e7eb;">☐</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">Equipment verified</td></tr>
  <tr><td style="text-align:center;padding:8px;border-bottom:1px solid #e5e7eb;">☐</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">Operation tested</td></tr>
  <tr><td style="text-align:center;padding:8px;border-bottom:1px solid #e5e7eb;">☐</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">No visible damage</td></tr>
  <tr><td style="text-align:center;padding:8px;">☐</td><td style="padding:8px;">Customer notified of follow-up</td></tr>
</table>`,
  },

  // ---------- Signatures ----------
  {
    id: 'signature-pair',
    name: 'Dual signature block',
    category: 'Signature',
    icon: '✍️',
    hint: 'Customer + company signature lines side-by-side.',
    html: `<div style="display:flex;gap:32px;margin-top:36px;">
  <div style="flex:1;">
    <div style="border-bottom:1px solid #94a3b8;height:60px;margin-bottom:4px;"></div>
    <div style="font-size:11px;color:#475569;">Customer · {{customer.name}}</div>
    <div style="margin-top:8px;">[[signature:customer]]</div>
  </div>
  <div style="flex:1;">
    <div style="border-bottom:1px solid #94a3b8;height:60px;margin-bottom:4px;"></div>
    <div style="font-size:11px;color:#475569;">{{company.name}}</div>
    <div style="margin-top:8px;">[[signature:company]]</div>
  </div>
</div>`,
  },
  {
    id: 'signature-single',
    name: 'Single signature',
    category: 'Signature',
    icon: '🖋️',
    hint: 'One signature line — for technician sign-off.',
    html: `<div style="margin-top:32px;">
  <div style="border-bottom:1px solid #94a3b8;height:60px;margin-bottom:4px;"></div>
  <div style="font-size:11px;color:#475569;">Technician · {{technician.name}}</div>
  <div style="margin-top:8px;">[[signature:technician]]</div>
</div>`,
  },

  // ---------- Misc ----------
  {
    id: 'callout-box',
    name: 'Callout box',
    category: 'Misc',
    icon: '💬',
    hint: 'Colored box for "How to pay" / "Important notes" / etc.',
    html: `<div style="background:#f8fafc;border:1px solid var(--primary,#f59e0b);border-left:4px solid var(--primary,#f59e0b);border-radius:6px;padding:12px 14px;margin:16px 0;">
  <div style="font-size:10px;color:var(--accent,#0f172a);text-transform:uppercase;letter-spacing:0.08em;font-weight:700;margin-bottom:4px;">Heading</div>
  <div style="font-size:12px;line-height:1.6;">Your callout text here. Good for payment instructions, terms, important notes.</div>
</div>`,
  },
  {
    id: 'divider',
    name: 'Divider line',
    category: 'Misc',
    icon: '➖',
    hint: 'Horizontal rule between sections.',
    html: `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />`,
  },
  {
    id: 'footer-rule',
    name: 'Footer text',
    category: 'Misc',
    icon: '⤓',
    hint: 'Thin rule + centered footer line.',
    html: `<div style="border-top:1px solid #e5e7eb;margin-top:24px;padding-top:8px;font-size:11px;color:#64748b;text-align:center;">Thank you for your business · {{company.name}}</div>`,
  },
  {
    id: 'paid-stamp',
    name: '"PAID" stamp',
    category: 'Misc',
    icon: '✅',
    hint: 'Rotated green PAID badge for receipts.',
    html: `<div style="text-align:right;margin:8px 0;"><span style="display:inline-block;border:3px solid #10b981;color:#10b981;font-weight:800;font-size:18px;letter-spacing:0.15em;padding:6px 14px;transform:rotate(-4deg);border-radius:4px;">PAID</span></div>`,
  },
]

const CATEGORIES: Block['category'][] = ['Header', 'Layout', 'Table', 'Signature', 'Misc']

export function BlockLibrary({ onInsert }: { onInsert: (html: string) => void }) {
  const [filter, setFilter] = useState<Block['category'] | 'all'>('all')

  const visible = filter === 'all' ? BLOCKS : BLOCKS.filter((b) => b.category === filter)

  function handleDragStart(e: React.DragEvent<HTMLButtonElement>, block: Block) {
    // Both formats: text/html so contenteditable's native drop handler
    // inserts as rich content; text/plain as a fallback.
    e.dataTransfer.setData('text/html', block.html)
    e.dataTransfer.setData('text/plain', block.html)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-200 bg-white flex flex-wrap items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setFilter('all')}
          onMouseDown={(e) => e.preventDefault()}
          className={[
            'text-[10px] px-2 py-0.5 rounded border',
            filter === 'all'
              ? 'bg-amber-500 border-amber-500 text-white'
              : 'border-slate-200 text-slate-700 hover:bg-slate-50',
          ].join(' ')}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            onMouseDown={(e) => e.preventDefault()}
            className={[
              'text-[10px] px-2 py-0.5 rounded border',
              filter === c
                ? 'bg-amber-500 border-amber-500 text-white'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50',
            ].join(' ')}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="overflow-y-auto p-3 grid grid-cols-1 gap-2">
        <p className="text-[10px] text-slate-500 italic px-1">
          Click to insert at cursor, or drag onto the editor.
        </p>
        {visible.map((b) => (
          <button
            key={b.id}
            type="button"
            draggable
            onDragStart={(e) => handleDragStart(e, b)}
            onClick={() => onInsert(b.html)}
            // NOTE: don't preventDefault on mousedown — that kills the
            // browser's drag-init (mousedown → dragstart). Cursor
            // preservation for click-to-insert is handled by the
            // editor's saved-range mechanism instead.
            className="text-left bg-white border border-slate-200 rounded-md px-3 py-2 hover:border-amber-400 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-base">{b.icon}</span>
              <span className="font-medium text-xs text-slate-900">{b.name}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{b.hint}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
