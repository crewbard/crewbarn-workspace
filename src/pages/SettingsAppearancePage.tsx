import { useEffect, useState } from 'react'
import { useTheme, type AppTheme } from '@/hooks/useTheme'
import { CHROME_COLORS, chromeHex, isCustomChromeColor } from '@/lib/chromeColors'
import { ACCENT_COLORS, accentBase } from '@/lib/accentColors'
import { TEXT_SCALES, UI_FONTS, ensureUiFontLoaded, uiFontStack, type TextScale } from '@/lib/uiFonts'
import { SettingsSectionNav, settingsSectionFromHash, updateSettingsSectionHash } from '@/components/settings/SettingsSectionNav'

/**
 * Tool Shed → Appearance.
 *
 * A focused, adaptive redesign — three areas, all per-browser (localStorage)
 * and instant:
 *
 *   1. Layout — Top bar or Side bar. Two clean shells; each applies sensible
 *      density/width defaults and adapts down to a hamburger on small screens.
 *   2. Color  — the brand accent (flows through the whole app) and the
 *      navigation chrome color.
 *   3. Font   — typeface and reading size.
 *
 * Defaults: Top bar layout, Amber accent, Navy chrome, Inter, Comfortable.
 */

type AppearanceSection = 'layout' | 'color' | 'font'

const appearanceSections = [
  { id: 'layout', label: 'Layout', description: 'Top bar, side bar, or rail', group: 'Workspace' },
  { id: 'color', label: 'Color', description: 'Brand accent and navigation color', group: 'Branding' },
  { id: 'font', label: 'Font', description: 'Typeface and text size', group: 'Branding' },
] satisfies Array<{ id: AppearanceSection; label: string; description: string; group: string }>

interface LayoutOption {
  value: 'top' | 'side' | 'rail'
  theme: AppTheme
  name: string
  blurb: string
}

const LAYOUTS: LayoutOption[] = [
  {
    value: 'top',
    theme: 'classic',
    name: 'Top bar',
    blurb: 'Horizontal navigation across the top. Content-forward and roomy — great on laptops and wide screens.',
  },
  {
    value: 'side',
    theme: 'pro',
    name: 'Side bar',
    blurb: 'A vertical navigation rail on the left with a slim action bar on top. Built for dispatch and multi-tasking.',
  },
  {
    value: 'rail',
    theme: 'rail',
    name: 'Rail',
    blurb:
      'Five headings on the edge — Work, Comms, Money, Files, Setup — each opening a panel of what sits under it. The only layout that reaches every part of the app without burying anything.',
  },
]

export function SettingsAppearancePage() {
  const {
    theme,
    setTheme,
    chromeColor,
    setChromeColor,
    accentColor,
    setAccentColor,
    uiFont,
    setUiFont,
    textScale,
    setTextScale,
    setDensity,
    setPageWidth,
  } = useTheme()
  const chrome = chromeHex(chromeColor)
  const customColor = isCustomChromeColor(chromeColor) ? chromeColor : chrome
  const contrastOk = contrastRatio(chrome, '#ffffff') >= 4.5
  const activeLayout: 'top' | 'side' | 'rail' =
    theme === 'pro' ? 'side' : theme === 'rail' ? 'rail' : 'top'
  const [activeSection, setActiveSection] = useState<AppearanceSection>(() => settingsSectionFromHash(appearanceSections, 'layout'))

  // Preload the typeface options while the Font section is open so each font
  // card previews in its own face (not just when it's the active font).
  useEffect(() => {
    if (activeSection === 'font') UI_FONTS.forEach((f) => ensureUiFontLoaded(f.id))
  }, [activeSection])

  function applyLayout(option: LayoutOption) {
    setTheme(option.theme)
    // Sensible defaults per shell; each user's list-view choice is left alone.
    if (option.value === 'top') {
      setDensity('comfortable')
      setPageWidth('centered')
    } else {
      setDensity('comfortable')
      setPageWidth('wide')
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">Appearance</h1>
        <p className="mt-1 text-sm text-slate-600">
          Choose your layout, colors, and type. These settings apply to this
          browser and take effect immediately.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <SettingsSectionNav
          active={activeSection}
          items={appearanceSections}
          onSelect={(section) => {
            setActiveSection(section)
            updateSettingsSectionHash(section)
          }}
          title="Appearance"
        />
        <main className="min-w-0">

          {/* Layout */}
          {activeSection === 'layout' && (
            <>
              <h2 className="mb-1 text-sm font-semibold text-navy-900">Layout</h2>
              <p className="mb-3 text-xs text-slate-600">
                Both layouts adapt to the screen — on phones and narrow windows
                they collapse to a slide-out menu.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {LAYOUTS.map((opt) => {
                  const active = activeLayout === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => applyLayout(opt)}
                      aria-pressed={active}
                      className={[
                        'rounded-xl border-2 p-4 text-left transition-colors focus:outline-none',
                        active ? 'border-amber-500 bg-amber-50/60' : 'border-slate-200 bg-white hover:border-slate-300',
                      ].join(' ')}
                    >
                      <LayoutPreview kind={opt.value} chrome={chrome} />
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-navy-900">{opt.name}</span>
                        {active ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                            <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
                              <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Active
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-400">Click to use</span>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{opt.blurb}</p>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Color */}
          {activeSection === 'color' && (
            <>
              <h2 className="mb-1 text-sm font-semibold text-navy-900">Color</h2>
              <p className="mb-4 max-w-2xl text-xs text-slate-600">
                The brand accent flows through the whole app — buttons, active
                nav, links, focus rings, and badges. The navigation color tints
                the top bar and side bar; the page area stays light.
              </p>

              {/* Brand accent */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-navy-900">Brand accent</h3>
                <div className="mt-3 flex flex-wrap gap-4">
                  {ACCENT_COLORS.map((a) => {
                    const base = accentBase(a.id)
                    const active = accentColor === a.id
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setAccentColor(a.id)}
                        title={a.name}
                        aria-pressed={active}
                        className="group flex flex-col items-center gap-1.5 focus:outline-none"
                      >
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-full transition-transform group-hover:scale-105"
                          style={{ backgroundColor: base, boxShadow: active ? `0 0 0 2px #fff, 0 0 0 4px ${base}` : undefined }}
                        >
                          {active && (
                            <svg viewBox="0 0 16 16" fill="none" className="h-5 w-5 text-white">
                              <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span className={active ? 'text-[11px] font-semibold text-navy-900' : 'text-[11px] text-slate-500'}>{a.name}</span>
                      </button>
                    )
                  })}
                </div>
                {/* accent sample */}
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                  <button type="button" className="rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-amber-600">Primary button</button>
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">On site</span>
                  <a className="text-sm font-semibold text-amber-700 underline decoration-amber-300 underline-offset-2" href="#color" onClick={(e) => e.preventDefault()}>A link</a>
                </div>
              </div>

              {/* Navigation color */}
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-navy-900">Navigation color</h3>
                <p className="mt-0.5 text-xs text-slate-500">Tints the top bar and side bar. Darker colors keep the white nav text readable.</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {CHROME_COLORS.map((c) => {
                    const active = chromeColor === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setChromeColor(c.id)}
                        title={c.name}
                        aria-pressed={active}
                        className="group flex flex-col items-center gap-1.5 focus:outline-none"
                      >
                        <span
                          className={[
                            'flex h-11 w-11 items-center justify-center rounded-full border transition-all',
                            active ? 'border-transparent ring-2 ring-amber-500 ring-offset-2' : 'border-black/10 group-hover:scale-105',
                          ].join(' ')}
                          style={{ backgroundColor: c.hex }}
                        >
                          {active && (
                            <svg viewBox="0 0 16 16" fill="none" className="h-5 w-5 text-white">
                              <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span className={active ? 'text-[11px] font-semibold text-navy-900' : 'text-[11px] text-slate-500'}>{c.name}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <label className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-full border border-slate-300 shadow-sm">
                      <input
                        type="color"
                        value={customColor}
                        onChange={(e) => setChromeColor(e.target.value.toUpperCase())}
                        className="absolute inset-[-8px] h-16 w-16 cursor-pointer border-0 p-0"
                        aria-label="Choose custom navigation color"
                      />
                    </label>
                    <input
                      type="text"
                      value={customColor.toUpperCase()}
                      onChange={(e) => {
                        const value = e.target.value.trim()
                        if (/^#[0-9a-f]{6}$/i.test(value)) setChromeColor(value.toUpperCase())
                      }}
                      placeholder="#0F1A2E"
                      className="w-28 rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setChromeColor('navy')}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Reset
                    </button>
                  </div>
                  <span className={`rounded-md border px-3 py-2 text-xs ${contrastOk ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                    {contrastOk ? 'Good contrast for nav text.' : 'May be hard to read — pick a darker shade.'}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Font */}
          {activeSection === 'font' && (
            <>
              <h2 className="mb-1 text-sm font-semibold text-navy-900">Font</h2>
              <p className="mb-4 max-w-2xl text-xs text-slate-600">
                The typeface and reading size used throughout the app, including
                navigation, forms, cards, dialogs, and notes. Changes apply
                immediately in this browser.
              </p>
              <div className="flex flex-wrap items-start gap-6">
                <div className="min-w-0 space-y-4" style={{ flex: '100 1 360px' }}>
                  {/* Typeface */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-navy-900">Typeface</h3>
                    <div className="mt-3 grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                      {UI_FONTS.map((f) => {
                        const active = uiFont === f.id
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setUiFont(f.id)}
                            aria-pressed={active}
                            className={[
                              'rounded-lg border p-3 text-left transition-colors',
                              active ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white hover:border-slate-300',
                            ].join(' ')}
                          >
                            <div className="text-2xl leading-none text-navy-900" style={{ fontFamily: uiFontStack(f.id) }}>Aa</div>
                            <div className="mt-2 text-sm font-semibold text-navy-900" style={{ fontFamily: uiFontStack(f.id) }}>{f.name}</div>
                            <div className="mt-0.5 text-[11px] text-slate-500">{f.note}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Text size */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-navy-900">Text size</h3>
                    <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                      {TEXT_SCALES.map((s) => {
                        const active = textScale === s.id
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setTextScale(s.id as TextScale)}
                            aria-pressed={active}
                            className={[
                              'rounded-md px-2 py-1.5 text-xs font-semibold transition-colors',
                              active ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
                            ].join(' ')}
                          >
                            {s.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Live preview */}
                <div className="lg:sticky lg:top-4" style={{ flex: '60 1 300px' }}>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-navy-900">Live preview</h3>
                    <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                      <div className="flex">
                        <div className="w-16 p-2" style={{ backgroundColor: 'var(--chrome-bg)' }}>
                          <div className="mb-3 text-sm font-black text-white">C<span className="text-amber-400">B</span></div>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="h-4 w-0.5 rounded bg-amber-500" />
                              <span className="h-1.5 flex-1 rounded bg-white/70" />
                            </div>
                            <div className="h-1.5 w-3/4 rounded bg-white/25" />
                            <div className="h-1.5 w-3/4 rounded bg-white/25" />
                          </div>
                        </div>
                        <div className="flex-1 bg-slate-50 p-3">
                          <div className="flex gap-3 border-b border-slate-200 pb-1 text-[11px] font-semibold">
                            <span className="border-b-2 border-amber-500 pb-1 text-navy-900">Jobs</span>
                            <span className="text-slate-400">Customers</span>
                          </div>
                          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[10px] text-slate-500">WO-1042</span>
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">On site</span>
                            </div>
                            <div className="mt-1.5 text-xs font-semibold text-slate-900">Rekey — 3 locks</div>
                            <button type="button" className="mt-2 rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white">Start job</button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600" style={{ fontFamily: 'var(--ui-font)', fontSize: 'var(--ui-base)' }}>
                      The quick brown fox jumps over the lazy dog. Your crew reads
                      this size all day — schedules, notes, and invoices.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a)
  const l2 = relativeLuminance(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

function relativeLuminance(hex: string): number {
  const m = hex.match(/^#?([0-9a-f]{6})$/i)
  if (!m) return 0
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
  const [rs, gs, bs] = [r, g, b].map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/** Tiny CSS wireframe so the layout choice is visual, not just words. */
function LayoutPreview({ kind, chrome }: { kind: 'top' | 'side' | 'rail'; chrome: string }) {
  // Rail: a narrow coloured edge of category marks, then a light panel of what
  // is under the chosen one, then the page. Three bands, which is the whole
  // point of the layout.
  if (kind === 'rail') {
    return (
      <div className="flex aspect-[16/10] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
        <div className="flex w-[15%] flex-col items-center gap-1 py-1.5" style={{ backgroundColor: chrome }}>
          <div className="h-1.5 w-1.5 rounded-[2px] bg-amber-400" />
          <div className="h-1.5 w-1.5 rounded-[2px] bg-white/60" />
          <div className="h-1.5 w-1.5 rounded-[2px] bg-white/25" />
          <div className="h-1.5 w-1.5 rounded-[2px] bg-white/25" />
          <div className="h-1.5 w-1.5 rounded-[2px] bg-white/25" />
        </div>
        <div className="w-[22%] space-y-1 border-r border-slate-200 bg-white p-1.5">
          <div className="h-1 w-2/3 rounded bg-amber-300" />
          <div className="h-1 w-full rounded bg-slate-200" />
          <div className="h-1 w-full rounded bg-slate-200" />
          <div className="h-1 w-3/4 rounded bg-slate-200" />
        </div>
        <div className="flex flex-1 flex-col">
          <div className="flex h-3 items-center justify-end gap-1 px-1.5" style={{ backgroundColor: chrome }}>
            <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
          </div>
          <div className="flex-1 space-y-1 p-1.5">
            <div className="h-1.5 w-1/2 rounded bg-slate-300" />
            <div className="h-6 w-full rounded border border-slate-200 bg-white" />
          </div>
        </div>
      </div>
    )
  }
  if (kind === 'side') {
    return (
      <div className="flex aspect-[16/10] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
        <div className="w-1/4 space-y-1 p-1.5" style={{ backgroundColor: chrome }}>
          <div className="h-1.5 w-3/4 rounded bg-amber-400/80" />
          <div className="h-1 w-full rounded bg-white/20" />
          <div className="h-1 w-full rounded bg-white/20" />
          <div className="h-1 w-2/3 rounded bg-white/20" />
        </div>
        <div className="flex flex-1 flex-col">
          <div className="flex h-3 items-center justify-end gap-1 px-1.5" style={{ backgroundColor: chrome }}>
            <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
          </div>
          <div className="flex-1 space-y-1 p-1.5">
            <div className="h-1.5 w-1/2 rounded bg-slate-300" />
            <div className="h-6 w-full rounded border border-slate-200 bg-white" />
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="flex aspect-[16/10] w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      <div className="flex h-3 items-center gap-1 px-1.5" style={{ backgroundColor: chrome }}>
        <div className="h-1.5 w-6 rounded bg-amber-400/90" />
        <div className="h-1 w-3 rounded bg-white/30" />
        <div className="h-1 w-3 rounded bg-white/30" />
        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-400" />
      </div>
      <div className="flex-1 space-y-1 p-1.5">
        <div className="h-1.5 w-1/2 rounded bg-slate-300" />
        <div className="h-6 w-full rounded border border-slate-200 bg-white" />
      </div>
    </div>
  )
}

export default SettingsAppearancePage
