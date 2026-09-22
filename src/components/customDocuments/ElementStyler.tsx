import { useEffect, useState } from 'react'

/**
 * Element inspector for the template editor canvas. Tracks whatever
 * element the user's caret is currently in (table, row, cell, div,
 * paragraph, heading…) and exposes inline-style controls for the most
 * common visual properties.
 *
 * Implementation
 * - Reads the current selection from the global selection via the
 *   document `selectionchange` event. Looks up the nearest block-level
 *   ancestor inside .tpl-canvas (the contentEditable surface).
 * - Mutations go directly to `el.style.*` for live preview. After each
 *   change we dispatch an `input` event on the canvas so the editor's
 *   React state syncs (programmatic style mutations don't fire `input`).
 *
 * Why this approach (vs lifting selection state up to TemplateEditor)
 * - Decoupled: this component doesn't need a ref to the VisualEditor.
 *   It finds the canvas via `.tpl-canvas` and the selection via the
 *   Selection API. Less prop wiring, no useImperativeHandle gymnastics.
 */

const TAG_LABEL: Record<string, string> = {
  TABLE: 'Table',
  THEAD: 'Table header row group',
  TBODY: 'Table body',
  TR: 'Table row',
  TH: 'Table heading cell',
  TD: 'Table cell',
  DIV: 'Container',
  P: 'Paragraph',
  H1: 'Heading 1',
  H2: 'Heading 2',
  H3: 'Heading 3',
  H4: 'Heading 4',
  UL: 'Bulleted list',
  OL: 'Numbered list',
  LI: 'List item',
  IMG: 'Image',
  A: 'Link',
  STRONG: 'Bold text',
  EM: 'Italic text',
  SPAN: 'Inline text',
}

const STYLEABLE_TAGS = new Set(Object.keys(TAG_LABEL))

export function ElementStyler() {
  const [el, setEl] = useState<HTMLElement | null>(null)
  // Bumped on every change so the controls below re-read the latest
  // computed style after a mutation.
  const [tick, setTick] = useState(0)

  useEffect(() => {
    function onSelectionChange() {
      const canvas = document.querySelector<HTMLElement>('.tpl-canvas')
      if (!canvas) {
        setEl(null)
        return
      }
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) {
        setEl(null)
        return
      }
      const range = sel.getRangeAt(0)
      const startNode = range.startContainer
      if (!canvas.contains(startNode)) {
        // Selection moved out of the editor — keep the last selection
        // sticky so users can fiddle with sidebar controls without
        // losing what they were styling.
        return
      }
      // Walk up to the nearest styleable element. Text nodes don't have
      // styles, so we always need to ascend at least once.
      let node: Node | null = startNode
      while (node && node !== canvas) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tag = (node as HTMLElement).tagName
          if (STYLEABLE_TAGS.has(tag)) {
            setEl(node as HTMLElement)
            return
          }
        }
        node = node.parentNode
      }
      setEl(null)
    }
    document.addEventListener('selectionchange', onSelectionChange)
    onSelectionChange()
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [])

  function applyStyle(prop: keyof CSSStyleDeclaration, value: string) {
    if (!el) return
    // @ts-expect-error: indexed style assignment is fine at runtime
    el.style[prop] = value
    // Tell the editor's React state to re-read innerHTML — programmatic
    // style mutations don't fire `input` natively.
    el.dispatchEvent(new Event('input', { bubbles: true }))
    setTick((t) => t + 1)
  }

  function clearStyle(prop: keyof CSSStyleDeclaration) {
    if (!el) return
    // @ts-expect-error: empty string clears a CSS property
    el.style[prop] = ''
    el.dispatchEvent(new Event('input', { bubbles: true }))
    setTick((t) => t + 1)
  }

  if (!el) {
    return (
      <div className="p-4 text-xs text-slate-500 italic leading-relaxed">
        Click any element in the editor (a table, row, cell, heading,
        paragraph, etc.) to style it. The controls below will appear once
        you've placed your cursor inside something.
      </div>
    )
  }

  const tagLabel = TAG_LABEL[el.tagName] ?? el.tagName
  const computed = window.getComputedStyle(el)
  // Inline style takes priority — that's what the user actually set;
  // computed value is the resolved cascade. We need to distinguish
  // "transparent/none" from a real value so the picker doesn't lie.
  const bgIsSet = !!el.style.backgroundColor && !isTransparent(el.style.backgroundColor)
  const fgIsSet = !!el.style.color && !isTransparent(el.style.color)
  const borderIsSet = !!el.style.borderColor && !isTransparent(el.style.borderColor)
  const bg = el.style.backgroundColor || computed.backgroundColor
  const fg = el.style.color || computed.color
  const border = el.style.borderColor || computed.borderColor

  // Walk up to build a breadcrumb of styleable ancestors. Lets the
  // user hop from a deep child up to a parent that's actually painting
  // a background (e.g. inside a brand-band, the click lands on an
  // inner wrapper; the user wants the brand-band itself).
  const canvas = document.querySelector<HTMLElement>('.tpl-canvas')
  const chain: HTMLElement[] = []
  let walker: HTMLElement | null = el
  while (walker && walker !== canvas) {
    if (STYLEABLE_TAGS.has(walker.tagName)) chain.push(walker)
    walker = walker.parentElement
  }

  // void tick read so the dependency on tick takes effect
  void tick

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-4 text-sm">
      <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
        <div className="text-[10px] uppercase tracking-wide text-amber-900 font-semibold">
          Selected
        </div>
        <div className="text-sm font-medium text-amber-900">{tagLabel}</div>
        <div className="text-[10px] font-mono text-amber-700 truncate">
          &lt;{el.tagName.toLowerCase()}{el.className ? ` class="${el.className}"` : ''}&gt;
        </div>
      </div>

      {chain.length > 1 && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">
            Click a parent to select it
          </div>
          <div className="flex flex-wrap items-center gap-1 text-[11px]">
            {[...chain].reverse().map((node, i, arr) => {
              const isLast = i === arr.length - 1
              const isCurrent = node === el
              const label = TAG_LABEL[node.tagName] ?? node.tagName.toLowerCase()
              return (
                <span key={i} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEl(node)}
                    className={[
                      'px-1.5 py-0.5 rounded border',
                      isCurrent
                        ? 'bg-amber-500 border-amber-500 text-white font-semibold'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-amber-400',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                  {!isLast && <span className="text-slate-300">›</span>}
                </span>
              )
            })}
          </div>
        </div>
      )}

      <Section title="Colors">
        <ColorRow
          label="Background"
          value={cssColorToHex(bg)}
          hasValue={bgIsSet}
          onChange={(v) => applyStyle('backgroundColor', v)}
          onClear={() => clearStyle('backgroundColor')}
        />
        <ColorRow
          label="Text"
          value={cssColorToHex(fg)}
          hasValue={fgIsSet}
          onChange={(v) => applyStyle('color', v)}
          onClear={() => clearStyle('color')}
        />
        <ColorRow
          label="Border"
          value={cssColorToHex(border)}
          hasValue={borderIsSet}
          onChange={(v) => applyStyle('borderColor', v)}
          onClear={() => clearStyle('borderColor')}
        />
      </Section>

      <Section title="Border">
        <div className="grid grid-cols-3 gap-2">
          {([
            { label: 'None', value: '' },
            { label: 'Thin', value: '1px solid' },
            { label: 'Bold', value: '2px solid' },
          ] as const).map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => applyStyle('borderStyle', opt.value || '')}
              className="text-[11px] px-2 py-1.5 rounded border border-slate-300 hover:bg-slate-50 hover:border-amber-400"
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {([
            { label: 'Square', value: '0' },
            { label: 'Soft', value: '6px' },
            { label: 'Round', value: '12px' },
          ] as const).map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => applyStyle('borderRadius', opt.value)}
              className="text-[11px] px-2 py-1.5 rounded border border-slate-300 hover:bg-slate-50 hover:border-amber-400"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Padding">
        <div className="grid grid-cols-4 gap-2">
          {([
            { label: '0', value: '0' },
            { label: 'S', value: '6px' },
            { label: 'M', value: '12px' },
            { label: 'L', value: '20px' },
          ] as const).map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => applyStyle('padding', opt.value)}
              className="text-[11px] px-2 py-1.5 rounded border border-slate-300 hover:bg-slate-50 hover:border-amber-400"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Section>

      {(el.tagName === 'P' ||
        el.tagName === 'DIV' ||
        el.tagName === 'TD' ||
        el.tagName === 'TH' ||
        el.tagName.startsWith('H')) && (
        <Section title="Text align">
          <div className="grid grid-cols-3 gap-2">
            {(['left', 'center', 'right'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => applyStyle('textAlign', opt)}
                className="text-[11px] px-2 py-1.5 rounded border border-slate-300 hover:bg-slate-50 hover:border-amber-400 capitalize"
              >
                {opt}
              </button>
            ))}
          </div>
        </Section>
      )}

      <p className="text-[10px] text-slate-500 italic px-1">
        Changes are inline styles — they save with the template body.
        Use the source view (&lt;/&gt; HTML) to fine-tune anything
        beyond what these controls cover.
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2">
        {title}
      </div>
      {children}
    </div>
  )
}

function ColorRow({
  label,
  value,
  hasValue,
  onChange,
  onClear,
}: {
  label: string
  value: string
  /**
   * False when the element has no inline color set for this property
   * (so 'value' is just a fallback computed value, often transparent
   * displayed as #000000). UI shows "(not set)" instead so the user
   * doesn't think the current color IS black.
   */
  hasValue: boolean
  onChange: (v: string) => void
  onClear: () => void
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <label className="text-[11px] text-slate-600 w-20 shrink-0">{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-8 border border-slate-200 rounded cursor-pointer"
      />
      <span className="text-[10px] font-mono text-slate-500 flex-1 truncate">
        {hasValue ? value : <span className="italic text-slate-400">not set — picker adds one</span>}
      </span>
      <button
        type="button"
        onClick={onClear}
        disabled={!hasValue}
        title="Clear (revert to template default)"
        className="text-[10px] px-1.5 py-1 rounded text-slate-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ✕
      </button>
    </div>
  )
}

function isTransparent(color: string): boolean {
  if (!color) return true
  const t = color.trim().toLowerCase()
  return t === 'transparent' || t === 'rgba(0, 0, 0, 0)' || t === 'rgba(0,0,0,0)'
}

/**
 * Convert a CSS color string (rgb / rgba / hex / named) to a #rrggbb
 * hex value for the native <input type="color">. Returns '#000000'
 * for transparent / unparseable values.
 */
function cssColorToHex(input: string): string {
  if (!input) return '#000000'
  const trimmed = input.trim().toLowerCase()
  if (trimmed === 'transparent' || trimmed === 'rgba(0, 0, 0, 0)') return '#000000'
  // Already hex
  if (trimmed.startsWith('#')) {
    if (trimmed.length === 7) return trimmed
    if (trimmed.length === 4) {
      // #rgb → #rrggbb
      const r = trimmed[1]
      const g = trimmed[2]
      const b = trimmed[3]
      return `#${r}${r}${g}${g}${b}${b}`
    }
  }
  // rgb(r, g, b) or rgba(r, g, b, a)
  const m = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (m) {
    const toHex = (n: string) => Number(n).toString(16).padStart(2, '0')
    return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`
  }
  return '#000000'
}
