import { useState } from 'react'
import { Link } from 'react-router-dom'

/**
 * connect.crewbarn.com/download — the open-source project's front door.
 *
 * Public on purpose: nothing here is secret, and somebody deciding whether to
 * self-host should not have to sign in to read about it. Everything that
 * manages an account — seats, provider keys, tokens — stays behind sign-in.
 *
 * The open-source repo is the WORK DASHBOARD, not this settings console. What
 * people want to self-host is the app they work in.
 *
 * Carried over from the hand-written console when connect moved to the
 * generated app, so the link that has been published keeps working.
 */

const REPO = 'https://github.com/crewbard/crewbarn-workspace'

export function DownloadPage() {
  const cmd = `git clone ${REPO}.git\ncd crewbarn-workspace\nnpm install\nnpm run build`

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto max-w-[940px] px-6 py-10">
        <div className="flex items-start gap-4">
          <div className="grow">
            <h1 className="text-2xl font-bold text-navy-900">Download CrewBarn</h1>
            <p className="mt-2 max-w-[70ch] text-[15px] leading-relaxed text-slate-600">
              The work dashboard — jobs, customers, scheduling, dispatch, estimates, invoicing and the Tool Shed — is
              open source (MIT). Run it on your own domain, brand it, change it. The CrewBarn service behind it (the
              API, your data, billing and the provider integrations) is not open source; your copy signs in to your
              CrewBarn account.
            </p>
          </div>
          <Link
            to="/"
            className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Sign in
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Card title="Ready-to-host build">
            <p className="text-slate-600">
              A zip of the built site. Unzip it onto any static host — Cloudflare Pages, Netlify, Vercel, S3, or a
              folder behind nginx — and open it.
            </p>
            <a
              href={`${REPO}/releases/latest`}
              className="mt-4 inline-block rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600"
            >
              Latest release ↗
            </a>
            <p className="mt-2 text-xs text-slate-500">
              No Node or build step needed. Unknown paths must fall back to <code>index.html</code> (the included{' '}
              <code>_redirects</code> does that on Cloudflare and Netlify).
            </p>
          </Card>

          <Card title="Source">
            <p className="text-slate-600">
              Clone it, change what you like, build it yourself. Vite + React + TypeScript; one optional setting (
              <code>VITE_API_URL</code>). The repo is generated from CrewBarn's source on each release, so pull requests
              there are overwritten.
            </p>
            <div className="mt-4 flex gap-2">
              <a
                href={REPO}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                GitHub ↗
              </a>
              <a
                href={`${REPO}/archive/refs/heads/main.zip`}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Source zip
              </a>
            </div>
            <div className="mt-4 flex items-start gap-2">
              <pre className="flex-1 overflow-x-auto rounded-md bg-slate-950 px-3 py-2 font-mono text-[11px] leading-5 text-slate-100">
                {cmd}
              </pre>
              <CopyButton text={cmd} />
            </div>
          </Card>
        </div>

        <div className="mt-5">
          <Card title="Then, on your domain">
            <ol className="list-decimal space-y-2 pl-5 text-slate-700">
              <li>
                Put the build at the domain you'll use, e.g. <code>sub.yourcompany.com</code> or{' '}
                <code>www.yourcompany.com</code>.
              </li>
              <li>
                Here, under{' '}
                <Link to="/tool-shed/self-hosted" className="font-semibold text-amber-700 hover:underline">
                  Self-hosted domains
                </Link>
                , activate that domain and copy the token (shown once).
              </li>
              <li>
                Open your site and paste the token on its setup page. Everyone signs in with their normal CrewBarn
                logins; techs use the phone app.
              </li>
            </ol>
            <p className="mt-3 text-xs text-slate-500">
              The token follows your{' '}
              <Link to="/tool-shed/subscription" className="font-semibold text-slate-700 hover:underline">
                subscription
              </Link>{' '}
              — free is read-only — and rotates itself monthly. Provider keys are set here, never on your server; your
              own phone, payment or email integrations use{' '}
              <Link to="/tool-shed/api-tokens" className="font-semibold text-slate-700 hover:underline">
                API tokens
              </Link>
              .
            </p>
          </Card>
        </div>

        <div className="mt-6 grid gap-3 text-xs text-slate-600 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-sm font-bold text-emerald-900">Open source (MIT)</div>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>The work dashboard — jobs, customers, scheduling, dispatch, estimates, invoicing, inventory</li>
              <li>The Tool Shed's work settings, and the API client it all uses</li>
              <li>Your changes to it — keep them, share them, whatever you like</li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-bold text-slate-900">CrewBarn service (not open source)</div>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>The API and your data — the dashboard is only a client</li>
              <li>Provider integrations and the keys that drive them</li>
              <li>CBI — CrewBarn Intelligence</li>
              <li>Billing, seats, the app on the stores</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-bold text-navy-900">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed">{children}</div>
    </div>
  )
}

/** Copy, and say so — a button that gives no sign it worked gets pressed twice. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1600)
        })
      }}
      className="shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
