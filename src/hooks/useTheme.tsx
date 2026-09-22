import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_CHROME, chromeHex } from '@/lib/chromeColors'
import { ACCENT_COLORS, DEFAULT_ACCENT, accentVars } from '@/lib/accentColors'
import {
  DEFAULT_TEXT_SCALE,
  DEFAULT_UI_FONT,
  TEXT_SCALES,
  UI_FONTS,
  ensureUiFontLoaded,
  textScalePx,
  uiFontStack,
  type TextScale,
} from '@/lib/uiFonts'

/**
 * App-wide layout theme.
 *
 *   - 'classic' — Top bar shell: the top-nav layout (TopBar + SubNav). Default.
 *   - 'rail' — Category rail: five headings on the edge, their contents in a
 *     panel beside it. The only shell that can hold the whole app without
 *     demoting anything — see lib/navTaxonomy.
 *   - 'pro' — Side bar shell: left vertical nav + a slim action bar on top,
 *     framing a light page body.
 *
 * (Earlier builds had extra variants — compact/minimal/command/field/studio —
 * now collapsed into these two; readTheme migrates any saved value.)
 *
 * Plus a `chromeColor` — the color of the navigation chrome (top bar in
 * both themes, plus the pro sidebar). The page body always stays light;
 * only the chrome is tinted.
 *
 * Both persist in localStorage (per-browser, not per-tenant) so the choice
 * sticks across reloads and is instant (no round-trip). Selectable from
 * Tool Shed → General → Appearance.
 */
export type AppTheme = 'classic' | 'pro' | 'rail'
export type AppDensity = 'comfortable' | 'compact' | 'dense'
export type AppPageWidth = 'centered' | 'wide' | 'full'
export type JobViewPreference = 'workflow' | 'cards' | 'files' | 'compact'
export type CustomerViewPreference = 'relationship' | 'cards' | 'files' | 'compact'
export type EstimateViewPreference = 'workflow' | 'cards' | 'files' | 'compact'
/** How the "files" folder view is laid out (Jobs / Customers / Estimates). */
export type FolderLayout = 'cabinet' | 'tree' | 'accordion'

const THEME_KEY = 'crewbarn_theme'
const CHROME_KEY = 'crewbarn_chrome'
const ACCENT_KEY = 'crewbarn_accent'
const UI_FONT_KEY = 'crewbarn_ui_font'
const TEXT_SCALE_KEY = 'crewbarn_text_scale'
const DENSITY_KEY = 'crewbarn_density'
const PAGE_WIDTH_KEY = 'crewbarn_page_width'
const JOB_VIEW_KEY = 'crewbarn_job_view'
const CUSTOMER_VIEW_KEY = 'crewbarn_customer_view'
const ESTIMATE_VIEW_KEY = 'crewbarn_estimate_view'
const FOLDER_LAYOUT_KEY = 'crewbarn_folder_layout'

interface ThemeContextValue {
  theme: AppTheme
  setTheme: (t: AppTheme) => void
  chromeColor: string
  setChromeColor: (id: string) => void
  accentColor: string
  setAccentColor: (id: string) => void
  uiFont: string
  setUiFont: (id: string) => void
  textScale: TextScale
  setTextScale: (scale: TextScale) => void
  density: AppDensity
  setDensity: (density: AppDensity) => void
  pageWidth: AppPageWidth
  setPageWidth: (width: AppPageWidth) => void
  jobView: JobViewPreference
  setJobView: (view: JobViewPreference) => void
  customerView: CustomerViewPreference
  setCustomerView: (view: CustomerViewPreference) => void
  estimateView: EstimateViewPreference
  setEstimateView: (view: EstimateViewPreference) => void
  folderLayout: FolderLayout
  setFolderLayout: (layout: FolderLayout) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function readTheme(): AppTheme {
  if (typeof window === 'undefined') return 'classic'
  try {
    const value = window.localStorage.getItem(THEME_KEY)
    // The app has two shells now: Top bar (classic) and Side bar (pro). Migrate
    // the retired sidebar variants (command/field/studio) to 'pro'; everything
    // else — including the old compact/minimal top-bar variants — to 'classic'.
    if (value === 'rail') return 'rail'
    return value === 'pro' || value === 'command' || value === 'field' || value === 'studio'
      ? 'pro'
      : 'classic'
  } catch {
    return 'classic'
  }
}

function readChrome(): string {
  if (typeof window === 'undefined') return DEFAULT_CHROME
  try {
    return window.localStorage.getItem(CHROME_KEY) || DEFAULT_CHROME
  } catch {
    return DEFAULT_CHROME
  }
}

function readAccent(): string {
  if (typeof window === 'undefined') return DEFAULT_ACCENT
  try {
    const value = window.localStorage.getItem(ACCENT_KEY)
    return value && ACCENT_COLORS.some((a) => a.id === value) ? value : DEFAULT_ACCENT
  } catch {
    return DEFAULT_ACCENT
  }
}

function readUiFont(): string {
  if (typeof window === 'undefined') return DEFAULT_UI_FONT
  try {
    const value = window.localStorage.getItem(UI_FONT_KEY)
    return value && UI_FONTS.some((f) => f.id === value) ? value : DEFAULT_UI_FONT
  } catch {
    return DEFAULT_UI_FONT
  }
}

function readTextScale(): TextScale {
  if (typeof window === 'undefined') return DEFAULT_TEXT_SCALE
  try {
    const value = window.localStorage.getItem(TEXT_SCALE_KEY)
    return TEXT_SCALES.some((s) => s.id === value) ? (value as TextScale) : DEFAULT_TEXT_SCALE
  } catch {
    return DEFAULT_TEXT_SCALE
  }
}

function readDensity(): AppDensity {
  if (typeof window === 'undefined') return 'comfortable'
  try {
    const value = window.localStorage.getItem(DENSITY_KEY)
    return value === 'compact' || value === 'dense' ? value : 'comfortable'
  } catch {
    return 'comfortable'
  }
}

function readPageWidth(): AppPageWidth {
  if (typeof window === 'undefined') return 'centered'
  try {
    const value = window.localStorage.getItem(PAGE_WIDTH_KEY)
    return value === 'wide' || value === 'full' ? value : 'centered'
  } catch {
    return 'centered'
  }
}

function readJobView(): JobViewPreference {
  // Default to the folder ("files") redesign so it shows on every device, not
  // just the one where it was explicitly picked. 'workflow' (the legacy list)
  // is no longer a stored value — anything unrecognized falls to 'files'.
  if (typeof window === 'undefined') return 'files'
  try {
    const value = window.localStorage.getItem(JOB_VIEW_KEY)
    return value === 'cards' || value === 'files' || value === 'compact' ? value : 'files'
  } catch {
    return 'files'
  }
}

function readCustomerView(): CustomerViewPreference {
  // Default to the folder ("files") redesign everywhere (see readJobView).
  if (typeof window === 'undefined') return 'files'
  try {
    const value = window.localStorage.getItem(CUSTOMER_VIEW_KEY)
    return value === 'cards' || value === 'files' || value === 'compact' ? value : 'files'
  } catch {
    return 'files'
  }
}

function readEstimateView(): EstimateViewPreference {
  // Default to the folder ("files") redesign everywhere (see readJobView).
  if (typeof window === 'undefined') return 'files'
  try {
    const value = window.localStorage.getItem(ESTIMATE_VIEW_KEY)
    return value === 'cards' || value === 'files' || value === 'compact' ? value : 'files'
  } catch {
    return 'files'
  }
}

function readFolderLayout(): FolderLayout {
  if (typeof window === 'undefined') return 'cabinet'
  try {
    const value = window.localStorage.getItem(FOLDER_LAYOUT_KEY)
    return value === 'tree' || value === 'accordion' ? value : 'cabinet'
  } catch {
    return 'cabinet'
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(readTheme)
  const [chromeColor, setChromeColorState] = useState<string>(readChrome)
  const [accentColor, setAccentColorState] = useState<string>(readAccent)
  const [uiFont, setUiFontState] = useState<string>(readUiFont)
  const [textScale, setTextScaleState] = useState<TextScale>(readTextScale)
  const [density, setDensityState] = useState<AppDensity>(readDensity)
  const [pageWidth, setPageWidthState] = useState<AppPageWidth>(readPageWidth)
  const [jobView, setJobViewState] = useState<JobViewPreference>(readJobView)
  const [customerView, setCustomerViewState] = useState<CustomerViewPreference>(readCustomerView)
  const [estimateView, setEstimateViewState] = useState<EstimateViewPreference>(readEstimateView)
  const [folderLayout, setFolderLayoutState] = useState<FolderLayout>(readFolderLayout)

  const setTheme = (t: AppTheme) => {
    setThemeState(t)
    try {
      window.localStorage.setItem(THEME_KEY, t)
    } catch {
      /* private mode / quota — non-fatal, state still updates in-memory */
    }
  }

  const setChromeColor = (id: string) => {
    setChromeColorState(id)
    try {
      window.localStorage.setItem(CHROME_KEY, id)
    } catch {
      /* non-fatal */
    }
  }

  const setAccentColor = (id: string) => {
    setAccentColorState(id)
    try {
      window.localStorage.setItem(ACCENT_KEY, id)
    } catch {
      /* non-fatal */
    }
  }

  const setUiFont = (id: string) => {
    setUiFontState(id)
    try {
      window.localStorage.setItem(UI_FONT_KEY, id)
    } catch {
      /* non-fatal */
    }
  }

  const setTextScale = (scale: TextScale) => {
    setTextScaleState(scale)
    try {
      window.localStorage.setItem(TEXT_SCALE_KEY, scale)
    } catch {
      /* non-fatal */
    }
  }

  const setDensity = (value: AppDensity) => {
    setDensityState(value)
    try {
      window.localStorage.setItem(DENSITY_KEY, value)
    } catch {
      /* non-fatal */
    }
  }

  const setPageWidth = (value: AppPageWidth) => {
    setPageWidthState(value)
    try {
      window.localStorage.setItem(PAGE_WIDTH_KEY, value)
    } catch {
      /* non-fatal */
    }
  }

  const setJobView = (value: JobViewPreference) => {
    setJobViewState(value)
    try {
      window.localStorage.setItem(JOB_VIEW_KEY, value)
      window.localStorage.setItem('crewbarn:job-filing-view', String(value === 'files'))
    } catch {
      /* non-fatal */
    }
  }

  const setCustomerView = (value: CustomerViewPreference) => {
    setCustomerViewState(value)
    try {
      window.localStorage.setItem(CUSTOMER_VIEW_KEY, value)
      window.localStorage.setItem('crewbarn:customer-filing-view', String(value === 'files'))
    } catch {
      /* non-fatal */
    }
  }

  const setEstimateView = (value: EstimateViewPreference) => {
    setEstimateViewState(value)
    try {
      window.localStorage.setItem(ESTIMATE_VIEW_KEY, value)
      window.localStorage.setItem('crewbarn:estimate-filing-view', String(value === 'files'))
    } catch {
      /* non-fatal */
    }
  }

  const setFolderLayout = (value: FolderLayout) => {
    setFolderLayoutState(value)
    try {
      window.localStorage.setItem(FOLDER_LAYOUT_KEY, value)
    } catch {
      /* non-fatal */
    }
  }

  // Mirror onto <html data-theme> for any CSS that wants to hook the theme.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useLayoutEffect(() => {
    document.documentElement.dataset.density = density
  }, [density])

  useLayoutEffect(() => {
    document.documentElement.dataset.pageWidth = pageWidth
  }, [pageWidth])

  // Write the chrome surface color as a CSS var the chrome reads via
  // bg-[var(--chrome-bg)]. index.css seeds a default so there's no flash.
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--chrome-bg', chromeHex(chromeColor))
  }, [chromeColor])

  // Accent — rewrite the whole --accent-* ramp on <html>. Every amber-* utility
  // is remapped onto these in index.css, so this recolors the app app-wide.
  useLayoutEffect(() => {
    const root = document.documentElement
    for (const [name, value] of Object.entries(accentVars(accentColor))) {
      root.style.setProperty(name, value)
    }
    root.dataset.accent = accentColor
  }, [accentColor])

  // Typeface + reading size — applied to <body> via index.css. Webfont options
  // (Public Sans / Source Sans 3) are fetched on demand, only when chosen.
  useLayoutEffect(() => {
    ensureUiFontLoaded(uiFont)
    document.documentElement.style.setProperty('--ui-font', uiFontStack(uiFont))
  }, [uiFont])

  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--ui-base', textScalePx(textScale))
  }, [textScale])

  // Cross-tab sync — flipping theme or color in one tab updates the others.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === THEME_KEY) setThemeState(readTheme())
      if (e.key === CHROME_KEY) setChromeColorState(readChrome())
      if (e.key === ACCENT_KEY) setAccentColorState(readAccent())
      if (e.key === UI_FONT_KEY) setUiFontState(readUiFont())
      if (e.key === TEXT_SCALE_KEY) setTextScaleState(readTextScale())
      if (e.key === DENSITY_KEY) setDensityState(readDensity())
      if (e.key === PAGE_WIDTH_KEY) setPageWidthState(readPageWidth())
      if (e.key === JOB_VIEW_KEY) setJobViewState(readJobView())
      if (e.key === CUSTOMER_VIEW_KEY) setCustomerViewState(readCustomerView())
      if (e.key === ESTIMATE_VIEW_KEY) setEstimateViewState(readEstimateView())
      if (e.key === FOLDER_LAYOUT_KEY) setFolderLayoutState(readFolderLayout())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <ThemeContext.Provider value={{
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
      density,
      setDensity,
      pageWidth,
      setPageWidth,
      jobView,
      setJobView,
      customerView,
      setCustomerView,
      estimateView,
      setEstimateView,
      folderLayout,
      setFolderLayout,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * useTheme — read/set the current layout theme + chrome color. Falls back
 * to safe no-op defaults if used outside the provider so nothing crashes.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    return {
      theme: 'classic',
      setTheme: () => {},
      chromeColor: DEFAULT_CHROME,
      setChromeColor: () => {},
      accentColor: DEFAULT_ACCENT,
      setAccentColor: () => {},
      uiFont: DEFAULT_UI_FONT,
      setUiFont: () => {},
      textScale: DEFAULT_TEXT_SCALE,
      setTextScale: () => {},
      density: 'comfortable',
      setDensity: () => {},
      pageWidth: 'centered',
      setPageWidth: () => {},
      jobView: 'files',
      setJobView: () => {},
      customerView: 'files',
      setCustomerView: () => {},
      estimateView: 'files',
      setEstimateView: () => {},
      folderLayout: 'cabinet',
      setFolderLayout: () => {},
    }
  }
  return ctx
}
