import { useState } from 'react'
import type { ReactNode } from 'react'

/**
 * How to get a Google Maps key, one screen at a time.
 *
 * "Create an API key and restrict it" is not something anybody can act on
 * without knowing where to click, and Google's console is a maze. So each
 * step is a small drawing of the screen they will see: our own sketch, with
 * the real button names on it, not a copy of Google's artwork. Under it, one
 * short instruction and a link that opens that exact page in a new tab.
 *
 * Shown in the setup step and on Storage & maps. The APIs listed are exactly
 * the ones CrewBarn's maps call (lib/googleMaps loads the JavaScript API; the
 * address box uses Places (New); the key test and pins use the Geocoder; the
 * dispatch map uses the Directions and Distance Matrix services).
 */

export const MAPS_APIS: Array<{ name: string; why: string; older?: boolean }> = [
  { name: 'Maps JavaScript API', why: 'Draws every map in CrewBarn' },
  { name: 'Places API (New)', why: 'Address search as you type' },
  { name: 'Geocoding API', why: 'Turns an address into a map pin' },
  { name: 'Directions API', why: 'Driving routes on the dispatch map', older: true },
  { name: 'Distance Matrix API', why: 'Picks the closest tech on dispatch', older: true },
]

/**
 * The web addresses a CrewBarn map loads on: the work app, any CrewBarn
 * subdomain, and the shop TV wall board (crewbarn.tv, its own domain), plus
 * this copy of CrewBarn when it runs on a domain of its own.
 */
export function crewbarnMapReferrers(): string[] {
  const here = typeof window === 'undefined' ? '' : window.location.origin
  let host = ''
  try { host = here ? new URL(here).hostname : '' } catch { host = '' }
  const selfHosted = !!host && !/(^|\.)crewbarn\.(com|tv)$/.test(host) && host !== 'localhost'
  return Array.from(new Set([
    'https://app.crewbarn.com/*',
    'https://*.crewbarn.com/*',
    'https://crewbarn.tv/*',
    'https://*.crewbarn.tv/*',
    ...(selfHosted ? [`${here}/*`] : []),
  ]))
}

type Where = 'onboarding' | 'settings'

interface GuideStep {
  title: string
  link: { href: string; label: string }
  say: ReactNode
  screen: (props: { referrers: string[]; where: Where }) => ReactNode
}

const STEPS: GuideStep[] = [
  {
    title: 'Create a project',
    link: { href: 'https://console.cloud.google.com/projectselector2/home/dashboard', label: 'Open the project page' },
    say: (
      <>Sign in with the Google account you want billed. Press <b>Create project</b>, name it something you will
        recognise, like your company name and “Maps”, and press <b>Create</b>.</>
    ),
    screen: () => (
      <Screen url="console.cloud.google.com/projectselector2">
        <Bar>Google Cloud · <span className="rounded border border-slate-300 bg-white px-1.5">Select a project ▾</span></Bar>
        <div className="grid gap-2 p-3 sm:grid-cols-[1fr_1.2fr]">
          <Box title="Select a project">
            <Row muted>No projects yet</Row>
            <Btn lit>Create project</Btn>
          </Box>
          <Box title="New project">
            <Label>Project name</Label>
            <Input>Acme Services Maps</Input>
            <Btn lit>Create</Btn>
          </Box>
        </div>
      </Screen>
    ),
  },
  {
    title: 'Turn on billing',
    link: { href: 'https://console.cloud.google.com/project/_/billing', label: 'Open billing' },
    say: (
      <>Google asks for a card even though it gives you a free monthly allowance, and most shops stay inside it.
        Press <b>Link a billing account</b>, then set a budget alert under <b>Budgets &amp; alerts</b> so you hear
        about it long before any surprise.</>
    ),
    screen: () => (
      <Screen url="console.cloud.google.com/billing">
        <Bar>Billing</Bar>
        <div className="grid gap-2 p-3 sm:grid-cols-2">
          <Box title="This project has no billing account">
            <Btn lit>Link a billing account</Btn>
          </Box>
          <Box title="Budgets & alerts">
            <Row>Budget <b className="ml-auto">$20 / month</b></Row>
            <Row>Email me at <b className="ml-auto">50% · 90% · 100%</b></Row>
            <Btn>Create budget</Btn>
          </Box>
        </div>
      </Screen>
    ),
  },
  {
    title: 'Turn on the maps CrewBarn uses',
    link: { href: 'https://console.cloud.google.com/project/_/google/maps-apis/api-list', label: 'Open the API list' },
    say: (
      <>Find each of these in the list, open it and press <b>Enable</b>. Google marks the last two as older
        (“Legacy”). If a new project will not let you turn them on, maps, pins and address search still work; only
        the routes and the closest tech on the dispatch map wait.</>
    ),
    screen: () => (
      <Screen url="console.cloud.google.com/google/maps-apis/api-list">
        <Bar>Google Maps Platform · APIs &amp; Services</Bar>
        <div className="space-y-1.5 p-3">
          {MAPS_APIS.map((api) => (
            <div key={api.name} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px]">
              <span className="min-w-0 flex-1">
                <b className="text-navy-900">{api.name}</b>
                {api.older && <span className="ml-1.5 rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-500">Legacy</span>}
                <span className="block text-[11px] text-slate-500">{api.why}</span>
              </span>
              <Btn lit small>Enable</Btn>
            </div>
          ))}
        </div>
      </Screen>
    ),
  },
  {
    title: 'Create the key',
    link: { href: 'https://console.cloud.google.com/project/_/google/maps-apis/credentials', label: 'Open credentials' },
    say: (
      <>Press <b>Create credentials</b>, then <b>API key</b>. Google shows the new key, starting with AIza. Copy it,
        but do not paste it anywhere yet: lock it down first.</>
    ),
    screen: () => (
      <Screen url="console.cloud.google.com/google/maps-apis/credentials">
        <Bar>Credentials</Bar>
        <div className="grid gap-2 p-3 sm:grid-cols-2">
          <Box title="Credentials">
            <Btn lit>+ Create credentials ▾</Btn>
            <div className="rounded-md border border-slate-200 bg-white text-[12px] shadow-sm">
              <div className="border-b border-slate-100 bg-amber-50 px-2 py-1 font-semibold text-navy-900">API key</div>
              <div className="px-2 py-1 text-slate-500">OAuth client ID</div>
            </div>
          </Box>
          <Box title="API key created">
            <Input mono>AIzaSy•••••••••••••••••</Input>
            <Row muted>Copy it now</Row>
          </Box>
        </div>
      </Screen>
    ),
  },
  {
    title: 'Restrict it',
    link: { href: 'https://console.cloud.google.com/project/_/google/maps-apis/credentials', label: 'Open credentials' },
    say: (
      <>Open the key. Under <b>Application restrictions</b> pick <b>Websites</b> and press <b>Add</b> for each
        address below. Under <b>API restrictions</b> pick <b>Restrict key</b> and tick only the APIs from step 3.
        Then <b>Save</b>. This stops anybody else running up your bill with it.</>
    ),
    screen: ({ referrers }) => (
      <Screen url="console.cloud.google.com/apis/credentials/key">
        <Bar>Edit API key</Bar>
        <div className="grid gap-2 p-3 sm:grid-cols-2">
          <Box title="Application restrictions">
            <Radio on>Websites</Radio>
            <Radio>None</Radio>
            <div className="space-y-1">
              {referrers.map((r) => <div key={r} className="truncate rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px]">{r}</div>)}
              <Btn small>Add</Btn>
            </div>
          </Box>
          <Box title="API restrictions">
            <Radio on>Restrict key</Radio>
            {MAPS_APIS.map((api) => <Row key={api.name}><span className="text-emerald-600">☑</span> {api.name}</Row>)}
            <Btn lit>Save</Btn>
          </Box>
        </div>
      </Screen>
    ),
  },
  {
    title: 'Paste it into CrewBarn',
    link: { href: 'https://console.cloud.google.com/project/_/google/maps-apis/credentials', label: 'Copy the key from credentials' },
    say: (
      <>Back here, paste the key in the Google Maps key box and save. It is stored encrypted, and nobody else can
        see it.</>
    ),
    screen: ({ where }) => (
      <Screen url={where === 'settings' ? 'Storage & maps · Google Maps' : 'Setup · Where your photos and maps come from'} ours>
        <Bar ours>CrewBarn</Bar>
        <div className="p-3">
          <Box title={where === 'settings' ? 'Paste API key' : 'Google Maps key'}>
            <div className="flex gap-2">
              <Input mono>AIzaSy•••••••••••••••••</Input>
              <Btn lit>{where === 'settings' ? 'Save' : 'Save and carry on'}</Btn>
            </div>
            {where === 'settings' && <Row muted>Then press Test key: it finds an address on the map.</Row>}
          </Box>
        </div>
      </Screen>
    ),
  },
]

export function GoogleMapsKeyGuide({ where, referrers }: { where: Where; referrers?: string[] }) {
  const [index, setIndex] = useState(0)
  const step = STEPS[index]
  const list = referrers && referrers.length > 0 ? referrers : crewbarnMapReferrers()
  return (
    <section data-tour="gmaps-guide" className="rounded-2xl border border-slate-200 bg-[radial-gradient(120%_120%_at_0%_0%,#fff7e6_0%,#f8fafc_55%)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[15px] font-bold text-navy-900">How to get a Google Maps key</h4>
        <span className="text-xs text-slate-500">About ten minutes, on Google’s website</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Google Maps key steps" data-tour="gmaps-steps">
        {STEPS.map((s, k) => (
          <button
            key={s.title}
            type="button"
            role="tab"
            data-tour={`gmaps-tab-${k + 1}`}
            aria-selected={k === index}
            onClick={() => setIndex(k)}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
              k === index ? 'border-navy-900 bg-navy-900 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-amber-400'
            }`}
          >
            <span className="tabular-nums">{k + 1}</span> · {s.title}
          </button>
        ))}
      </div>

      <div data-tour="gmaps-panel" role="tabpanel" className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div data-tour="gmaps-screen" aria-hidden="true">{step.screen({ referrers: list, where })}</div>
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-amber-700">Step {index + 1} of {STEPS.length}</div>
            <div className="mt-1 text-base font-bold text-navy-900">{step.title}</div>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">{step.say}</p>
          </div>
          {index === 2 && (
            <ul className="space-y-0.5 text-[13px] text-slate-700">
              {MAPS_APIS.map((api) => <li key={api.name}>• <b>{api.name}</b> <span className="text-slate-500">· {api.why}</span></li>)}
            </ul>
          )}
          {index === 4 && (
            <div className="space-y-1" data-tour="gmaps-referrers">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Websites to add</div>
              {list.map((r) => (
                <div key={r} className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 font-mono text-[12px] text-navy-900 ring-1 ring-slate-200">{r}</code>
                  <button type="button" onClick={() => navigator.clipboard?.writeText(r)} className="shrink-0 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-navy-800 hover:border-amber-300">Copy</button>
                </div>
              ))}
              <p className="text-[12px] text-slate-500">Got your own website? Add it too, as https://yourshop.com/* and https://*.yourshop.com/*.</p>
            </div>
          )}
          <a
            data-tour="gmaps-link"
            href={step.link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800 hover:bg-amber-100"
          >
            {step.link.label} <span aria-hidden="true">↗</span>
          </a>
          <div className="mt-auto flex gap-2">
            <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-navy-800 disabled:opacity-40">Back</button>
            <button type="button" disabled={index === STEPS.length - 1} onClick={() => setIndex(index + 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-navy-800 disabled:opacity-40">Next step</button>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------- the drawn screens: labelled boxes, our own sketch ----------

function Screen({ url, ours = false, children }: { url: string; ours?: boolean; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-[0_8px_20px_rgba(11,19,36,.06)]">
      <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5">
        <span className="h-2 w-2 rounded-full bg-slate-300" /><span className="h-2 w-2 rounded-full bg-slate-300" /><span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className={`ml-2 min-w-0 flex-1 truncate rounded px-2 py-0.5 text-[11px] ${ours ? 'bg-amber-50 text-amber-900' : 'bg-white text-slate-500'}`}>{url}</span>
      </div>
      {children}
    </div>
  )
}
function Bar({ ours = false, children }: { ours?: boolean; children: ReactNode }) {
  return <div className={`flex items-center gap-1.5 border-b px-3 py-1.5 text-[12px] font-semibold ${ours ? 'border-amber-200 bg-navy-950 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{children}</div>
}
function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-1.5 rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-slate-500">{title}</div>
      {children}
    </div>
  )
}
function Row({ muted = false, children }: { muted?: boolean; children: ReactNode }) {
  return <div className={`flex items-center gap-1 text-[12px] ${muted ? 'text-slate-400' : 'text-slate-700'}`}>{children}</div>
}
function Label({ children }: { children: ReactNode }) {
  return <div className="text-[11px] text-slate-500">{children}</div>
}
function Input({ mono = false, children }: { mono?: boolean; children: ReactNode }) {
  return <div className={`min-w-0 flex-1 truncate rounded border border-slate-300 bg-white px-2 py-1 text-[12px] text-navy-900 ${mono ? 'font-mono' : ''}`}>{children}</div>
}
function Btn({ lit = false, small = false, children }: { lit?: boolean; small?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex w-fit shrink-0 items-center rounded-md font-bold ${small ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]'} ${
      lit ? 'bg-sky-600 text-white shadow-[0_0_0_3px_#fde68a]' : 'border border-slate-300 bg-white text-slate-700'
    }`}>{children}</span>
  )
}
function Radio({ on = false, children }: { on?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-slate-700">
      <span className={`flex h-3 w-3 items-center justify-center rounded-full border ${on ? 'border-sky-600' : 'border-slate-300'}`}>{on && <span className="h-1.5 w-1.5 rounded-full bg-sky-600" />}</span>
      {children}
    </div>
  )
}
