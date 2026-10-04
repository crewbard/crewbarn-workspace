import { sectionForRoute } from '@/connect/sections'

/**
 * What belongs in the workspace, and what belongs on Connect.
 *
 * The plan: company settings live on connect.crewbarn.com, and the workspace
 * gets back to being the place work happens. A hosted workspace can switch
 * them into its own Tool Shed as well — some shops are run by one person who
 * does not want a second site open — but the default is off, because
 * defaulting to on would ship the de-bloat to nobody.
 *
 * Nothing is removed by any of this. Every route still resolves, every deep
 * link and bookmark still works, and the API still serves them. This decides
 * what is listed in a menu, which is the thing that was actually bloated.
 */

/** Where the settings console lives. */
export const CONNECT_URL = import.meta.env.VITE_CONNECT_URL || 'https://connect.crewbarn.com'

/** Where the work happens. */
export const APP_URL = import.meta.env.VITE_APP_URL || 'https://app.crewbarn.com'

/**
 * A link to something that only exists in the workspace.
 *
 * Settings pages are served from both hosts, so a relative link to a
 * workspace-only page works from the app and lands on nothing from
 * Connect — the employee portal is not built into the console, so
 * connect.crewbarn.com/me is a route that resolves to no page. Absolute
 * when we are on Connect, untouched otherwise, so ordinary in-app
 * navigation stays a client-side route.
 */
export function workspaceHref(path: string): string {
  return onConnect() ? `${APP_URL}${path}` : path
}

/**
 * Settings that stay in the workspace no matter what.
 *
 * Both earn it the same way: they are saved per browser, not per company.
 *
 * App layout is a personal preference about the screen someone is looking
 * at. Anyone who works in the workspace gets to pick the shell that suits
 * them, which means the control has to be in the workspace — on Connect it
 * would set the layout of whichever browser the settings console happened
 * to be open in.
 *
 * The label printer is the same rule with a plug attached, and stricter
 * about it. Pairing writes a token to localStorage, and localStorage
 * belongs to an origin: paired on Connect, the token is saved on Connect,
 * and the Label Studio in the workspace reads its own empty storage and
 * falls back to the Windows print window as though no bridge existed. A
 * printer is a physical object on one desk; it is set up at that desk, in
 * the place the printing happens.
 */
export const ALWAYS_IN_WORKSPACE = ['/tool-shed/appearance', '/tool-shed/label-printer']

/**
 * Is this route a company setting — one whose home is Connect?
 *
 * Read from the Connect section map rather than a second list, so the two
 * cannot disagree. A route the map does not know is a work surface
 * (inventory, catalogs, assets, vendors, purchase orders, company files) and
 * stays put.
 */
export function isCompanySetting(route: string): boolean {
  if (ALWAYS_IN_WORKSPACE.includes(route)) return false
  return sectionForRoute(route) !== null
}

/**
 * Are we being served BY the settings console?
 *
 * The generated connect app has the same Tool Shed in it, and there the
 * settings are the entire point — so the switch must not hide them from the
 * one place that exists to show them.
 */
export function onConnect(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname.toLowerCase()
  return host === 'connect.crewbarn.com' || host.includes('crewbarn-connect') || host.includes('crewbarn-console')
}
