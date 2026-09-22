import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import { betaApply, getBetaStatus, getSignupStatus, listPublicTrades, tenantSignup } from '@/lib/signup'
import { Turnstile } from '@/components/Turnstile'
import { AuthIntroBlueprint } from '@/pages/AuthIntro'

/**
 * app.crewbarn.com/beta — invite only. The full-screen CrewBarn hero with
 * one small box: enter the invite code Patrick handed out (or arrive with
 * ?invite=CODE). A live code opens the sign-up form right here — company,
 * trade, crew emails, password — and creates the workspace. No code?
 * "Ask for one" opens the short application instead.
 */

const EMPLOYEES = [
  { v: '1', l: 'Just me' },
  { v: '2-5', l: '2–5' },
  { v: '6-10', l: '6–10' },
  { v: '11-25', l: '11–25' },
  { v: '26+', l: '26+' },
]

const field = 'mt-1 w-full rounded-lg border border-white/15 bg-white/[.06] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400'
const label = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-400'

export function BetaApplyPage() {
  const [params] = useSearchParams()
  const [code, setCode] = useState(params.get('invite') ?? '')
  const [checking, setChecking] = useState<string | null>(params.get('invite'))
  const [mode, setMode] = useState<'code' | 'signup' | 'apply' | 'sent' | 'applied'>('code')
  const [codeErr, setCodeErr] = useState<string | null>(null)
  const tradesQ = useQuery({ queryKey: ['public', 'trades'], queryFn: () => listPublicTrades() })
  const trades = tradesQ.data?.data ?? []
  const betaQ = useQuery({ queryKey: ['public', 'beta-status'], queryFn: () => getBetaStatus() })
  const beta = betaQ.data?.data
  const inviteQ = useQuery({
    queryKey: ['public', 'signup-status', checking],
    queryFn: () => getSignupStatus(checking),
    enabled: !!checking,
  })
  const invite = inviteQ.data?.data.invite ?? null

  // form state (shared by sign-up and apply)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [company, setCompany] = useState('')
  const [trade, setTrade] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [count, setCount] = useState('')
  const [crew, setCrew] = useState('')
  const [software, setSoftware] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [terms, setTerms] = useState(false)
  // Bot check — only rendered when the API hands us a site key.
  const [botToken, setBotToken] = useState<string | null>(null)
  const siteKey = betaQ.data?.data.turnstile_site_key ?? null
  const botOk = !siteKey || !!botToken
  const pwMismatch = password2.length > 0 && password2 !== password
  const [err, setErr] = useState<string | null>(null)
  const crewEmails = crew.split(/[\s,;]+/).map((s) => s.trim()).filter((s) => s.includes('@')).slice(0, 25)

  useEffect(() => {
    if (!checking || !inviteQ.data) return
    if (invite?.valid) {
      setCodeErr(null)
      if (invite.business_name && !company) setCompany(invite.business_name)
      if (invite.email && !email) setEmail(invite.email)
      if (invite.trade && !trade) setTrade(invite.trade)
      if (invite.first_name && !firstName) setFirstName(invite.first_name)
      if (invite.last_name && !lastName) setLastName(invite.last_name)
      if (invite.phone && !phone) setPhone(invite.phone)
      setMode('signup')
    } else {
      setCodeErr(invite?.reason ?? 'That code isn’t valid.')
      setChecking(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteQ.data])

  const signup = useMutation({
    mutationFn: () =>
      tenantSignup({
        company_name: company.trim(),
        trade,
        applicant_type: 'trade',
        accepted_terms: terms,
        owner_first_name: firstName.trim(),
        owner_last_name: lastName.trim(),
        owner_email: email.trim(),
        owner_phone: phone.trim() || undefined,
        password,
        invite_token: checking ?? undefined,
        employees_count: count || undefined,
        employee_emails: crewEmails,
        turnstile_token: botToken ?? undefined,
      }),
    onSuccess: () => { setErr(null); setMode('sent') },
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Something went wrong — try again.'),
  })
  const apply = useMutation({
    mutationFn: () =>
      betaApply({
        contact_name: `${firstName.trim()} ${lastName.trim()}`.trim(), business_name: company.trim(), trade: trade || undefined, email: email.trim(), phone: phone.trim() || undefined,
        employees_count: count, employee_emails: crewEmails, current_software: software.trim() || undefined, source: 'beta_page',
        turnstile_token: botToken ?? undefined,
      }),
    onSuccess: () => { setErr(null); setMode('applied') },
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Something went wrong — try again.'),
  })

  const canSignup = company.trim() && firstName.trim() && lastName.trim() && trade && email.trim() && phone.trim() && count && password.length >= 10 && password2 === password && terms && botOk && !signup.isPending
  const canApply = firstName.trim() && lastName.trim() && company.trim() && trade && email.trim() && phone.trim() && count && botOk && !apply.isPending

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0B1120]">
      <AuthIntroBlueprint />
      {/* The box sits low so the mark and the typed word stay clear. */}
      <div className="absolute inset-0 flex items-end justify-center overflow-y-auto px-4 pb-8 pt-8 sm:pb-12">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/80 p-5 text-white shadow-2xl backdrop-blur-md">
          {mode === 'code' && (
            <form onSubmit={(e) => { e.preventDefault(); const m = code.match(/inv_[A-Za-z0-9]+/); if (m) { setCode(m[0]); setCodeErr(null); setChecking(m[0]) } else if (code.trim()) { setCodeErr('Codes start with inv_ — paste the whole thing.') } }}>
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-400">Beta · invite only</div>
              <h1 className="mt-1 text-lg font-bold">Have an invite code?</h1>
              <div className="mt-3 flex gap-2">
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="inv_…" autoComplete="off" spellCheck={false} className={`${field} mt-0 font-mono`} />
                <button type="submit" disabled={!code.trim() || (!!checking && inviteQ.isLoading)} className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50">
                  {checking && inviteQ.isLoading ? 'Checking…' : 'Continue'}
                </button>
              </div>
              {codeErr && <p className="mt-2 text-xs text-red-300">{codeErr}</p>}
              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                <button type="button" onClick={() => { setMode('apply'); setErr(null) }} className="font-semibold text-slate-200 hover:underline">No code? Ask for one →</button>
                <Link to="/login" className="hover:underline">Sign in</Link>
              </div>
              {beta && <p className="mt-3 text-[11px] text-slate-500">Free CrewBarn for life for the first {beta.spots} people who test the app · {beta.left} spot{beta.left === 1 ? '' : 's'} left</p>}
            </form>
          )}

          {mode === 'signup' && (
            <form onSubmit={(e) => { e.preventDefault(); if (canSignup) signup.mutate() }} className="space-y-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-400">You're in</div>
                <h1 className="mt-1 text-lg font-bold">Set up {company.trim() || 'your company'} on CrewBarn</h1>
                <p className="mt-1 text-[11px] text-slate-500">Everything except crew emails is required.</p>
                <p className="mt-1 text-xs text-slate-400">Free for life for helping us test — you bring your own provider keys. Your crew get phone-app logins as soon as you confirm your email.{invite?.expires_at ? ` Code expires ${new Date(invite.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.` : ''}</p>
              </div>
              {err && <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">{err}</div>}
              <label className={label}>Company name<input value={company} onChange={(e) => setCompany(e.target.value)} className={field} required /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}>First name<input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={field} autoComplete="given-name" required /></label>
                <label className={label}>Last name<input value={lastName} onChange={(e) => setLastName(e.target.value)} className={field} autoComplete="family-name" required /></label>
              </div>
              <label className={label}>Trade
                <select value={trade} onChange={(e) => setTrade(e.target.value)} className={field} required>
                  <option value="" className="text-slate-900">{tradesQ.isLoading ? 'Loading…' : 'Pick your trade'}</option>
                  {trades.map((t) => <option key={t.slug} value={t.slug} className="text-slate-900">{t.name}</option>)}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} required /></label>
                <label className={label}>Phone<input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={field} autoComplete="tel" required /></label>
              </div>
              <div>
                <div className={label}>People in the field or office</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {EMPLOYEES.map((o) => <button key={o.v} type="button" onClick={() => setCount(o.v)} className={`rounded-full border px-2.5 py-1 text-xs ${count === o.v ? 'border-amber-400 bg-amber-400/15 font-semibold text-amber-200' : 'border-white/15 text-slate-300 hover:border-white/30'}`}>{o.l}</button>)}
                </div>
              </div>
              <label className={label}>Crew emails — they get the phone app (optional)
                <textarea value={crew} onChange={(e) => setCrew(e.target.value)} rows={2} placeholder={'tech1@company.com, tech2@company.com'} className={field} />
                {crewEmails.length > 0 && <span className="mt-1 block text-[11px] font-normal normal-case text-slate-400">{crewEmails.length} will be invited.</span>}
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} autoComplete="new-password" required /></label>
                <label className={label}>Confirm password<input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} className={`${field} ${pwMismatch ? 'border-red-400' : ''}`} autoComplete="new-password" required /></label>
              </div>
              <p className={`-mt-1 text-[11px] ${pwMismatch ? 'text-red-300' : 'text-slate-500'}`}>{pwMismatch ? "Passwords don't match." : '10+ characters, upper and lower case, a number.'}</p>
              <label className="flex items-start gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-500" />
                <span>I agree to the <a href="https://crewbarn.com/terms" target="_blank" rel="noreferrer" className="underline">terms of service</a>.</span>
              </label>
              {siteKey && <Turnstile siteKey={siteKey} onToken={setBotToken} theme="dark" />}
              <button type="submit" disabled={!canSignup} className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50">{signup.isPending ? 'Creating your workspace…' : 'Create my CrewBarn'}</button>
            </form>
          )}

          {mode === 'apply' && (
            <form onSubmit={(e) => { e.preventDefault(); if (canApply) apply.mutate() }} className="space-y-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-400">Ask for an invite</div>
                <h1 className="mt-1 text-lg font-bold">Tell us about your company</h1>
                <p className="mt-1 text-xs text-slate-400">We need {beta?.spots ?? 10} people to run the Android app for two weeks. In return: CrewBarn free for life, bring your own provider keys.{beta && !beta.open ? ' The beta is full right now — leave your details and you’re first in line.' : ''}</p>
              </div>
              {err && <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">{err}</div>}
              <label className={label}>Company name<input value={company} onChange={(e) => setCompany(e.target.value)} className={field} required /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}>First name<input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={field} autoComplete="given-name" required /></label>
                <label className={label}>Last name<input value={lastName} onChange={(e) => setLastName(e.target.value)} className={field} autoComplete="family-name" required /></label>
              </div>
              <label className={label}>Trade
                <select value={trade} onChange={(e) => setTrade(e.target.value)} className={field} required>
                  <option value="" className="text-slate-900">{tradesQ.isLoading ? 'Loading…' : 'Pick your trade'}</option>
                  {trades.map((t) => <option key={t.slug} value={t.slug} className="text-slate-900">{t.name}</option>)}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} required /></label>
                <label className={label}>Phone<input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={field} autoComplete="tel" required /></label>
              </div>
              <div>
                <div className={label}>People in the field or office</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {EMPLOYEES.map((o) => <button key={o.v} type="button" onClick={() => setCount(o.v)} className={`rounded-full border px-2.5 py-1 text-xs ${count === o.v ? 'border-amber-400 bg-amber-400/15 font-semibold text-amber-200' : 'border-white/15 text-slate-300 hover:border-white/30'}`}>{o.l}</button>)}
                </div>
              </div>
              <label className={label}>Crew emails (optional)<textarea value={crew} onChange={(e) => setCrew(e.target.value)} rows={2} placeholder={'tech1@company.com, tech2@company.com'} className={field} /></label>
              <label className={label}>What do you use today? (optional)<input value={software} onChange={(e) => setSoftware(e.target.value)} placeholder="Paper, Jobber, Service Fusion…" className={field} /></label>
              {siteKey && <Turnstile siteKey={siteKey} onToken={setBotToken} theme="dark" />}
              <button type="submit" disabled={!canApply} className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50">{apply.isPending ? 'Sending…' : beta && !beta.open ? 'Put me on the list' : 'Ask for an invite'}</button>
              <button type="button" onClick={() => setMode('code')} className="w-full text-center text-xs text-slate-400 hover:underline">← I have a code</button>
            </form>
          )}

          {mode === 'sent' && (
            <div className="text-center">
              <div className="text-3xl">✉️</div>
              <h1 className="mt-2 text-lg font-bold">Check your email</h1>
              <p className="mt-1 text-sm text-slate-300">We sent a confirmation link to <strong>{email.trim()}</strong>. Click it to activate your workspace, then sign in at <strong>app.crewbarn.com</strong> — the full office app works in your browser right away.</p>
              <p className="mt-3 text-xs text-slate-500">The Android app is in Google's closed test: Patrick adds you and your crew to the tester list, and you'll each get a Google Play invite email with the install link. Use the web app until then.</p>
            </div>
          )}

          {mode === 'applied' && (
            <div className="text-center">
              <div className="text-3xl">👍</div>
              <h1 className="mt-2 text-lg font-bold">Got it — thanks</h1>
              <p className="mt-1 text-sm text-slate-300">Patrick will look it over and send an invite code to <strong>{email.trim()}</strong>.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
