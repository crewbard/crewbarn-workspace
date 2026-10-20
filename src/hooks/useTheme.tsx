import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_CHROME, chromeHex } from '@/lib/chromeColors'
import { useAuth } from '@/hooks/useAuth'
import { apiRequest } from '@/lib/api'
import { ACCENT_COLORS, DEFAULT_ACCENT, accentVars } from '@/lib/accentColors'
import {
  DEFAULT_TEXT_SCALE,
  DEFAULT_UI_FONT,
  TEXT_SCALES,
  UI_FONTS,
  ensureUiFontLoaded,
  textScalePx,
  textScaleRatio,
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
 *   - 'focus' — Full-workspace rail shell with compact, task-first pages.
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
 * Layout follows the account override, then the company default. Existing
 * browser-local choices migrate once to the account override after sign-in.
 * Other appearance options remain browser-local.
 */
export type AppTheme = 'classic' | 'pro' | 'rail' | 'focus' | 'easy-side' | 'easy-top'
export type AppDensity = 'comfortable' | 'compact' | 'dense'
export type AppPageWidth = 'centered' | 'wide' | 'full'
export type JobViewPreference = 'workflow' | 'cards' | 'files' | 'compact'
export type CustomerViewPreference = 'relationship' | 'cards' | 'files' | 'compact'
export type EstimateViewPreference = 'workflow' | 'cards' | 'files' | 'compact'
/** How the "files" folder view is laid out (Jobs / Customers / Estimates). */
export type FolderLayout = 'cabinet' | 'tree' | 'accordion'

const THEME_KEY = 'crewbarn_theme'
const accountThemeKey = (accountId: string, tenantId: string) => `crewbarn_theme:${tenantId}:${accountId}`
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
// Focus is a separate workspace, not a preset that overwrites the other
// layouts' browsing choices. Keep its local presentation preferences apart.
const FOCUS_DENSITY_KEY = 'crewbarn:focus:density'
const FOCUS_PAGE_WIDTH_KEY = 'crewbarn:focus:page-width'
const FOCUS_JOB_VIEW_KEY = 'crewbarn:focus:job-view'
const FOCUS_CUSTOMER_VIEW_KEY = 'crewbarn:focus:customer-view'
const FOCUS_ESTIMATE_VIEW_KEY = 'crewbarn:focus:estimate-view'
const FOCUS_FOLDER_LAYOUT_KEY = 'crewbarn:focus:folder-layout'

interface ThemeContextValue {
  theme: AppTheme
  setTheme: (t: AppTheme) => void
  defaultTheme: AppTheme
  themeOverride: AppTheme | null
  appearanceLoading: boolean
  appearanceError: string | null
  clearThemeOverride: () => Promise<void>
  setDefaultTheme: (t: AppTheme) => Promise<void>
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
    if (value === 'rail' || value === 'focus' || value === 'easy-side' || value === 'easy-top') return value
    return value === 'pro' || value === 'command' || value === 'field' || value === 'studio'
      ? 'pro'
      : 'classic'
  } catch {
    return 'classic'
  }
}

const APP_THEMES: AppTheme[] = ['classic', 'pro', 'rail', 'focus', 'easy-side', 'easy-top']

function validTheme(value: unknown): AppTheme | null {
  return typeof value === 'string' && APP_THEMES.includes(value as AppTheme) ? value as AppTheme : null
}

interface AppearanceResponse {
  data: { default_theme: AppTheme; theme_override: AppTheme | null }
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

function readFocusDensity(): AppDensity {
  if (typeof window === 'undefined') return 'compact'
  try {
    const value = window.localStorage.getItem(FOCUS_DENSITY_KEY)
    return value === 'comfortable' || value === 'dense' ? value : 'compact'
  } catch {
    return 'compact'
  }
}

function readFocusPageWidth(): AppPageWidth {
  if (typeof window === 'undefined') return 'full'
  try {
    const value = window.localStorage.getItem(FOCUS_PAGE_WIDTH_KEY)
    return value === 'centered' || value === 'wide' ? value : 'full'
  } catch {
    return 'full'
  }
}

function readFocusJobView(): JobViewPreference {
  if (typeof window === 'undefined') return 'compact'
  try {
    const value = window.localStorage.getItem(FOCUS_JOB_VIEW_KEY)
    return value === 'cards' || value === 'files' ? value : 'compact'
  } catch {
    return 'compact'
  }
}

function readFocusCustomerView(): CustomerViewPreference {
  if (typeof window === 'undefined') return 'compact'
  try {
    const value = window.localStorage.getItem(FOCUS_CUSTOMER_VIEW_KEY)
    return value === 'cards' || value === 'files' ? value : 'compact'
  } catch {
    return 'compact'
  }
}

function readFocusEstimateView(): EstimateViewPreference {
  if (typeof window === 'undefined') return 'compact'
  try {
    const value = window.localStorage.getItem(FOCUS_ESTIMATE_VIEW_KEY)
    return value === 'cards' || value === 'files' ? value : 'compact'
  } catch {
    return 'compact'
  }
}

function readFocusFolderLayout(): FolderLayout {
  if (typeof window === 'undefined') return 'cabinet'
  try {
    const value = window.localStorage.getItem(FOCUS_FOLDER_LAYOUT_KEY)
    return value === 'tree' || value === 'accordion' ? value : 'cabinet'
  } catch {
    return 'cabinet'
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth()
  const [theme, setThemeState] = useState<AppTheme>(readTheme)
  const [defaultTheme, setDefaultThemeState] = useState<AppTheme>('classic')
  const [themeOverride, setThemeOverrideState] = useState<AppTheme | null>(null)
  const [appearanceLoading, setAppearanceLoading] = useState(false)
  const [appearanceError, setAppearanceError] = useState<string | null>(null)
  const requestVersion = useRef(0)
  const overrideSaveQueue = useRef<Promise<void>>(Promise.resolve())
  const appearanceIdentity = `${account?.tenant?.id ?? ''}:${account?.id ?? ''}`
  const appearanceIdentityRef = useRef(appearanceIdentity)
  useEffect(() => {
    appearanceIdentityRef.current = appearanceIdentity
  }, [appearanceIdentity])
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
  const [focusDensity, setFocusDensityState] = useState<AppDensity>(readFocusDensity)
  const [focusPageWidth, setFocusPageWidthState] = useState<AppPageWidth>(readFocusPageWidth)
  const [focusJobView, setFocusJobViewState] = useState<JobViewPreference>(readFocusJobView)
  const [focusCustomerView, setFocusCustomerViewState] = useState<CustomerViewPreference>(readFocusCustomerView)
  const [focusEstimateView, setFocusEstimateViewState] = useState<EstimateViewPreference>(readFocusEstimateView)
  const [focusFolderLayout, setFocusFolderLayoutState] = useState<FolderLayout>(readFocusFolderLayout)

  const saveOverride = (value: AppTheme | null): Promise<AppearanceResponse> => {
    const identity = appearanceIdentity
    const queued = overrideSaveQueue.current.then(() => {
      if (identity !== appearanceIdentityRef.current) throw new Error('Account changed before appearance could be saved.')
      return apiRequest<AppearanceResponse>('/v1/appearance', {
        method: 'PATCH', body: { theme_override: value },
      })
    })
    overrideSaveQueue.current = queued.then(() => undefined, () => undefined)
    return queued
  }

  useEffect(() => {
    const version = ++requestVersion.current
    const tenantId = account?.tenant?.id
    if (!account || !tenantId) {
      setAppearanceLoading(false)
      setDefaultThemeState('classic')
      setThemeOverrideState(null)
      return
    }
    try {
      const cached = validTheme(window.localStorage.getItem(accountThemeKey(account.id, tenantId)))
      if (cached) setThemeState(cached)
    } catch { /* Browser storage is optional. */ }
    setAppearanceLoading(true)
    setAppearanceError(null)
    void (async () => {
      try {
        const response = await apiRequest<AppearanceResponse>('/v1/appearance')
        if (version !== requestVersion.current) return
        const company = validTheme(response.data.default_theme) ?? 'classic'
        let override = validTheme(response.data.theme_override)
        setDefaultThemeState(company)
        // The old key was shared by a browser. Claim it for the first signed-in
        // account, then remove it so a later account on that browser gets its
        // own setting instead of accidentally inheriting this one.
        const legacy = window.localStorage.getItem(THEME_KEY) === null ? null : readTheme()
        if (legacy && !override) {
          const migrated = await saveOverride(legacy)
          if (version !== requestVersion.current) return
          override = validTheme(migrated.data.theme_override)
        }
        if (legacy) window.localStorage.removeItem(THEME_KEY)
        setThemeOverrideState(override)
        setThemeState(override ?? company)
        window.localStorage.setItem(accountThemeKey(account.id, tenantId), override ?? company)
      } catch {
        if (version === requestVersion.current) setAppearanceError('Layout could not be loaded. Your browser choice is still available.')
      } finally {
        if (version === requestVersion.current) setAppearanceLoading(false)
      }
    })()
    return () => { requestVersion.current++ }
  }, [account?.id, account?.tenant?.id])

  const setTheme = (t: AppTheme) => {
    setThemeState(t)
    setThemeOverrideState(t)
    setAppearanceError(null)
    try {
      // Keep an account-specific browser fallback, and never share a newly
      // selected layout with another staff member using the same browser.
      window.localStorage.setItem(account?.tenant ? accountThemeKey(account.id, account.tenant.id) : THEME_KEY, t)
    } catch {
      /* private mode / quota — non-fatal, state still updates in-memory */
    }
    if (account?.tenant) {
      const version = ++requestVersion.current
      setAppearanceLoading(false)
      void saveOverride(t).then((response) => {
        if (version === requestVersion.current) setDefaultThemeState(validTheme(response.data.default_theme) ?? 'classic')
      }).catch(() => {
        if (version === requestVersion.current) setAppearanceError('Layout could not be saved to your account. It is saved in this browser for now.')
      })
    }
  }

  const clearThemeOverride = async () => {
    if (!account?.tenant) return
    const response = await saveOverride(null)
    ++requestVersion.current
    window.localStorage.removeItem(THEME_KEY)
    window.localStorage.setItem(accountThemeKey(account.id, account.tenant.id), validTheme(response.data.default_theme) ?? 'classic')
    setThemeOverrideState(null)
    setThemeState(validTheme(response.data.default_theme) ?? 'classic')
    setAppearanceError(null)
  }

  const setDefaultTheme = async (value: AppTheme) => {
    const response = await apiRequest<AppearanceResponse>('/v1/tenant-settings/appearance', {
      method: 'PATCH', body: { default_theme: value },
    })
    const company = validTheme(response.data.default_theme) ?? 'classic'
    setDefaultThemeState(company)
    if (!themeOverride) setThemeState(company)
    setAppearanceError(null)
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
    if (theme === 'focus') {
      setFocusDensityState(value)
      try { window.localStorage.setItem(FOCUS_DENSITY_KEY, value) } catch { /* non-fatal */ }
      return
    }
    setDensityState(value)
    try {
      window.localStorage.setItem(DENSITY_KEY, value)
    } catch {
      /* non-fatal */
    }
  }

  const setPageWidth = (value: AppPageWidth) => {
    if (theme === 'focus') {
      setFocusPageWidthState(value)
      try { window.localStorage.setItem(FOCUS_PAGE_WIDTH_KEY, value) } catch { /* non-fatal */ }
      return
    }
    setPageWidthState(value)
    try {
      window.localStorage.setItem(PAGE_WIDTH_KEY, value)
    } catch {
      /* non-fatal */
    }
  }

  const setJobView = (value: JobViewPreference) => {
    if (theme === 'focus') {
      setFocusJobViewState(value)
      try { window.localStorage.setItem(FOCUS_JOB_VIEW_KEY, value) } catch { /* non-fatal */ }
      return
    }
    setJobViewState(value)
    try {
      window.localStorage.setItem(JOB_VIEW_KEY, value)
      window.localStorage.setItem('crewbarn:job-filing-view', String(value === 'files'))
    } catch {
      /* non-fatal */
    }
  }

  const setCustomerView = (value: CustomerViewPreference) => {
    if (theme === 'focus') {
      setFocusCustomerViewState(value)
      try { window.localStorage.setItem(FOCUS_CUSTOMER_VIEW_KEY, value) } catch { /* non-fatal */ }
      return
    }
    setCustomerViewState(value)
    try {
      window.localStorage.setItem(CUSTOMER_VIEW_KEY, value)
      window.localStorage.setItem('crewbarn:customer-filing-view', String(value === 'files'))
    } catch {
      /* non-fatal */
    }
  }

  const setEstimateView = (value: EstimateViewPreference) => {
    if (theme === 'focus') {
      setFocusEstimateViewState(value)
      try { window.localStorage.setItem(FOCUS_ESTIMATE_VIEW_KEY, value) } catch { /* non-fatal */ }
      return
    }
    setEstimateViewState(value)
    try {
      window.localStorage.setItem(ESTIMATE_VIEW_KEY, value)
      window.localStorage.setItem('crewbarn:estimate-filing-view', String(value === 'files'))
    } catch {
      /* non-fatal */
    }
  }

  const setFolderLayout = (value: FolderLayout) => {
    if (theme === 'focus') {
      setFocusFolderLayoutState(value)
      try { window.localStorage.setItem(FOCUS_FOLDER_LAYOUT_KEY, value) } catch { /* non-fatal */ }
      return
    }
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
    document.documentElement.dataset.density = theme === 'focus' ? focusDensity : density
  }, [theme, density, focusDensity])

  useLayoutEffect(() => {
    document.documentElement.dataset.pageWidth = theme === 'focus' ? focusPageWidth : pageWidth
  }, [theme, pageWidth, focusPageWidth])

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
    // Pixel-sized text cannot follow --ui-base. index.css restates those
    // sizes as a multiple of this, so one choice moves all of the text
    // rather than only the part that happens to be measured in rem.
    document.documentElement.style.setProperty('--ui-ratio', String(textScaleRatio(textScale)))
  }, [textScale])

  // Cross-tab sync — flipping theme or color in one tab updates the others.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === THEME_KEY && e.newValue) setThemeState(readTheme())
      if (account?.tenant && e.key === accountThemeKey(account.id, account.tenant.id)) {
        const next = validTheme(e.newValue)
        if (next) setThemeState(next)
      }
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
      if (e.key === FOCUS_DENSITY_KEY) setFocusDensityState(readFocusDensity())
      if (e.key === FOCUS_PAGE_WIDTH_KEY) setFocusPageWidthState(readFocusPageWidth())
      if (e.key === FOCUS_JOB_VIEW_KEY) setFocusJobViewState(readFocusJobView())
      if (e.key === FOCUS_CUSTOMER_VIEW_KEY) setFocusCustomerViewState(readFocusCustomerView())
      if (e.key === FOCUS_ESTIMATE_VIEW_KEY) setFocusEstimateViewState(readFocusEstimateView())
      if (e.key === FOCUS_FOLDER_LAYOUT_KEY) setFocusFolderLayoutState(readFocusFolderLayout())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [account?.id, account?.tenant?.id])

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme,
      defaultTheme,
      themeOverride,
      appearanceLoading,
      appearanceError,
      clearThemeOverride,
      setDefaultTheme,
      chromeColor,
      setChromeColor,
      accentColor,
      setAccentColor,
      uiFont,
      setUiFont,
      textScale,
      setTextScale,
      density: theme === 'focus' ? focusDensity : density,
      setDensity,
      pageWidth: theme === 'focus' ? focusPageWidth : pageWidth,
      setPageWidth,
      jobView: theme === 'focus' ? focusJobView : jobView,
      setJobView,
      customerView: theme === 'focus' ? focusCustomerView : customerView,
      setCustomerView,
      estimateView: theme === 'focus' ? focusEstimateView : estimateView,
      setEstimateView,
      folderLayout: theme === 'focus' ? focusFolderLayout : folderLayout,
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
      defaultTheme: 'classic',
      themeOverride: null,
      appearanceLoading: false,
      appearanceError: null,
      clearThemeOverride: async () => {},
      setDefaultTheme: async () => {},
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
